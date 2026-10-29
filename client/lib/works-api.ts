import type { AuthenticatedFetch } from "./auth-api";
import { refreshSession } from "./auth-api";

/**
 * API tác phẩm của user cho Lát 2A: gửi duyệt, danh sách công khai,
 * tác phẩm của mình, gửi duyệt lại, hàng đợi duyệt của admin.
 *
 * Mọi hàm nhận `authenticatedFetch` như admin-users-api, trừ
 * `listPublicWorks` (danh sách công khai xem được cả khi chưa đăng nhập)
 * và `submitWork` (tải file bằng XMLHttpRequest để báo tiến trình).
 */

export type WorkType = "manga" | "novel" | "animation" | "fanart";
export type WorkVisibility = "public" | "unlisted" | "private";
export type WorkStatus = "pending" | "approved" | "rejected";

export interface WorkAuthor {
  id: string;
  username: string;
  displayName: string;
}

export interface WorkSourceRef {
  kind: "manga" | "anim" | "novel";
  id: string;
  label: string;
}

export interface WorkSubmission {
  id: string;
  author: WorkAuthor;
  type: WorkType;
  title: string;
  description: string;
  genre: string;
  tags: string[];
  visibility: WorkVisibility;
  status: WorkStatus;
  rejectReason: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sourceRef: WorkSourceRef | null;
  coverUrl: string | null;
  fileUrl: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkList {
  items: WorkSubmission[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminWorkQueue extends WorkList {
  counts: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
}

export interface ListWorksParams {
  page?: number;
  pageSize?: number;
  type?: WorkType;
  status?: WorkStatus;
}

export class WorksApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WorksApiError";
  }
}

/** Giới hạn file đã chốt, dùng để kiểm tra trước khi tải lên. */
export const WORK_FILE_MAX_BYTES: Record<WorkType, number> = {
  animation: 1024 * 1024 * 1024,
  manga: 100 * 1024 * 1024,
  novel: 100 * 1024 * 1024,
  fanart: 100 * 1024 * 1024,
};

export const WORK_COVER_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Kiểm tra file trước khi tải lên, trả về câu lỗi tiếng Việt hoặc null
 * khi hợp lệ. Hàm thuần để test được mà không cần DOM.
 */
export function checkWorkUploadLimits(
  type: WorkType,
  file: { size: number; name: string },
  cover?: { size: number; name: string } | null,
): string | null {
  const maxBytes = WORK_FILE_MAX_BYTES[type];
  if (file.size > maxBytes) {
    return type === "animation"
      ? "File video vượt quá giới hạn 1GB."
      : "File tác phẩm vượt quá giới hạn 100MB.";
  }
  if (file.size === 0) {
    return "File tác phẩm đang trống, hãy chọn file khác.";
  }
  if (cover && cover.size > WORK_COVER_MAX_BYTES) {
    return "Ảnh bìa vượt quá giới hạn 5MB.";
  }
  return null;
}

async function callWorks(
  authenticatedFetch: AuthenticatedFetch,
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await authenticatedFetch(url, init);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    if (error instanceof Error && error.name === "TypeError") {
      throw new WorksApiError(
        "Không kết nối được máy chủ. Hãy kiểm tra server AniMan đã chạy rồi thử lại.",
        0,
      );
    }
    throw error;
  }
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

/**
 * Dịch lỗi của API tác phẩm sang tiếng Việt. Ưu tiên thông báo đã biết
 * của server vì nó nói đúng nguyên nhân; sau đó rơi về theo HTTP status.
 */
export function translateWorksError(
  payload: unknown,
  status: number,
): string {
  if (typeof payload === "object" && payload !== null) {
    const record = payload as Record<string, unknown>;
    const message = record.message;
    if (typeof message === "string") {
      if (message === "Work file is required.") {
        return "Chưa chọn file tác phẩm.";
      }
      if (message === "Title is required.") {
        return "Chưa nhập tiêu đề tác phẩm.";
      }
      if (message.startsWith("Work file exceeds the limit")) {
        return "File tác phẩm vượt quá giới hạn cho phép.";
      }
      if (message === "Cover image exceeds 5MB.") {
        return "Ảnh bìa vượt quá giới hạn 5MB.";
      }
      if (message === "Work file type is not allowed.") {
        return "Định dạng file không phù hợp với loại tác phẩm đã chọn.";
      }
      if (message === "Cover must be an image.") {
        return "Ảnh bìa phải là file hình ảnh.";
      }
      if (message === "Submission not found.") {
        return "Không tìm thấy tác phẩm này.";
      }
      if (message === "Only pending submissions can be reviewed.") {
        return "Chỉ duyệt được tác phẩm đang chờ duyệt.";
      }
      if (message === "Only rejected submissions can be resubmitted.") {
        return "Chỉ gửi duyệt lại được tác phẩm đã bị từ chối.";
      }
      if (
        message === "Rejection reason must be at least 10 characters." ||
        message.startsWith("Rejection reason")
      ) {
        return "Lý do từ chối phải có ít nhất 10 ký tự.";
      }
      if (message === "Only the author can resubmit.") {
        return "Chỉ tác giả mới gửi duyệt lại được tác phẩm này.";
      }
      if (message === "File exceeds the maximum allowed size.") {
        return "File vượt quá giới hạn cho phép.";
      }
      if (Array.isArray(message)) {
        return "Thông tin gửi lên chưa đúng, hãy kiểm tra lại các trường.";
      }
    }
  }

  if (status === 401) {
    return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
  }
  if (status === 403) {
    return "Bạn không có quyền thực hiện thao tác này.";
  }
  if (status === 404) {
    return "Không tìm thấy tác phẩm này.";
  }
  if (status === 409) {
    return "Trạng thái tác phẩm đã thay đổi, hãy tải lại trang.";
  }
  if (status === 413) {
    return "File vượt quá giới hạn cho phép.";
  }
  return "Không tải được dữ liệu tác phẩm. Hãy thử lại.";
}

function isWorkSubmission(value: unknown): value is WorkSubmission {
  if (typeof value !== "object" || value === null) return false;
  const rec = value as Record<string, unknown>;
  const author = rec.author;
  return (
    typeof rec.id === "string" &&
    typeof author === "object" &&
    author !== null &&
    typeof (author as Record<string, unknown>).id === "string" &&
    typeof (author as Record<string, unknown>).username === "string" &&
    typeof (author as Record<string, unknown>).displayName === "string" &&
    (rec.type === "manga" ||
      rec.type === "novel" ||
      rec.type === "animation" ||
      rec.type === "fanart") &&
    typeof rec.title === "string" &&
    typeof rec.description === "string" &&
    typeof rec.genre === "string" &&
    Array.isArray(rec.tags) &&
    (rec.visibility === "public" ||
      rec.visibility === "unlisted" ||
      rec.visibility === "private") &&
    (rec.status === "pending" ||
      rec.status === "approved" ||
      rec.status === "rejected") &&
    typeof rec.fileName === "string" &&
    typeof rec.fileSize === "number" &&
    typeof rec.mimeType === "string" &&
    typeof rec.fileUrl === "string" &&
    typeof rec.createdAt === "string" &&
    typeof rec.updatedAt === "string"
  );
}

function isWorkList(value: unknown): value is WorkList {
  if (typeof value !== "object" || value === null) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.total === "number" &&
    typeof rec.page === "number" &&
    typeof rec.pageSize === "number" &&
    Array.isArray(rec.items) &&
    rec.items.every(isWorkSubmission)
  );
}

function isAdminWorkQueue(value: unknown): value is AdminWorkQueue {
  if (!isWorkList(value)) return false;
  const counts = (value as unknown as Record<string, unknown>).counts;
  if (typeof counts !== "object" || counts === null) return false;
  const c = counts as Record<string, unknown>;
  return (
    typeof c.pending === "number" &&
    typeof c.approved === "number" &&
    typeof c.rejected === "number" &&
    typeof c.total === "number"
  );
}

function buildListQuery(params: ListWorksParams): string {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.pageSize !== undefined)
    query.set("pageSize", String(params.pageSize));
  if (params.type) query.set("type", params.type);
  if (params.status) query.set("status", params.status);
  return query.toString();
}

async function readWorkList(
  response: Response,
  fallbackMessage: string,
): Promise<WorkList> {
  const data: unknown = await readPayload(response);
  if (!response.ok) {
    throw new WorksApiError(
      translateWorksError(data, response.status),
      response.status,
    );
  }
  if (!isWorkList(data)) {
    throw new Error(fallbackMessage);
  }
  return data;
}

export async function listPublicWorks(
  params: ListWorksParams = {},
  fetchFn: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<WorkList> {
  const suffix = buildListQuery(params);
  const url = suffix ? `/works?${suffix}` : "/works";
  let response: Response;
  try {
    response = await fetchFn(url, { method: "GET", signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new WorksApiError(
      "Không kết nối được máy chủ. Hãy kiểm tra server AniMan đã chạy rồi thử lại.",
      0,
    );
  }
  return readWorkList(
    response,
    "Phản hồi danh sách tác phẩm không đúng cấu trúc yêu cầu.",
  );
}

export async function listMyWorks(
  authenticatedFetch: AuthenticatedFetch,
  params: ListWorksParams = {},
  signal?: AbortSignal,
): Promise<WorkList> {
  const suffix = buildListQuery(params);
  const url = suffix ? `/works/mine?${suffix}` : "/works/mine";
  const response = await callWorks(authenticatedFetch, url, {
    method: "GET",
    signal,
  });
  return readWorkList(
    response,
    "Phản hồi danh sách tác phẩm không đúng cấu trúc yêu cầu.",
  );
}

export async function resubmitWork(
  authenticatedFetch: AuthenticatedFetch,
  workId: string,
): Promise<WorkSubmission> {
  const response = await callWorks(
    authenticatedFetch,
    `/works/${encodeURIComponent(workId)}/resubmit`,
    { method: "PATCH" },
  );
  const data: unknown = await readPayload(response);
  if (!response.ok) {
    throw new WorksApiError(
      translateWorksError(data, response.status),
      response.status,
    );
  }
  if (!isWorkSubmission(data)) {
    throw new Error("Phản hồi gửi duyệt lại không đúng cấu trúc yêu cầu.");
  }
  return data;
}

export async function listReviewQueue(
  authenticatedFetch: AuthenticatedFetch,
  params: ListWorksParams = {},
  signal?: AbortSignal,
): Promise<AdminWorkQueue> {
  const suffix = buildListQuery(params);
  const url = suffix ? `/admin/works?${suffix}` : "/admin/works";
  const response = await callWorks(authenticatedFetch, url, {
    method: "GET",
    signal,
  });
  const data: unknown = await readPayload(response);
  if (!response.ok) {
    throw new WorksApiError(
      translateWorksError(data, response.status),
      response.status,
    );
  }
  if (!isAdminWorkQueue(data)) {
    throw new Error("Phản hồi hàng đợi duyệt không đúng cấu trúc yêu cầu.");
  }
  return data;
}

export async function reviewWork(
  authenticatedFetch: AuthenticatedFetch,
  workId: string,
  action: "approve" | "reject",
  reason?: string,
): Promise<WorkSubmission> {
  const response = await callWorks(
    authenticatedFetch,
    `/admin/works/${encodeURIComponent(workId)}/${action}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "reject" ? { reason: reason ?? "" } : {}),
    },
  );
  const data: unknown = await readPayload(response);
  if (!response.ok) {
    throw new WorksApiError(
      translateWorksError(data, response.status),
      response.status,
    );
  }
  if (!isWorkSubmission(data)) {
    throw new Error("Phản hồi duyệt tác phẩm không đúng cấu trúc yêu cầu.");
  }
  return data;
}

/** URL đọc file/ảnh bìa qua endpoint có kiểm tra quyền của server. */
export function getWorkFileUrl(work: Pick<WorkSubmission, "fileUrl">): string {
  return work.fileUrl;
}

export function getWorkCoverUrl(
  work: Pick<WorkSubmission, "coverUrl">,
): string | null {
  return work.coverUrl;
}

export interface WorkUploadTransport {
  /** Token Bearer hiện tại, lấy từ AuthProvider. */
  getAccessToken: () => string | null;
}

interface UploadResult {
  status: number;
  text: string;
}

function sendFormDataWithFetch(
  formData: FormData,
  token: string | null,
  signal?: AbortSignal,
): Promise<UploadResult> {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch("/works", {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
    signal,
  }).then(async (response) => ({
    status: response.status,
    text: await response.text(),
  }));
}

function sendFormDataWithXhr(
  formData: FormData,
  token: string | null,
  onProgress?: (loaded: number, total: number) => void,
): Promise<UploadResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/works");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (onProgress) onProgress(event.loaded, event.total);
    };
    xhr.onload = () => {
      resolvePromise({ status: xhr.status, text: xhr.responseText });
    };
    xhr.onerror = () => {
      rejectPromise(
        new TypeError("Network request failed during work upload."),
      );
    };
    xhr.onabort = () => {
      rejectPromise(new DOMException("Upload aborted.", "AbortError"));
    };
    xhr.send(formData);
  });
}

/**
 * Gửi tác phẩm lên server để duyệt. Dùng XMLHttpRequest để báo tiến
 * trình tải lên; môi trường không có XMLHttpRequest (test, SSR) thì
 * rơi về fetch và chỉ báo 100% khi xong. Token hết hạn (401) thì làm
 * mới phiên một lần rồi gửi lại, giống authenticatedFetch.
 */
export async function submitWork(
  transport: WorkUploadTransport,
  formData: FormData,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<WorkSubmission> {
  const sendOnce = async (token: string | null): Promise<UploadResult> => {
    if (typeof XMLHttpRequest !== "undefined") {
      return sendFormDataWithXhr(formData, token, onProgress);
    }
    const result = await sendFormDataWithFetch(formData, token, signal);
    if (onProgress) {
      const total = Number(formData.get("file") instanceof File
        ? (formData.get("file") as File).size
        : 0);
      onProgress(total, total);
    }
    return result;
  };

  let result: UploadResult;
  try {
    result = await sendOnce(transport.getAccessToken());
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    if (error instanceof Error && error.name === "TypeError") {
      throw new WorksApiError(
        "Không kết nối được máy chủ. Hãy kiểm tra server AniMan đã chạy rồi thử lại.",
        0,
      );
    }
    throw error;
  }

  if (result.status === 401) {
    const session = await refreshSession();
    if (!session) {
      throw new WorksApiError(
        "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
        401,
      );
    }
    result = await sendOnce(session.accessToken);
  }

  let data: unknown;
  try {
    data = result.text ? (JSON.parse(result.text) as unknown) : undefined;
  } catch {
    data = result.text;
  }
  if (result.status < 200 || result.status >= 300) {
    throw new WorksApiError(
      translateWorksError(data, result.status),
      result.status,
    );
  }
  if (!isWorkSubmission(data)) {
    throw new Error("Phản hồi gửi tác phẩm không đúng cấu trúc yêu cầu.");
  }
  return data;
}
