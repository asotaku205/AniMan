import type { AuthenticatedFetch } from "./auth-api";
import { MAINTENANCE_ERROR_CODE, type SiteStatus } from "./site-status";

/**
 * API cai dat he thong va so lieu dashboard cho trang Admin (Lat 4).
 *
 * Moi ham deu goi qua `authenticatedFetch` (tu gan token va tu lam moi
 * phien nhu cac API khac), tru `getSiteStatus` la endpoint cong khai.
 * Loi HTTP duoc dich sang cau tieng Viet trong
 * `translateAdminSettingsError`; thong bao ky thuat cua server chi hien
 * khi khong nhan ra nguyen nhan.
 */

export interface AdminStats {
  totalUsers: number;
  adminCount: number;
  suspendedCount: number;
  newUsersLast7Days: number;
}

export interface SiteSettings {
  maintenance: boolean;
  registrationOpen: boolean;
}

export type SiteSettingsPatch = Partial<SiteSettings>;

export class AdminSettingsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AdminSettingsApiError";
  }
}

async function callAdminSettings(
  authenticatedFetch: AuthenticatedFetch,
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await authenticatedFetch(url, init);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    if (error instanceof Error && error.name === "TypeError") {
      throw new AdminSettingsApiError(
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

export function translateAdminSettingsError(
  payload: unknown,
  status: number,
): string {
  if (status === 503) {
    if (
      typeof payload === "object" &&
      payload !== null &&
      (payload as Record<string, unknown>).code === MAINTENANCE_ERROR_CODE
    ) {
      return "Hệ thống đang bảo trì. Vui lòng quay lại sau.";
    }
    return "Máy chủ đang bận. Hãy thử lại sau.";
  }
  if (status === 403) {
    return "Tài khoản này không có quyền quản trị.";
  }
  if (status === 400) {
    return "Dữ liệu cài đặt không hợp lệ.";
  }
  if (typeof payload === "object" && payload !== null) {
    const message = (payload as Record<string, unknown>).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  return "Không tải được dữ liệu. Hãy thử lại.";
}

async function callJson<T>(
  authenticatedFetch: AuthenticatedFetch,
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await callAdminSettings(authenticatedFetch, url, init);
  const payload = await readPayload(response);
  if (!response.ok) {
    throw new AdminSettingsApiError(
      translateAdminSettingsError(payload, response.status),
      response.status,
    );
  }
  return payload as T;
}

export function getAdminStats(
  authenticatedFetch: AuthenticatedFetch,
): Promise<AdminStats> {
  return callJson(authenticatedFetch, "/api/admin/stats", { cache: "no-store" });
}

export function getAdminSettings(
  authenticatedFetch: AuthenticatedFetch,
): Promise<SiteSettings> {
  return callJson(authenticatedFetch, "/api/admin/settings", {
    cache: "no-store",
  });
}

export function updateAdminSettings(
  authenticatedFetch: AuthenticatedFetch,
  changes: SiteSettingsPatch,
): Promise<SiteSettings> {
  return callJson(authenticatedFetch, "/api/admin/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
}

/** Endpoint cong khai, khong can dang nhap. Loi mang thi nem, gate tu mo. */
export async function getSiteStatus(): Promise<SiteStatus> {
  const response = await fetch("/site/status", { cache: "no-store" });
  const payload = (await response.json()) as unknown;
  if (!response.ok || typeof payload !== "object" || payload === null) {
    throw new AdminSettingsApiError(
      "Không tải được trạng thái hệ thống.",
      response.status,
    );
  }
  const record = payload as Record<string, unknown>;
  return {
    maintenance: record.maintenance === true,
    registrationOpen: record.registrationOpen !== false,
  };
}

/**
 * 6 khoa chi luu o trinh duyet nay (Lat 4). Ham thuan de test va de
 * SettingsClient tach kho localStorage cu: chi doc/ghi 6 khoa nay,
 * bo qua maintenance/registration neu con sot trong JSON cu.
 */
export const LOCAL_SETTING_KEYS = [
  "darkDefault",
  "sakura",
  "watchParty",
  "studioAI",
  "communityWorks",
  "premiumRequired",
] as const;

export type LocalSettingKey = (typeof LOCAL_SETTING_KEYS)[number];

export type LocalSettings = Record<LocalSettingKey, boolean>;

export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  darkDefault: true,
  sakura: true,
  watchParty: true,
  studioAI: true,
  communityWorks: true,
  premiumRequired: false,
};

export function pickLocalSettings(stored: unknown): LocalSettings {
  const record =
    typeof stored === "object" && stored !== null
      ? (stored as Record<string, unknown>)
      : {};
  const picked = { ...DEFAULT_LOCAL_SETTINGS };
  for (const key of LOCAL_SETTING_KEYS) {
    if (typeof record[key] === "boolean") {
      picked[key] = record[key] as boolean;
    }
  }
  return picked;
}

export function readStoredLocalSettings(): LocalSettings {
  try {
    const raw = localStorage.getItem("animan_admin_settings");
    if (!raw) return { ...DEFAULT_LOCAL_SETTINGS };
    return pickLocalSettings(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_LOCAL_SETTINGS };
  }
}

export function writeStoredLocalSettings(settings: LocalSettings): void {
  try {
    localStorage.setItem(
      "animan_admin_settings",
      JSON.stringify(settings),
    );
  } catch {
    /* storage unavailable */
  }
}
