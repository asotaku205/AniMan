// @vitest-environment node
/**
 * API nhat ky kiem tra phia client (Lat 3): tham so query, dich loi,
 * nhan hanh dong, dong chi tiet doc duoc va xuat CSV cua trang hien tai.
 */
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedFetch } from "@/lib/auth-api";
import {
  AuditLogsApiError,
  auditActionLabel,
  auditDetailLines,
  buildAuditCsv,
  formatAuditTime,
  listAuditLogs,
  translateAuditLogsError,
  type AuditLog,
} from "@/lib/admin-audit-api";

function auditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "log-1",
    actorId: "admin-1",
    actorUsername: "son_admin",
    action: "user.suspended",
    targetType: "user",
    targetId: "user-1",
    targetLabel: "spam_bot_01",
    detail: { previousStatus: "active", newStatus: "suspended" },
    ip: "203.0.113.7",
    createdAt: "2026-10-29T00:41:00.000Z",
    ...overrides,
  };
}

function jsonFetch(payload: unknown, status = 200): AuthenticatedFetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    }),
  ) as unknown as AuthenticatedFetch;
}

describe("listAuditLogs", () => {
  it("goi dung URL voi tham so loc va phan trang", async () => {
    const fetchMock = jsonFetch({
      items: [auditLog()],
      total: 1,
      page: 2,
      pageSize: 20,
    });
    const result = await listAuditLogs(fetchMock, {
      page: 2,
      pageSize: 20,
      actor: "son",
      action: "work.rejected",
      search: "la thu",
    });
    expect(result.total).toBe(1);
    const url = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(url).toBe(
      "/admin/audit-logs?page=2&pageSize=20&actor=son&action=work.rejected&search=la+thu",
    );
  });

  it("bo tham so trong va dung mac dinh khi khong truyen", async () => {
    const fetchMock = jsonFetch({ items: [], total: 0, page: 1, pageSize: 20 });
    await listAuditLogs(fetchMock, { search: "   ", actor: "  " });
    const url = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(url).toBe("/admin/audit-logs");
  });

  it("dich loi 403 va nem AuditLogsApiError co status", async () => {
    const fetchMock = jsonFetch({ message: "Forbidden" }, 403);
    await expect(listAuditLogs(fetchMock, {})).rejects.toMatchObject({
      message: "Bạn không có quyền xem nhật ký kiểm tra.",
    });
    await expect(listAuditLogs(fetchMock, {})).rejects.toBeInstanceOf(
      AuditLogsApiError,
    );
  });

  it("nem loi khi may chu tra ve du lieu sai dinh dang", async () => {
    const fetchMock = jsonFetch({ items: [{ id: 1 }], total: 1 });
    await expect(listAuditLogs(fetchMock, {})).rejects.toThrow(
      "không đúng định dạng",
    );
  });
});

describe("translateAuditLogsError", () => {
  it("dich 401 va 403, roi ve cau chung cho trang thai khac", () => {
    expect(translateAuditLogsError({}, 401)).toContain("hết hạn");
    expect(translateAuditLogsError({}, 403)).toContain("không có quyền");
    expect(translateAuditLogsError({}, 500)).toContain("Không tải được");
  });
});

describe("auditActionLabel", () => {
  it("co nhan tieng Viet cho ca 5 hanh dong", () => {
    expect(auditActionLabel("user.role_changed")).toBe("Đổi vai trò");
    expect(auditActionLabel("user.suspended")).toBe("Khóa tài khoản");
    expect(auditActionLabel("user.unsuspended")).toBe("Mở khóa tài khoản");
    expect(auditActionLabel("work.approved")).toBe("Duyệt tác phẩm");
    expect(auditActionLabel("work.rejected")).toBe("Từ chối tác phẩm");
  });
});

describe("auditDetailLines", () => {
  it("hien vai tro cu va moi cho doi vai tro", () => {
    const lines = auditDetailLines(
      auditLog({
        action: "user.role_changed",
        detail: { previousRole: "user", newRole: "admin" },
      }),
    );
    expect(lines).toEqual(["Vai trò: Thành viên -> Quản trị viên"]);
  });

  it("hien day du chi tiet tu choi tac pham gom ly do", () => {
    const lines = auditDetailLines(
      auditLog({
        action: "work.rejected",
        targetLabel: "Lá thư mùa hạ",
        detail: {
          type: "manga",
          visibility: "public",
          authorUsername: "lan_anh",
          previousStatus: "pending",
          newStatus: "rejected",
          reason: "Ảnh bìa chưa đúng tỉ lệ, cần sửa lại.",
        },
      }),
    );
    expect(lines).toContain("Tác giả: lan_anh");
    expect(lines).toContain("Loại: Manga");
    expect(lines).toContain("Hiển thị: Công khai");
    expect(lines).toContain("Trạng thái: Chờ duyệt -> Bị từ chối");
    expect(lines).toContain(
      "Lý do từ chối: Ảnh bìa chưa đúng tỉ lệ, cần sửa lại.",
    );
  });

  it("khong hien ly do o dong duyet", () => {
    const lines = auditDetailLines(
      auditLog({
        action: "work.approved",
        detail: {
          type: "animation",
          visibility: "unlisted",
          previousStatus: "pending",
          newStatus: "approved",
        },
      }),
    );
    expect(lines).toContain("Loại: Hoạt hình");
    expect(lines).toContain("Hiển thị: Chỉ có link");
    expect(lines.every((line) => !line.startsWith("Lý do"))).toBe(true);
  });
});

describe("formatAuditTime", () => {
  it("dinh dang ngay gio tieng Viet, giu nguyen chuoi loi", () => {
    expect(formatAuditTime("2026-10-29T00:41:00.000Z")).toMatch(/29\/10\/2026/);
    expect(formatAuditTime("khong-phai-ngay")).toBe("khong-phai-ngay");
  });
});

describe("buildAuditCsv", () => {
  it("co BOM, tieu de va thoat dau nhay, dau phay, xuong dong dung", () => {
    const csv = buildAuditCsv([
      auditLog({
        targetLabel: 'Truyện "đặc biệt", tập 1',
        detail: { previousStatus: "active", newStatus: "suspended" },
        ip: null,
      }),
      auditLog({
        id: "log-2",
        action: "work.rejected",
        targetLabel: "Lá thư\nmùa hạ",
        detail: { reason: "Lý do có\ndấu xuống dòng." },
        ip: "203.0.113.7",
      }),
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Thời gian,Người thực hiện,Hành động,Đối tượng,Chi tiết,IP");
    expect(csv).toContain('"Truyện ""đặc biệt"", tập 1"');
    expect(csv).toContain("không xác định");
    expect(csv).toContain("Lý do từ chối: Lý do có\ndấu xuống dòng.");
  });

  it("tra ve chi tieu de khi khong co dong nao", () => {
    const csv = buildAuditCsv([]);
    expect(csv).toBe(
      "\uFEFFThời gian,Người thực hiện,Hành động,Đối tượng,Chi tiết,IP\n",
    );
  });
});
