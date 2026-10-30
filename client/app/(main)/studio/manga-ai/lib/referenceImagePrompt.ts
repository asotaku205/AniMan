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
  "Black-and-white manga illustration ONLY, drawn in classic manga ink style. The entire image uses only pure black ink lines on a pure white background: only black and white, no gray fill, no color of any kind, no gradients, no soft shading, no painterly brushwork, no photorealistic rendering, no 3D render, no watercolor, no anime cel shading. Draw with clean, confident manga ink outlines with varied line weight, thicker on foreground shapes and shadows, thinner on fine details, like a finished manga page inked for print that a learner can copy by hand with a pen. Shade only with manga screentone dots, cross-hatching, or short parallel hatch lines, never with gray wash. Fill the whole frame edge to edge with the drawing: no empty white margins around the scene, no letterbox bars. No text, no letters, no numbers, no speech bubbles, no sound-effect words, no watermark, no signature, no panel border, no inner frame.";

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
