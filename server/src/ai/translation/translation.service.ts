import { GoogleGenAI } from "@google/genai";

/**
 * Dịch thoại/phụ đề CÓ NGỮ CẢNH cho Animation Studio.
 *
 * Khác biệt so với dịch từng câu rời: một lượt gọi dịch CẢ CẢNH, kèm
 * (1) tên + ghi chú cảnh, (2) bảng thuật ngữ tên riêng người dùng cung
 * cấp, (3) các câu thoại liên tiếp nhau — để giữ nhất quán xưng hô,
 * tên riêng và giọng nhân vật. Kết quả là BẢN NHÁP: client hiển thị
 * cạnh bản gốc, người dùng áp dụng/sửa tay (triết lý AI trợ giúp).
 *
 * An toàn: ngôn ngữ đích thuộc danh sách cho phép; độ dài đầu vào bị
 * chặn cứng; không nhận system prompt/model từ client.
 */

export const TRANSLATION_TARGET_LANGUAGES = [
  { id: "en", label: "English" },
  { id: "ja", label: "日本語 (Japanese)" },
  { id: "ko", label: "한국어 (Korean)" },
  { id: "zh", label: "中文 (Chinese)" },
  { id: "vi", label: "Tiếng Việt" },
] as const;

export type TranslationTargetLang =
  (typeof TRANSLATION_TARGET_LANGUAGES)[number]["id"];

export const MAX_TRANSLATION_LINES = 40;
export const MAX_TRANSLATION_LINE_LENGTH = 500;
export const MAX_TRANSLATION_CONTEXT_LENGTH = 2000;

export interface TranslateDialogueInput {
  targetLang: TranslationTargetLang;
  sceneName: string;
  sceneNote?: string;
  /** Bảng thuật ngữ/tên riêng dạng văn bản tự do từ người dùng. */
  glossary?: string;
  lines: Array<{ id: string; text: string; speaker?: string }>;
}

export interface TranslateDialogueResult {
  translations: Array<{ id: string; text: string }>;
  model: string;
}

const FALLBACK_MODELS = [
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
];

/** Dựng prompt — hàm thuần để kiểm thử được cấu trúc ngữ cảnh. */
export function buildTranslationPrompt(input: TranslateDialogueInput): {
  systemInstruction: string;
  userPrompt: string;
} {
  const target = TRANSLATION_TARGET_LANGUAGES.find(
    (l) => l.id === input.targetLang,
  );
  const systemInstruction = [
    "You are a professional subtitle/dialogue translator for animated films.",
    `Translate every line into ${target?.label ?? input.targetLang}.`,
    "Rules:",
    "- Keep each translation natural as SPOKEN dialogue, concise enough for subtitles.",
    "- Preserve proper nouns according to the provided glossary; never translate names that the glossary marks as keep-original.",
    "- Keep the same speaker addressing style (pronouns/formality) consistently across all lines of the scene.",
    "- Do NOT add, drop, merge or reorder lines. Output exactly one translation per input line, matched by id.",
    '- Respond with JSON only: {"translations":[{"id":"...","text":"..."}]}',
  ].join("\n");

  const parts: string[] = [];
  parts.push(`Scene: ${input.sceneName}`);
  if (input.sceneNote?.trim()) {
    parts.push(`Scene context/note: ${input.sceneNote.trim()}`);
  }
  if (input.glossary?.trim()) {
    parts.push(`Glossary / proper nouns:\n${input.glossary.trim()}`);
  }
  parts.push(
    "Lines to translate (JSON):\n" +
      JSON.stringify(
        input.lines.map((l) => ({
          id: l.id,
          speaker: l.speaker ?? null,
          text: l.text,
        })),
        null,
        2,
      ),
  );
  return { systemInstruction, userPrompt: parts.join("\n\n") };
}

/** Chuẩn hoá + kiểm tra đáp án của model: đủ dòng, đúng id, không rỗng. */
export function parseTranslationResponse(
  raw: unknown,
  expectedIds: string[],
): Array<{ id: string; text: string }> | null {
  if (typeof raw !== "object" || raw === null) return null;
  const list = (raw as { translations?: unknown }).translations;
  if (!Array.isArray(list)) return null;
  const byId = new Map<string, string>();
  for (const item of list) {
    if (typeof item !== "object" || item === null) return null;
    const { id, text } = item as { id?: unknown; text?: unknown };
    if (typeof id !== "string" || typeof text !== "string") return null;
    if (!text.trim()) return null;
    byId.set(id, text.trim());
  }
  if (expectedIds.some((id) => !byId.has(id))) return null;
  return expectedIds.map((id) => ({ id, text: byId.get(id)! }));
}

export class TranslationService {
  private readonly client: GoogleGenAI;
  private readonly preferredModel?: string;

  constructor(apiKey: string, preferredModel?: string) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("GEMINI_API_KEY is required for TranslationService");
    }
    this.client = new GoogleGenAI({ apiKey });
    this.preferredModel = preferredModel;
  }

  async translateDialogue(
    input: TranslateDialogueInput,
  ): Promise<TranslateDialogueResult> {
    const { systemInstruction, userPrompt } = buildTranslationPrompt(input);
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
            maxOutputTokens: 4096,
          },
        });
        const text = response.text ?? "";
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error("Model returned non-JSON output");
        }
        const translations = parseTranslationResponse(
          parsed,
          input.lines.map((l) => l.id),
        );
        if (!translations) {
          throw new Error("Model output failed validation");
        }
        return { translations, model };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Translation failed on all candidate models");
  }
}
