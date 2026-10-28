import "reflect-metadata";
import {
  BadRequestException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import sharp from "sharp";
import { AiDrawingTask } from "../src/ai/contracts/ai-drawing-request.dto.js";
import { AiDrawingModule } from "../src/ai/ai-drawing.module.js";
import {
  AI_DRAWING_ERROR_CODES,
  AiDrawingModelProfileError,
  AiDrawingModelRegistry,
  AiDrawingModelProfile,
  AiDrawingProvider,
  AiDrawingProviderError,
  AiDrawingProviderRequest,
  AiDrawingProviderTimeoutError,
  AiDrawingProviderTransientError,
  AiDrawingProviderTruncatedError,
  GEMINI_DRAWING_MODEL_PROFILE,
} from "../src/ai/driver/ai-drawing-driver.js";
import { AiDrawingDriver } from "../src/ai/driver/ai-drawing-driver.service.js";
import { AiDrawingPromptService } from "../src/ai/prompts/ai-drawing-prompt.service.js";

const validRequest = {
  task: AiDrawingTask.CompositionGuidance,
  prompt: "Xin hãy xem bản vẽ này giúp tôi",
  image: {
    data: (
      await sharp({
        create: {
          width: 256,
          height: 256,
          channels: 3,
          background: { r: 80, g: 120, b: 160 },
        },
      })
        .png({ compressionLevel: 9 })
        .toBuffer()
    ).toString("base64"),
    mimeType: "image/png",
    width: 256,
    height: 256,
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
  return new AiDrawingDriver(
    { generate },
    profile,
    new AiDrawingPromptService(),
  );
}

const storyFlowProfile: AiDrawingModelProfile = {
  ...enabledProfile,
  tasks: [...enabledProfile.tasks, AiDrawingTask.PageStoryFlow],
};

const storyFlowResponse = {
  schemaVersion: "1",
  task: AiDrawingTask.PageStoryFlow,
  summary: "Trang dồn từ toàn cảnh xuống cận cảnh gương mặt.",
  sourceIds: [],
  flow: "Sân trường vắng → tiếng bước chân → quay đầu → gương mặt sững lại.",
  panels: [
    { panelId: "p1", order: 1, hint: "Toàn cảnh sân trường.", camera: "toàn cảnh" },
    { panelId: "p2", order: 2, hint: "Cận giày dừng lại.", camera: "cận cảnh" },
    { panelId: "p3", order: 3, hint: "Nhân vật quay đầu.", camera: "trung cảnh" },
    { panelId: "p4", order: 4, hint: "Gương mặt sững lại.", camera: "cận cảnh" },
  ],
};

describe("AI drawing driver", () => {
  it(
    "registers the driver through the dynamic Nest module",
    async () => {
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
    },
    15000,
  );

  it("rejects model profiles with unbounded limits", () => {
    expect(
      () =>
        new AiDrawingModelRegistry({
          ...enabledProfile,
          limits: {
            ...enabledProfile.limits,
            timeoutMs: 120_001,
          },
        }),
    ).toThrow(AiDrawingModelProfileError);

    expect(
      () =>
        new AiDrawingModelRegistry({
          ...enabledProfile,
          limits: {
            ...enabledProfile.limits,
            maxOutputTokens: 8193,
          },
        }),
    ).toThrow(AiDrawingModelProfileError);
  });

  it("accepts the production profile with the raised output budget (Phase 5D)", () => {
    expect(GEMINI_DRAWING_MODEL_PROFILE.limits.maxOutputTokens).toBe(8192);
    expect(GEMINI_DRAWING_MODEL_PROFILE.limits.timeoutMs).toBe(90_000);

    const registry = new AiDrawingModelRegistry(GEMINI_DRAWING_MODEL_PROFILE);

    expect(registry.select(AiDrawingTask.DrawingReview)).toBe(
      GEMINI_DRAWING_MODEL_PROFILE,
    );
    expect(registry.select(AiDrawingTask.SceneBlueprint)).toBe(
      GEMINI_DRAWING_MODEL_PROFILE,
    );
    // Task nét mờ đã gỡ khỏi profile (28/10/2026): chọn task đó phải lỗi.
    expect(() =>
      registry.select("stroke_guidance" as never),
    ).toThrow(AiDrawingModelProfileError);
  });

  it("validates requests and parses provider output against the application contract", async () => {
    const driver = createDriver(async () => validResponse);

    await expect(driver.execute(validRequest)).resolves.toEqual(validResponse);
  });

  it("requires an image for every task except page story flow (VD-1)", async () => {
    let calls = 0;
    const driver = createDriver(async () => {
      calls += 1;
      return validResponse;
    });
    const { image: _image, ...withoutImage } = validRequest;

    await expect(driver.execute(withoutImage)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(calls).toBe(0);
  });

  it("runs page story flow without an image and keeps the layout context", async () => {
    let receivedRequest: AiDrawingProviderRequest | undefined;
    const driver = createDriver(
      async (request) => {
        receivedRequest = request;
        return storyFlowResponse;
      },
      storyFlowProfile,
    );

    await expect(
      driver.execute({
        task: AiDrawingTask.PageStoryFlow,
        prompt: "layout L1 gồm p1..p4, trang 2/8, thể loại hành động",
      }),
    ).resolves.toEqual(storyFlowResponse);

    expect(receivedRequest?.image).toBeUndefined();
    expect(receivedRequest?.templateId).toBe("manga-page-story-flow");
    expect(receivedRequest?.prompt).toContain("layout L1 gồm p1..p4");
  });

  it("passes versioned prompt and retrieved evidence separately to the provider", async () => {
    let receivedRequest: AiDrawingProviderRequest | undefined;
    const driver = createDriver(async (request) => {
      receivedRequest = request;
      return {
        ...validResponse,
        sourceIds: request.evidence.map(({ id }) => id),
      };
    });

    await driver.execute({
      ...validRequest,
      prompt: "Gợi ý bố cục và điểm nhấn",
    });

    expect(receivedRequest?.templateId).toBe("manga-composition-guidance");
    expect(receivedRequest?.templateVersion).toBe("1");
    expect(receivedRequest?.systemInstruction).toContain(
      "người dùng luôn là tác giả",
    );
    expect(receivedRequest?.prompt).toBe("Gợi ý bố cục và điểm nhấn");
    expect(receivedRequest?.evidence.length).toBeGreaterThan(0);
  });

  it("rejects provider citations that were not retrieved for the request", async () => {
    const driver = createDriver(async () => ({
      ...validResponse,
      sourceIds: ["unretrieved-source"],
    }));

    await expect(driver.execute(validRequest)).rejects.toThrow(
      "AI provider returned a response that violates the drawing contract",
    );
  });

  it("rejects invalid input before calling the provider", async () => {
    let calls = 0;
    const driver = createDriver(async () => {
      calls += 1;
      return validResponse;
    });

    await expect(
      driver.execute({ ...validRequest, arbitraryModel: "attacker-model" }),
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

    await expect(driver.execute(validRequest)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(calls).toBe(0);
  });

  it("never accepts a model ID from the client", async () => {
    let capturedModel = "";
    const driver = createDriver(async (request) => {
      capturedModel = request.modelId;
      return validResponse;
    });

    await expect(
      driver.execute({ ...validRequest, modelId: "unapproved-model" }),
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

    await expect(driver.execute(validRequest)).resolves.toEqual(validResponse);
    expect(calls).toBe(2);
  });

  it("returns a sanitized service error after retries are exhausted", async () => {
    let calls = 0;
    const driver = createDriver(async () => {
      calls += 1;
      throw new AiDrawingProviderTransientError();
    });

    await expect(driver.execute(validRequest)).rejects.toThrow(
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

    await expect(driver.execute(validRequest)).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
    expect(calls).toBe(1);
    expect(wasAborted).toBe(true);
  });

  it("rejects malformed provider responses without exposing their content", async () => {
    const driver = createDriver(async () => ({
      ...validResponse,
      generatedImage: "private-provider-payload",
    }));

    await expect(driver.execute(validRequest)).rejects.toThrow(
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

    await expect(providerFailure.execute(validRequest)).rejects.toThrow(
      "AI provider request failed",
    );
    await expect(programmingFailure.execute(validRequest)).rejects.toThrow(
      "unexpected internal failure",
    );
  });

  it("maps an upstream failure to a machine-readable error code", async () => {
    const providerFailure = createDriver(async () => {
      throw new AiDrawingProviderError("upstream key detail");
    });

    await expect(providerFailure.execute(validRequest)).rejects.toMatchObject({
      response: { code: AI_DRAWING_ERROR_CODES.providerRequestFailed },
    });
  });

  it("names the disabled-profile cause instead of a generic 503", async () => {
    const driver = createDriver(async () => validResponse, {
      ...enabledProfile,
      enabled: false,
    });

    await expect(driver.execute(validRequest)).rejects.toMatchObject({
      response: { code: AI_DRAWING_ERROR_CODES.modelUnavailable },
    });
  });

  it("names provider overload after retries are exhausted", async () => {
    const driver = createDriver(async () => {
      throw new AiDrawingProviderTransientError();
    });

    await expect(driver.execute(validRequest)).rejects.toMatchObject({
      response: { code: AI_DRAWING_ERROR_CODES.providerOverloaded },
    });
  });

  it("names the timeout cause on 504", async () => {
    const driver = createDriver(async () => {
      throw new AiDrawingProviderTimeoutError();
    });

    await expect(driver.execute(validRequest)).rejects.toMatchObject({
      response: { code: AI_DRAWING_ERROR_CODES.timeout },
    });
  });

  it("names a contract violation on 502", async () => {
    const driver = createDriver(async () => ({
      ...validResponse,
      generatedImage: "private-provider-payload",
    }));

    await expect(driver.execute(validRequest)).rejects.toMatchObject({
      response: { code: AI_DRAWING_ERROR_CODES.invalidResponse },
    });
  });

  it("does NOT retry a truncated output (same prompt would be cut again)", async () => {
    let calls = 0;
    const driver = createDriver(async () => {
      calls += 1;
      throw new AiDrawingProviderTruncatedError("MAX_TOKENS", 6871, 16_779);
    });

    await expect(driver.execute(validRequest)).rejects.toMatchObject({
      response: { code: AI_DRAWING_ERROR_CODES.outputTruncated },
    });
    expect(calls).toBe(1);
  });

  it("passes the model reported by the provider through to the client", async () => {
    const driver = createDriver(async () => ({
      ...validResponse,
      model: "gemini-2.5-flash-fallback",
    }));

    await expect(driver.execute(validRequest)).resolves.toEqual({
      ...validResponse,
      model: "gemini-2.5-flash-fallback",
    });
  });
});
