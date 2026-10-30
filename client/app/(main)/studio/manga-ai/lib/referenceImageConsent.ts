import type { AuthenticatedFetch } from "@/lib/auth-api";

/**
 * Đồng ý dữ liệu riêng cho ảnh mẫu tham khảo.
 *
 * Cổng đồng ý chung của AI vẽ hiện là no-op và client chưa có giao diện
 * đồng ý nào, nên panel ảnh mẫu tự giữ một xác nhận riêng: trước lần sinh
 * đầu tiên, người dùng đọc văn bản mới (đã gồm Cloudflare) và xác nhận
 * 18+. Xác nhận lưu theo phiên bản văn bản; khi server đổi phiên bản thì
 * xác nhận cũ hết hiệu lực và hộp thoại hiện lại.
 *
 * Văn bản và phiên bản dưới đây PHẢI khớp
 * `server/src/ai/consent/ai-drawing-consent.constants.ts`. Khi server đổi
 * văn bản, đổi cả hai nơi và tăng phiên bản.
 */
export const REFERENCE_IMAGE_CONSENT_VERSION = "ai-providers-v4";

export const REFERENCE_IMAGE_CONSENT_NOTICE =
  "AniMan và tính năng hỗ trợ vẽ AI chỉ dành cho người từ đủ 18 tuổi. Khi sử dụng AI, bản vẽ và prompt bạn gửi cùng phản hồi do AI tạo sẽ được xử lý qua Gemini API ở gói unpaid và qua Cloudflare Workers AI (model FLUX.2 klein 4B của Black Forest Labs) cho ảnh mẫu tham khảo. Google có thể sử dụng nội dung gửi và phản hồi để cải thiện sản phẩm, dịch vụ, bao gồm việc con người xem xét; nội dung gửi tới Cloudflare được xử lý theo điều khoản của Cloudflare. Không gửi thông tin cá nhân nhạy cảm. Xác nhận 18+ dựa trên tự khai; AniMan không thu thập ngày sinh. Bạn có thể thu hồi xác nhận dữ liệu AI bất kỳ lúc nào; khi thu hồi, tính năng AI vẽ sẽ bị khóa đến khi bạn xác nhận lại.";

const STORAGE_KEY = "animan:reference-image-consent";

export function loadReferenceImageConsentVersion(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveReferenceImageConsentVersion(version: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // Lưu trữ bị chặn: lần sinh sau sẽ hỏi lại, không chặn tính năng.
  }
}

export function isReferenceImageConsentCurrent(version: string): boolean {
  return loadReferenceImageConsentVersion() === version;
}

/**
 * Lấy văn bản đồng ý hiện hành từ server. Server lỗi hoặc chưa đăng
 * nhập thì dùng bản sao kèm theo client, vì văn bản hai nơi được giữ
 * đồng bộ theo phiên bản.
 */
export async function fetchReferenceImageConsent(
  authenticatedFetch: AuthenticatedFetch,
  signal?: AbortSignal,
): Promise<{ version: string; notice: string }> {
  const fallback = {
    version: REFERENCE_IMAGE_CONSENT_VERSION,
    notice: REFERENCE_IMAGE_CONSENT_NOTICE,
  };
  try {
    const response = await authenticatedFetch("/ai/consent", {
      method: "GET",
      signal,
    });
    if (!response.ok) return fallback;
    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null) return fallback;
    const rec = data as Record<string, unknown>;
    const version =
      typeof rec.currentNoticeVersion === "string"
        ? rec.currentNoticeVersion
        : null;
    const notice = typeof rec.notice === "string" ? rec.notice : null;
    if (!version || !notice) return fallback;
    return { version, notice };
  } catch {
    return fallback;
  }
}
