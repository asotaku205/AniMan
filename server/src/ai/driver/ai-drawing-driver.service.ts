import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  AiDrawingRequestDto,
  AiDrawingTask,
  MAX_AI_IMAGE_BYTES,
} from "../contracts/ai-drawing-request.dto.js";
import { AiDrawingPromptService } from "../prompts/ai-drawing-prompt.service.js";
import {
  AiDrawingResponseValidationError,
  parseAiDrawingResponse,
} from "../contracts/ai-drawing-response.js";
import { validateAiDrawingImage } from "../contracts/ai-drawing-image.validator.js";
import {
  AI_DRAWING_ERROR_CODES,
  AI_DRAWING_MODEL_PROFILE,
  AI_DRAWING_PROVIDER,
  AiDrawingModelProfileError,
  AiDrawingModelRegistry,
  AiDrawingProviderError,
  AiDrawingProviderTimeoutError,
  AiDrawingProviderTransientError,
  AiDrawingProviderTruncatedError,
} from "./ai-drawing-driver.js";
import type { AiDrawingResponse } from "../contracts/ai-drawing-response.js";
import type {
  AiDrawingErrorCode,
  AiDrawingModelProfile,
  AiDrawingProvider,
  AiDrawingProviderRequest,
} from "./ai-drawing-driver.js";

const MAX_PROVIDER_ATTEMPTS = 2;

@Injectable()
export class AiDrawingDriver {
  private readonly modelRegistry: AiDrawingModelRegistry;
  private readonly logger = new Logger(AiDrawingDriver.name);

  constructor(
    @Inject(AI_DRAWING_PROVIDER)
    private readonly provider: AiDrawingProvider,
    @Inject(AI_DRAWING_MODEL_PROFILE)
    profile: AiDrawingModelProfile,
    @Inject(AiDrawingPromptService)
    private readonly promptService: AiDrawingPromptService,
  ) {
    this.modelRegistry = new AiDrawingModelRegistry(profile);
  }

  async execute(input: unknown): Promise<AiDrawingResponse> {
    const request = await this.validateRequest(input);
    // VD-1: ảnh bắt buộc với mọi task TRỪ page_story_flow (task kể chuyện cả
    // trang chạy được chỉ bằng mô tả layout + ý tưởng).
    if (!request.image) {
      if (request.task !== AiDrawingTask.PageStoryFlow) {
        throw new BadRequestException(
          "AI drawing image is required for this task",
        );
      }
    } else {
      await validateAiDrawingImage(request.image);
    }
    const profile = this.selectProfile(request.task);
    if (request.image) {
      this.validateImageSize(request.image.data, profile);
    }
    const prompt = this.promptService.assemble(request);

    const providerRequest: AiDrawingProviderRequest = {
      modelId: profile.modelId,
      task: request.task,
      templateId: prompt.templateId,
      templateVersion: prompt.templateVersion,
      systemInstruction: prompt.systemInstruction,
      prompt: prompt.userPrompt,
      evidence: prompt.evidence,
      image: request.image,
      maxOutputTokens: profile.limits.maxOutputTokens,
    };
    const response = await this.generateWithRetry(
      providerRequest,
      profile.limits.timeoutMs,
    );

    try {
      return parseAiDrawingResponse(
        response,
        request.task,
        new Set(prompt.sourceIds),
      );
    } catch (error) {
      if (error instanceof AiDrawingResponseValidationError) {
        this.throwDrawingError({
          code: AI_DRAWING_ERROR_CODES.invalidResponse,
          status: 502,
          message:
            "AI provider returned a response that violates the drawing contract",
          task: request.task,
          modelId: profile.modelId,
          detail: `reason="${error.message}"`,
        });
      }
      throw error;
    }
  }

  private async validateRequest(input: unknown): Promise<AiDrawingRequestDto> {
    const request = plainToInstance(AiDrawingRequestDto, input);
    const errors = await validate(request, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      throw new BadRequestException("Invalid AI drawing request");
    }
    return request;
  }

  private selectProfile(task: AiDrawingTask): AiDrawingModelProfile {
    try {
      return this.modelRegistry.select(task);
    } catch (error) {
      if (error instanceof AiDrawingModelProfileError) {
        this.throwDrawingError({
          code: AI_DRAWING_ERROR_CODES.modelUnavailable,
          status: 503,
          message: "AI drawing is not available for this task",
          task,
          detail: `reason="${error.message}"`,
        });
      }
      throw error;
    }
  }

  /**
   * Ghi log lỗi thật ra terminal rồi ném exception mang **mã lỗi** cho client.
   *
   * `code` là thứ client dùng để chọn câu tiếng Việt; `message` giữ tiếng Anh cho log/nội
   * bộ. Log kèm `code`, HTTP status, model và (nếu có) `finishReason` + số token để lần sau
   * chẩn đoán bằng log thay vì đoán.
   */
  private throwDrawingError(input: {
    code: AiDrawingErrorCode;
    status: number;
    message: string;
    task: AiDrawingTask;
    modelId?: string;
    detail?: string;
  }): never {
    const body = {
      statusCode: input.status,
      code: input.code,
      message: input.message,
    };
    this.logger.error(
      `AI drawing failed: task=${input.task} code=${input.code} status=${input.status} model=${input.modelId ?? "-"}` +
        (input.detail ? ` ${input.detail}` : ""),
    );
    if (input.status === 502) {
      throw new BadGatewayException(body);
    }
    if (input.status === 503) {
      throw new ServiceUnavailableException(body);
    }
    throw new GatewayTimeoutException(body);
  }

  private validateImageSize(
    encodedImage: string,
    profile: AiDrawingModelProfile,
  ): void {
    const exactImageBytes = Buffer.from(encodedImage, "base64").byteLength;
    const maxBytes = Math.min(MAX_AI_IMAGE_BYTES, profile.limits.maxImageBytes);
    if (exactImageBytes > maxBytes) {
      throw new BadRequestException("AI drawing image exceeds the size limit");
    }
  }

  private async generateWithRetry(
    request: AiDrawingProviderRequest,
    timeoutMs: number,
  ): Promise<unknown> {
    for (let attempt = 1; attempt <= MAX_PROVIDER_ATTEMPTS; attempt += 1) {
      try {
        return await this.generateWithTimeout(request, timeoutMs);
      } catch (error) {
        if (
          error instanceof AiDrawingProviderTransientError &&
          attempt < MAX_PROVIDER_ATTEMPTS
        ) {
          continue;
        }
        if (error instanceof AiDrawingProviderTimeoutError) {
          this.throwDrawingError({
            code: AI_DRAWING_ERROR_CODES.timeout,
            status: 504,
            message: "AI provider request timed out",
            task: request.task,
            modelId: request.modelId,
          });
        }
        // Cắt ở trần token: gửi lại đúng prompt đó cũng bị cắt lại, nên không thử lại.
        if (error instanceof AiDrawingProviderTruncatedError) {
          this.throwDrawingError({
            code: AI_DRAWING_ERROR_CODES.outputTruncated,
            status: 502,
            message: error.message,
            task: request.task,
            modelId: request.modelId,
            detail: `finishReason=${error.finishReason} outputTokens=${error.outputTokens ?? "unknown"} textLength=${error.textLength}`,
          });
        }
        if (error instanceof AiDrawingProviderTransientError) {
          this.throwDrawingError({
            code: AI_DRAWING_ERROR_CODES.providerOverloaded,
            status: 503,
            message: "AI provider is temporarily unavailable",
            task: request.task,
            modelId: request.modelId,
          });
        }
        if (error instanceof AiDrawingProviderError) {
          this.throwDrawingError({
            code: AI_DRAWING_ERROR_CODES.providerRequestFailed,
            status: 502,
            message: "AI provider request failed",
            task: request.task,
            modelId: request.modelId,
            detail: `reason="${error.message}"`,
          });
        }
        throw error;
      }
    }
    this.throwDrawingError({
      code: AI_DRAWING_ERROR_CODES.providerOverloaded,
      status: 503,
      message: "AI provider is temporarily unavailable",
      task: request.task,
      modelId: request.modelId,
    });
  }

  private async generateWithTimeout(
    request: AiDrawingProviderRequest,
    timeoutMs: number,
  ): Promise<unknown> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new AiDrawingProviderTimeoutError());
      }, timeoutMs);
    });

    try {
      return await Promise.race([
        this.provider.generate(request, controller.signal),
        timeoutPromise,
      ]);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }
}
