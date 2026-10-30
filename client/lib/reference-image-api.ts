import type { AuthenticatedFetch } from "./auth-api";
import {
  AiDrawingApiError,
  type AiDrawingImagePayload,
} from "./ai-drawing-api";

/**
 * API ảnh mẫu tham khảo (Cloudflare Workers AI), chạy bất đồng bộ bằng job.
 *
 * Tạo job trả về ngay; client hỏi lại trạng thái mỗi 5 giây cho tới khi
 * job xong, thất bại, timeout hoặc bị hủy. Job timeout là trạng thái
 * RIÊNG, không phải thất bại: hết 300 giây mà không rõ lần gọi đầu đã
 * sinh xong hay chưa, nên không tự thử lại âm thầm.
 */

export type ReferenceImageJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "timeout"
  | "cancelled";

export interface ReferenceImageJob {
  id: string;
  status: ReferenceImageJobStatus;
  model: string;
  seed: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  elapsedMs: number | null;
  imageDataUrl: string | null;
  note: string;
  coloredShare: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface CreateReferenceImageJobInput {
  source: "prompt" | "drawing-prompt";
  sceneType: string;
  prompt?: string;
  fixHints?: string[];
  image?: AiDrawingImagePayload;
}

export interface ReferenceImageStatus {
  enabled: boolean;
  model: string;
  providerTimeoutMs: number;
}

/**
 * Khung vẽ có thật sự trắng hay không: không một điểm ảnh nào nhìn thấy
 * được trên nền trắng. Canvas hiển thị của Manga Studio có nền trong
 * suốt (giấy trắng là nền CSS của khung), nên điểm trong suốt là trắng,
 * điểm trắng đục cũng là trắng. Ngưỡng 248 chừa dư địa cho nhiễu nhẹ,
 * nhưng một nét xám nhạt vẫn tính là có vẽ. Đọc pixel thất bại thì trả
 * về false (coi như có vẽ) để không bao giờ chặn nhầm một lần sinh.
 */
export function canvasIsBlank(canvas: HTMLCanvasElement | null): boolean {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return true;
  let ctx: CanvasRenderingContext2D | null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    return false;
  }
  if (!ctx) return false;
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    return false;
  }
  for (let i = 0; i + 3 < data.length; i += 4) {
    const alpha = data[i + 3] ?? 0;
    if (alpha === 0) continue;
    const r = data[i] ?? 255;
    const g = data[i + 1] ?? 255;
    const b = data[i + 2] ?? 255;
    if (r < 248 || g < 248 || b < 248) return false;
  }
  return true;
}

/** Câu tiếng Việt theo mã lỗi ổn định của server (xem REFERENCE_IMAGE_ERROR_CODES). */
export const REFERENCE_IMAGE_ERROR_MESSAGES: Record<string, string> = {
  reference_image_disabled:
    "Sinh ảnh mẫu chưa được bật trên server. Hãy kiểm tra cấu hình Cloudflare trên server rồi thử lại.",
  reference_image_auth:
    "Token Cloudflare trên server bị từ chối. Hãy kiểm tra lại token và quyền Workers AI rồi thử lại.",
  reference_image_overloaded:
    "Cloudflare đang quá tải hoặc đã hết hạn mức neuron trong ngày. Hãy thử lại sau.",
  reference_image_error:
    "Không sinh được ảnh mẫu lúc này. Hãy thử lại sau.",
  reference_image_invalid:
    "Ảnh Cloudflare trả về không đúng phong cách nét vẽ trắng đen. Hãy thử lại, mô tả rõ hơn nếu cần.",
  reference_image_timeout:
    "Hết thời gian chờ mà chưa rõ ảnh đã sinh xong hay chưa. Không tự thử lại; hãy bấm Sinh ảnh mẫu để tạo lần sinh mới nếu cần.",
  reference_image_blank_sketch:
    "Khung vẽ còn trắng và chưa nhập mô tả. Hãy vẽ vài nét hoặc nhập mô tả rồi sinh lại.",
};

export function getReferenceImageErrorMessage(
  errorCode: string | null,
  fallback: string,
): string {
  if (errorCode && REFERENCE_IMAGE_ERROR_MESSAGES[errorCode]) {
    return REFERENCE_IMAGE_ERROR_MESSAGES[errorCode];
  }
  return fallback;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function extractErrorMessage(data: unknown, status: number): string {
  if (typeof data === "object" && data !== null) {
    const rec = data as Record<string, unknown>;
    if (typeof rec.code === "string") {
      return getReferenceImageErrorMessage(rec.code, `Lỗi ${status}.`);
    }
    if (typeof rec.message === "string" && rec.message.length > 0) {
      return rec.message;
    }
  }
  return `Lỗi ${status}.`;
}

async function callReferenceImage(
  authenticatedFetch: AuthenticatedFetch,
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await authenticatedFetch(url, init);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    if (error instanceof Error && error.name === "TypeError") {
      throw new AiDrawingApiError(
        "Không kết nối được máy chủ AI. Hãy kiểm tra server AniMan đã chạy (cổng 8080) rồi thử lại.",
        0,
      );
    }
    throw error;
  }
}

function isReferenceImageJob(data: unknown): data is ReferenceImageJob {
  if (typeof data !== "object" || data === null) return false;
  const rec = data as Record<string, unknown>;
  return (
    typeof rec.id === "string" &&
    typeof rec.status === "string" &&
    typeof rec.model === "string" &&
    typeof rec.seed === "number"
  );
}

export async function getReferenceImageStatus(
  authenticatedFetch: AuthenticatedFetch,
  signal?: AbortSignal,
): Promise<ReferenceImageStatus> {
  const response = await callReferenceImage(
    authenticatedFetch,
    "/ai/reference-image/status",
    { method: "GET", signal },
  );
  const data = await readJson(response);
  if (!response.ok) {
    throw new AiDrawingApiError(
      extractErrorMessage(data, response.status),
      response.status,
    );
  }
  if (
    typeof data !== "object" ||
    data === null ||
    typeof (data as Record<string, unknown>).enabled !== "boolean"
  ) {
    throw new Error("Phản hồi trạng thái ảnh mẫu không đúng cấu trúc yêu cầu.");
  }
  return data as ReferenceImageStatus;
}

export async function createReferenceImageJob(
  authenticatedFetch: AuthenticatedFetch,
  input: CreateReferenceImageJobInput,
  signal?: AbortSignal,
): Promise<ReferenceImageJob> {
  const response = await callReferenceImage(
    authenticatedFetch,
    "/ai/reference-image/jobs",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    },
  );
  const data = await readJson(response);
  if (!response.ok) {
    throw new AiDrawingApiError(
      extractErrorMessage(data, response.status),
      response.status,
    );
  }
  if (!isReferenceImageJob(data)) {
    throw new Error("Phản hồi tạo job ảnh mẫu không đúng cấu trúc yêu cầu.");
  }
  return data;
}

export async function getReferenceImageJob(
  authenticatedFetch: AuthenticatedFetch,
  jobId: string,
  signal?: AbortSignal,
): Promise<ReferenceImageJob> {
  const response = await callReferenceImage(
    authenticatedFetch,
    `/ai/reference-image/jobs/${encodeURIComponent(jobId)}`,
    { method: "GET", signal },
  );
  const data = await readJson(response);
  if (!response.ok) {
    throw new AiDrawingApiError(
      extractErrorMessage(data, response.status),
      response.status,
    );
  }
  if (!isReferenceImageJob(data)) {
    throw new Error("Phản hồi job ảnh mẫu không đúng cấu trúc yêu cầu.");
  }
  return data;
}

export async function cancelReferenceImageJob(
  authenticatedFetch: AuthenticatedFetch,
  jobId: string,
  signal?: AbortSignal,
): Promise<ReferenceImageJob> {
  const response = await callReferenceImage(
    authenticatedFetch,
    `/ai/reference-image/jobs/${encodeURIComponent(jobId)}`,
    { method: "DELETE", signal },
  );
  const data = await readJson(response);
  if (!response.ok) {
    throw new AiDrawingApiError(
      extractErrorMessage(data, response.status),
      response.status,
    );
  }
  if (!isReferenceImageJob(data)) {
    throw new Error("Phản hồi hủy job ảnh mẫu không đúng cấu trúc yêu cầu.");
  }
  return data;
}

const TERMINAL_JOB_STATUSES: ReferenceImageJobStatus[] = [
  "succeeded",
  "failed",
  "timeout",
  "cancelled",
];

/**
 * Hỏi lại job mỗi `intervalMs` cho tới trạng thái cuối. Hủy bằng
 * `signal`: ném lỗi có `name === "AbortError"` để caller phân biệt với
 * lỗi thật. `onUpdate` nhận từng trạng thái giữa chừng để hiện tiến trình.
 */
export async function pollReferenceImageJob(
  authenticatedFetch: AuthenticatedFetch,
  jobId: string,
  options: {
    intervalMs?: number;
    signal?: AbortSignal;
    onUpdate?: (job: ReferenceImageJob) => void;
  } = {},
): Promise<ReferenceImageJob> {
  const intervalMs = options.intervalMs ?? 5000;
  const signal = options.signal;
  for (;;) {
    if (signal?.aborted) {
      const abortError = new Error("Polling aborted");
      abortError.name = "AbortError";
      throw abortError;
    }
    const job = await getReferenceImageJob(authenticatedFetch, jobId, signal);
    options.onUpdate?.(job);
    if (TERMINAL_JOB_STATUSES.includes(job.status)) {
      return job;
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, intervalMs);
      if (!signal) return;
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          const abortError = new Error("Polling aborted");
          abortError.name = "AbortError";
          reject(abortError);
        },
        { once: true },
      );
    });
  }
}

/** Cạnh dài nhất của phác thảo gửi đi: dưới giới hạn 512 px của klein, giữ tỉ lệ. */
export const REFERENCE_SKETCH_MAX_DIMENSION = 500;

export function referenceSketchTargetSize(
  width: number,
  height: number,
  maxDimension = REFERENCE_SKETCH_MAX_DIMENSION,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 1, height: 1 };
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Chụp phác thảo của người dùng thành ảnh nhỏ nền trắng để gửi cho klein.
 * Khác `createCanvasSnapshot`: thu nhỏ còn tối đa 500 px (giới hạn đầu
 * vào của klein) và không nâng kích thước tối thiểu.
 */
export function createSketchSnapshot(
  canvas: HTMLCanvasElement,
): AiDrawingImagePayload | null {
  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    return null;
  }
  const target = referenceSketchTargetSize(canvas.width, canvas.height);
  const snapshotCanvas = document.createElement("canvas");
  snapshotCanvas.width = target.width;
  snapshotCanvas.height = target.height;
  const ctx = snapshotCanvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, target.width, target.height);
  ctx.drawImage(canvas, 0, 0, target.width, target.height);
  const dataUrl = snapshotCanvas.toDataURL("image/png");
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) return null;
  return {
    data: dataUrl.slice(prefix.length),
    mimeType: "image/png",
    width: target.width,
    height: target.height,
  };
}
