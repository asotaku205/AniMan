import { GoogleGenAI } from "@google/genai";
import type { NovelAiTask } from "./novel-ai.service.js";

/**
 * Backend text cho Novel AI: tách việc gọi model ra khỏi NovelAiService
 * để service chỉ giữ dựng prompt, kiểm tra JSON, timeout và trả lỗi.
 * Service thử từng model trong modelsFor(task) theo thứ tự, giống vòng
 * thử model cũ của Gemini: model trả về JSON không đạt vẫn được thử
 * model tiếp theo.
 *
 * 06/11/2026: backend mặc định là Cloudflare Workers AI, vì cuộc gọi
 * Gemini từ máy Sơn treo đủ 60s không trả về (17:53 30/10), trong khi
 * api.cloudflare.com gọi được từ cùng máy đó (ảnh mẫu trả về 30/10).
 * Thử thật 06/11/2026 với prompt server và cảnh thật: llama-3.1-8b
 * tóm tắt tốt (0,9s, 5,8 neuron) nhưng tách cảnh dài chế 3/14 câu
 * thoại; llama-3.3-70b trích đúng 5/5 câu (29,8s, 279,5 neuron).
 * Vì vậy breakdown dùng 70B trước, 8B dự phòng; summarize/consistency
 * dùng 8B. Gemini giữ lại làm dự phòng, đổi bằng NOVEL_AI_PROVIDER.
 */

export interface NovelAiTextGenerateInput {
  systemInstruction: string;
  userPrompt: string;
  maxOutputTokens: number;
  task: NovelAiTask;
}

export interface NovelAiTextBackend {
  readonly name: string;
  modelsFor(task: NovelAiTask): string[];
  generateText(model: string, input: NovelAiTextGenerateInput): Promise<string>;
}

/** Model text Cloudflare cho Novel AI (đường REST /ai/run). */
export const CLOUDFLARE_NOVEL_BREAKDOWN_MODELS = [
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-3.1-8b-instruct",
] as const;

export const CLOUDFLARE_NOVEL_TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

const GEMINI_FALLBACK_MODELS = [
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
];

/**
 * JSON Schema cho breakdown, khớp đúng hình dạng parseBreakdown kiểm tra
 * (pages -> layout/panels -> prompt/sceneType/dialogue/note). Gửi kèm
 * response_format để Workers AI ép JSON Mode, thay vì chỉ dặn bằng prompt.
 */
export const NOVEL_BREAKDOWN_JSON_SCHEMA = {
  type: "object",
  properties: {
    pages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          layout: {
            type: "string",
            enum: ["classic-5", "action-4", "splash-3", "manga-6"],
          },
          panels: {
            type: "array",
            items: {
              type: "object",
              properties: {
                prompt: { type: "string" },
                sceneType: {
                  type: "string",
                  enum: ["action", "dialogue", "landscape", "closeup", "wide"],
                },
                dialogue: { type: "array", items: { type: "string" } },
                note: { type: "string" },
              },
              required: ["prompt", "sceneType", "dialogue", "note"],
              additionalProperties: false,
            },
          },
        },
        required: ["layout", "panels"],
        additionalProperties: false,
      },
    },
  },
  required: ["pages"],
  additionalProperties: false,
} as const;

export interface CloudflareNovelAiConfig {
  accountId: string;
  token: string;
}

export interface GeminiNovelAiConfig {
  apiKey: string;
  preferredModel?: string;
}

function cloudflareErrorMessage(bodyText: string): string {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    const errors = (parsed as { errors?: { message?: unknown }[] }).errors;
    const first = errors?.[0]?.message;
    if (typeof first === "string" && first.length > 0) {
      return first.slice(0, 300);
    }
  } catch {
    // Bỏ qua: dùng thông báo chung bên dưới.
  }
  return "";
}

function extractCloudflareText(bodyText: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error("Cloudflare returned a non-JSON response");
  }
  const result = (parsed as { result?: unknown }).result;
  if (typeof result !== "object" || result === null) {
    throw new Error("Cloudflare returned an unexpected response shape");
  }
  const choices = (result as { choices?: unknown }).choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const content = (choices[0] as { message?: { content?: unknown } }).message
      ?.content;
    if (typeof content === "string" && content.trim().length > 0) {
      return content;
    }
  }
  const response = (result as { response?: unknown }).response;
  if (typeof response === "string" && response.trim().length > 0) {
    return response;
  }
  const success = (parsed as { success?: unknown }).success;
  if (success === false) {
    throw new Error(
      cloudflareErrorMessage(bodyText) || "Cloudflare request failed",
    );
  }
  throw new Error("Cloudflare returned an empty text response");
}

export function createCloudflareNovelAiBackend(
  config: CloudflareNovelAiConfig,
): NovelAiTextBackend {
  if (config.accountId.trim().length === 0) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is required for NovelAiService");
  }
  if (config.token.trim().length === 0) {
    throw new Error("CLOUDFLARE_API_TOKEN is required for NovelAiService");
  }

  return {
    name: "cloudflare",
    modelsFor(task: NovelAiTask): string[] {
      return task === "breakdown"
        ? [...CLOUDFLARE_NOVEL_BREAKDOWN_MODELS]
        : [CLOUDFLARE_NOVEL_TEXT_MODEL];
    },
    async generateText(
      model: string,
      input: NovelAiTextGenerateInput,
    ): Promise<string> {
      const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`;
      const body: Record<string, unknown> = {
        messages: [
          { role: "system", content: input.systemInstruction },
          { role: "user", content: input.userPrompt },
        ],
        max_tokens: input.maxOutputTokens,
      };
      // Breakdown ép JSON Schema cho đúng hình dạng; 2 task còn lại
      // chỉ cần JSON object vì output là một object đơn giản.
      body.response_format =
        input.task === "breakdown"
          ? {
              type: "json_schema",
              json_schema: {
                name: "novel_breakdown",
                strict: true,
                schema: NOVEL_BREAKDOWN_JSON_SCHEMA,
              },
            }
          : { type: "json_object" };
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      } catch (error) {
        throw new Error(
          error instanceof Error
            ? `Cloudflare request failed: ${error.message}`
            : "Cloudflare request failed",
        );
      }
      const bodyText = await response.text();
      if (!response.ok) {
        const detail = cloudflareErrorMessage(bodyText);
        throw new Error(
          detail.length > 0
            ? `Cloudflare request failed (HTTP ${response.status}): ${detail}`
            : `Cloudflare request failed (HTTP ${response.status})`,
        );
      }
      return extractCloudflareText(bodyText);
    },
  };
}

export function createGeminiNovelAiBackend(
  config: GeminiNovelAiConfig,
): NovelAiTextBackend {
  if (!config.apiKey || config.apiKey.trim().length === 0) {
    throw new Error("GEMINI_API_KEY is required for NovelAiService");
  }
  const client = new GoogleGenAI({ apiKey: config.apiKey });
  const preferredModel = config.preferredModel;

  return {
    name: "gemini",
    modelsFor(): string[] {
      return Array.from(
        new Set(
          [preferredModel, ...GEMINI_FALLBACK_MODELS].filter(
            (m): m is string => typeof m === "string" && m.length > 0,
          ),
        ),
      );
    },
    async generateText(
      model: string,
      input: NovelAiTextGenerateInput,
    ): Promise<string> {
      const response = await client.models.generateContent({
        model,
        contents: input.userPrompt,
        config: {
          systemInstruction: input.systemInstruction,
          responseMimeType: "application/json",
          maxOutputTokens: input.maxOutputTokens,
        },
      });
      return response.text ?? "";
    },
  };
}
