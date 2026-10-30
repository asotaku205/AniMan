/**
 * Ảnh mẫu tham khảo cho Manga Studio (đã duyệt mockup 28/10/2026).
 *
 * Ảnh mẫu CHỈ để người dùng nhìn theo và vẽ lại. Ảnh mẫu không bao giờ là
 * bản chính của truyện, không được đưa vào lớp vẽ, lịch sử hoàn tác hay
 * xuất PNG/PDF. Sinh ảnh chạy qua Cloudflare Workers AI bằng job bất đồng
 * bộ (xem `client/lib/reference-image-api.ts`); ảnh về đã được server ép
 * xám và lưu riêng trong IndexedDB của panel này.
 */

/** Tối đa 3 ảnh mẫu mỗi khung (lịch sử so sánh, theo mockup đã duyệt). */
export const MAX_REFERENCE_IMAGES = 3;

export type ReferenceImageSource = "prompt" | "drawing-prompt";

export const REFERENCE_IMAGE_SOURCE_LABELS: Record<
  ReferenceImageSource,
  string
> = {
  prompt: "Chỉ prompt",
  "drawing-prompt": "Bức vẽ + prompt",
};

/** Vị trí của lớp ảnh mẫu đè lên khung vẽ: trên nét vẽ hay dưới nét vẽ. */
export type ReferenceOverlayPosition = "above" | "below";

/** Độ mờ mặc định của lớp ảnh mẫu đè lên khung vẽ (40%), theo mockup đã duyệt 30/10/2026. */
export const DEFAULT_REFERENCE_OVERLAY_OPACITY = 40;

/** Độ mờ của lớp đè lên luôn nằm trong 0 tới 100, làm tròn số nguyên. */
export function clampReferenceOverlayOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_REFERENCE_OVERLAY_OPACITY;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Ảnh mẫu đang đè lên khung vẽ: ảnh có id đã chọn, nếu không có hoặc
 * đã bị xóa thì lấy ảnh mới nhất còn ảnh thật (bỏ bản ghi không có
 * dataUrl). Trả về null khi khung chưa có ảnh mẫu nào có ảnh thật.
 */
export function resolveReferenceOverlayImage(
  images: ReferenceImageItem[],
  overlayImageId: string | null,
): ReferenceImageItem | null {
  const withImage = images.filter((image) => image.dataUrl);
  if (withImage.length === 0) return null;
  if (overlayImageId) {
    const chosen = withImage.find((image) => image.id === overlayImageId);
    if (chosen) return chosen;
  }
  return withImage[0] ?? null;
}

/**
 * Một ảnh mẫu trong lịch sử của một khung. `dataUrl` là ảnh đã sinh (PNG/JPEG),
 * lưu riêng khỏi mọi lớp vẽ. `source` ghi lại nguồn người dùng đã chọn khi
 * sinh, `note` là câu mô tả ngắn model trả về (ví dụ phần giải phẫu đã sửa).
 * `isPlaceholder` đánh dấu bản ghi nội bộ dùng để kiểm thử/khởi tạo giao diện,
 * KHÔNG BAO GIỜ được hiển thị như ảnh AI thật.
 */
export interface ReferenceImageItem {
  id: string;
  dataUrl: string;
  source: ReferenceImageSource;
  note?: string;
  createdAt: number;
  isPlaceholder?: boolean;
}

/** Id cho một ảnh mẫu mới trong lịch sử của khung. */
export function createReferenceImageId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Thêm một ảnh vào lịch sử: ảnh mới nhất lên đầu, ảnh cũ nhất bị loại khi
 * lịch sử đã đủ `MAX_REFERENCE_IMAGES`. Hàm thuần, không chạm IndexedDB.
 */
export function addReferenceImageToHistory(
  history: ReferenceImageItem[],
  item: ReferenceImageItem,
): ReferenceImageItem[] {
  const next = [item, ...history.filter((entry) => entry.id !== item.id)];
  return next.slice(0, MAX_REFERENCE_IMAGES);
}

export function removeReferenceImageFromHistory(
  history: ReferenceImageItem[],
  id: string,
): ReferenceImageItem[] {
  return history.filter((entry) => entry.id !== id);
}

/**
 * Kiểm tra một ảnh mẫu có an toàn để đứng ngoài xuất bản hay không: ảnh mẫu
 * không bao giờ được đưa vào danh sách lớp xuất. Hàm này dùng trong test
 * bảo vệ xuất bản (xem reference-images.test.ts).
 */
export function referenceImageIsOutsideLayers(
  layerIds: string[],
  referenceIds: string[],
): boolean {
  return referenceIds.every((id) => !layerIds.includes(id));
}
