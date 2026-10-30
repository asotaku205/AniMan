import "reflect-metadata";
import { describe, expect, it, vi, afterEach } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import sharp from "sharp";
import { JwtAuthGuard } from "../src/auth/guards/jwt-auth.guard.js";
import { AiDrawingRateLimiter } from "../src/ai/ai-drawing-rate-limiter.service.js";
import { UserRole } from "../src/users/user-role.enum.js";
import type { PublicUser } from "../src/users/users.service.js";
import { ReferenceImageController } from "../src/ai/reference-image/reference-image.controller.js";
import {
  CreateReferenceImageJobDto,
  ReferenceImageSceneType,
  ReferenceImageSource,
} from "../src/ai/reference-image/reference-image.dto.js";
import { assembleReferenceImagePrompt } from "../src/ai/reference-image/reference-image-prompt.js";
import {
  createCloudflareReferenceImageProvider,
  processCloudflareImage,
  ReferenceImageAuthError,
  ReferenceImageDisabledError,
  ReferenceImageInvalidError,
  ReferenceImageOverloadedError,
  ReferenceImageProviderError,
  ReferenceImageTimeoutError,
  type CloudflareReferenceImageProvider,
  type ReferenceImageGenerateResult,
} from "../src/ai/reference-image/cloudflare-reference-image.provider.js";
import { ReferenceImageJobsService } from "../src/ai/reference-image/reference-image-jobs.service.js";

async function makePng(
  background: { r: number; g: number; b: number },
  size = 16,
): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 3, background },
  })
    .png()
    .toBuffer();
}

function sketchDto(buffer: Buffer, width = 16, height = 16) {
  return {
    data: buffer.toString("base64"),
    mimeType: "image/png" as const,
    width,
    height,
  };
}

async function fixtureResult(): Promise<ReferenceImageGenerateResult> {
  const png = await makePng({ r: 255, g: 255, b: 255 }, 16);
  return {
    imageBuffer: png,
    mimeType: "image/png",
    width: 16,
    height: 16,
    coloredShare: 0,
    model: "test-model",
    seed: 1,
    elapsedMs: 5,
  };
}

describe("assembleReferenceImagePrompt", () => {
  it("chi prompt: phong cach net ve dung dau, mo ta dung som, khong co huong dan chatbot", () => {
    const prompt = assembleReferenceImagePrompt({
      sceneType: "landscape",
      source: ReferenceImageSource.Prompt,
      userPrompt: "thanh pho ve dem",
    });
    expect(prompt.startsWith("Black-and-white manga line drawing")).toBe(true);
    expect(prompt).toContain("Landscape scene");
    expect(prompt).toContain("Draw this scene: thanh pho ve dem");
    expect(prompt).not.toContain("You are a drawing reference assistant");
    expect(prompt).not.toContain("Return the reference image only");
    expect(prompt).not.toContain("Scene type:");
    expect(prompt).not.toContain("Fix these specific problems");
  });

  it("chi prompt loai auto thi bo han dong loai canh", () => {
    const prompt = assembleReferenceImagePrompt({
      sceneType: "auto",
      source: ReferenceImageSource.Prompt,
      userPrompt: "thanh pho ve dem",
    });
    expect(prompt).not.toContain("auto");
    expect(prompt).toContain("Draw this scene: thanh pho ve dem");
  });

  it("co phac thao: giu bo cuc, them mo ta va danh sach loi can sua", () => {
    const prompt = assembleReferenceImagePrompt({
      sceneType: "action",
      source: ReferenceImageSource.DrawingPrompt,
      userPrompt: "co gai vung kiem",
      fixHints: ["dau qua to -> thu nho dau", "tay ngan -> keo dai tay"],
    });
    expect(prompt).toContain("Black-and-white manga line drawing");
    expect(prompt).toContain("Keep the exact composition");
    expect(prompt).toContain("User description: co gai vung kiem");
    expect(prompt).toContain("- dau qua to -> thu nho dau");
    expect(prompt).toContain("- tay ngan -> keo dai tay");
  });

  it("co phac thao khong co fixHints thi khong them muc sua", () => {
    const prompt = assembleReferenceImagePrompt({
      sceneType: "wide",
      source: ReferenceImageSource.DrawingPrompt,
    });
    expect(prompt).not.toContain("Fix these specific problems");
  });
});

describe("createCloudflareReferenceImageProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(
    handler: (url: string, init: RequestInit) => Promise<unknown>,
  ) {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return handler(url, init);
      },
    );
    return calls;
  }

  function okImageResponse(imageBase64: string) {
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ success: true, result: { image: imageBase64 } }),
    };
  }

  it("klein gui multipart: prompt + width/height + seed + input_image_0, khong guidance", async () => {
    const png = await makePng({ r: 255, g: 255, b: 255 });
    const calls = stubFetch(async () => okImageResponse(png.toString("base64")));
    const provider = createCloudflareReferenceImageProvider({
      enabled: true,
      accountId: "test-account",
      token: "test-token",
    });
    const result = await provider.generate(
      {
        prompt: "test prompt",
        source: ReferenceImageSource.DrawingPrompt,
        sketch: { data: png, mimeType: "image/png" },
        seed: 42,
      },
      new AbortController().signal,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("test-account");
    expect(calls[0].url).toContain("flux-2-klein-4b");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token");
    const form = calls[0].init.body as FormData;
    expect(form.get("prompt")).toBe("test prompt");
    expect(form.get("width")).toBe("1024");
    expect(form.get("height")).toBe("1024");
    expect(form.get("seed")).toBe("42");
    expect(form.get("guidance")).toBeNull();
    const file = form.get("input_image_0") as File;
    expect(file.size).toBe(png.length);
    expect(result.model).toContain("klein-4b");
    expect(result.seed).toBe(42);
  });

  it("chi prompt dung klein multipart khong kem anh: prompt + width/height + seed, khong guidance, khong input_image_0", async () => {
    const png = await makePng({ r: 255, g: 255, b: 255 });
    const calls = stubFetch(async () => okImageResponse(png.toString("base64")));
    const provider = createCloudflareReferenceImageProvider({
      enabled: true,
      accountId: "test-account",
      token: "test-token",
    });
    const result = await provider.generate(
      { prompt: "test prompt", source: ReferenceImageSource.Prompt, seed: 7 },
      new AbortController().signal,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("flux-2-klein-4b");
    expect(calls[0].url).not.toContain("schnell");
    const form = calls[0].init.body as FormData;
    expect(form.get("prompt")).toBe("test prompt");
    expect(form.get("width")).toBe("1024");
    expect(form.get("height")).toBe("1024");
    expect(form.get("seed")).toBe("7");
    expect(form.get("guidance")).toBeNull();
    expect(form.get("input_image_0")).toBeNull();
    expect(result.model).toContain("klein-4b");
    expect(result.seed).toBe(7);
  });

  it("tat thi khong goi fetch", async () => {
    const calls = stubFetch(async () => {
      throw new Error("fetch must not be called");
    });
    const provider = createCloudflareReferenceImageProvider({
      enabled: false,
      accountId: "",
      token: "",
    });
    await expect(
      provider.generate(
        { prompt: "x", source: ReferenceImageSource.Prompt, seed: 1 },
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(ReferenceImageDisabledError);
    expect(calls).toHaveLength(0);
  });

  it("map loi 401/429/400/thieu anh dung ma", async () => {
    const provider = createCloudflareReferenceImageProvider({
      enabled: true,
      accountId: "a",
      token: "t",
    });
    const run = async (status: number) => {
      stubFetch(async () => ({
        ok: false,
        status,
        text: async () =>
          JSON.stringify({ errors: [{ message: "boom", code: 1 }] }),
      }));
      await provider.generate(
        { prompt: "x", source: ReferenceImageSource.Prompt, seed: 1 },
        new AbortController().signal,
      );
    };
    await expect(run(401)).rejects.toBeInstanceOf(ReferenceImageAuthError);
    await expect(run(429)).rejects.toBeInstanceOf(ReferenceImageOverloadedError);
    await expect(run(400)).rejects.toBeInstanceOf(ReferenceImageProviderError);

    stubFetch(async () =>
      okImageResponse(Buffer.from("not an image").toString("base64")),
    );
    await expect(
      provider.generate(
        { prompt: "x", source: ReferenceImageSource.Prompt, seed: 1 },
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(ReferenceImageInvalidError);
  });

  it("tin hieu huy bien thanh loi timeout", async () => {
    stubFetch(async (_url, init) => {
      if (init.signal?.aborted) {
        throw new DOMException("aborted", "AbortError");
      }
      throw new Error("unexpected fetch");
    });
    const provider = createCloudflareReferenceImageProvider({
      enabled: true,
      accountId: "a",
      token: "t",
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      provider.generate(
        { prompt: "x", source: ReferenceImageSource.Prompt, seed: 1 },
        controller.signal,
      ),
    ).rejects.toBeInstanceOf(ReferenceImageTimeoutError);
  });
});

describe("processCloudflareImage", () => {
  it("anh trang den tra ve dung anh goc ma lai PNG, khong ep xam", async () => {
    const white = await makePng({ r: 255, g: 255, b: 255 }, 32);
    const processed = await processCloudflareImage(white);
    expect(processed.coloredShare).toBe(0);
    expect(processed.width).toBe(32);
    expect(processed.height).toBe(32);
    const stats = await sharp(processed.imageBuffer).stats();
    const means = stats.channels.map((channel) => channel.mean);
    expect(Math.max(...means) - Math.min(...means)).toBeLessThan(1);
  });

  it("anh do (co mau) bi loai thay vi ep xam thanh xam", async () => {
    const red = await makePng({ r: 255, g: 0, b: 0 }, 32);
    await expect(processCloudflareImage(red)).rejects.toBeInstanceOf(
      ReferenceImageInvalidError,
    );
  });

  it("buffer rong hoac khong phai anh thi loi", async () => {
    await expect(processCloudflareImage(Buffer.alloc(0))).rejects.toBeInstanceOf(
      ReferenceImageInvalidError,
    );
    await expect(
      processCloudflareImage(Buffer.from("hello")),
    ).rejects.toBeInstanceOf(ReferenceImageInvalidError);
  });
});

describe("ReferenceImageJobsService", () => {
  function fakeProvider(
    behavior: (
      signal: AbortSignal,
    ) => Promise<ReferenceImageGenerateResult>,
  ): CloudflareReferenceImageProvider {
    return {
      isEnabled: () => true,
      generate: async (input, signal) => behavior(signal),
    };
  }

  function validDto(
    overrides: Partial<CreateReferenceImageJobDto> = {},
  ): CreateReferenceImageJobDto {
    const dto = new CreateReferenceImageJobDto();
    dto.source = ReferenceImageSource.Prompt;
    dto.sceneType = ReferenceImageSceneType.Action;
    dto.prompt = "co gai vung kiem";
    Object.assign(dto, overrides);
    return dto;
  }

  async function waitForStatus(
    service: ReferenceImageJobsService,
    userId: string,
    id: string,
    status: string,
  ) {
    for (let i = 0; i < 100; i += 1) {
      const view = service.getJob(userId, id);
      if (view.status === status) return view;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`job ${id} did not reach ${status}`);
  }

  it("tu choi prompt trong khi nguon la chi prompt, va thieu anh khi nguon co ve", async () => {
    const service = new ReferenceImageJobsService(fakeProvider(fixtureResult));
    await expect(
      service.createJob("u1", validDto({ prompt: undefined })),
    ).rejects.toThrow();
    await expect(
      service.createJob(
        "u1",
        validDto({ source: ReferenceImageSource.DrawingPrompt, prompt: undefined }),
      ),
    ).rejects.toThrow();
  });

  it("tu choi phac thao khai kich thuoc sai voi anh that", async () => {
    const png = await makePng({ r: 0, g: 0, b: 0 }, 16);
    const service = new ReferenceImageJobsService(fakeProvider(fixtureResult));
    await expect(
      service.createJob(
        "u1",
        validDto({
          source: ReferenceImageSource.DrawingPrompt,
          prompt: undefined,
          image: sketchDto(png, 100, 100),
        }),
      ),
    ).rejects.toThrow();
  });

  it("job chay xong luu data URL anh, chi chu so huu moi doc duoc", async () => {
    const service = new ReferenceImageJobsService(fakeProvider(fixtureResult));
    const png = await makePng({ r: 0, g: 0, b: 0 }, 16);
    const created = await service.createJob(
      "u1",
      validDto({
        source: ReferenceImageSource.DrawingPrompt,
        prompt: undefined,
        image: sketchDto(png),
      }),
    );
    expect(["queued", "running"]).toContain(created.status);
    expect(created.model).toContain("klein-4b");
    const done = await waitForStatus(service, "u1", created.id, "succeeded");
    expect(done.imageDataUrl?.startsWith("data:image/png;base64,")).toBe(true);
    expect(() => service.getJob("u2", created.id)).toThrow();
  });

  it("job chi prompt dung model klein va prompt net ve co mo ta som", async () => {
    let seenPrompt = "";
    const capturing: CloudflareReferenceImageProvider = {
      isEnabled: () => true,
      generate: async (input) => {
        seenPrompt = input.prompt;
        return fixtureResult();
      },
    };
    const service = new ReferenceImageJobsService(capturing);
    const created = await service.createJob("u1", validDto());
    expect(created.model).toContain("klein-4b");
    await waitForStatus(service, "u1", created.id, "succeeded");
    expect(seenPrompt).toContain("Draw this scene: co gai vung kiem");
    expect(seenPrompt).not.toContain("You are a drawing reference assistant");
  });

  it("phac thao trang + prompt thi doi sang chi prompt, khong gui anh trang", async () => {
    let seenInput: { prompt: string; source: string; sketch?: unknown } | null =
      null;
    const capturing: CloudflareReferenceImageProvider = {
      isEnabled: () => true,
      generate: async (input) => {
        seenInput = {
          prompt: input.prompt,
          source: input.source,
          sketch: input.sketch,
        };
        return fixtureResult();
      },
    };
    const service = new ReferenceImageJobsService(capturing);
    const white = await makePng({ r: 255, g: 255, b: 255 }, 16);
    const created = await service.createJob(
      "u1",
      validDto({
        source: ReferenceImageSource.DrawingPrompt,
        image: sketchDto(white),
      }),
    );
    await waitForStatus(service, "u1", created.id, "succeeded");
    expect(seenInput?.source).toBe(ReferenceImageSource.Prompt);
    expect(seenInput?.sketch).toBeUndefined();
    expect(seenInput?.prompt).toContain("Draw this scene: co gai vung kiem");
    expect(seenInput?.prompt).not.toContain("Keep the exact composition");
  });

  it("phac thao trang + khong prompt thi tu choi ngay voi ma blank_sketch", async () => {
    const service = new ReferenceImageJobsService(fakeProvider(fixtureResult));
    const white = await makePng({ r: 255, g: 255, b: 255 }, 16);
    let caught: unknown;
    try {
      await service.createJob(
        "u1",
        validDto({
          source: ReferenceImageSource.DrawingPrompt,
          prompt: undefined,
          image: sketchDto(white),
        }),
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    const response = (caught as { getResponse?: () => unknown }).getResponse?.();
    expect(response).toMatchObject({ code: "reference_image_blank_sketch" });
  });

  it("phac thao chi co mot diem den van la phac thao, khong doi sang chi prompt", async () => {
    let seenInput: { source: string; sketch?: unknown } | null = null;
    const capturing: CloudflareReferenceImageProvider = {
      isEnabled: () => true,
      generate: async (input) => {
        seenInput = { source: input.source, sketch: input.sketch };
        return fixtureResult();
      },
    };
    const service = new ReferenceImageJobsService(capturing);
    const dot = await sharp({
      create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    const mostlyWhite = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([{ input: dot, left: 0, top: 0 }])
      .png()
      .toBuffer();
    const created = await service.createJob(
      "u1",
      validDto({
        source: ReferenceImageSource.DrawingPrompt,
        prompt: undefined,
        image: sketchDto(mostlyWhite),
      }),
    );
    await waitForStatus(service, "u1", created.id, "succeeded");
    expect(seenInput?.source).toBe(ReferenceImageSource.DrawingPrompt);
    expect(seenInput?.sketch).toBeDefined();
  });

  it("huy job dang chay thi giu trang thai cancelled", async () => {
    const provider = fakeProvider(
      (signal) =>
        new Promise<ReferenceImageGenerateResult>((_resolve, reject) => {
          signal.addEventListener("abort", () =>
            reject(new ReferenceImageTimeoutError()),
          );
        }),
    );
    const service = new ReferenceImageJobsService(provider);
    const created = await service.createJob("u1", validDto());
    await new Promise((resolve) => setTimeout(resolve, 20));
    const cancelled = service.cancelJob("u1", created.id);
    expect(cancelled.status).toBe("cancelled");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(service.getJob("u1", created.id).status).toBe("cancelled");
  });

  it("loi timeout cua provider thanh trang thai timeout, khong phai failed", async () => {
    const provider = fakeProvider(async () => {
      throw new ReferenceImageTimeoutError();
    });
    const service = new ReferenceImageJobsService(provider);
    const created = await service.createJob("u1", validDto());
    const view = await waitForStatus(service, "u1", created.id, "timeout");
    expect(view.errorCode).toBe("reference_image_timeout");
  });

  it("provider tat thi tao job bi 503", async () => {
    const disabled: CloudflareReferenceImageProvider = {
      isEnabled: () => false,
      generate: async () => {
        throw new ReferenceImageDisabledError();
      },
    };
    const service = new ReferenceImageJobsService(disabled);
    await expect(service.createJob("u1", validDto())).rejects.toMatchObject({
      status: 503,
    });
  });

  it("DTO tu choi enum sai, tu choi nguon drawing da bo, va chap nhan DTO hop le", async () => {
    const bad = plainToInstance(CreateReferenceImageJobDto, {
      source: "nope",
      sceneType: "action",
      prompt: "abc",
    });
    expect((await validate(bad)).length).toBeGreaterThan(0);
    const removed = plainToInstance(CreateReferenceImageJobDto, {
      source: "drawing",
      sceneType: "action",
      prompt: "abc",
    });
    expect((await validate(removed)).length).toBeGreaterThan(0);
    const good = plainToInstance(
      CreateReferenceImageJobDto,
      validDto(),
    );
    expect(await validate(good)).toHaveLength(0);
  });
});

describe("ReferenceImageController", () => {
  const user: PublicUser = {
    id: "user-ctrl",
    username: "reader",
    displayName: "Reader",
    role: UserRole.User,
    termsAcceptedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("yeu cau JWT va tra trang thai enabled", () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      ReferenceImageController,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    const provider: CloudflareReferenceImageProvider = {
      isEnabled: () => true,
      generate: async () => fixtureResult(),
    };
    const controller = new ReferenceImageController(
      new AiDrawingRateLimiter(),
      new ReferenceImageJobsService(provider),
    );
    expect(controller.getStatus().enabled).toBe(true);
  });

  it("tao job qua controller ton mot luot quota", async () => {
    const limiter = new AiDrawingRateLimiter();
    const provider: CloudflareReferenceImageProvider = {
      isEnabled: () => true,
      generate: async () => fixtureResult(),
    };
    const controller = new ReferenceImageController(
      limiter,
      new ReferenceImageJobsService(provider),
    );
    const dto = new CreateReferenceImageJobDto();
    dto.source = ReferenceImageSource.Prompt;
    dto.sceneType = ReferenceImageSceneType.Action;
    dto.prompt = "co gai vung kiem";
    const created = await controller.createJob({ user } as never, dto);
    expect(["queued", "running"]).toContain(created.status);
    expect(limiter.peekQuota(user.id).dayUsed).toBe(1);
  });
});
