import { HttpException, HttpStatus } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";

/**
 * AI cho Novel Studio (N3): tóm tắt cảnh + kiểm tra nhất quán với sổ tay
 * + tách cảnh thành trang/khung manga (cầu nối Novel -> Manga).
 *
 * Cùng triết lý như dịch thoại: kết quả là BẢN NHÁP, client hiển thị để
 * người dùng duyệt/sửa tay, không tự sửa văn bản. Cùng ngân sách Gemini
 * free tier với vẽ/dịch (rate limiter dùng chung ở controller).
 * An toàn: không nhận system prompt/model từ client; độ dài đầu vào bị
 * chặn cứng ở controller.
 */

export type NovelAiTask = "summarize" | "consistency" | "breakdown";

/** Loại cảnh của một khung manga, khớp SceneType bên Manga Studio (trừ auto). */
export type BreakdownSceneType =
  | "action"
  | "dialogue"
  | "landscape"
  | "closeup"
  | "wide";

export const BREAKDOWN_SCENE_TYPES: readonly BreakdownSceneType[] = [
  "action",
  "dialogue",
  "landscape",
  "closeup",
  "wide",
];

/** Layout trang manga, khớp LAYOUTS bên Manga Studio; số khung phải khớp layout. */
export type BreakdownLayout = "classic-5" | "action-4" | "splash-3" | "manga-6";

export const BREAKDOWN_LAYOUT_PANEL_COUNT: Record<BreakdownLayout, number> = {
  "splash-3": 3,
  "action-4": 4,
  "classic-5": 5,
  "manga-6": 6,
};

/** Một khung trong kế hoạch: prompt hình ảnh để sinh ảnh mẫu + tham khảo. */
export interface BreakdownPanel {
  /** Mô tả hình ảnh thuần thị giác, tối đa 400 ký tự, không chữ/bong bóng. */
  prompt: string;
  sceneType: BreakdownSceneType;
  /** Thoại trích nguyên văn từ cảnh, tối đa 200 ký tự mỗi câu. */
  dialogue: string[];
  /** Ghi chú bố cục tham khảo, tối đa 200 ký tự. */
  note: string;
}

export interface BreakdownPage {
  layout: BreakdownLayout;
  panels: BreakdownPanel[];
}

export interface NovelBreakdown {
  pages: BreakdownPage[];
}

export interface NovelAiInput {
  task: NovelAiTask;
  /** Nội dung cảnh (2 trang washi gộp). */
  text: string;
  /** Sổ tay dạng văn bản tự do (chỉ dùng cho task consistency). */
  bible?: string;
  /** Ngữ cảnh truyện: tiền đề + tóm tắt + tóm tắt cảnh (chỉ dùng cho task breakdown). */
  context?: string;
}

export interface NovelAiResult {
  summary?: string;
  issues?: string[];
  breakdown?: NovelBreakdown;
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
  if (input.task === "breakdown") {
    return {
      systemInstruction:
        "You break one novel scene into manga pages in Vietnamese. Reply with JSON only: " +
        '{"pages": [{"layout": "classic-5", "panels": [{"prompt": "...", "sceneType": "wide", "dialogue": ["..."], "note": "..."}]}]}. ' +
        "Rules: 1 to 3 pages per scene, 3 to 6 panels per page. The layout must match the panel count exactly: " +
        "3 panels use splash-3, 4 use action-4, 5 use classic-5, 6 use manga-6. " +
        "Each panel prompt is a purely visual description for a black-and-white manga reference image: what is seen, who, where, camera angle and mood. " +
        "Never put text, letters, speech bubbles or sound-effect words in the prompt. " +
        "sceneType is one of action, dialogue, landscape, closeup, wide and must fit the panel. " +
        "dialogue holds only exact quotes taken from the scene text, at most 3 per panel, empty when the panel has no dialogue. " +
        "note is one short composition hint. Follow the scene order, never invent characters, places or events that are not in the scene.",
      userPrompt: JSON.stringify({
        context: input.context ?? "",
        sceneText: input.text,
      }),
    };
  }
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
): { summary?: string; issues?: string[]; breakdown?: NovelBreakdown } | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (task === "breakdown") {
    return parseBreakdown(p);
  }
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

/** Layout theo đúng số khung: model gửi sai layout thì sửa theo số khung thật. */
function layoutForPanelCount(count: number): BreakdownLayout {
  if (count <= 3) return "splash-3";
  if (count === 4) return "action-4";
  if (count >= 6) return "manga-6";
  return "classic-5";
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, max);
  return text.length > 0 ? text : null;
}

/**
 * Kiểm tra kế hoạch tách cảnh: 1-3 trang, mỗi trang 3-6 khung, prompt
 * và loại cảnh hợp lệ, thoại là mảng câu trích. Trang rỗng hoặc khung
 * thiếu prompt thì cả đáp án bị loại, để model thử lại ở model khác.
 */
function parseBreakdown(
  p: Record<string, unknown>,
): { breakdown: NovelBreakdown } | null {
  if (!Array.isArray(p.pages)) return null;
  const pages: BreakdownPage[] = [];
  for (const rawPage of p.pages.slice(0, 3)) {
    if (typeof rawPage !== "object" || rawPage === null) return null;
    const rawPanels = (rawPage as Record<string, unknown>).panels;
    if (!Array.isArray(rawPanels)) return null;
    const panels: BreakdownPanel[] = [];
    for (const rawPanel of rawPanels.slice(0, 6)) {
      if (typeof rawPanel !== "object" || rawPanel === null) return null;
      const rp = rawPanel as Record<string, unknown>;
      const prompt = cleanText(rp.prompt, 400);
      if (!prompt) return null;
      const sceneType = BREAKDOWN_SCENE_TYPES.includes(
        rp.sceneType as BreakdownSceneType,
      )
        ? (rp.sceneType as BreakdownSceneType)
        : null;
      if (!sceneType) return null;
      const dialogue = Array.isArray(rp.dialogue)
        ? rp.dialogue
            .map((d) => cleanText(d, 200))
            .filter((d): d is string => d !== null)
            .slice(0, 3)
        : [];
      const note = cleanText(rp.note, 200) ?? "";
      panels.push({ prompt, sceneType, dialogue, note });
    }
    if (panels.length < 3) return null;
    pages.push({ layout: layoutForPanelCount(panels.length), panels });
  }
  if (pages.length === 0) return null;
  return { breakdown: { pages } };
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
            // Tách cảnh trả về nhiều trang/khung nên cần trần cao hơn.
            maxOutputTokens: input.task === "breakdown" ? 4096 : 2048,
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
    // Mọi model đều lỗi: ném HttpException kèm nguyên nhân thật để client
    // hiện đúng lý do (key sai, model không có, hết quota...) thay vì
    // 500 chung chung của Nest, và ghi log ra terminal của server để
    // chẩn đoán. Thông báo lỗi của Google không chứa API key.
    const detail =
      lastError instanceof Error ? lastError.message : "Unknown error";
    console.error(
      `[NovelAi] task=${input.task} failed on all models: ${detail.slice(0, 300)}`,
    );
    throw new HttpException(
      `Gemini request failed: ${detail.slice(0, 200)}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
