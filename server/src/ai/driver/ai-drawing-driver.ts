import { AiDrawingTask } from "../contracts/ai-drawing-request.dto.js";
import type { AiDrawingPromptEvidence } from "../prompts/ai-drawing-prompt.service.js";

const MAX_AI_DRAWING_TIMEOUT_MS = 60_000;
const MAX_AI_DRAWING_OUTPUT_TOKENS = 4096;

export const AI_DRAWING_PROVIDER = Symbol("AI_DRAWING_PROVIDER");
export const AI_DRAWING_MODEL_PROFILE = Symbol("AI_DRAWING_MODEL_PROFILE");

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
  readonly image: {
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
  modelId: "gemini-3.8-flash",
  description:
    "Candidate vision model for structured composition guidance and drawing review.",
  version: "1",
  tasks: [AiDrawingTask.CompositionGuidance, AiDrawingTask.DrawingReview],
  capabilities: {
    textInput: true,
    imageInput: true,
    structuredOutput: true,
  },
  limits: {
    maxImageBytes: 4 * 1024 * 1024,
    maxOutputTokens: 2048,
    timeoutMs: 30_000,
  },
  enabled: false,
};
