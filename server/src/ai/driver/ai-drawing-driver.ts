import { AiDrawingTask } from "../contracts/ai-drawing-request.dto.js";
import type { AiDrawingPromptEvidence } from "../prompts/ai-drawing-prompt.service.js";

// Trần hợp lệ của profile. `MAX_AI_DRAWING_OUTPUT_TOKENS` nâng 4096 → 8192 ngày
// 18/10/2026 (Phase 5D): đo thật cho thấy trần 4096 làm model viết dài thì JSON bị cắt ở
// `MAX_TOKENS` → parser báo không đọc được JSON → 503 nói sai nguyên nhân. Timeout nâng
// theo vì ~260 token/s nghĩa là 8192 token output cần khoảng 35–50s.
const MAX_AI_DRAWING_TIMEOUT_MS = 120_000;
const MAX_AI_DRAWING_OUTPUT_TOKENS = 8192;

export const AI_DRAWING_PROVIDER = Symbol("AI_DRAWING_PROVIDER");
export const AI_DRAWING_MODEL_PROFILE = Symbol("AI_DRAWING_MODEL_PROFILE");

/**
 * Mã lỗi ổn định trả cho client (Phase 5E). Client chọn câu tiếng Việt theo `code`
 * thay vì theo HTTP status, vì nhiều nguyên nhân khác nhau cùng dùng 503/502.
 *
 * Phải khớp `AI_DRAWING_ERROR_CODES` của client (`client/lib/ai-drawing-api.ts`).
 */
export const AI_DRAWING_ERROR_CODES = {
  /** Profile model tắt hoặc không khai báo task này. */
  modelUnavailable: "ai_model_unavailable",
  /** Nhà cung cấp quá tải (429/503) sau khi đã thử lại. */
  providerOverloaded: "ai_provider_overloaded",
  /** Gọi nhà cung cấp thất bại vì lý do khác (khoá sai, 4xx/5xx khác, phản hồi rỗng). */
  providerRequestFailed: "ai_provider_error",
  /** Model viết dài quá trần token → output bị cắt ở `MAX_TOKENS`. */
  outputTruncated: "ai_output_truncated",
  /** Nhà cung cấp trả về thứ không khớp hợp đồng của ứng dụng. */
  invalidResponse: "ai_invalid_response",
  /** Quá thời gian chờ của profile. */
  timeout: "ai_timeout",
} as const;

export type AiDrawingErrorCode =
  (typeof AI_DRAWING_ERROR_CODES)[keyof typeof AI_DRAWING_ERROR_CODES];

export interface AiDrawingModelProfile {
  readonly id: string;
  readonly provider: string;
  readonly modelId: string;
  readonly description: string;
  readonly version: string;
  readonly tasks: readonly AiDrawingTask[];
  readonly capabilities: {
    readonly textInput: boolean;
    readonly imageInput: boolean;
    readonly structuredOutput: boolean;
  };
  readonly limits: {
    readonly maxImageBytes: number;
    readonly maxOutputTokens: number;
    readonly timeoutMs: number;
  };
  readonly enabled: boolean;
}

export interface AiDrawingProviderRequest {
  readonly modelId: string;
  readonly task: AiDrawingTask;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly systemInstruction: string;
  readonly prompt: string;
  readonly evidence: readonly AiDrawingPromptEvidence[];
  /**
   * Ảnh canvas. **Vắng mặt là hợp lệ với `page_story_flow`** (VD-1); mọi task
   * khác driver đã chặn từ trước nên tới đây luôn có ảnh.
   */
  readonly image?: {
    readonly data: string;
    readonly mimeType: string;
    readonly width: number;
    readonly height: number;
  };
  readonly maxOutputTokens: number;
}

export interface AiDrawingProvider {
  generate(
    request: AiDrawingProviderRequest,
    signal: AbortSignal,
  ): Promise<unknown>;
}

export class AiDrawingProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiDrawingProviderError";
  }
}

export class AiDrawingProviderTransientError extends AiDrawingProviderError {
  constructor() {
    super("AI provider temporarily unavailable");
    this.name = "AiDrawingProviderTransientError";
  }
}

export class AiDrawingProviderTimeoutError extends AiDrawingProviderError {
  constructor() {
    super("AI provider request timed out");
    this.name = "AiDrawingProviderTimeoutError";
  }
}

/**
 * Model bị cắt ở trần token (`finishReason: MAX_TOKENS`) nên phản hồi dở dang.
 *
 * Tách khỏi `AiDrawingProviderError` vì đây là nguyên nhân **đoán được** (trần output quá
 * thấp so với yêu cầu) và **không nên thử lại**: gửi lại đúng prompt đó với đúng trần đó
 * sẽ lại bị cắt. Mang theo số liệu để driver ghi log chẩn đoán.
 */
export class AiDrawingProviderTruncatedError extends AiDrawingProviderError {
  constructor(
    readonly finishReason: string,
    readonly outputTokens: number | undefined,
    readonly textLength: number,
  ) {
    super("AI provider stopped before finishing the response (output truncated)");
    this.name = "AiDrawingProviderTruncatedError";
  }
}

export class AiDrawingModelProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiDrawingModelProfileError";
  }
}

export class AiDrawingModelRegistry {
  constructor(private readonly profile: AiDrawingModelProfile) {
    if (
      profile.id.trim().length === 0 ||
      profile.provider.trim().length === 0 ||
      profile.modelId.trim().length === 0 ||
      !Number.isInteger(profile.limits.maxImageBytes) ||
      profile.limits.maxImageBytes < 1 ||
      profile.limits.maxImageBytes > 4 * 1024 * 1024 ||
      !Number.isInteger(profile.limits.maxOutputTokens) ||
      profile.limits.maxOutputTokens < 1 ||
      profile.limits.maxOutputTokens > MAX_AI_DRAWING_OUTPUT_TOKENS ||
      !Number.isInteger(profile.limits.timeoutMs) ||
      profile.limits.timeoutMs < 1 ||
      profile.limits.timeoutMs > MAX_AI_DRAWING_TIMEOUT_MS
    ) {
      throw new AiDrawingModelProfileError(
        "AI drawing model profile has invalid limits or identifiers",
      );
    }
  }

  select(task: AiDrawingTask): AiDrawingModelProfile {
    if (!this.profile.enabled) {
      throw new AiDrawingModelProfileError(
        "AI drawing model profile is disabled",
      );
    }
    if (
      !this.profile.tasks.includes(task) ||
      !this.profile.capabilities.textInput ||
      !this.profile.capabilities.imageInput ||
      !this.profile.capabilities.structuredOutput
    ) {
      throw new AiDrawingModelProfileError(
        "AI drawing model profile does not support this task",
      );
    }
    return this.profile;
  }
}

export const GEMINI_DRAWING_MODEL_PROFILE: AiDrawingModelProfile = {
  id: "gemini-drawing-assistant",
  provider: "google-gemini",
  modelId: "gemini-flash-latest",
  description:
    "Google Gemini Flash (Latest) — vision model for structured composition guidance, stroke guidance, pose guidance, page story flow, scene blueprint and drawing review.",
  version: "4",
  tasks: [
    AiDrawingTask.CompositionGuidance,
    AiDrawingTask.DrawingReview,
    AiDrawingTask.StrokeGuidance,
    AiDrawingTask.CompositionOverlay,
    AiDrawingTask.PoseGuidance,
    AiDrawingTask.PageStoryFlow,
    AiDrawingTask.SceneBlueprint,
  ],
  capabilities: {
    textInput: true,
    imageInput: true,
    structuredOutput: true,
  },
  limits: {
    maxImageBytes: 4 * 1024 * 1024,
    maxOutputTokens: 8192,
    timeoutMs: 90_000,
  },
  enabled: true,
};
