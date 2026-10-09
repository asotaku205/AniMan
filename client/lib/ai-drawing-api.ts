import type { AuthenticatedFetch } from "./auth-api";

export type AiDrawingTask =
  | "composition_guidance"
  | "drawing_review"
  | "stroke_guidance"
  | "composition_overlay"
  | "pose_guidance";

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
  opacity: number;
  strokeWidth: number;
  dashed?: boolean;
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

export interface AiDrawingRequestPayload {
  task: AiDrawingTask;
  prompt?: string;
  toolHint?: AiDrawingToolHint;
  image: AiDrawingImagePayload;
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
