// @vitest-environment node
/**
 * Job ảnh mẫu tham khảo phía client: tạo job, hỏi lại trạng thái, hủy,
 * cỡ phác thảo gửi đi và văn bản đồng ý riêng cho ảnh mẫu.
 */
import { describe, expect, it } from "vitest";
import type { AuthenticatedFetch } from "@/lib/auth-api";
import {
  cancelReferenceImageJob,
  canvasIsBlank,
  createReferenceImageJob,
  getReferenceImageErrorMessage,
  pollReferenceImageJob,
  referenceSketchTargetSize,
  REFERENCE_IMAGE_ERROR_MESSAGES,
  type ReferenceImageJob,
} from "@/lib/reference-image-api";
import { createReferenceImageId } from "../lib/referenceImages";
import {
  REFERENCE_IMAGE_LINE_STYLE,
  REFERENCE_IMAGE_SYSTEM_PROMPT_ENABLED,
} from "../lib/referenceImagePrompt";
import {
  REFERENCE_IMAGE_CONSENT_NOTICE,
  REFERENCE_IMAGE_CONSENT_VERSION,
  fetchReferenceImageConsent,
} from "../lib/referenceImageConsent";

function job(overrides: Partial<ReferenceImageJob> = {}): ReferenceImageJob {
  return {
    id: "job-1",
    status: "queued",
    model: "test-model",
    seed: 1,
    createdAt: 1,
    startedAt: null,
    finishedAt: null,
    elapsedMs: null,
    imageDataUrl: null,
    note: "note",
    coloredShare: null,
    errorCode: null,
    errorMessage: null,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("referenceSketchTargetSize", () => {
  it("thu nho canh dai nhat ve 500 px, giu ti le", () => {
    expect(referenceSketchTargetSize(2000, 1000)).toEqual({
      width: 500,
      height: 250,
    });
    expect(referenceSketchTargetSize(800, 800)).toEqual({
      width: 500,
      height: 500,
    });
  });

  it("khong phong to anh nho hon gioi han", () => {
    expect(referenceSketchTargetSize(400, 300)).toEqual({
      width: 400,
      height: 300,
    });
  });

  it("kich thuoc khong hop le thi ve 1x1", () => {
    expect(referenceSketchTargetSize(0, 0)).toEqual({ width: 1, height: 1 });
  });
});

describe("createReferenceImageJob", () => {
  it("gui POST dung truong va tra job", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fakeFetch: AuthenticatedFetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse(job({ status: "queued" }), 202);
    };
    const created = await createReferenceImageJob(fakeFetch, {
      source: "drawing-prompt",
      sceneType: "action",
      prompt: "co gai vung kiem",
      fixHints: ["dau to -> thu nho"],
    });
    expect(created.status).toBe("queued");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/ai/reference-image/jobs");
    expect(calls[0].init?.method).toBe("POST");
    const body = JSON.parse(calls[0].init?.body as string) as Record<
      string,
      unknown
    >;
    expect(body.source).toBe("drawing-prompt");
    expect(body.sceneType).toBe("action");
    expect(body.fixHints).toEqual(["dau to -> thu nho"]);
  });

  it("loi 503 ma disabled thi dich sang tieng Viet", async () => {
    const fakeFetch: AuthenticatedFetch = async () =>
      jsonResponse(
        { statusCode: 503, code: "reference_image_disabled", message: "x" },
        503,
      );
    await expect(
      createReferenceImageJob(fakeFetch, {
        source: "prompt",
        sceneType: "action",
        prompt: "co gai vung kiem",
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining("chưa được bật") });
  });
});

describe("pollReferenceImageJob", () => {
  it("hoi lai cho toi trang thai cuoi va goi onUpdate moi lan", async () => {
    const states = [
      job({ status: "running", startedAt: 100 }),
      job({ status: "running", startedAt: 100 }),
      job({ status: "succeeded", imageDataUrl: "data:image/png;base64,abc" }),
    ];
    let index = 0;
    const fakeFetch: AuthenticatedFetch = async () =>
      jsonResponse(states[Math.min(index++, states.length - 1)]);
    const seen: string[] = [];
    const finalJob = await pollReferenceImageJob(fakeFetch, "job-1", {
      intervalMs: 1,
      onUpdate: (current) => seen.push(current.status),
    });
    expect(finalJob.status).toBe("succeeded");
    expect(seen).toEqual(["running", "running", "succeeded"]);
  });

  it("huy bang signal thi nem loi AbortError", async () => {
    const fakeFetch: AuthenticatedFetch = async () =>
      jsonResponse(job({ status: "running" }));
    const controller = new AbortController();
    const promise = pollReferenceImageJob(fakeFetch, "job-1", {
      intervalMs: 5,
      signal: controller.signal,
    });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("trang thai timeout la trang thai cuoi, khong hoi tiep", async () => {
    let calls = 0;
    const fakeFetch: AuthenticatedFetch = async () => {
      calls += 1;
      return jsonResponse(
        job({ status: "timeout", errorCode: "reference_image_timeout" }),
      );
    };
    const finalJob = await pollReferenceImageJob(fakeFetch, "job-1", {
      intervalMs: 1,
    });
    expect(finalJob.status).toBe("timeout");
    expect(calls).toBe(1);
  });
});

describe("cancelReferenceImageJob", () => {
  it("gui DELETE va tra job da huy", async () => {
    let method = "";
    const fakeFetch: AuthenticatedFetch = async (_input, init) => {
      method = init?.method ?? "";
      return jsonResponse(job({ status: "cancelled" }));
    };
    const cancelled = await cancelReferenceImageJob(fakeFetch, "job-1");
    expect(method).toBe("DELETE");
    expect(cancelled.status).toBe("cancelled");
  });
});

describe("thong diep loi va dong y", () => {
  it("ma loi khong biet thi dung fallback", () => {
    expect(getReferenceImageErrorMessage("nope", "Du phong")).toBe("Du phong");
    expect(getReferenceImageErrorMessage("reference_image_timeout", "Du phong")).toContain(
      "Hết thời gian chờ",
    );
  });

  it("id anh mau khac nhau va khong rong", () => {
    const first = createReferenceImageId();
    const second = createReferenceImageId();
    expect(first.length).toBeGreaterThan(0);
    expect(first).not.toBe(second);
  });

  it("phong cách nét vẽ đã bật và văn bản đồng ý gồm Cloudflare klein", () => {
    expect(REFERENCE_IMAGE_SYSTEM_PROMPT_ENABLED).toBe(true);
    expect(REFERENCE_IMAGE_LINE_STYLE.startsWith(
      "Black-and-white manga line drawing",
    )).toBe(true);
    expect(REFERENCE_IMAGE_CONSENT_VERSION).toBe("ai-providers-v4");
    expect(REFERENCE_IMAGE_CONSENT_NOTICE).toContain("Cloudflare");
    expect(REFERENCE_IMAGE_CONSENT_NOTICE).toContain("FLUX.2 klein 4B");
    expect(REFERENCE_IMAGE_CONSENT_NOTICE).not.toContain("schnell");
  });

  it("fetch dong y loi thi dung ban sao kem theo", async () => {
    const fakeFetch: AuthenticatedFetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    const consent = await fetchReferenceImageConsent(fakeFetch);
    expect(consent.version).toBe(REFERENCE_IMAGE_CONSENT_VERSION);
    expect(consent.notice).toBe(REFERENCE_IMAGE_CONSENT_NOTICE);
  });

  it("fetch dong y thanh cong thi dung van ban server", async () => {
    const fakeFetch: AuthenticatedFetch = async () =>
      jsonResponse({
        currentNoticeVersion: "ai-providers-v9",
        notice: "Van ban moi tu server",
      });
    const consent = await fetchReferenceImageConsent(fakeFetch);
    expect(consent.version).toBe("ai-providers-v9");
    expect(consent.notice).toBe("Van ban moi tu server");
  });

  it("ma loi phac thao trang co cau tieng Viet ro rang", () => {
    expect(REFERENCE_IMAGE_ERROR_MESSAGES.reference_image_blank_sketch).toContain(
      "còn trắng",
    );
    expect(
      getReferenceImageErrorMessage("reference_image_blank_sketch", "Khac"),
    ).toContain("còn trắng");
  });
});

describe("canvasIsBlank: khung trang de sinh theo prompt thay vi gui anh trang", () => {
  function fakeCanvas(pixels: number[]) {
    return {
      width: 2,
      height: 2,
      getContext: () => ({
        getImageData: () => ({ data: new Uint8ClampedArray(pixels) }),
      }),
    } as unknown as HTMLCanvasElement;
  }

  it("trong suot hoan toan thi trang", () => {
    expect(canvasIsBlank(fakeCanvas([0, 0, 0, 0, 0, 0, 0, 0]))).toBe(true);
  });

  it("trang duc hoan toan thi trang", () => {
    expect(
      canvasIsBlank(
        fakeCanvas([255, 255, 255, 255, 255, 255, 255, 255]),
      ),
    ).toBe(true);
  });

  it("mot diem den thi khong trang", () => {
    expect(
      canvasIsBlank(
        fakeCanvas([0, 0, 0, 255, 255, 255, 255, 255]),
      ),
    ).toBe(false);
  });

  it("doc pixel that bai thi coi nhu co ve, khong chan nham", () => {
    const canvas = {
      width: 2,
      height: 2,
      getContext: () => {
        throw new Error("tainted");
      },
    } as unknown as HTMLCanvasElement;
    expect(canvasIsBlank(canvas)).toBe(false);
    expect(canvasIsBlank(null)).toBe(true);
  });
});
