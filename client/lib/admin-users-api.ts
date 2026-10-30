import type { AuthenticatedFetch } from "./auth-api";

/**
 * API quản lý user cho trang Admin (Lát 2).
 *
 * Mọi hàm đều gọi qua `authenticatedFetch` (tự gắn token và tự làm mới
 * phiên như các API khác). Lỗi HTTP được dịch sang câu tiếng Việt trong
 * `translateAdminUsersError`; thông báo kỹ thuật của server chỉ hiện khi
 * không nhận ra nguyên nhân.
 */

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  role: "user" | "admin";
  status: "active" | "suspended";
  termsAcceptedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserCounts {
  total: number;
  admin: number;
  active: number;
  suspended: number;
}

export interface AdminUserList {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  counts: AdminUserCounts;
}

export interface ListAdminUsersParams {
  page?: number;
  pageSize?: number;
  q?: string;
  role?: "user" | "admin";
  status?: "active" | "suspended";
}

export class AdminUsersApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AdminUsersApiError";
  }
}

async function callAdminUsers(
  authenticatedFetch: AuthenticatedFetch,
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await authenticatedFetch(url, init);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    if (error instanceof Error && error.name === "TypeError") {
      throw new AdminUsersApiError(
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
 * Dịch lỗi của API quản lý user sang tiếng Việt.
 *
 * Ưu tiên thông báo đã biết của server (chuỗi tiếng Anh cố định trong
 * UsersService) vì nó nói đúng nguyên nhân; sau đó rơi về theo HTTP status.
 * Xuất để test trực tiếp mà không phải dựng fetch giả.
 */
export function translateAdminUsersError(
  payload: unknown,
  status: number,
): string {
  if (typeof payload === "object" && payload !== null) {
    const record = payload as Record<string, unknown>;
    const message = record.message;
    if (typeof message === "string") {
      if (message === "Cannot suspend an admin account") {
        return "Không thể khóa tài khoản quản trị viên.";
      }
      if (message === "Cannot demote the last admin") {
        return "Không thể hạ quyền quản trị viên cuối cùng. Hãy cấp quyền cho một tài khoản khác trước.";
      }
      if (
        message === "Cannot change your own role" ||
        message === "Cannot change your own account status"
      ) {
        return "Không thể tự thay đổi tài khoản của chính mình.";
      }
      if (message === "User not found") {
        return "Không tìm thấy người dùng này. Có thể tài khoản đã bị xóa.";
      }
      if (message === "Account is suspended") {
        return "Tài khoản này đang bị khóa.";
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
    return "Không tìm thấy người dùng này. Có thể tài khoản đã bị xóa.";
  }
  if (status === 409) {
    return "Không thể thực hiện vì dữ liệu xung đột. Có thể đây là quản trị viên cuối cùng.";
  }
  return "Không tải được danh sách người dùng. Hãy thử lại.";
}

function isAdminUser(value: unknown): value is AdminUser {
  if (typeof value !== "object" || value === null) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.id === "string" &&
    typeof rec.username === "string" &&
    typeof rec.displayName === "string" &&
    (rec.role === "user" || rec.role === "admin") &&
    (rec.status === "active" || rec.status === "suspended") &&
    typeof rec.termsAcceptedAt === "string" &&
    typeof rec.createdAt === "string" &&
    typeof rec.updatedAt === "string"
  );
}

function isAdminUserList(value: unknown): value is AdminUserList {
  if (typeof value !== "object" || value === null) return false;
  const rec = value as Record<string, unknown>;
  if (
    typeof rec.total !== "number" ||
    typeof rec.page !== "number" ||
    typeof rec.pageSize !== "number" ||
    !Array.isArray(rec.items) ||
    !rec.items.every(isAdminUser)
  ) {
    return false;
  }
  const counts = rec.counts;
  if (typeof counts !== "object" || counts === null) return false;
  const c = counts as Record<string, unknown>;
  return (
    typeof c.total === "number" &&
    typeof c.admin === "number" &&
    typeof c.active === "number" &&
    typeof c.suspended === "number"
  );
}

export async function listAdminUsers(
  authenticatedFetch: AuthenticatedFetch,
  params: ListAdminUsersParams = {},
  signal?: AbortSignal,
): Promise<AdminUserList> {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.pageSize !== undefined)
    query.set("pageSize", String(params.pageSize));
  const q = params.q?.trim();
  if (q) query.set("q", q);
  if (params.role) query.set("role", params.role);
  if (params.status) query.set("status", params.status);
  const suffix = query.toString();
  const url = suffix ? `/api/admin/users?${suffix}` : "/api/admin/users";

  const response = await callAdminUsers(authenticatedFetch, url, {
    method: "GET",
    signal,
  });
  const data: unknown = await readPayload(response);
  if (!response.ok) {
    throw new AdminUsersApiError(
      translateAdminUsersError(data, response.status),
      response.status,
    );
  }
  if (!isAdminUserList(data)) {
    throw new Error("Phản hồi danh sách người dùng không đúng cấu trúc yêu cầu.");
  }
  return data;
}

async function changeAdminUser(
  authenticatedFetch: AuthenticatedFetch,
  userId: string,
  path: "role" | "status",
  body: Record<string, string>,
): Promise<AdminUser> {
  const response = await callAdminUsers(
    authenticatedFetch,
    `/api/admin/users/${encodeURIComponent(userId)}/${path}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data: unknown = await readPayload(response);
  if (!response.ok) {
    throw new AdminUsersApiError(
      translateAdminUsersError(data, response.status),
      response.status,
    );
  }
  if (!isAdminUser(data)) {
    throw new Error("Phản hồi cập nhật người dùng không đúng cấu trúc yêu cầu.");
  }
  return data;
}

export function changeAdminUserRole(
  authenticatedFetch: AuthenticatedFetch,
  userId: string,
  role: "user" | "admin",
): Promise<AdminUser> {
  return changeAdminUser(authenticatedFetch, userId, "role", { role });
}

export function changeAdminUserStatus(
  authenticatedFetch: AuthenticatedFetch,
  userId: string,
  status: "active" | "suspended",
): Promise<AdminUser> {
  return changeAdminUser(authenticatedFetch, userId, "status", { status });
}
