import { describe, expect, it } from "vitest";
import {
  AI_DRAWING_ERROR_CODES,
  AI_DRAWING_RATE_LIMIT_CODE,
  buildAiToolPrompt,
  extractErrorMessage,
  formatRetryWait,
  requestAiDrawingReview,
} from "@/lib/ai-drawing-api";
import type { AuthenticatedFetch } from "@/lib/auth-api";

describe("Ghép prompt mẫu + ý tưởng cho AI (mẫu phải đổi được kết quả)", () => {
  it("mẫu + ý tưởng gộp thành một prompt, mẫu đứng trước", () => {
    expect(
      buildAiToolPrompt("nhân vật vung kiếm", "Bố cục mẫu: Đường chéo — Năng lượng"),
    ).toBe("Bố cục mẫu: Đường chéo — Năng lượng\nnhân vật vung kiếm");
  });

  it("chỉ có mẫu thì prompt là mẫu, chỉ có ý tưởng thì prompt là ý tưởng", () => {
    expect(buildAiToolPrompt("", "Bố cục mẫu: X")).toBe("Bố cục mẫu: X");
    expect(buildAiToolPrompt("  vẽ mèo  ", undefined)).toBe("vẽ mèo");
  });

  it("cả hai rỗng thì không gửi prompt (undefined)", () => {
    expect(buildAiToolPrompt("   ", "  ")).toBeUndefined();
    expect(buildAiToolPrompt("", undefined)).toBeUndefined();
  });
});

describe("Thông báo lỗi AI: trạng thái HTTP + hết lượt có thời gian chờ", () => {
  it("401 cũng báo cần đăng nhập như 403 (trước đây lọt chuỗi tiếng Anh)", () => {
    expect(extractErrorMessage({ message: "Unauthorized" }, 401)).toMatch(
      /đăng nhập/,
    );
    expect(extractErrorMessage({ message: "Forbidden" }, 403)).toMatch(/đăng nhập/);
  });

  it("413 báo ảnh quá lớn kèm giới hạn 4MB", () => {
    expect(extractErrorMessage({}, 413)).toMatch(/quá lớn.*4MB/);
  });

  it("429 kèm mã hết lượt + số giây chờ thì nói rõ chờ bao lâu", () => {
    expect(
      extractErrorMessage(
        { code: AI_DRAWING_RATE_LIMIT_CODE, retryAfterSeconds: 45 },
        429,
      ),
    ).toMatch(/45 giây/);
    expect(
      extractErrorMessage(
        { code: AI_DRAWING_RATE_LIMIT_CODE, retryAfterSeconds: 150 },
        429,
      ),
    ).toMatch(/3 phút/);
  });

  it("429 không có mã vẫn dùng câu chung cũ, mã lỗi cũ vẫn thắng", () => {
    expect(extractErrorMessage({}, 429)).toMatch(/5 lượt\/phút và 30 lượt\/ngày/);
    expect(
      extractErrorMessage({ code: AI_DRAWING_ERROR_CODES.timeout }, 504),
    ).toMatch(/quá lâu/);
  });

  it("formatRetryWait: giây, phút và giá trị lạ", () => {
    expect(formatRetryWait(45)).toBe("45 giây nữa");
    expect(formatRetryWait(150)).toBe("3 phút nữa");
    expect(formatRetryWait(0)).toBe("ít phút nữa");
    expect(formatRetryWait(Number.NaN)).toBe("ít phút nữa");
  });
});

describe("Lỗi mạng và 429 đi qua đúng hàm gọi API (fetch giả)", () => {
  const image = { data: "aGVsbG8=", mimeType: "image/png" as const, width: 256, height: 256 };

  it("mất mạng (TypeError) thành thông báo tiếng Việt hướng dẫn kiểm tra server", async () => {
    const throwingFetch = () => {
      throw new TypeError("Failed to fetch");
    };
    await expect(
      requestAiDrawingReview(
        throwingFetch as unknown as AuthenticatedFetch,
        image,
        undefined,
      ),
    ).rejects.toThrow(/Không kết nối được máy chủ AI.*cổng 8080/);
  });

  it("429 kèm mã hết lượt + retryAfter thành thông báo chờ, không phải câu chung", async () => {
    const rateLimitedFetch = async () =>
      ({
        ok: false,
        status: 429,
        text: async () =>
          JSON.stringify({ code: AI_DRAWING_RATE_LIMIT_CODE, retryAfterSeconds: 45 }),
      }) as unknown as Response;
    await expect(
      requestAiDrawingReview(
        rateLimitedFetch as unknown as AuthenticatedFetch,
        image,
        undefined,
      ),
    ).rejects.toThrow(/45 giây/);
  });
});
