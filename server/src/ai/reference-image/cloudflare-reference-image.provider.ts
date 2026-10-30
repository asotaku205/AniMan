import sharp, { type Metadata, type OutputInfo } from "sharp";
import {
  CLOUDFLARE_KLEIN_4B_MODEL_ID,
  MAX_REFERENCE_IMAGE_COLORED_SHARE,
  MAX_REFERENCE_IMAGE_OUTPUT_BYTES,
  REFERENCE_IMAGE_PROVIDER_TIMEOUT_MS,
} from "./reference-image.constants.js";
import type { ReferenceImageSource } from "./reference-image.dto.js";

export class ReferenceImageDisabledError extends Error {
  constructor() {
    super("Reference image generation is not enabled on this server");
    this.name = "ReferenceImageDisabledError";
  }
}

export class ReferenceImageAuthError extends Error {
  constructor() {
    super("Cloudflare rejected the reference image credential");
    this.name = "ReferenceImageAuthError";
  }
}

export class ReferenceImageOverloadedError extends Error {
  constructor() {
    super("Cloudflare is overloaded or the daily neuron allowance is used up");
    this.name = "ReferenceImageOverloadedError";
  }
}

export class ReferenceImageProviderError extends Error {
  constructor(message = "Cloudflare reference image request failed") {
    super(message);
    this.name = "ReferenceImageProviderError";
  }
}

export class ReferenceImageInvalidError extends Error {
  constructor(message = "Cloudflare returned an invalid reference image") {
    super(message);
    this.name = "ReferenceImageInvalidError";
  }
}

export class ReferenceImageTimeoutError extends Error {
  constructor() {
    super("Cloudflare reference image request timed out");
    this.name = "ReferenceImageTimeoutError";
  }
}

export interface CloudflareReferenceImageConfig {
  enabled: boolean;
  accountId: string;
  token: string;
}

export interface ReferenceImageGenerateInput {
  /** Prompt đã ghép xong phía server (system prompt + loại cảnh + gợi ý sửa). */
  prompt: string;
  source: ReferenceImageSource;
  sketch?: {
    data: Buffer;
    mimeType: "image/png" | "image/jpeg";
  };
  seed: number;
  /**
   * Kích thước đầu ra đã tính theo đúng tỉ lệ khung đang vẽ. Không có
   * thì giữ 1024x1024 như trước (đường gọi cũ, test).
   */
  width?: number;
  /** Kích thước đầu ra đã tính theo đúng tỉ lệ khung đang vẽ. */
  height?: number;
}

export interface ReferenceImageGenerateResult {
  /** Ảnh PNG như model trả về, sẵn sàng trả về client dưới dạng data URL. */
  imageBuffer: Buffer;
  mimeType: "image/png";
  width: number;
  height: number;
  /** Tỉ lệ điểm màu trong ảnh (0 tới 1); dùng để loại ảnh có màu. */
  coloredShare: number;
  model: string;
  seed: number;
  elapsedMs: number;
}

export interface CloudflareReferenceImageProvider {
  isEnabled(): boolean;
  generate(
    input: ReferenceImageGenerateInput,
    signal: AbortSignal,
  ): Promise<ReferenceImageGenerateResult>;
}

export const REFERENCE_IMAGE_PROVIDER = Symbol("REFERENCE_IMAGE_PROVIDER");

/**
 * Kiểm tra ảnh Cloudflare trả về và mã lại thành PNG, KHÔNG ép xám.
 *
 * Phong cách nét vẽ phải do model vẽ ra ngay từ đầu (prompt nét vẽ
 * trong reference-image-prompt.ts). Ép xám một ảnh có màu/tô bóng
 * không biến nó thành nét vẽ, chỉ che đi việc model đã bỏ qua phong
 * cách. Vì vậy ảnh có tỉ lệ điểm màu vượt ngưỡng thì bị loại thẳng
 * (ReferenceImageInvalidError) để người dùng sinh lại, thay vì nhận
 * về một ảnh xám giả nét vẽ. Ảnh nét vẽ trắng đen thật có tỉ lệ
 * điểm màu gần 0, nên ngưỡng 0,2 vẫn chừa dư địa cho nhiễu JPEG.
 */
export async function processCloudflareImage(buffer: Buffer): Promise<{
  imageBuffer: Buffer;
  width: number;
  height: number;
  coloredShare: number;
}> {
  if (buffer.length === 0 || buffer.length > MAX_REFERENCE_IMAGE_OUTPUT_BYTES) {
    throw new ReferenceImageInvalidError();
  }
  let metadata: Metadata;
  let raw: { data: Buffer; info: OutputInfo };
  try {
    metadata = await sharp(buffer).metadata();
    raw = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  } catch {
    throw new ReferenceImageInvalidError();
  }
  if (
    (metadata.format !== "png" && metadata.format !== "jpeg") ||
    !metadata.width ||
    !metadata.height ||
    metadata.width < 1 ||
    metadata.height < 1 ||
    metadata.width > 1920 ||
    metadata.height > 1920
  ) {
    throw new ReferenceImageInvalidError();
  }
  const channels = raw.info.channels;
  if (channels < 3) {
    throw new ReferenceImageInvalidError();
  }
  const pixels = raw.info.width * raw.info.height;
  const stride = Math.max(1, Math.floor(pixels / 65536));
  let sampled = 0;
  let colored = 0;
  const data = raw.data;
  for (let i = 0; i < pixels; i += stride) {
    const offset = i * channels;
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    sampled += 1;
    if (max - min > 38 && max > 51) {
      colored += 1;
    }
  }
  const coloredShare = sampled === 0 ? 0 : colored / sampled;
  if (coloredShare > MAX_REFERENCE_IMAGE_COLORED_SHARE) {
    throw new ReferenceImageInvalidError(
      "Cloudflare returned a colored image instead of a black-and-white line drawing",
    );
  }
  let png: Buffer;
  try {
    png = await sharp(buffer).png().toBuffer();
  } catch {
    throw new ReferenceImageInvalidError();
  }
  if (png.length === 0 || png.length > MAX_REFERENCE_IMAGE_OUTPUT_BYTES) {
    throw new ReferenceImageInvalidError();
  }
  return {
    imageBuffer: png,
    width: metadata.width,
    height: metadata.height,
    coloredShare,
  };
}

function cloudflareErrorMessage(bodyText: string): string {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    const errors = (parsed as { errors?: { message?: unknown }[] }).errors;
    const first = errors?.[0]?.message;
    if (typeof first === "string" && first.length > 0) {
      return first.slice(0, 300);
    }
  } catch {
    // Bỏ qua: dùng thông báo chung bên dưới.
  }
  return "";
}

export function createCloudflareReferenceImageProvider(
  config: CloudflareReferenceImageConfig,
): CloudflareReferenceImageProvider {
  const enabled =
    config.enabled &&
    config.accountId.trim().length > 0 &&
    config.token.trim().length > 0;

  async function callCloudflare(
    input: ReferenceImageGenerateInput,
    signal: AbortSignal,
    startedAt: number,
  ): Promise<ReferenceImageGenerateResult> {
    // Cả 2 nguồn dùng chung klein 4B qua multipart: klein dùng
    // multipart cả khi chỉ có prompt, input_image_0 là tùy chọn.
    // Không gửi guidance: 2 lần gọi có guidance 7.0 đều timeout ở
    // 180 giây và 300 giây trong lần kiểm chứng 28/10/2026, nên giữ
    // guidance mặc định của model.
    const model = CLOUDFLARE_KLEIN_4B_MODEL_ID;
    const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`;

    let response: Response;
    try {
      if (input.source !== "prompt" && !input.sketch) {
        throw new ReferenceImageProviderError(
          "A sketch image is required for this reference image source",
        );
      }
      const form = new FormData();
      form.append("prompt", input.prompt);
      // Kích thước theo đúng tỉ lệ khung đang vẽ, do jobs service tính
      // từ panelWidth/panelHeight client gửi. Không có thì 1024x1024.
      form.append("width", String(input.width ?? 1024));
      form.append("height", String(input.height ?? 1024));
      form.append("seed", String(input.seed));
      if (input.sketch) {
        form.append(
          "input_image_0",
          new Blob([Uint8Array.from(input.sketch.data)], {
            type: input.sketch.mimeType,
          }),
          "sketch.png",
        );
      }
      response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.token}` },
        body: form,
        signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ReferenceImageTimeoutError();
      }
      throw new ReferenceImageProviderError(
        error instanceof Error ? error.message : "Network request failed",
      );
    }

    const bodyText = await response.text();
    if (!response.ok) {
      const detail = cloudflareErrorMessage(bodyText);
      if (response.status === 401 || response.status === 403) {
        throw new ReferenceImageAuthError();
      }
      if (response.status === 429 || response.status === 503) {
        throw new ReferenceImageOverloadedError();
      }
      throw new ReferenceImageProviderError(
        detail.length > 0
          ? `Cloudflare request failed: ${detail}`
          : "Cloudflare request failed",
      );
    }

    let imageBase64: unknown;
    try {
      const parsed: unknown = JSON.parse(bodyText);
      imageBase64 = (parsed as { result?: { image?: unknown } }).result?.image;
    } catch {
      throw new ReferenceImageInvalidError();
    }
    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      throw new ReferenceImageInvalidError();
    }
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const processed = await processCloudflareImage(imageBuffer);
    return {
      imageBuffer: processed.imageBuffer,
      mimeType: "image/png",
      width: processed.width,
      height: processed.height,
      coloredShare: processed.coloredShare,
      model,
      seed: input.seed,
      elapsedMs: Date.now() - startedAt,
    };
  }

  return {
    isEnabled(): boolean {
      return enabled;
    },

    async generate(
      input: ReferenceImageGenerateInput,
      signal: AbortSignal,
    ): Promise<ReferenceImageGenerateResult> {
      if (!enabled) {
        throw new ReferenceImageDisabledError();
      }
      const startedAt = Date.now();
      // Timeout riêng của provider, độc lập với tín hiệu hủy của job: hết
      // 300 giây mà chưa có kết quả thì coi là không xác định, không thử lại
      // âm thầm vì lần gọi đầu có thể đã sinh xong và đã trừ neuron.
      const timeoutSignal = AbortSignal.timeout(
        REFERENCE_IMAGE_PROVIDER_TIMEOUT_MS,
      );
      const combined =
        typeof AbortSignal.any === "function"
          ? AbortSignal.any([signal, timeoutSignal])
          : signal;
      return callCloudflare(input, combined, startedAt);
    },
  };
}
