import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomInt, randomUUID } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import {
  CLOUDFLARE_KLEIN_4B_MODEL_ID,
  MAX_REFERENCE_SKETCH_BYTES,
  MAX_REFERENCE_SKETCH_DIMENSION,
  REFERENCE_IMAGE_BLANK_CHANNEL_THRESHOLD,
  REFERENCE_IMAGE_ERROR_CODES,
  REFERENCE_IMAGE_JOB_TTL_MS,
} from "./reference-image.constants.js";
import {
  REFERENCE_IMAGE_PROVIDER,
  ReferenceImageAuthError,
  ReferenceImageDisabledError,
  ReferenceImageInvalidError,
  ReferenceImageOverloadedError,
  ReferenceImageTimeoutError,
  type CloudflareReferenceImageProvider,
} from "./cloudflare-reference-image.provider.js";
import { assembleReferenceImagePrompt } from "./reference-image-prompt.js";
import {
  CreateReferenceImageJobDto,
  ReferenceImageSource,
} from "./reference-image.dto.js";

export type ReferenceImageJobStatus =
  "queued" | "running" | "succeeded" | "failed" | "timeout" | "cancelled";

export interface ReferenceImageJobView {
  id: string;
  status: ReferenceImageJobStatus;
  model: string;
  seed: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  elapsedMs: number | null;
  /** Data URL PNG nét vẽ như model trả về; chỉ có khi job thành công. */
  imageDataUrl: string | null;
  /** Câu mô tả dựng từ yêu cầu (không phải văn bản do model trả về). */
  note: string;
  coloredShare: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

interface ReferenceImageJobRecord extends ReferenceImageJobView {
  userId: string;
  abortController: AbortController | null;
}

const SOURCE_LABELS: Record<ReferenceImageSource, string> = {
  [ReferenceImageSource.Prompt]: "mô tả của bạn",
  [ReferenceImageSource.DrawingPrompt]: "bức vẽ và mô tả của bạn",
};

async function validateSketch(
  image: NonNullable<CreateReferenceImageJobDto["image"]>,
): Promise<Buffer> {
  const bytes = Buffer.from(image.data, "base64");
  if (
    bytes.length === 0 ||
    bytes.length > MAX_REFERENCE_SKETCH_BYTES ||
    bytes.toString("base64") !== image.data
  ) {
    throw new BadRequestException("Invalid reference sketch image");
  }
  let metadata: Metadata;
  try {
    metadata = await sharp(bytes).metadata();
  } catch {
    throw new BadRequestException("Invalid reference sketch image");
  }
  const expectedFormat = image.mimeType.slice("image/".length);
  if (
    metadata.format !== expectedFormat ||
    metadata.width !== image.width ||
    metadata.height !== image.height ||
    !metadata.width ||
    !metadata.height ||
    metadata.width > MAX_REFERENCE_SKETCH_DIMENSION ||
    metadata.height > MAX_REFERENCE_SKETCH_DIMENSION
  ) {
    throw new BadRequestException("Invalid reference sketch image");
  }
  return bytes;
}

/**
 * Phác thảo có trắng hoàn toàn hay không: không một điểm ảnh nào nhìn
 * thấy được trên nền trắng. Điểm trong suốt và điểm trắng đục đều là
 * trắng; ngưỡng chừa dư địa cho nhiễu nén nhẹ, nét xám nhạt vẫn tính
 * là có vẽ. Giải mã thất bại thì trả về false (coi như có vẽ) để
 * không chặn nhầm; validateSketch đã kiểm tra định dạng trước đó.
 */
async function sketchIsBlank(bytes: Buffer): Promise<boolean> {
  let raw: { data: Buffer; info: { channels: number; width: number; height: number } };
  try {
    const result = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
    raw = { data: result.data, info: result.info };
  } catch {
    return false;
  }
  const channels = raw.info.channels;
  const pixels = raw.info.width * raw.info.height;
  const stride = Math.max(1, Math.floor(pixels / 65536));
  const data = raw.data;
  const threshold = REFERENCE_IMAGE_BLANK_CHANNEL_THRESHOLD;
  for (let i = 0; i < pixels; i += stride) {
    const offset = i * channels;
    if (channels === 1) {
      if ((data[offset] ?? 255) < threshold) return false;
    } else if (channels === 2) {
      const alpha = data[offset + 1] ?? 0;
      if (alpha > 0 && (data[offset] ?? 255) < threshold) return false;
    } else {
      const alpha = channels === 4 ? (data[offset + 3] ?? 255) : 255;
      if (alpha === 0) continue;
      const r = data[offset] ?? 255;
      const g = data[offset + 1] ?? 255;
      const b = data[offset + 2] ?? 255;
      if (r < threshold || g < threshold || b < threshold) return false;
    }
  }
  return true;
}

/**
 * Job sinh ảnh mẫu tham khảo, chạy nền trong bộ nhớ.
 *
 * Một job = một lần gọi Cloudflare. Job không tự thử lại khi timeout vì
 * kết quả của lần gọi đầu không xác định (có thể đã sinh xong và đã trừ
 * neuron). Người dùng bấm sinh lại sẽ tạo job mới với seed ngẫu nhiên
 * khác. Ảnh chỉ giữ trong bộ nhớ tối đa 30 phút; client phải lưu ảnh
 * vào IndexedDB riêng ngay khi job thành công.
 */
@Injectable()
export class ReferenceImageJobsService {
  private readonly jobs = new Map<string, ReferenceImageJobRecord>();
  private readonly logger = new Logger(ReferenceImageJobsService.name);

  constructor(
    @Inject(REFERENCE_IMAGE_PROVIDER)
    private readonly provider: CloudflareReferenceImageProvider,
  ) {}

  isEnabled(): boolean {
    return this.provider.isEnabled();
  }

  async createJob(
    userId: string,
    dto: CreateReferenceImageJobDto,
  ): Promise<ReferenceImageJobView> {
    if (!this.provider.isEnabled()) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: REFERENCE_IMAGE_ERROR_CODES.disabled,
        message: "Reference image generation is not enabled on this server",
      });
    }
    if (dto.source === ReferenceImageSource.Prompt && !dto.prompt?.trim()) {
      throw new BadRequestException(
        "A prompt is required when the source is prompt only",
      );
    }
    let sketch:
      { data: Buffer; mimeType: "image/png" | "image/jpeg" } | undefined;
    let effectiveSource = dto.source;
    if (dto.source !== ReferenceImageSource.Prompt) {
      if (!dto.image) {
        throw new BadRequestException(
          "A sketch image is required for this reference image source",
        );
      }
      const bytes = await validateSketch(dto.image);
      sketch = { data: bytes, mimeType: dto.image.mimeType };
      // Phác thảo trắng hoàn toàn gửi kèm chỉ làm model bám vào khoảng
      // trắng và bỏ qua mô tả. Có mô tả thì đổi hẳn sang nguồn chỉ
      // prompt: cùng model klein, không gửi ảnh trắng. Chưa có mô tả
      // thì từ chối ngay, khỏi chờ 300 giây cho một job không có gì
      // để sinh. Client mới đã chặn trường hợp này trước khi gọi, đây
      // là lớp phòng thủ cho client cũ hoặc gọi API trực tiếp.
      if (await sketchIsBlank(bytes)) {
        if (!dto.prompt?.trim()) {
          throw new BadRequestException({
            statusCode: 400,
            code: REFERENCE_IMAGE_ERROR_CODES.blankSketch,
            message:
              "A blank sketch without a prompt cannot generate a reference image",
          });
        }
        effectiveSource = ReferenceImageSource.Prompt;
        sketch = undefined;
      }
    }

    const seed = randomInt(0, 2_147_483_647);
    const prompt = assembleReferenceImagePrompt({
      sceneType: dto.sceneType,
      source: effectiveSource,
      userPrompt: dto.prompt,
      fixHints:
        effectiveSource === ReferenceImageSource.Prompt
          ? undefined
          : dto.fixHints,
    });
    const model = CLOUDFLARE_KLEIN_4B_MODEL_ID;
    const now = Date.now();
    const record: ReferenceImageJobRecord = {
      id: randomUUID(),
      userId,
      status: "queued",
      model,
      seed,
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      elapsedMs: null,
      imageDataUrl: null,
      note: `Ảnh mẫu tham khảo sinh từ ${SOURCE_LABELS[effectiveSource]}, nét trắng đen.`,
      coloredShare: null,
      errorCode: null,
      errorMessage: null,
      abortController: null,
    };
    this.pruneJobs(now);
    this.jobs.set(record.id, record);
    void this.runJob(record, {
      prompt,
      source: effectiveSource,
      sketch,
      seed,
    });
    return this.toView(record);
  }

  getJob(userId: string, id: string): ReferenceImageJobView {
    const record = this.findOwnedJob(userId, id);
    this.pruneJobs(Date.now());
    return this.toView(record);
  }

  cancelJob(userId: string, id: string): ReferenceImageJobView {
    const record = this.findOwnedJob(userId, id);
    if (record.status === "queued" || record.status === "running") {
      record.status = "cancelled";
      record.finishedAt = Date.now();
      record.abortController?.abort();
      record.abortController = null;
    }
    return this.toView(record);
  }

  private findOwnedJob(userId: string, id: string): ReferenceImageJobRecord {
    const record = this.jobs.get(id);
    if (!record || record.userId !== userId) {
      throw new NotFoundException("Reference image job not found");
    }
    return record;
  }

  private pruneJobs(now: number): void {
    for (const [id, record] of this.jobs) {
      if (now - record.createdAt > REFERENCE_IMAGE_JOB_TTL_MS) {
        record.abortController?.abort();
        this.jobs.delete(id);
      }
    }
  }

  private async runJob(
    record: ReferenceImageJobRecord,
    input: {
      prompt: string;
      source: ReferenceImageSource;
      sketch?: { data: Buffer; mimeType: "image/png" | "image/jpeg" };
      seed: number;
    },
  ): Promise<void> {
    record.status = "running";
    record.startedAt = Date.now();
    const abortController = new AbortController();
    record.abortController = abortController;
    try {
      const result = await this.provider.generate(
        input,
        abortController.signal,
      );
      record.imageDataUrl = `data:image/png;base64,${result.imageBuffer.toString("base64")}`;
      record.coloredShare = result.coloredShare;
      record.elapsedMs = result.elapsedMs;
      record.status = "succeeded";
      record.finishedAt = Date.now();
      this.logger.log(
        `Reference image succeeded: model=${result.model} seed=${result.seed} elapsedMs=${result.elapsedMs} bytes=${result.imageBuffer.length} coloredShare=${result.coloredShare.toFixed(4)}`,
      );
    } catch (error) {
      // Hủy từ người dùng: giữ nguyên trạng thái "cancelled" mà
      // cancelJob đã đặt, không ghi đè bằng lỗi của lần gọi bị hủy.
      if (abortController.signal.aborted) {
        return;
      }
      record.finishedAt = Date.now();
      record.elapsedMs = record.startedAt
        ? record.finishedAt - record.startedAt
        : null;
      if (error instanceof ReferenceImageTimeoutError) {
        record.status = "timeout";
        record.errorCode = REFERENCE_IMAGE_ERROR_CODES.timeout;
        record.errorMessage = "Cloudflare reference image request timed out";
      } else if (error instanceof ReferenceImageAuthError) {
        record.status = "failed";
        record.errorCode = REFERENCE_IMAGE_ERROR_CODES.auth;
        record.errorMessage =
          "Cloudflare rejected the reference image credential";
      } else if (error instanceof ReferenceImageOverloadedError) {
        record.status = "failed";
        record.errorCode = REFERENCE_IMAGE_ERROR_CODES.overloaded;
        record.errorMessage =
          "Cloudflare is overloaded or the daily neuron allowance is used up";
      } else if (error instanceof ReferenceImageDisabledError) {
        record.status = "failed";
        record.errorCode = REFERENCE_IMAGE_ERROR_CODES.disabled;
        record.errorMessage = "Reference image generation is not enabled";
      } else if (error instanceof ReferenceImageInvalidError) {
        record.status = "failed";
        record.errorCode = REFERENCE_IMAGE_ERROR_CODES.invalidResponse;
        record.errorMessage = "Cloudflare returned an invalid reference image";
      } else {
        record.status = "failed";
        record.errorCode = REFERENCE_IMAGE_ERROR_CODES.providerError;
        record.errorMessage =
          error instanceof Error ? error.message : "Reference image failed";
      }
      this.logger.error(
        `Reference image failed: model=${record.model} seed=${record.seed} status=${record.status} code=${record.errorCode}`,
      );
    } finally {
      record.abortController = null;
    }
  }

  private toView(record: ReferenceImageJobRecord): ReferenceImageJobView {
    return {
      id: record.id,
      status: record.status,
      model: record.model,
      seed: record.seed,
      createdAt: record.createdAt,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      elapsedMs: record.elapsedMs,
      imageDataUrl: record.imageDataUrl,
      note: record.note,
      coloredShare: record.coloredShare,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
    };
  }
}
