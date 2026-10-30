import type { AuthenticatedFetch } from "./auth-api";

/**
 * API nhat ky kiem tra cho trang Admin (Lat 3).
 *
 * Moi ham deu goi qua `authenticatedFetch` (tu gan token va tu lam moi
 * phien nhu cac API khac). Loi HTTP duoc dich sang cau tieng Viet trong
 * `translateAuditLogsError`.
 */

export type AuditAction =
  | "user.role_changed"
  | "user.suspended"
  | "user.unsuspended"
  | "work.approved"
  | "work.rejected";

export interface AuditLog {
  id: string;
  actorId: string;
  actorUsername: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  targetLabel: string;
  detail: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

export interface AuditLogList {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListAuditLogsParams {
  page?: number;
  pageSize?: number;
  actor?: string;
  action?: AuditAction;
  search?: string;
}

export class AuditLogsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuditLogsApiError";
  }
}

async function callAuditLogs(
  authenticatedFetch: AuthenticatedFetch,
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await authenticatedFetch(url, init);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    if (error instanceof Error && error.name === "TypeError") {
      throw new AuditLogsApiError(
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

export function translateAuditLogsError(
  payload: unknown,
  status: number,
): string {
  if (status === 401) {
    return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
  }
  if (status === 403) {
    return "Bạn không có quyền xem nhật ký kiểm tra.";
  }
  if (status === 404) {
    return "Không tìm thấy nhật ký kiểm tra.";
  }
  void payload;
  return "Không tải được nhật ký kiểm tra. Hãy thử lại.";
}

function isAuditLog(value: unknown): value is AuditLog {
  if (typeof value !== "object" || value === null) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.id === "string" &&
    typeof rec.actorId === "string" &&
    typeof rec.actorUsername === "string" &&
    (rec.action === "user.role_changed" ||
      rec.action === "user.suspended" ||
      rec.action === "user.unsuspended" ||
      rec.action === "work.approved" ||
      rec.action === "work.rejected") &&
    typeof rec.targetType === "string" &&
    typeof rec.targetId === "string" &&
    typeof rec.targetLabel === "string" &&
    typeof rec.detail === "object" &&
    rec.detail !== null &&
    (typeof rec.ip === "string" || rec.ip === null) &&
    typeof rec.createdAt === "string"
  );
}

function isAuditLogList(value: unknown): value is AuditLogList {
  if (typeof value !== "object" || value === null) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.total === "number" &&
    typeof rec.page === "number" &&
    typeof rec.pageSize === "number" &&
    Array.isArray(rec.items) &&
    rec.items.every(isAuditLog)
  );
}

export async function listAuditLogs(
  authenticatedFetch: AuthenticatedFetch,
  params: ListAuditLogsParams = {},
  signal?: AbortSignal,
): Promise<AuditLogList> {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.pageSize !== undefined)
    query.set("pageSize", String(params.pageSize));
  const actor = params.actor?.trim();
  if (actor) query.set("actor", actor);
  if (params.action) query.set("action", params.action);
  const search = params.search?.trim();
  if (search) query.set("search", search);
  const suffix = query.toString();
  const url = suffix ? `/api/admin/audit-logs?${suffix}` : "/api/admin/audit-logs";

  const response = await callAuditLogs(authenticatedFetch, url, {
    method: "GET",
    signal,
  });
  const data: unknown = await readPayload(response);
  if (!response.ok) {
    throw new AuditLogsApiError(
      translateAuditLogsError(data, response.status),
      response.status,
    );
  }
  if (!isAuditLogList(data)) {
    throw new AuditLogsApiError(
      "Máy chủ trả về dữ liệu nhật ký không đúng định dạng.",
      response.status,
    );
  }
  return data;
}

/** Nhan tieng Viet cua mot hanh dong audit, dung cho ca bang va CSV. */
export function auditActionLabel(action: AuditAction): string {
  switch (action) {
    case "user.role_changed":
      return "Đổi vai trò";
    case "user.suspended":
      return "Khóa tài khoản";
    case "user.unsuspended":
      return "Mở khóa tài khoản";
    case "work.approved":
      return "Duyệt tác phẩm";
    case "work.rejected":
      return "Từ chối tác phẩm";
  }
}

function roleLabel(value: unknown): string {
  if (value === "admin") return "Quản trị viên";
  if (value === "user") return "Thành viên";
  return typeof value === "string" ? value : "không rõ";
}

function statusLabel(value: unknown): string {
  if (value === "active") return "Đang hoạt động";
  if (value === "suspended") return "Đã khóa";
  return typeof value === "string" ? value : "không rõ";
}

function workTypeLabel(value: unknown): string {
  switch (value) {
    case "manga":
      return "Manga";
    case "novel":
      return "Tiểu thuyết";
    case "animation":
      return "Hoạt hình";
    case "fanart":
      return "Fan art";
    default:
      return typeof value === "string" ? value : "không rõ";
  }
}

function visibilityLabel(value: unknown): string {
  switch (value) {
    case "public":
      return "Công khai";
    case "unlisted":
      return "Chỉ có link";
    case "private":
      return "Riêng tư";
    default:
      return typeof value === "string" ? value : "không rõ";
  }
}

function workStatusLabel(value: unknown): string {
  switch (value) {
    case "pending":
      return "Chờ duyệt";
    case "approved":
      return "Đã duyệt";
    case "rejected":
      return "Bị từ chối";
    default:
      return typeof value === "string" ? value : "không rõ";
  }
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Cac dong chi tiet doc duoc cua mot dong log, suy tu truong detail.
 * Dung chung cho khung chi tiet trong giao dien va cot chi tiet cua CSV.
 */
export function auditDetailLines(log: AuditLog): string[] {
  const detail = log.detail;
  const lines: string[] = [];
  const consumed = new Set<string>();

  const take = (key: string): unknown => {
    consumed.add(key);
    return detail[key];
  };

  if (log.action === "user.role_changed") {
    lines.push(
      `Vai trò: ${roleLabel(take("previousRole"))} -> ${roleLabel(take("newRole"))}`,
    );
  } else if (
    log.action === "user.suspended" ||
    log.action === "user.unsuspended"
  ) {
    lines.push(
      `Trạng thái: ${statusLabel(take("previousStatus"))} -> ${statusLabel(take("newStatus"))}`,
    );
  } else if (log.action === "work.approved" || log.action === "work.rejected") {
    const author = textValue(take("authorUsername"));
    if (author) lines.push(`Tác giả: ${author}`);
    lines.push(`Loại: ${workTypeLabel(take("type"))}`);
    lines.push(`Hiển thị: ${visibilityLabel(take("visibility"))}`);
    lines.push(
      `Trạng thái: ${workStatusLabel(take("previousStatus"))} -> ${workStatusLabel(take("newStatus"))}`,
    );
    const reason = textValue(take("reason"));
    if (reason) lines.push(`Lý do từ chối: ${reason}`);
  }

  for (const [key, value] of Object.entries(detail)) {
    if (consumed.has(key)) continue;
    if (typeof value === "string" || typeof value === "number") {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines;
}

/** Dinh dang thoi gian ISO sang dang ngay/gio tieng Viet. */
export function formatAuditTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Tao noi dung CSV (co BOM de Excel hieu UTF-8) tu dung cac dong dang
 * hien tren trang. Khong tai them du lieu ngoai trang hien tai.
 */
export function buildAuditCsv(rows: AuditLog[]): string {
  const header = ["Thời gian", "Người thực hiện", "Hành động", "Đối tượng", "Chi tiết", "IP"];
  const lines = rows.map((row) =>
    [
      formatAuditTime(row.createdAt),
      row.actorUsername,
      auditActionLabel(row.action),
      row.targetLabel,
      auditDetailLines(row).join("; "),
      row.ip ?? "không xác định",
    ]
      .map(csvCell)
      .join(","),
  );
  return `\uFEFF${header.map(csvCell).join(",")}\n${lines.join("\n")}${lines.length > 0 ? "\n" : ""}`;
}
