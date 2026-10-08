import "reflect-metadata";
import {
  BadRequestException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AiDrawingTask } from "../src/ai/contracts/ai-drawing-request.dto.js";
import { AiDrawingModule } from "../src/ai/ai-drawing.module.js";
import {
  AiDrawingModelProfileError,
  AiDrawingModelRegistry,
  AiDrawingModelProfile,
  AiDrawingProvider,
  AiDrawingProviderError,
  AiDrawingProviderRequest,
  AiDrawingProviderTransientError,
} from "../src/ai/driver/ai-drawing-driver.js";
import { AiDrawingDriver } from "../src/ai/driver/ai-drawing-driver.service.js";

const validRequest = {
  task: AiDrawingTask.CompositionGuidance,
  prompt: "Đề xuất đường dẫn mắt cho panel",
  image: {
    data: "aGVsbG8=",
    mimeType: "image/png",
    width: 1024,
    height: 1024,
  },
};

const validResponse = {
  schemaVersion: "1",
  task: AiDrawingTask.CompositionGuidance,
  summary: "Có thể làm rõ điểm nhấn.",
  sourceIds: [],
  recommendations: [
    {
      principle: "composition",
      explanation: "Thử dịch điểm nhấn khỏi tâm panel.",
      overlay: [
        {
          kind: "line",
          from: { x: 0.1, y: 0.8 },
          to: { x: 0.8, y: 0.2 },
          style: "flow",
          opacity: 0.2,
        },
      ],
    },
  ],
};

const enabledProfile: AiDrawingModelProfile = {
  id: "test-drawing-model",
  provider: "test",
  modelId: "test-vision-model",
  description: "Test-only model profile.",
  version: "1",
  tasks: [AiDrawingTask.CompositionGuidance, AiDrawingTask.DrawingReview],
  capabilities: {
    textInput: true,
    imageInput: true,
    structuredOutput: true,
  },
  limits: {
    maxImageBytes: 1024,
    maxOutputTokens: 128,
    timeoutMs: 100,
  },
  enabled: true,
};

function createDriver(
  generate: AiDrawingProvider["generate"],
  profile = enabledProfile,
): AiDrawingDriver {
  return new AiDrawingDriver({ generate }, profile);
}

describe("AI drawing driver", () => {
  it("registers the driver through the dynamic Nest module", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AiDrawingModule.register({
          profile: enabledProfile,
          provider: { generate: async () => validResponse },
        }),
      ],
    }).compile();

    expect(moduleRef.get(AiDrawingDriver)).toBeInstanceOf(AiDrawingDriver);
    await moduleRef.close();
  });

  it("rejects model profiles with unbounded limits", () => {
    expect(
      () =>
        new AiDrawingModelRegistry({
          ...enabledProfile,
          limits: {
            ...enabledProfile.limits,
            timeoutMs: 60_001,
          },
        }),
    ).toThrow(AiDrawingModelProfileError);
  });

  it("validates requests and parses provider output against the application contract", async () => {
    const driver = createDriver(async () => validResponse);

    await expect(driver.execute(validRequest, new Set())).resolves.toEqual(
      validResponse,
    );
  });

  it("rejects invalid input before calling the provider", async () => {
    let calls = 0;
    const driver = createDriver(async () => {
      calls += 1;
      return validResponse;
    });

    await expect(
      driver.execute(
        { ...validRequest, arbitraryModel: "attacker-model" },
        new Set(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(calls).toBe(0);
  });

  it("rejects disabled profiles before calling the provider", async () => {
    let calls = 0;
    const driver = createDriver(
      async () => {
        calls += 1;
        return validResponse;
      },
      { ...enabledProfile, enabled: false },
    );

    await expect(
      driver.execute(validRequest, new Set()),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(calls).toBe(0);
  });

  it("never accepts a model ID from the client", async () => {
    let capturedModel = "";
    const driver = createDriver(async (request) => {
      capturedModel = request.modelId;
      return validResponse;
    });

    await expect(
      driver.execute(
        { ...validRequest, modelId: "unapproved-model" },
        new Set(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(capturedModel).toBe("");
  });

  it("retries a typed transient provider error once", async () => {
    let calls = 0;
    const driver = createDriver(async () => {
      calls += 1;
      if (calls === 1) {
        throw new AiDrawingProviderTransientError();
      }
      return validResponse;
    });

    await expect(driver.execute(validRequest, new Set())).resolves.toEqual(
      validResponse,
    );
    expect(calls).toBe(2);
  });

  it("returns a sanitized service error after retries are exhausted", async () => {
    let calls = 0;
    const driver = createDriver(async () => {
      calls += 1;
      throw new AiDrawingProviderTransientError();
    });

    await expect(driver.execute(validRequest, new Set())).rejects.toThrow(
      "AI provider is temporarily unavailable",
    );
    expect(calls).toBe(2);
  });

  it("aborts a timed-out provider call and does not retry it", async () => {
    let calls = 0;
    let wasAborted = false;
    const driver = createDriver(
      async (_request: AiDrawingProviderRequest, signal: AbortSignal) => {
        calls += 1;
        signal.addEventListener("abort", () => {
          wasAborted = true;
        });
        return new Promise<unknown>(() => {});
      },
      { ...enabledProfile, limits: { ...enabledProfile.limits, timeoutMs: 5 } },
    );

    await expect(
      driver.execute(validRequest, new Set()),
    ).rejects.toBeInstanceOf(GatewayTimeoutException);
    expect(calls).toBe(1);
    expect(wasAborted).toBe(true);
  });

  it("rejects malformed provider responses without exposing their content", async () => {
    const driver = createDriver(async () => ({
      ...validResponse,
      generatedImage: "private-provider-payload",
    }));

    await expect(driver.execute(validRequest, new Set())).rejects.toThrow(
      "AI provider returned a response that violates the drawing contract",
    );
  });

  it("sanitizes known provider failures without hiding unexpected programming errors", async () => {
    const providerFailure = createDriver(async () => {
      throw new AiDrawingProviderError("upstream key detail");
    });
    const programmingFailure = createDriver(async () => {
      throw new TypeError("unexpected internal failure");
    });

    await expect(
      providerFailure.execute(validRequest, new Set()),
    ).rejects.toThrow("AI provider request failed");
    await expect(
      programmingFailure.execute(validRequest, new Set()),
    ).rejects.toThrow("unexpected internal failure");
  });
});
