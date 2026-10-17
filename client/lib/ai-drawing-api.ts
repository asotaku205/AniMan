import type { AuthenticatedFetch } from "./auth-api";

export type AiDrawingTask =
  | "composition_guidance"
  | "drawing_review"
  | "stroke_guidance"
  | "composition_overlay"
  | "pose_guidance"
  | "page_story_flow";

export type AiDrawingToolHint =
  | "clean-lines"
  | "screentone"
  | "speed-lines"
  | "speech-bubble"
  | "composition-overlay"
  | "pose-guidance";

export type AiDrawingPrinciple =
  | "composition"
  | "proportion"
  | "color"
  | "flow"
  | "perspective"
  | "lighting"
  | "shadow";

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface NormalizedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Nhóm nội dung của nét AI — thứ tự trong mảng **cũng là thứ tự vẽ**
 * (nền trước, hiệu ứng sau). Phải khớp `AI_STROKE_GROUPS` của server.
 */
export const AI_STROKE_GROUPS = [
  "background",
  "midground",
  "subject",
  "detail",
  "effects",
  "guide",
] as const;

export type AiStrokeGroup = (typeof AI_STROKE_GROUPS)[number];

export interface AiDrawingFinding {
  principle: AiDrawingPrinciple;
  region: NormalizedRegion;
  issue: string;
  recommendation: string;
  severity: "low" | "medium" | "high";
  confidence: number;
}

export interface AiDrawingReviewResponse {
  schemaVersion: "1";
  task: "drawing_review";
  summary: string;
  sourceIds: string[];
  findings: AiDrawingFinding[];
}

/** Một nét gợi ý do AI sinh ra — SVG mờ, không ghi vào canvas */
export interface AiStrokePath {
  kind: "path" | "line" | "ellipse" | "rectangle";
  /** Với path: mảng điểm normalized */
  points?: NormalizedPoint[];
  /** Với line */
  from?: NormalizedPoint;
  to?: NormalizedPoint;
  /** Với ellipse/rectangle */
  region?: NormalizedRegion;
  style: AiDrawingPrinciple;
  /** Nhóm nội dung — quyết định thứ tự vẽ (Phase 5A) */
  group: AiStrokeGroup;
  /** Nhãn tiếng Việt ngắn hiện khi trỏ chuột; rỗng khi model không đặt tên */
  label: string;
  opacity: number;
  strokeWidth: number;
  dashed?: boolean;
  /** Với path: nét đã khép kín chưa (chỉ path khép kín mới có `fill`) */
  closed?: boolean;
  /** Màu tô kín: "#rrggbb" hoặc "none" */
  fill?: string;
}

export interface AiGhostStrokeResponse {
  schemaVersion: "1";
  task: "stroke_guidance" | "composition_overlay" | "pose_guidance";
  summary: string;
  sourceIds: string[];
  strokes: AiStrokePath[];
}

export interface AiDrawingImagePayload {
  data: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
}

// ─── Mạch truyện toàn trang (D-1) ───────────────────────────────────────────

/** Bốn cỡ cảnh hợp lệ — khớp `AI_PANEL_CAMERAS` phía server. */
export const AI_PANEL_CAMERAS = [
  "toàn cảnh",
  "trung cảnh",
  "cận cảnh",
  "chuyển động",
] as const;

export type AiPanelCamera = (typeof AI_PANEL_CAMERAS)[number];

/** Trần khung mỗi trang — khớp `MAX_AI_STORY_FLOW_PANELS` phía server. */
export const MAX_STORY_FLOW_PANELS = 12;

export interface AiPageStoryFlowPanelHint {
  panelId: string;
  order: number;
  hint: string;
  camera: AiPanelCamera;
}

export interface AiPageStoryFlowResponse {
  schemaVersion: "1";
  task: "page_story_flow";
  summary: string;
  sourceIds: string[];
  /** Mạch truyện cả trang dạng "A → B → C". */
  flow: string;
  panels: AiPageStoryFlowPanelHint[];
}

/**
 * Nhãn mô hình hiển thị ở dòng nguồn AI (AC-D2.2).
 *
 * Phải khớp `modelId` của profile phía server
 * (`GEMINI_DRAWING_MODEL_PROFILE` trong `server/src/ai/driver/ai-drawing-driver.ts`).
 * Hợp đồng phản hồi không mang tên model, nên đây là hằng số client phản chiếu
 * cấu hình server; đổi model ở server thì sửa cả hai chỗ.
 */
export const AI_DRAWING_MODEL_LABEL = "gemini-flash-latest";

export interface AiDrawingRequestPayload {
  task: AiDrawingTask;
  prompt?: string;
  toolHint?: AiDrawingToolHint;
  /** Bắt buộc với mọi task trừ `page_story_flow` (VD-1). */
  image?: AiDrawingImagePayload;
}

export class AiDrawingApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AiDrawingApiError";
  }
}

/**
 * Creates a clean PNG base64 snapshot of the user's active canvas.
 * Scales dimensions to meet server bounds (min 256x256, max 4096)
 * and fills background with white paper so ink is properly visible.
 */
export function createCanvasSnapshot(
  canvas: HTMLCanvasElement,
): AiDrawingImagePayload | null {
  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    return null;
  }

  const minDim = 256;
  const maxDim = 4096;

  let targetWidth = canvas.width;
  let targetHeight = canvas.height;

  if (targetWidth < minDim || targetHeight < minDim) {
    const scale = Math.max(minDim / targetWidth, minDim / targetHeight);
    targetWidth = Math.round(targetWidth * scale);
    targetHeight = Math.round(targetHeight * scale);
  }

  if (targetWidth > maxDim || targetHeight > maxDim) {
    const scale = Math.min(maxDim / targetWidth, maxDim / targetHeight);
    targetWidth = Math.round(targetWidth * scale);
    targetHeight = Math.round(targetHeight * scale);
  }

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = targetWidth;
  exportCanvas.height = targetHeight;
  const ctx = exportCanvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  // White paper background for manga artwork
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

  const dataUrl = exportCanvas.toDataURL("image/png");
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) {
    return null;
  }

  return {
    data: dataUrl.slice(prefix.length),
    mimeType: "image/png",
    width: targetWidth,
    height: targetHeight,
  };
}

/**
 * Requests an AI drawing review for the currently active panel snapshot.
 */
export async function requestAiDrawingReview(
  authenticatedFetch: AuthenticatedFetch,
  image: AiDrawingImagePayload,
  prompt?: string,
  signal?: AbortSignal,
): Promise<AiDrawingReviewResponse> {
  const payload: AiDrawingRequestPayload = {
    task: "drawing_review",
    image,
    ...(prompt ? { prompt } : {}),
  };

  const response = await authenticatedFetch("/ai/drawing", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  const responseData: unknown = await readPayload(response);

  if (!response.ok) {
    const message = extractErrorMessage(responseData, response.status);
    throw new AiDrawingApiError(message, response.status);
  }

  if (!isDrawingReviewResponse(responseData)) {
    throw new Error("Phản hồi đánh giá từ AI không đúng cấu trúc yêu cầu.");
  }

  return responseData;
}

/**
 * Yêu cầu AI sinh ghost strokes cho một trong các task: stroke_guidance,
 * composition_overlay, pose_guidance.
 *
 * @param prompt  Mô tả ý tưởng của người dùng (user prompt) — để lại rỗng
 *                nếu bức vẽ đã rõ ràng. Khi canvas còn sơ khai, người dùng
 *                có thể nhập mô tả để AI đưa ra gợi ý phù hợp hơn.
 */
export async function requestAiGhostStrokes(
  authenticatedFetch: AuthenticatedFetch,
  image: AiDrawingImagePayload,
  task: "stroke_guidance" | "composition_overlay" | "pose_guidance",
  toolHint?: AiDrawingToolHint,
  prompt?: string,
  signal?: AbortSignal,
): Promise<AiGhostStrokeResponse> {
  const payload: AiDrawingRequestPayload = {
    task,
    image,
    ...(toolHint ? { toolHint } : {}),
    ...(prompt?.trim() ? { prompt: prompt.trim() } : {}),
  };

  const response = await authenticatedFetch("/ai/drawing", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  const responseData: unknown = await readPayload(response);

  if (!response.ok) {
    const message = extractErrorMessage(responseData, response.status);
    throw new AiDrawingApiError(message, response.status);
  }

  if (!isGhostStrokeResponse(responseData)) {
    throw new Error("Phản hồi ghost stroke từ AI không đúng cấu trúc yêu cầu.");
  }

  return responseData;
}

/**
 * Yêu cầu AI dệt mạch truyện xuyên suốt cả trang (AC-D1.1).
 *
 * `image` là tùy chọn (VD-1): khi người dùng chưa mở khung nào thì chỉ gửi mô tả
 * layout/trang/thể loại trong `prompt`. Ngược lại gửi kèm ảnh khung đang mở để
 * AI bám vào nét đã có.
 */
export async function requestAiPageStoryFlow(
  authenticatedFetch: AuthenticatedFetch,
  input: { prompt?: string; image?: AiDrawingImagePayload },
  signal?: AbortSignal,
): Promise<AiPageStoryFlowResponse> {
  const payload: AiDrawingRequestPayload = {
    task: "page_story_flow",
    ...(input.prompt?.trim() ? { prompt: input.prompt.trim() } : {}),
    ...(input.image ? { image: input.image } : {}),
  };

  const response = await authenticatedFetch("/ai/drawing", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  const responseData: unknown = await readPayload(response);

  if (!response.ok) {
    const message = extractErrorMessage(responseData, response.status);
    throw new AiDrawingApiError(message, response.status);
  }

  if (!isPageStoryFlowResponse(responseData)) {
    throw new Error("Phản hồi mạch truyện từ AI không đúng cấu trúc yêu cầu.");
  }

  return responseData;
}

/**
 * Đối chiếu gợi ý khung của AI với **layout đang mở** (VD-5): bỏ khung không tồn
 * tại, gộp khung trùng id (giữ gợi ý có `order` nhỏ nhất) và sắp theo thứ tự đọc.
 *
 * Server chỉ biết `p1..p12`; chỉ client mới biết layout nào đang hiển thị nên
 * đây là chốt chặn cuối cùng trước khi gợi ý được áp lên từng khung.
 */
export function selectStoryFlowPanelsForLayout(
  panels: readonly AiPageStoryFlowPanelHint[],
  layoutPanelIds: readonly string[],
): AiPageStoryFlowPanelHint[] {
  const allowed = new Map<string, number>();
  layoutPanelIds.forEach((id, index) => allowed.set(id, index));

  const byPanelId = new Map<string, AiPageStoryFlowPanelHint>();
  for (const panel of panels) {
    const layoutIndex = allowed.get(panel.panelId);
    if (layoutIndex === undefined) continue;
    if (typeof panel.hint !== "string" || panel.hint.trim().length === 0) {
      continue;
    }
    const existing = byPanelId.get(panel.panelId);
    if (existing && existing.order <= panel.order) continue;
    byPanelId.set(panel.panelId, panel);
  }

  return [...byPanelId.values()].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return (allowed.get(a.panelId) ?? 0) - (allowed.get(b.panelId) ?? 0);
  });
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractErrorMessage(payload: unknown, status: number): string {
  if (status === 429) {
    return "Bạn đã gửi quá số lượt yêu cầu cho phép (tối đa 5 lượt/phút và 30 lượt/ngày). Vui lòng thử lại sau.";
  }
  if (status === 403) {
    return "Bạn cần đăng nhập để sử dụng tính năng AI.";
  }
  if (status === 503) {
    return "Mô hình AI hỗ trợ vẽ đang tạm thời chờ kích hoạt hoặc bảo trì.";
  }
  if (status === 504) {
    return "Thời gian phân tích của AI quá lâu. Vui lòng thử lại.";
  }

  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const msg = (payload as Record<string, unknown>).message;
    if (typeof msg === "string") {
      return msg;
    }
  }

  return "Không thể hoàn thành yêu cầu phân tích nét vẽ.";
}

function isDrawingReviewResponse(
  value: unknown,
): value is AiDrawingReviewResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const rec = value as Record<string, unknown>;
  return (
    rec.schemaVersion === "1" &&
    rec.task === "drawing_review" &&
    typeof rec.summary === "string" &&
    Array.isArray(rec.sourceIds) &&
    Array.isArray(rec.findings)
  );
}

const GHOST_STROKE_TASKS = new Set([
  "stroke_guidance",
  "composition_overlay",
  "pose_guidance",
]);

/**
 * Kiểm tra phản hồi `page_story_flow`. Xuất để test được hợp đồng này mà không
 * phải dựng fetch giả.
 */
export function isPageStoryFlowResponse(
  value: unknown,
): value is AiPageStoryFlowResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const rec = value as Record<string, unknown>;
  if (
    rec.schemaVersion !== "1" ||
    rec.task !== "page_story_flow" ||
    typeof rec.summary !== "string" ||
    !Array.isArray(rec.sourceIds) ||
    typeof rec.flow !== "string" ||
    !Array.isArray(rec.panels) ||
    rec.panels.length === 0 ||
    rec.panels.length > MAX_STORY_FLOW_PANELS
  ) {
    return false;
  }

  const cameras = new Set<string>(AI_PANEL_CAMERAS);
  return rec.panels.every((panel) => {
    if (typeof panel !== "object" || panel === null) return false;
    const hint = panel as Record<string, unknown>;
    return (
      typeof hint.panelId === "string" &&
      typeof hint.order === "number" &&
      Number.isInteger(hint.order) &&
      typeof hint.hint === "string" &&
      typeof hint.camera === "string" &&
      cameras.has(hint.camera)
    );
  });
}

function isGhostStrokeResponse(value: unknown): value is AiGhostStrokeResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const rec = value as Record<string, unknown>;
  return (
    rec.schemaVersion === "1" &&
    typeof rec.task === "string" &&
    GHOST_STROKE_TASKS.has(rec.task) &&
    typeof rec.summary === "string" &&
    Array.isArray(rec.sourceIds) &&
    Array.isArray(rec.strokes)
  );
}
