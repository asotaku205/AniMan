/**
 * Hằng số cho đường sinh ảnh mẫu tham khảo bằng Cloudflare Workers AI.
 *
 * Ảnh mẫu CHỈ để người dùng nhìn theo và vẽ lại, không bao giờ là bản
 * chính, không vào lớp vẽ, không vào xuất PNG/PDF. Đường này chạy bất
 * đồng bộ bằng job (xem reference-image-jobs.service.ts) vì thời gian
 * gọi model dao động mạnh (đo thật 48 giây tới 171 giây) và không thể
 * hứa xong trong timeout 90 giây của đường Gemini.
 */

export const CLOUDFLARE_KLEIN_4B_MODEL_ID =
  "@cf/black-forest-labs/flux-2-klein-4b";
export const CLOUDFLARE_SCHNELL_MODEL_ID =
  "@cf/black-forest-labs/flux-1-schnell";

/** Timeout gọi Cloudflare: dài hơn mọi lần gọi đo được (tối đa 171 giây). */
export const REFERENCE_IMAGE_PROVIDER_TIMEOUT_MS = 300_000;

/** Job giữ trong bộ nhớ tối đa 30 phút; sau đó bị dọn khi có truy cập mới. */
export const REFERENCE_IMAGE_JOB_TTL_MS = 30 * 60 * 1000;

/** Ảnh Cloudflare trả về vượt quá cỡ này thì job thất bại, không lưu. */
export const MAX_REFERENCE_IMAGE_OUTPUT_BYTES = 5 * 1024 * 1024;

/** Phác thảo gửi đi tối đa 1 MB; client đã thu nhỏ còn tối đa 500 px. */
export const MAX_REFERENCE_SKETCH_BYTES = 1 * 1024 * 1024;
export const MAX_REFERENCE_SKETCH_DIMENSION = 512;

/** Cạnh ảnh đầu ra 1024x1024 cho klein (đúng lần gọi đã kiểm chứng). */
export const REFERENCE_IMAGE_OUTPUT_SIZE = 1024;

/**
 * System prompt nguyên văn từ mockup đã duyệt 28/10/2026. Bản này là
 * nguồn sự thật phía server; bản trong client
 * (referenceImagePrompt.ts) chỉ là bản sao để hiển thị/tham khảo, không
 * bao giờ được gửi đi từ client. Model ảnh chỉ trả về ảnh, không trả
 * câu văn: câu mô tả trong `note` của job được dựng từ yêu cầu, không
 * phải văn bản do model trả về.
 */
export const REFERENCE_IMAGE_SYSTEM_PROMPT = `You are a drawing reference assistant for a manga learner, not a finished-artwork generator.

OUTPUT RULES (must follow every time):
- Output one single-panel black-and-white manga line drawing only.
- Clean, confident black ink lines on a plain white background. Grayscale screentone dots only where shading is needed. No color, no color gradients, no painterly shading, no photorealism, no 3D-render look.
- No text, no letters, no numbers, no speech bubbles, no sound-effect words, no watermark, no signature, no panel border around the drawing.
- Keep the exact composition, camera angle, character pose, and framing of the user's sketch or prompt. Fix only anatomy and proportions that are clearly wrong (head size, limb length, joint placement, symmetry).
- Do not invent new characters, props, backgrounds, panels, or story elements. Do not change the story. If the sketch is incomplete, complete only the lines needed to make the existing pose readable, and leave the rest simple.
- Keep the drawing simple enough to copy by hand: clear outlines first, details second, no dense hatching that hides the construction.

USER INPUT:
- Sketch image (when provided) and/or a short text description of the scene.
- Scene type: action, dialogue, landscape, close-up, or wide shot.

RESPONSE:
- Return the reference image only, plus one short sentence in Vietnamese saying what was fixed (for example: head size, arm length, or composition). Do not claim the image is the user's work.`;

/** Mã lỗi ổn định trả cho client; client chọn câu tiếng Việt theo mã này. */
export const REFERENCE_IMAGE_ERROR_CODES = {
  /** Tính năng chưa bật hoặc thiếu Account ID/token trên server. */
  disabled: "reference_image_disabled",
  /** Token sai, hết hạn hoặc thiếu quyền Workers AI. */
  auth: "reference_image_auth",
  /** Cloudflare quá tải hoặc hết hạn mức neuron trong ngày. */
  overloaded: "reference_image_overloaded",
  /** Gọi Cloudflare thất bại vì lý do khác. */
  providerError: "reference_image_error",
  /** Ảnh Cloudflare trả về không giải mã được hoặc vượt giới hạn. */
  invalidResponse: "reference_image_invalid",
  /** Quá 300 giây mà không rõ server đã sinh xong hay chưa. */
  timeout: "reference_image_timeout",
} as const;

export type ReferenceImageErrorCode =
  (typeof REFERENCE_IMAGE_ERROR_CODES)[keyof typeof REFERENCE_IMAGE_ERROR_CODES];
