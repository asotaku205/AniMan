import { describe, expect, it } from "vitest";
import {
  AI_DRAWING_ERROR_CODES,
  AI_DRAWING_RATE_LIMIT_CODE,
  buildAiToolPrompt,
  extractErrorMessage,
  formatRetryWait,
  requestAiGhostStrokes,
  type AiStrokePath,
} from "@/lib/ai-drawing-api";
import type { AuthenticatedFetch } from "@/lib/auth-api";
import {
  isDrawableAiStroke,
  orderStrokesWithIndex,
  sanitizeAiStrokes,
} from "../lib/aiStrokeGeometry";

const baseStroke: Omit<AiStrokePath, "kind"> = {
  style: "composition",
  group: "subject",
  label: "nét mẫu",
  opacity: 0.5,
  strokeWidth: 0.01,
};

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

describe("Lọc nét AI không vẽ được phía client", () => {
  const pathStroke: AiStrokePath = {
    ...baseStroke,
    kind: "path",
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.5 },
    ],
  };
  const lineStroke: AiStrokePath = {
    ...baseStroke,
    kind: "line",
    from: { x: 0, y: 0 },
    to: { x: 1, y: 1 },
  };
  const ellipseStroke: AiStrokePath = {
    ...baseStroke,
    kind: "ellipse",
    region: { x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
  };

  it("giữ nét đủ hình học ở mọi kind", () => {
    expect(isDrawableAiStroke(pathStroke)).toBe(true);
    expect(isDrawableAiStroke(lineStroke)).toBe(true);
    expect(isDrawableAiStroke(ellipseStroke)).toBe(true);
    expect(
      sanitizeAiStrokes([pathStroke, lineStroke, ellipseStroke]),
    ).toHaveLength(3);
  });

  it("bỏ nét có tọa độ NaN (tránh chuỗi path 'NaN' vẽ rác)", () => {
    const nanStroke: AiStrokePath = {
      ...baseStroke,
      kind: "path",
      points: [
        { x: 0.1, y: 0.1 },
        { x: Number.NaN, y: 0.5 },
      ],
    };
    expect(isDrawableAiStroke(nanStroke)).toBe(false);
    expect(sanitizeAiStrokes([pathStroke, nanStroke])).toEqual([pathStroke]);
  });

  it("bỏ nét thiếu hình học, kind lạ, vùng rỗng và strokeWidth NaN", () => {
    const noPoints: AiStrokePath = { ...baseStroke, kind: "path", points: [] };
    const weirdKind = { ...baseStroke, kind: "spline" } as unknown as AiStrokePath;
    const emptyRegion: AiStrokePath = {
      ...baseStroke,
      kind: "rectangle",
      region: { x: 0.1, y: 0.1, width: 0, height: 0.2 },
    };
    const nanWidth: AiStrokePath = { ...pathStroke, strokeWidth: Number.NaN };
    expect(sanitizeAiStrokes([noPoints, weirdKind, emptyRegion, nanWidth])).toEqual([]);
    expect(sanitizeAiStrokes([pathStroke, noPoints])).toEqual([pathStroke]);
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
      requestAiGhostStrokes(
        throwingFetch as unknown as AuthenticatedFetch,
        image,
        "stroke_guidance",
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
      requestAiGhostStrokes(
        rateLimitedFetch as unknown as AuthenticatedFetch,
        image,
        "stroke_guidance",
      ),
    ).rejects.toThrow(/45 giây/);
  });
});

describe("Thứ tự nét giữ chỉ số gốc để chọn từng nét", () => {
  it("sắp theo nhóm nhưng key chọn nét vẫn là chỉ số gốc", () => {
    const strokes: AiStrokePath[] = [
      { ...baseStroke, kind: "line", group: "effects", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
      { ...baseStroke, kind: "line", group: "background", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
      { ...baseStroke, kind: "line", group: "subject", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
    ];
    const ordered = orderStrokesWithIndex(strokes);
    expect(ordered.map((item) => item.index)).toEqual([1, 2, 0]);
    expect(ordered.map((item) => item.stroke.group)).toEqual([
      "background",
      "subject",
      "effects",
    ]);
  });
});
