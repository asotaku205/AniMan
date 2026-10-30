import { describe, expect, it, vi } from "vitest";
import {
  getAdminSettings,
  getAdminStats,
  getSiteStatus,
  pickLocalSettings,
  translateAdminSettingsError,
  updateAdminSettings,
  type SiteSettings,
} from "../admin-settings-api";
import {
  decideSiteAccess,
  isMaintenancePayload,
} from "../site-status";

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchOk = (fetch: (input: RequestInfo | URL) => Promise<Response>) =>
  fetch;

describe("translateAdminSettingsError", () => {
  it("503 bao tri tra cau tieng Viet ro rang", () => {
    expect(
      translateAdminSettingsError({ code: "maintenance" }, 503),
    ).toBe("Hệ thống đang bảo trì. Vui lòng quay lại sau.");
    expect(translateAdminSettingsError({}, 503)).toBe(
      "Máy chủ đang bận. Hãy thử lại sau.",
    );
  });

  it("403 va 400 co cau rieng, loi khac giu thong bao server", () => {
    expect(translateAdminSettingsError({}, 403)).toBe(
      "Tài khoản này không có quyền quản trị.",
    );
    expect(translateAdminSettingsError({}, 400)).toBe(
      "Dữ liệu cài đặt không hợp lệ.",
    );
    expect(
      translateAdminSettingsError({ message: "Custom server message" }, 500),
    ).toBe("Custom server message");
  });
});

describe("admin settings API calls", () => {
  it("getAdminStats goi dung endpoint va tra so lieu", async () => {
    const authenticatedFetch = vi.fn(async () =>
      jsonResponse(200, {
        totalUsers: 12,
        adminCount: 2,
        suspendedCount: 1,
        newUsersLast7Days: 3,
      }),
    );
    await expect(getAdminStats(fetchOk(authenticatedFetch))).resolves.toEqual({
      totalUsers: 12,
      adminCount: 2,
      suspendedCount: 1,
      newUsersLast7Days: 3,
    });
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/admin/stats",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("updateAdminSettings gui PATCH dung body", async () => {
    const saved: SiteSettings = { maintenance: true, registrationOpen: true };
    let capturedInit: RequestInit | undefined;
    const authenticatedFetch = vi.fn(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        capturedInit = init;
        return jsonResponse(200, saved);
      },
    );
    await expect(
      updateAdminSettings(fetchOk(authenticatedFetch), { maintenance: true }),
    ).resolves.toEqual(saved);
    expect(capturedInit?.method).toBe("PATCH");
    expect(capturedInit?.body).toBe(JSON.stringify({ maintenance: true }));
  });

  it("getAdminSettings loi 403 dich sang tieng Viet", async () => {
    const authenticatedFetch = vi.fn(async () =>
      jsonResponse(403, { message: "Forbidden" }),
    );
    await expect(
      getAdminSettings(fetchOk(authenticatedFetch)),
    ).rejects.toThrow("Tài khoản này không có quyền quản trị.");
  });

  it("getSiteStatus la fetch thuong, khong gan token", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(200, { maintenance: true, registrationOpen: false }),
      );
    await expect(getSiteStatus()).resolves.toEqual({
      maintenance: true,
      registrationOpen: false,
    });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/site/status");
    expect(init).toMatchObject({ cache: "no-store" });
    fetchSpy.mockRestore();
  });
});

describe("pickLocalSettings", () => {
  it("chi giu 6 khoa local, bo qua khoa that trong JSON cu", () => {
    expect(
      pickLocalSettings({
        darkDefault: false,
        sakura: false,
        maintenance: true,
        registration: false,
        registrationOpen: false,
        unknownKey: true,
      }),
    ).toEqual({
      darkDefault: false,
      sakura: false,
      watchParty: true,
      studioAI: true,
      communityWorks: true,
      premiumRequired: false,
    });
  });

  it("JSON khong hop le tra mac dinh", () => {
    expect(pickLocalSettings(null)).toEqual({
      darkDefault: true,
      sakura: true,
      watchParty: true,
      studioAI: true,
      communityWorks: true,
      premiumRequired: false,
    });
  });
});

describe("decideSiteAccess", () => {
  it("bao tri tat thi mo; bao tri bat thi user thay trang bao tri, admin thay thanh bao", () => {
    expect(decideSiteAccess(null, "user")).toBe("open");
    expect(
      decideSiteAccess({ maintenance: false, registrationOpen: true }, "user"),
    ).toBe("open");
    expect(
      decideSiteAccess({ maintenance: true, registrationOpen: true }, "user"),
    ).toBe("maintenance-page");
    expect(
      decideSiteAccess({ maintenance: true, registrationOpen: true }, undefined),
    ).toBe("maintenance-page");
    expect(
      decideSiteAccess({ maintenance: true, registrationOpen: true }, "admin"),
    ).toBe("admin-banner");
  });
});

describe("isMaintenancePayload", () => {
  it("nhan ra code maintenance va thong bao tieng Viet", () => {
    expect(isMaintenancePayload({ code: "maintenance" })).toBe(true);
    expect(
      isMaintenancePayload({ message: "Hệ thống đang bảo trì." }),
    ).toBe(true);
    expect(isMaintenancePayload({ message: "Something else" })).toBe(false);
    expect(isMaintenancePayload(null)).toBe(false);
  });
});
