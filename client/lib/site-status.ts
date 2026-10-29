/**
 * Trang thai cong khai cua he thong (Lat 4) va quyet dinh hien thi
 * cua SiteStatusGate. Khong phu thuoc vao AuthProvider de tranh
 * vong tron import.
 */

export interface SiteStatus {
  maintenance: boolean;
  registrationOpen: boolean;
}

/** Su kien window khi mot API tra ve 503 bao tri: gate kiem tra lai ngay. */
export const MAINTENANCE_DETECTED_EVENT = "animan:maintenance-detected";

/** Ma loi on dinh server tra khi dang bao tri (xem MaintenanceException). */
export const MAINTENANCE_ERROR_CODE = "maintenance";

export function isMaintenancePayload(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) return false;
  const record = payload as Record<string, unknown>;
  if (record.code === MAINTENANCE_ERROR_CODE) return true;
  return (
    typeof record.message === "string" &&
    record.message.includes("bảo trì")
  );
}

export type SiteAccess = "open" | "maintenance-page" | "admin-banner";

/**
 * Ham thuan de test: bao tri bat thi user thuong thay trang bao tri,
 * admin thay thanh bao, con lai mo binh thuong.
 */
export function decideSiteAccess(
  status: SiteStatus | null,
  role: string | undefined,
): SiteAccess {
  if (!status?.maintenance) return "open";
  return role === "admin" ? "admin-banner" : "maintenance-page";
}
