import { GoogleGenAI } from "@google/genai";

/**
 * AI cho Novel Studio (N3): tóm tắt cảnh + kiểm tra nhất quán với sổ tay.
 *
 * Cùng triết lý như dịch thoại: kết quả là BẢN NHÁP, client hiển thị để
 * người dùng duyệt/sửa tay, không tự sửa văn bản. Cùng ngân sách Gemini
 * free tier với vẽ/dịch (rate limiter dùng chung ở controller).
 * An toàn: không nhận system prompt/model từ client; độ dài đầu vào bị
 * chặn cứng ở controller.
 */

export type NovelAiTask = "summarize" | "consistency";

export interface NovelAiInput {
  task: NovelAiTask;
  /** Nội dung cảnh (2 trang washi gộp). */
  text: string;
  /** Sổ tay dạng văn bản tự do (chỉ dùng cho task consistency). */
  bible?: string;
}

export interface NovelAiResult {
  summary?: string;
  issues?: string[];
  model: string;
}

const FALLBACK_MODELS = [
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
];

/** Dựng prompt — hàm thuần để kiểm thử được cấu trúc. */
export function buildNovelAiPrompt(input: NovelAiInput): {
  systemInstruction: string;
  userPrompt: string;
} {
  if (input.task === "summarize") {
    return {
      systemInstruction:
        "You summarize a novel scene in Vietnamese. Reply with JSON only: " +
        '{"summary": "..."}. The summary is 2-3 sentences, covers who did what and what changed, ' +
        "and never invents details that are not in the scene.",
      userPrompt: JSON.stringify({ sceneText: input.text }),
    };
  }
  return {
    systemInstruction:
      "You check a novel scene against its story bible in Vietnamese. Reply with JSON only: " +
      '{"issues": ["..."]}. Each issue is one short sentence naming the concrete contradiction ' +
      "(appearance, location, timeline, object, relationship) between the scene and the bible. " +
      "Only report contradictions actually supported by the given text; if none, return an empty list. " +
      "Never rewrite the scene.",
    userPrompt: JSON.stringify({ bible: input.bible ?? "", sceneText: input.text }),
  };
}

/** Kiểm tra đáp án model — hàm thuần để kiểm thử được. */
export function parseNovelAiResponse(
  parsed: unknown,
  task: NovelAiTask,
): { summary?: string; issues?: string[] } | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (task === "summarize") {
    if (typeof p.summary !== "string" || !p.summary.trim()) return null;
    return { summary: p.summary.trim() };
  }
  if (!Array.isArray(p.issues)) return null;
  const issues = p.issues.filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );
  return { issues: issues.map((x) => x.trim()) };
}

export class NovelAiService {
  private readonly client: GoogleGenAI;
  private readonly preferredModel?: string;

  constructor(apiKey: string, preferredModel?: string) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("GEMINI_API_KEY is required for NovelAiService");
    }
    this.client = new GoogleGenAI({ apiKey });
    this.preferredModel = preferredModel;
  }

  async run(input: NovelAiInput): Promise<NovelAiResult> {
    const { systemInstruction, userPrompt } = buildNovelAiPrompt(input);
    const models = Array.from(
      new Set(
        [this.preferredModel, ...FALLBACK_MODELS].filter(
          (m): m is string => typeof m === "string" && m.length > 0,
        ),
      ),
    );
    let lastError: unknown;
    for (const model of models) {
      try {
        const response = await this.client.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            maxOutputTokens: 2048,
          },
        });
        const text = response.text ?? "";
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error("Model returned non-JSON output");
        }
        const result = parseNovelAiResponse(parsed, input.task);
        if (!result) {
          throw new Error("Model output failed validation");
        }
        return { ...result, model };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Novel AI failed on all candidate models");
  }
}
