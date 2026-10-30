/**
 * Phong cách nét vẽ cho sinh ảnh mẫu tham khảo manga (mockup đã duyệt 28/10/2026,
 * sửa cách ghép prompt 30/10/2026: cả 2 nguồn dùng chung klein 4B).
 *
 * ĐÃ NỐI (29/10/2026): prompt này chạy phía SERVER, trong
 * `server/src/ai/reference-image/reference-image.constants.ts`, và server
 * tự ghép từ hằng số của chính nó. Bản trong file này chỉ là bản sao để
 * hiển thị/tham khảo, KHÔNG BAO GIỜ được gửi đi từ client. Hai bản phải
 * giữ nguyên văn giống nhau; khi đổi prompt thì đổi cả hai nơi.
 *
 * Phong cách nét vẽ phải do model vẽ ra ngay từ đầu, không phải ảnh
 * sinh ra rồi ép xám: xem processCloudflareImage phía server.
 */
export const REFERENCE_IMAGE_LINE_STYLE =
  "Black-and-white manga line drawing, clean confident black ink outlines on a plain white background, simple clear outlines that are easy to copy by hand, screentone dots only where shading is needed. No color, no color gradients, no painterly shading, no photorealism, no 3D-render look, no text, no letters, no numbers, no speech bubbles, no sound-effect words, no watermark, no signature, no panel border.";

export const REFERENCE_IMAGE_SCENE_PHRASES: Record<string, string> = {
  action: "Dynamic action scene.",
  dialogue: "Dialogue scene with the characters facing each other.",
  landscape:
    "Landscape scene with foreground, middle ground, and background layers.",
  closeup: "Close-up scene.",
  wide: "Wide establishing shot.",
};

/** Đánh dấu rõ: prompt trên đã được nối vào provider Cloudflare phía server. */
export const REFERENCE_IMAGE_SYSTEM_PROMPT_ENABLED = true;
