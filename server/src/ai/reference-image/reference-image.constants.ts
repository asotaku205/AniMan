/**
 * Hằng số cho đường sinh ảnh mẫu tham khảo bằng Cloudflare Workers AI.
 *
 * Ảnh mẫu CHỈ để người dùng nhìn theo và vẽ lại, không bao giờ là bản
 * chính, không vào lớp vẽ, không vào xuất PNG/PDF. Đường này chạy bất
 * đồng bộ bằng job (xem reference-image-jobs.service.ts) vì thời gian
 * gọi model dao động mạnh (đo thật 48 giây tới 171 giây) và không thể
 * hứa xong trong timeout 90 giây của đường Gemini.
 *
 * CẢ HAI NGUỒN DÙNG CHUNG MỘT MODEL (sửa 30/10/2026 theo lệnh của Sơn):
 * trước đây nguồn "Chỉ prompt" dùng FLUX.1 schnell còn nguồn có bức
 * vẽ dùng FLUX.2 klein 4B, nên ảnh từ prompt sai prompt và sai phong
 * cách, trong khi ảnh từ bức vẽ thì đúng. Nay cả 2 nguồn đều dùng
 * klein 4B: có bức vẽ thì gửi kèm ảnh qua multipart, chỉ prompt thì
 * gửi multipart không kèm ảnh (klein dùng multipart cả khi chỉ có
 * prompt, input_image_0 là tùy chọn). Cùng một model, cùng một
 * cách ghép prompt nét vẽ, nên phong cách giữa 2 nguồn mới nhất quán.
 * Nguồn "Chỉ bức vẽ" đã bỏ ngày 30/10/2026 theo lệnh của Sơn, chỉ còn
 * "Chỉ prompt" và "Bức vẽ + prompt".
 */

/** Model duy nhất cho cả 2 nguồn sinh ảnh mẫu. */
export const CLOUDFLARE_KLEIN_4B_MODEL_ID =
  "@cf/black-forest-labs/flux-2-klein-4b";

/** Timeout gọi Cloudflare: dài hơn mọi lần gọi đo được (tối đa 171 giây). */
export const REFERENCE_IMAGE_PROVIDER_TIMEOUT_MS = 300_000;

/** Job giữ trong bộ nhớ tối đa 30 phút; sau đó bị dọn khi có truy cập mới. */
export const REFERENCE_IMAGE_JOB_TTL_MS = 30 * 60 * 1000;

/** Ảnh Cloudflare trả về vượt quá cỡ này thì job thất bại, không lưu. */
export const MAX_REFERENCE_IMAGE_OUTPUT_BYTES = 5 * 1024 * 1024;

/** Phác thảo gửi đi tối đa 1 MB; client đã thu nhỏ còn tối đa 500 px. */
export const MAX_REFERENCE_SKETCH_BYTES = 1 * 1024 * 1024;
export const MAX_REFERENCE_SKETCH_DIMENSION = 512;

/** Cạnh dài nhất của ảnh đầu ra: 1024 (đúng lần gọi đã kiểm chứng). */
export const REFERENCE_IMAGE_OUTPUT_LONGEST_SIDE = 1024;

/** Klein chấp nhận width/height từ 256 tới 1920 (tài liệu Cloudflare). */
export const REFERENCE_IMAGE_OUTPUT_MIN_SIDE = 256;
export const REFERENCE_IMAGE_OUTPUT_MAX_SIDE = 1920;

/** FLUX yêu cầu width/height là bội số của 16. */
export const REFERENCE_IMAGE_OUTPUT_SIZE_STEP = 16;

/**
 * Kích thước ảnh đầu ra theo đúng tỉ lệ của khung đang vẽ.
 *
 * Mỗi khung có tỉ lệ khác nhau (lấy từ kích thước backing của đúng khung
 * đang mở, ví dụ khung 1200x896 ra 1024x768), nên không được ép vuông
 * 1024x1024 như trước: ảnh vuông đặt vào khung chữ nhật không bao giờ
 * vừa khít. Cạnh dài nhất giữ 1024, cạnh còn lại thu theo tỉ lệ rồi làm
 * tròn theo bội số của 16. Không có kích thước khung hợp lệ (client cũ)
 * thì giữ 1024x1024 như trước.
 */
export function resolveReferenceImageOutputSize(
  panelWidth?: number,
  panelHeight?: number,
): { width: number; height: number } {
  const fallback = { width: 1024, height: 1024 };
  if (
    !Number.isFinite(panelWidth) ||
    !Number.isFinite(panelHeight) ||
    !panelWidth ||
    !panelHeight ||
    panelWidth <= 0 ||
    panelHeight <= 0
  ) {
    return fallback;
  }
  const scale =
    REFERENCE_IMAGE_OUTPUT_LONGEST_SIDE / Math.max(panelWidth, panelHeight);
  const roundStep = (value: number): number =>
    Math.min(
      REFERENCE_IMAGE_OUTPUT_MAX_SIDE,
      Math.max(
        REFERENCE_IMAGE_OUTPUT_MIN_SIDE,
        Math.round(value / REFERENCE_IMAGE_OUTPUT_SIZE_STEP) *
          REFERENCE_IMAGE_OUTPUT_SIZE_STEP,
      ),
    );
  return {
    width: roundStep(panelWidth * scale),
    height: roundStep(panelHeight * scale),
  };
}

/**
 * Phong cách nét vẽ, là một phần của prompt ảnh gửi tới model.
 *
 * Phong cách PHẢI do model vẽ ra ngay từ đầu: nét mực đen trên nền
 * trắng, không màu, không tô bóng như ảnh thật. Server KHÔNG được ép
 * xám một ảnh có màu/tô bóng rồi gọi đó là phong cách nét vẽ (xem
 * processCloudflareImage). Bản này là nguồn sự thật phía server; bản
 * trong client (referenceImagePrompt.ts) chỉ là bản sao để hiển
 * thị/tham khảo, không bao giờ được gửi đi từ client. Hai bản phải
 * giữ nguyên văn giống nhau.
 *
 * Bản này đã thử thật 3 lần gọi ngày 30/10/2026 (prompt tiếng Anh,
 * prompt tiếng Việt, phác thảo nhà; đều ra đúng tỉ lệ 1024x768, trắng
 * đen, tỉ lệ điểm màu 0): mô tả cụ thể hơn bản cũ ở chỗ chỉ rõ chỉ có
 * đen và trắng, cấm xám/màu/gradient/tô bóng, và bắt lấp đầy khung.
 * Sơn dặn thêm cùng ngày: phong cách phải là vẽ manga, nên bản này
 * nói rõ kiểu mực manga cổ điển, nét đậm nhạt theo khối, tô bóng
 * bằng screentone manga. Câu chữ manga này chưa thử thật trên
 * Cloudflare, Sơn kiểm tra live một lần sau khi pull.
 */
export const REFERENCE_IMAGE_LINE_STYLE =
  "Black-and-white manga illustration ONLY, drawn in classic manga ink style. The entire image uses only pure black ink lines on a pure white background: only black and white, no gray fill, no color of any kind, no gradients, no soft shading, no painterly brushwork, no photorealistic rendering, no 3D render, no watercolor, no anime cel shading. Draw with clean, confident manga ink outlines with varied line weight, thicker on foreground shapes and shadows, thinner on fine details, like a finished manga page inked for print that a learner can copy by hand with a pen. Shade only with manga screentone dots, cross-hatching, or short parallel hatch lines, never with gray wash. Fill the whole frame edge to edge with the drawing: no empty white margins around the scene, no letterbox bars. No text, no letters, no numbers, no speech bubbles, no sound-effect words, no watermark, no signature, no panel border, no inner frame.";

/**
 * Cụm từ mô tả loại cảnh bằng tiếng Anh, đặt ngay sau phong cách nét vẽ.
 * Loại "auto" KHÔNG có cụm từ: bỏ hẳn dòng loại cảnh, để model chỉ theo
 * mô tả của người dùng và phác thảo, thay vì gửi chữ "auto" vô nghĩa
 * mà system prompt cũ không định nghĩa.
 */
export const REFERENCE_IMAGE_SCENE_PHRASES: Record<string, string> = {
  action: "Dynamic action scene.",
  dialogue: "Dialogue scene with the characters facing each other.",
  landscape:
    "Landscape scene with foreground, middle ground, and background layers.",
  closeup: "Close-up scene.",
  wide: "Wide establishing shot.",
};

/**
 * Tỉ lệ điểm màu tối đa chấp nhận trong ảnh model trả về (0 tới 1).
 * Ảnh nét vẽ trắng đen thật có tỉ lệ gần 0 (3 ảnh đo thật ngày
 * 28/10/2026 đều bằng 0). Vượt ngưỡng này nghĩa là model đã bỏ qua
 * phong cách nét vẽ và trả về ảnh có màu: job thất bại thay vì ép xám
 * rồi trả về, vì ép xám không biến ảnh có màu thành nét vẽ.
 */
export const MAX_REFERENCE_IMAGE_COLORED_SHARE = 0.2;

/** Điểm ảnh được tính là có nét khi kênh tối nhất dưới ngưỡng này (0 tới 255). */
export const REFERENCE_IMAGE_BLANK_CHANNEL_THRESHOLD = 248;

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
  /** Ảnh Cloudflare trả về không giải mã được, vượt giới hạn, hoặc có màu quá ngưỡng. */
  invalidResponse: "reference_image_invalid",
  /** Phác thảo trắng hoàn toàn mà không kèm mô tả: không có gì để sinh theo. */
  blankSketch: "reference_image_blank_sketch",
  /** Quá 300 giây mà không rõ server đã sinh xong hay chưa. */
  timeout: "reference_image_timeout",
} as const;

export type ReferenceImageErrorCode =
  (typeof REFERENCE_IMAGE_ERROR_CODES)[keyof typeof REFERENCE_IMAGE_ERROR_CODES];
