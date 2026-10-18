import { GoogleGenAI } from "@google/genai";
import {
  AiDrawingProvider,
  AiDrawingProviderError,
  AiDrawingProviderTransientError,
  AiDrawingProviderTruncatedError,
} from "./ai-drawing-driver.js";
import type { AiDrawingProviderRequest } from "./ai-drawing-driver.js";
import { AiDrawingTask } from "../contracts/ai-drawing-request.dto.js";
import {
  AI_PANEL_CAMERAS,
  AI_STROKE_GROUPS,
  AI_STROKE_OPACITY_MAX,
  AI_STROKE_OPACITY_MIN,
  AI_STROKE_WIDTH_MAX,
  AI_STROKE_WIDTH_MIN,
  MAX_AI_BLUEPRINT_CAMERA_LENGTH,
  MAX_AI_BLUEPRINT_DESCRIPTION_LENGTH,
  MAX_AI_BLUEPRINT_LAYERS,
  MAX_AI_BLUEPRINT_LAYER_STROKES,
  MAX_AI_BLUEPRINT_TITLE_LENGTH,
  MAX_AI_FLOW_LENGTH,
  MAX_AI_GHOST_STROKES,
  MAX_AI_PANEL_HINT_LENGTH,
  MAX_AI_STORY_FLOW_PANELS,
  MAX_AI_STROKE_LABEL_LENGTH,
  MAX_AI_STROKE_POINTS,
  MIN_AI_BLUEPRINT_LAYER_STROKES,
  isValidStoryFlowPanelId,
} from "../contracts/ai-drawing-response.js";

/**
 * Gemini provider adapter for the AI drawing driver.
 *
 * Responsibilities:
 * - Converts the provider-neutral AiDrawingProviderRequest into the Gemini SDK payload.
 * - Handles inline image input (base64 + mimeType) according to the Gemini vision API.
 * - Requests structured JSON output from the model.
 * - Maps Gemini-specific error shapes into the application's error hierarchy so the
 *   driver can apply its retry/timeout policy without knowing provider internals.
 * - Returns the raw parsed JSON object; the driver validates it against the application
 *   response contract via parseAiDrawingResponse.
 *
 * What this adapter does NOT do:
 * - It never writes to or mutates the user's canvas.
 * - It never serialises prompts, images or responses to persistent storage.
 * - It never accepts arbitrary system instructions or model IDs from the client.
 * - It does not fall back to another provider on its own; that decision belongs to the
 *   application's model registry.
 */
const FALLBACK_MODELS = [
  "gemini-flash-latest",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
];

export function createGeminiDrawingProvider(apiKey: string): AiDrawingProvider {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("GEMINI_API_KEY is required to create the Gemini provider");
  }

  const client = new GoogleGenAI({ apiKey });

  return {
    async generate(
      request: AiDrawingProviderRequest,
      signal: AbortSignal,
    ): Promise<unknown> {
      // Gemini structured output: ask the model to return pure JSON.
      // The system instruction already mandates JSON-only output; adding
      // responseMimeType reinforces this at the SDK/API level.
      const contents = buildContents(request);

      const candidateModels = Array.from(
        new Set([request.modelId, ...FALLBACK_MODELS]),
      );

      let lastError: unknown;

      for (let i = 0; i < candidateModels.length; i++) {
        const modelToTry = candidateModels[i];
        if (signal.aborted) {
          throw new AiDrawingProviderError("Request aborted");
        }

        let response: Awaited<ReturnType<typeof client.models.generateContent>>;
        try {
          response = await client.models.generateContent({
            model: modelToTry,
            contents,
            config: {
              systemInstruction: request.systemInstruction,
              responseMimeType: "application/json",
              maxOutputTokens: request.maxOutputTokens,
              abortSignal: signal,
            },
          });
        } catch (error) {
          lastError = error;
          if (signal.aborted) {
            throw error;
          }

          const message = error instanceof Error ? error.message : String(error);
          const statusCode =
            (error as { statusCode?: number; status?: number }).statusCode ??
            (error as { statusCode?: number; status?: number }).status ??
            extractStatusFromMessage(message);

          // If model is discontinued/not found (404) or experiencing temporary overload (503/429)
          const isRecoverableWithNextModel =
            statusCode === 404 || statusCode === 503 || statusCode === 429;

          if (isRecoverableWithNextModel && i < candidateModels.length - 1) {
            console.warn(
              `[GeminiDrawingProvider] Model "${modelToTry}" returned ${statusCode || "error"}, attempting fallback to "${candidateModels[i + 1]}"...`,
            );
            continue;
          }

          throw mapGeminiError(error);
        }

        return buildGeminiDrawingOutput(response, request, modelToTry);
      }

      throw mapGeminiError(lastError);
    },
  };
}

/** Phần phản hồi mà bộ đọc cần — tách ra để test được không cần SDK. */
export interface GeminiDrawingResponseLike {
  text?: string;
  candidates?: Array<{ finishReason?: string }>;
  usageMetadata?: { candidatesTokenCount?: number };
}

/**
 * Biến phản hồi Gemini thành đối tượng sẽ đi vào `parseAiDrawingResponse()`.
 *
 * Hai điều quan trọng (Phase 5E):
 * 1. `finishReason === "MAX_TOKENS"` được kiểm **trước** khi đọc JSON. Output bị cắt
 *    thường để lại JSON đứt giữa dòng, nên nếu để phần parse báo lỗi trước thì nguyên
 *    nhân thật (hết trần token) bị giấu sau câu "could not be parsed as JSON" — đúng cái
 *    ngụy trang đã khiến lỗi 503 bị hiểu nhầm là "chờ kích hoạt hoặc bảo trì".
 * 2. Gắn `model` = model **thật đã phục vụ** lần gọi này, không phải model cấu hình
 *    trong profile; khi provider rơi sang model dự phòng thì đây mới là tên đúng.
 */
export function buildGeminiDrawingOutput(
  response: GeminiDrawingResponseLike,
  request: AiDrawingProviderRequest,
  modelId: string,
): unknown {
  const text = response.text;
  const finishReason = response.candidates?.[0]?.finishReason;

  if (finishReason === "MAX_TOKENS") {
    throw new AiDrawingProviderTruncatedError(
      finishReason,
      response.usageMetadata?.candidatesTokenCount,
      typeof text === "string" ? text.length : 0,
    );
  }

  if (typeof text !== "string" || text.trim().length === 0) {
    throw new AiDrawingProviderError(
      "Gemini returned an empty or non-text response",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJsonText(text)) as unknown;
  } catch {
    throw new AiDrawingProviderError(
      "Gemini response could not be parsed as JSON",
    );
  }

  const normalized = normalizeGeminiOutput(parsed, request);
  if (
    typeof normalized === "object" &&
    normalized !== null &&
    !Array.isArray(normalized)
  ) {
    (normalized as Record<string, unknown>).model = modelId;
  }
  return normalized;
}

function cleanJsonText(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return cleaned.trim();
}

function clamp(
  num: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof num !== "number" || !Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

const ALLOWED_PRINCIPLES = new Set([
  "composition",
  "proportion",
  "color",
  "flow",
  "perspective",
  "lighting",
  "shadow",
]);

const ALLOWED_STROKE_GROUPS = new Set<string>(AI_STROKE_GROUPS);

/** Ba task trả về một mảng nét phẳng (không chia lớp). */
const GHOST_STROKE_TASKS = new Set<string>([
  "stroke_guidance",
  "composition_overlay",
  "pose_guidance",
]);

const STROKE_FILL_PATTERN = /^#[0-9a-f]{6}$/;

/** Độ mờ mặc định cho nét AI khi model không khai (AC-A1.3: 0.55). */
const DEFAULT_AI_STROKE_OPACITY = 0.55;

/**
 * Nhãn hiển thị của nét: gộp khoảng trắng, cắt theo giới hạn hợp đồng.
 * Thiếu nhãn → chuỗi rỗng (hợp đồng cho phép rỗng, chỉ chặn kiểu/độ dài).
 */
function normalizeStrokeLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  const single = value.replace(/\s+/g, " ").trim();
  if (single.length <= MAX_AI_STROKE_LABEL_LENGTH) return single;
  return `${single.slice(0, MAX_AI_STROKE_LABEL_LENGTH - 3)}...`;
}

/**
 * Màu tô kín: chỉ nhận `"none"` hoặc `"#rrggbb"`, còn lại bỏ trường để parser
 * dùng giá trị mặc định (không tô).
 */
function normalizeStrokeFill(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim().toLowerCase();
  if (text === "none") return "none";
  return STROKE_FILL_PATTERN.test(text) ? text : undefined;
}

/**
 * Chuẩn hoá một mảng nét thô: suy `kind` khi model bỏ trống, kẹp toạ độ và các
 * tham số về giới hạn hợp đồng, điền `group`/`label`. Mỗi nét được **dựng lại**
 * từ danh sách trường hợp lệ nên trường lạ (vd `color`) không lọt qua parser.
 */
function normalizeStrokes(
  rawStrokesValue: unknown,
  limit: number,
): Array<Record<string, unknown>> {
  const rawStrokes = Array.isArray(rawStrokesValue) ? rawStrokesValue : [];
  const normalizedStrokes: Array<Record<string, unknown>> = [];

  for (const stroke of rawStrokes) {
    if (typeof stroke !== "object" || stroke === null) continue;
    if (normalizedStrokes.length >= limit) break;

    const s = stroke as Record<string, unknown>;
    let kind = s.kind;
    if (
      kind !== "path" &&
      kind !== "line" &&
      kind !== "ellipse" &&
      kind !== "rectangle"
    ) {
      if (Array.isArray(s.points) && s.points.length > 0) kind = "path";
      else if (s.from && s.to) kind = "line";
      else if (s.region) kind = "ellipse";
      else kind = "path";
    }

    const style = ALLOWED_PRINCIPLES.has(s.style as string)
      ? (s.style as string)
      : "flow";
    const group = ALLOWED_STROKE_GROUPS.has(s.group as string)
      ? (s.group as string)
      : "detail";
    const label = normalizeStrokeLabel(s.label);
    const opacity = clamp(
      s.opacity,
      AI_STROKE_OPACITY_MIN,
      AI_STROKE_OPACITY_MAX,
      DEFAULT_AI_STROKE_OPACITY,
    );
    const strokeWidth = clamp(
      s.strokeWidth,
      AI_STROKE_WIDTH_MIN,
      AI_STROKE_WIDTH_MAX,
      0.005,
    );
    const dashed = typeof s.dashed === "boolean" ? s.dashed : undefined;
    const fill = normalizeStrokeFill(s.fill);
    // Màu tô chỉ có nghĩa với hình khép kín: model quên `closed` thì tự khép.
    const closed =
      typeof s.closed === "boolean"
        ? s.closed
        : fill !== undefined && fill !== "none"
          ? true
          : undefined;

    if (kind === "path") {
      const rawPoints = Array.isArray(s.points) ? s.points : [];
      const points: Array<{ x: number; y: number }> = [];
      for (const pt of rawPoints) {
        if (typeof pt !== "object" || pt === null) continue;
        if (points.length >= MAX_AI_STROKE_POINTS) break;
        const p = pt as Record<string, unknown>;
        points.push({
          x: clamp(p.x, 0, 1, 0.5),
          y: clamp(p.y, 0, 1, 0.5),
        });
      }
      if (points.length === 0) continue;
      normalizedStrokes.push({
        kind: "path",
        points,
        style,
        group,
        label,
        opacity,
        strokeWidth,
        ...(dashed !== undefined ? { dashed } : {}),
        ...(closed !== undefined ? { closed } : {}),
        ...(fill !== undefined ? { fill } : {}),
      });
    } else if (kind === "line") {
      if (
        !s.from ||
        !s.to ||
        typeof s.from !== "object" ||
        typeof s.to !== "object"
      )
        continue;
      const fromRaw = s.from as Record<string, unknown>;
      const toRaw = s.to as Record<string, unknown>;
      normalizedStrokes.push({
        kind: "line",
        from: {
          x: clamp(fromRaw.x, 0, 1, 0.1),
          y: clamp(fromRaw.y, 0, 1, 0.1),
        },
        to: {
          x: clamp(toRaw.x, 0, 1, 0.9),
          y: clamp(toRaw.y, 0, 1, 0.9),
        },
        style,
        group,
        label,
        opacity,
        strokeWidth,
        ...(dashed !== undefined ? { dashed } : {}),
      });
    } else {
      if (!s.region || typeof s.region !== "object") continue;
      const r = s.region as Record<string, unknown>;
      const x = clamp(r.x, 0, 0.98, 0.1);
      const y = clamp(r.y, 0, 0.98, 0.1);
      const width = clamp(r.width, 0.01, 1 - x, 0.2);
      const height = clamp(r.height, 0.01, 1 - y, 0.2);
      normalizedStrokes.push({
        kind: kind as "ellipse" | "rectangle",
        region: { x, y, width, height },
        style,
        group,
        label,
        opacity,
        strokeWidth,
        ...(dashed !== undefined ? { dashed } : {}),
        ...(fill !== undefined ? { fill } : {}),
      });
    }
  }

  return normalizedStrokes;
}

/**
 * Chuỗi mô tả của blueprint: gộp khoảng trắng, cắt theo giới hạn hợp đồng.
 * Trả `null` khi model không trả về gì dùng được — **không bịa** mô tả.
 */
function normalizeBlueprintText(
  value: unknown,
  maxLength: number,
): string | null {
  if (typeof value !== "string") return null;
  const single = value.replace(/\s+/g, " ").trim();
  if (single.length === 0) return null;
  if (single.length <= maxLength) return single;
  return `${single.slice(0, maxLength - 3)}...`;
}

/**
 * Bốn mô tả của "bức tranh toàn cảnh bằng lời". Thiếu bất kỳ phần nào thì trả
 * `null` để parser chặn (502) thay vì tự chế một mô tả trông như dữ liệu thật.
 */
function normalizeBlueprintSpec(
  value: unknown,
): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const title = normalizeBlueprintText(
    raw.title,
    MAX_AI_BLUEPRINT_TITLE_LENGTH,
  );
  const composition = normalizeBlueprintText(
    raw.composition,
    MAX_AI_BLUEPRINT_DESCRIPTION_LENGTH,
  );
  const lighting = normalizeBlueprintText(
    raw.lighting,
    MAX_AI_BLUEPRINT_DESCRIPTION_LENGTH,
  );
  const camera = normalizeBlueprintText(
    raw.camera,
    MAX_AI_BLUEPRINT_CAMERA_LENGTH,
  );
  if (
    title === null ||
    composition === null ||
    lighting === null ||
    camera === null
  ) {
    return null;
  }
  return { title, composition, lighting, camera };
}

/**
 * Các lớp của blueprint theo đúng thứ tự vẽ (nền trước, hiệu ứng sau): bỏ lớp
 * sai nhóm hoặc trùng nhóm, bỏ lớp thưa hơn `MIN_AI_BLUEPRINT_LAYER_STROKES` nét,
 * và chia dần ngân sách `MAX_AI_GHOST_STROKES` cho các lớp phía sau.
 */
function normalizeBlueprintLayers(
  value: unknown,
): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  const layers: Array<Record<string, unknown>> = [];
  const seenGroups = new Set<string>();
  let strokeBudget = MAX_AI_GHOST_STROKES;

  for (const rawLayer of value) {
    if (layers.length >= MAX_AI_BLUEPRINT_LAYERS) break;
    if (typeof rawLayer !== "object" || rawLayer === null) continue;
    const layer = rawLayer as Record<string, unknown>;
    const group = layer.group;
    if (
      typeof group !== "string" ||
      !ALLOWED_STROKE_GROUPS.has(group) ||
      seenGroups.has(group)
    ) {
      continue;
    }

    const name = normalizeBlueprintText(
      layer.name,
      MAX_AI_BLUEPRINT_TITLE_LENGTH,
    );
    const description = normalizeBlueprintText(
      layer.description,
      MAX_AI_BLUEPRINT_DESCRIPTION_LENGTH,
    );
    if (name === null || description === null) continue;

    const strokes = normalizeStrokes(
      layer.strokes,
      Math.min(MAX_AI_BLUEPRINT_LAYER_STROKES, strokeBudget),
    );
    if (strokes.length < MIN_AI_BLUEPRINT_LAYER_STROKES) continue;

    // Nét thuộc lớp nào thì mang group của lớp đó — hợp đồng bắt buộc hai bên khớp.
    for (const stroke of strokes) stroke.group = group;

    layers.push({ group, name, description, strokes });
    seenGroups.add(group);
    strokeBudget -= strokes.length;
  }

  return layers;
}

/**
 * Chuẩn hoá JSON thô của model về đúng hợp đồng phản hồi.
 *
 * Nguyên tắc chung của dự án: **provider normalize, parser strict** — ở đây chỉ
 * sửa những gì còn dùng được (nhóm nét mặc định, nhãn rỗng, kẹp số, bỏ trường
 * lạ), còn `parseAiDrawingResponse()` mới là nơi ném lỗi.
 *
 * Xuất ra để test trực tiếp phần chuẩn hoá.
 */
export function normalizeGeminiOutput(
  raw: unknown,
  request: AiDrawingProviderRequest,
): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;

  const obj = raw as Record<string, unknown>;
  obj.schemaVersion = "1";
  obj.task = request.task;

  if (typeof obj.summary !== "string" || obj.summary.trim().length === 0) {
    obj.summary = "Gợi ý nét vẽ từ AI.";
  } else if (obj.summary.length > 600) {
    obj.summary = obj.summary.slice(0, 597) + "...";
  }

  // Filter hallucinated citations: only keep IDs in request.evidence
  const validEvidenceIds = new Set(request.evidence?.map((e) => e.id) ?? []);
  if (Array.isArray(obj.sourceIds)) {
    obj.sourceIds = obj.sourceIds.filter(
      (id) => typeof id === "string" && validEvidenceIds.has(id),
    );
  } else {
    obj.sourceIds = [];
  }

  // ── Task nét đơn lẻ: chuẩn hoá thẳng mảng `strokes` ────────────────────────
  if (GHOST_STROKE_TASKS.has(request.task)) {
    obj.strokes = normalizeStrokes(obj.strokes, MAX_AI_GHOST_STROKES);
    delete obj.recommendations;
    delete obj.findings;
  }

  // ── Blueprint toàn cảnh: chuẩn hoá theo từng lớp rồi trải phẳng ────────────
  // `strokes` luôn được **dựng lại** từ `layers` nên hai trường không thể lệch nhau.
  if (request.task === AiDrawingTask.SceneBlueprint) {
    const normalizedLayers = normalizeBlueprintLayers(obj.layers);
    const blueprint = normalizeBlueprintSpec(obj.blueprint);
    if (normalizedLayers.length === 0) {
      delete obj.layers;
      delete obj.strokes;
    } else {
      obj.layers = normalizedLayers;
      obj.strokes = normalizedLayers.flatMap(
        (layer) => layer.strokes as Array<Record<string, unknown>>,
      );
    }
    if (blueprint === null) {
      delete obj.blueprint;
    } else {
      obj.blueprint = blueprint;
    }
    delete obj.recommendations;
    delete obj.findings;
  }

  if (request.task === AiDrawingTask.PageStoryFlow) {
    const flow = normalizeStoryFlowText(obj.flow);
    // Không bịa mạch truyện: model trả thiếu/không dùng được thì bỏ trường để
    // parser chặn (502) thay vì trả về một câu tự chế trông như dữ liệu thật.
    if (flow === null) {
      delete obj.flow;
    } else {
      obj.flow = flow;
    }
    obj.panels = normalizeStoryFlowPanels(obj.panels);
    delete obj.strokes;
    delete obj.recommendations;
    delete obj.findings;
  }

  return obj;
}

/**
 * Chuỗi mạch truyện cả trang: bỏ xuống dòng, cắt theo giới hạn hợp đồng.
 * `null` khi model không trả về gì dùng được.
 */
function normalizeStoryFlowText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const single = value.replace(/\s+/g, " ").trim();
  if (single.length === 0) return null;
  if (single.length > MAX_AI_FLOW_LENGTH) {
    return `${single.slice(0, MAX_AI_FLOW_LENGTH - 3)}...`;
  }
  return single;
}

/**
 * Gợi ý từng khung: giữ tối đa `MAX_AI_STORY_FLOW_PANELS` khung, ép `panelId`
 * về dạng `pN`, `order` về số nguyên dương, `hint` về chuỗi có nghĩa và
 * `camera` về một trong bốn cỡ cảnh hợp lệ. Phần tử không có `panelId`/`hint`
 * dùng được thì bị loại (parser phía sau chặt hơn: thiếu khung → lỗi).
 */
function normalizeStoryFlowPanels(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  const panels: Array<Record<string, unknown>> = [];

  for (const rawPanel of value) {
    if (typeof rawPanel !== "object" || rawPanel === null) continue;
    if (panels.length >= MAX_AI_STORY_FLOW_PANELS) break;

    const raw = rawPanel as Record<string, unknown>;
    const panelId =
      typeof raw.panelId === "string" ? raw.panelId.trim().toLowerCase() : "";
    if (!isValidStoryFlowPanelId(panelId)) continue;

    let hint = "";
    if (typeof raw.hint === "string") {
      hint = raw.hint.replace(/\s+/g, " ").trim();
    }
    if (hint.length === 0) continue;
    if (hint.length > MAX_AI_PANEL_HINT_LENGTH) {
      hint = `${hint.slice(0, MAX_AI_PANEL_HINT_LENGTH - 3)}...`;
    }

    const order = clamp(raw.order, 1, 99, panels.length + 1);
    const camera =
      typeof raw.camera === "string" &&
      (AI_PANEL_CAMERAS as readonly string[]).includes(raw.camera.trim())
        ? raw.camera.trim()
        : "trung cảnh";

    panels.push({
      panelId,
      order: Math.round(order),
      hint,
      camera,
    });
  }

  return panels;
}

/**
 * Build the Gemini `contents` array for the request.
 * The panel image is sent as an inline base64 part so Gemini receives both the
 * user's text context and the canvas snapshot in a single turn.
 *
 * `page_story_flow` may run without an image (VD-1): then only the text part is
 * sent, and the prompt must carry the layout/page context.
 */
function buildContents(
  request: AiDrawingProviderRequest,
): Array<{ role: string; parts: Array<Record<string, unknown>> }> {
  const textPart: Record<string, unknown> = {
    text: request.prompt.trim().length > 0 ? request.prompt : "(panel gửi để đánh giá)",
  };

  if (!request.image) {
    return [{ role: "user", parts: [textPart] }];
  }

  const imagePart: Record<string, unknown> = {
    inlineData: {
      mimeType: request.image.mimeType,
      data: request.image.data,
    },
  };

  return [{ role: "user", parts: [textPart, imagePart] }];
}

/**
 * Map Gemini SDK/API error shapes to the application's AiDrawingProviderError
 * hierarchy so the driver can apply uniform retry/timeout handling.
 *
 * Transient errors (429, 503, network resets) → AiDrawingProviderTransientError
 *   → driver retries once then re-throws as ServiceUnavailableException.
 * Everything else → AiDrawingProviderError
 *   → driver maps to ServiceUnavailableException without retrying.
 */
function mapGeminiError(error: unknown): AiDrawingProviderError {
  if (error instanceof AiDrawingProviderError) {
    return error;
  }

  const message =
    error instanceof Error ? error.message : String(error);

  // Gemini SDK surfaces HTTP status codes in the error message or as a
  // statusCode/status property on the thrown Error-like object.
  const statusCode =
    (error as { statusCode?: number; status?: number }).statusCode ??
    (error as { statusCode?: number; status?: number }).status ??
    extractStatusFromMessage(message);

  if (statusCode === 429 || statusCode === 503) {
    return new AiDrawingProviderTransientError();
  }

  return new AiDrawingProviderError(
    `Gemini request failed (status ${statusCode ?? "unknown"})`,
  );
}

function extractStatusFromMessage(message: string): number | undefined {
  const match = /\b(4\d{2}|5\d{2})\b/.exec(message);
  return match ? Number(match[1]) : undefined;
}
