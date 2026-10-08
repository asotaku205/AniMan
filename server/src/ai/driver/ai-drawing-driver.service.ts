import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  AiDrawingRequestDto,
  AiDrawingTask,
  MAX_AI_IMAGE_BYTES,
} from "../contracts/ai-drawing-request.dto.js";
import {
  AiDrawingResponseValidationError,
  parseAiDrawingResponse,
} from "../contracts/ai-drawing-response.js";
import {
  AI_DRAWING_MODEL_PROFILE,
  AI_DRAWING_PROVIDER,
  AiDrawingModelProfileError,
  AiDrawingModelRegistry,
  AiDrawingProviderError,
  AiDrawingProviderTimeoutError,
  AiDrawingProviderTransientError,
} from "./ai-drawing-driver.js";
import type { AiDrawingResponse } from "../contracts/ai-drawing-response.js";
import type {
  AiDrawingModelProfile,
  AiDrawingProvider,
  AiDrawingProviderRequest,
} from "./ai-drawing-driver.js";

const MAX_PROVIDER_ATTEMPTS = 2;

@Injectable()
export class AiDrawingDriver {
  private readonly modelRegistry: AiDrawingModelRegistry;

  constructor(
    @Inject(AI_DRAWING_PROVIDER)
    private readonly provider: AiDrawingProvider,
    @Inject(AI_DRAWING_MODEL_PROFILE)
    profile: AiDrawingModelProfile,
  ) {
    this.modelRegistry = new AiDrawingModelRegistry(profile);
  }

  async execute(
    input: unknown,
    availableSourceIds: ReadonlySet<string>,
  ): Promise<AiDrawingResponse> {
    const request = await this.validateRequest(input);
    const profile = this.selectProfile(request.task);
    this.validateImageSize(request.image.data, profile);

    const providerRequest: AiDrawingProviderRequest = {
      modelId: profile.modelId,
      task: request.task,
      prompt: request.prompt,
      image: request.image,
      maxOutputTokens: profile.limits.maxOutputTokens,
    };
    const response = await this.generateWithRetry(
      providerRequest,
      profile.limits.timeoutMs,
    );

    try {
      return parseAiDrawingResponse(response, request.task, availableSourceIds);
    } catch (error) {
      if (error instanceof AiDrawingResponseValidationError) {
        throw new BadGatewayException(
          "AI provider returned a response that violates the drawing contract",
        );
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
        throw new ServiceUnavailableException(
          "AI drawing is not available for this task",
        );
      }
      throw error;
    }
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
          throw new GatewayTimeoutException("AI provider request timed out");
        }
        if (error instanceof AiDrawingProviderTransientError) {
          throw new ServiceUnavailableException(
            "AI provider is temporarily unavailable",
          );
        }
        if (error instanceof AiDrawingProviderError) {
          throw new ServiceUnavailableException("AI provider request failed");
        }
        throw error;
      }
    }
    throw new ServiceUnavailableException(
      "AI provider is temporarily unavailable",
    );
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
