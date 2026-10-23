/**
 * Cổng sinh video AI cho workspace 3D (Lớp B) — CHỈ LÀ INTERFACE.
 *
 * Sự thật đã research (23/10/2026): hiện không có API sinh video AI nào
 * free, ổn định, không watermark để tích hợp vào bản demo (Kling/Hailuo
 * chỉ free qua web của họ; API đều tính tiền theo giây). Vì vậy bản demo
 * chạy bằng Lớp A (render previz Three.js ngay trong trình duyệt) và
 * định nghĩa sẵn cổng này: khi có API key/ngân sách (Kling, Runway, hoặc
 * ComfyUI tự host), chỉ cần cài một provider theo interface dưới đây là
 * workspace dùng được. UI phải nói rõ "chưa kết nối" — TUYỆT ĐỐI không
 * giả lập kết quả sinh video.
 */

export interface VideoGenRequest {
  /** Ảnh khung đầu (data URL) render từ cảnh previz. */
  firstFrameDataUrl: string;
  /** Ảnh khung cuối (tuỳ chọn). */
  lastFrameDataUrl?: string;
  /** Mô tả cú máy theo mốc thời gian, VD "0-3s pull-back, 3-5s push-in". */
  cameraPrompt: string;
  durationSec: number;
}

export interface VideoGenResult {
  /** URL (blob/object) của đoạn video sinh ra. */
  videoUrl: string;
  providerId: string;
}

export interface VideoGenProvider {
  id: string;
  label: string;
  /** Provider đã sẵn sàng dùng chưa (có key/kết nối). */
  isAvailable: () => boolean;
  generate: (req: VideoGenRequest) => Promise<VideoGenResult>;
}

/** Danh sách provider đã cài — bản demo chưa có provider nào. */
export const VIDEO_GEN_PROVIDERS: VideoGenProvider[] = [];

export function videoGenStatus(): { connected: boolean; label: string } {
  const available = VIDEO_GEN_PROVIDERS.filter((p) => p.isAvailable());
  if (available.length === 0) {
    return {
      connected: false,
      label:
        "Chưa kết nối dịch vụ AI tạo video — bạn vẫn có thể dựng cảnh và xuất bản xem trước ngay trong trình duyệt.",
    };
  }
  return {
    connected: true,
    label: `Đã kết nối: ${available.map((p) => p.label).join(", ")}`,
  };
}
