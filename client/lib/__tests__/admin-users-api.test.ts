// @vitest-environment node
/**
 * API quản lý user phía client (Lát 2): tham số query, đọc envelope
 * phân trang và dịch mã lỗi sang tiếng Việt.
 */
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedFetch } from "@/lib/auth-api";
import {
  changeAdminUserRole,
  changeAdminUserStatus,
  listAdminUsers,
  translateAdminUsersError,
  type AdminUser,
} from "@/lib/admin-users-api";

function adminUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: "user-1",
    username: "reader",
    displayName: "Reader",
    role: "user",
    status: "active",
    termsAcceptedAt: "2026-09-01T00:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("listAdminUsers", () => {
  it("ghep dung tham so query, bo qua gia tri rong", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        items: [adminUser()],
        total: 1,
        page: 2,
        pageSize: 20,
        counts: { total: 1, admin: 0, active: 1, suspended: 0 },
      }),
    );
    const result = await listAdminUsers(fetchFn as unknown as AuthenticatedFetch, {
      page: 2,
      pageSize: 20,
      q: "  sakura ",
      role: "admin",
      status: "suspended",
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "/admin/users?page=2&pageSize=20&q=sakura&role=admin&status=suspended",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.counts.total).toBe(1);
  });

  it("khong them query khi khong co tham so", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        counts: { total: 0, admin: 0, active: 0, suspended: 0 },
      }),
    );
    await listAdminUsers(fetchFn as unknown as AuthenticatedFetch, {});
    expect(fetchFn).toHaveBeenCalledWith(
      "/admin/users",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("nem loi tieng Viet khi server tra 403", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ message: "Insufficient permissions" }, 403),
    );
    await expect(
      listAdminUsers(fetchFn as unknown as AuthenticatedFetch, {}),
    ).rejects.toThrow("Bạn không có quyền thực hiện thao tác này.");
  });

  it("nem loi khi envelope sai cau truc", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ items: "khong-phai-mang" }));
    await expect(
      listAdminUsers(fetchFn as unknown as AuthenticatedFetch, {}),
    ).rejects.toThrow("không đúng cấu trúc");
  });

  it("nem loi mang khi fetch that bai", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(
      listAdminUsers(fetchFn as unknown as AuthenticatedFetch, {}),
    ).rejects.toThrow("Không kết nối được máy chủ.");
  });
});

describe("changeAdminUserRole / changeAdminUserStatus", () => {
  it("PATCH dung duong dan va body", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(adminUser({ role: "admin" })),
    );
    const result = await changeAdminUserRole(
      fetchFn as unknown as AuthenticatedFetch,
      "user-1",
      "admin",
    );
    expect(fetchFn).toHaveBeenCalledWith(
      "/admin/users/user-1/role",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
      }),
    );
    expect(result.role).toBe("admin");
  });

  it("dich loi ha admin cuoi cung sang tieng Viet", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ message: "Cannot demote the last admin" }, 409),
    );
    await expect(
      changeAdminUserRole(
        fetchFn as unknown as AuthenticatedFetch,
        "user-1",
        "user",
      ),
    ).rejects.toThrow("quản trị viên cuối cùng");
  });

  it("PATCH status dung duong dan va body", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(adminUser({ status: "suspended" })),
    );
    const result = await changeAdminUserStatus(
      fetchFn as unknown as AuthenticatedFetch,
      "user-1",
      "suspended",
    );
    expect(fetchFn).toHaveBeenCalledWith(
      "/admin/users/user-1/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "suspended" }),
      }),
    );
    expect(result.status).toBe("suspended");
  });
});

describe("translateAdminUsersError", () => {
  it("dich cac thong bao da biet cua server", () => {
    expect(
      translateAdminUsersError({ message: "Cannot suspend an admin account" }, 403),
    ).toBe("Không thể khóa tài khoản quản trị viên.");
    expect(
      translateAdminUsersError({ message: "Cannot change your own role" }, 403),
    ).toBe("Không thể tự thay đổi tài khoản của chính mình.");
    expect(
      translateAdminUsersError({ message: "User not found" }, 404),
    ).toBe("Không tìm thấy người dùng này. Có thể tài khoản đã bị xóa.");
  });

  it("roi ve theo HTTP status khi thong bao la", () => {
    expect(translateAdminUsersError({}, 401)).toBe(
      "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
    );
    expect(translateAdminUsersError({}, 404)).toBe(
      "Không tìm thấy người dùng này. Có thể tài khoản đã bị xóa.",
    );
    expect(translateAdminUsersError({}, 409)).toContain("xung đột");
    expect(translateAdminUsersError({}, 500)).toBe(
      "Không tải được danh sách người dùng. Hãy thử lại.",
    );
  });
});
