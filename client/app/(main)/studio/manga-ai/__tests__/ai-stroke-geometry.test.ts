import { describe, expect, it, vi } from "vitest";
import type { AiStrokePath } from "@/lib/ai-drawing-api";
import {
  AI_STROKE_GROUP_LABELS,
  aiStrokeAlpha,
  aiStrokeColor,
  aiStrokePixelWidth,
  aiStrokeShape,
  orderStrokesByGroup,
  pointsToSmoothPath,
} from "../lib/aiStrokeGeometry";
import { rasterizeAiStrokes } from "../lib/aiRasterize";

// Node không có `Path2D`; stub để nhánh `path` chạy đúng như trên trình duyệt (5C.2).
class FakePath2D {
  constructor(public readonly d: string) {}
}
(globalThis as unknown as { Path2D: unknown }).Path2D = FakePath2D;

/** Nét hợp lệ tối thiểu, ghi đè phần cần thiết theo từng ca kiểm thử. */
function stroke(overrides: Partial<AiStrokePath> = {}): AiStrokePath {
  return {
    kind: "path",
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.5 },
      { x: 0.9, y: 0.2 },
    ],
    style: "composition",
    group: "subject",
    label: "",
    opacity: 0.5,
    strokeWidth: 0.01,
    ...overrides,
  };
}

describe("pointsToSmoothPath — hình học nét AI (5C.3)", () => {
  it("mảng rỗng → chuỗi rỗng; 1 điểm → M; 2 điểm → đường thẳng", () => {
    expect(pointsToSmoothPath([], 100, 100)).toBe("");
    expect(pointsToSmoothPath([{ x: 0.5, y: 0.5 }], 100, 100)).toBe("M 50 50");
    expect(
      pointsToSmoothPath(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        100,
        100,
      ),
    ).toBe("M 0 0 L 100 100");
  });

  it("≥3 điểm → đường cong cubic Bézier, toạ độ nhân theo pixel canvas", () => {
    const d = pointsToSmoothPath(
      [
        { x: 0, y: 0 },
        { x: 0.5, y: 1 },
        { x: 1, y: 0 },
      ],
      200,
      100,
    );
    expect(d.startsWith("M 0.0 0.0")).toBe(true);
    expect(d).toContain(" C ");
    expect(d.endsWith("200.0 0.0")).toBe(true);
  });
});

describe("aiStrokeShape — quy đổi nét sang pixel", () => {
  it("path: dùng points và cờ closed", () => {
    const shape = aiStrokeShape(stroke({ closed: true }), 200, 100);
    expect(shape).toEqual({
      kind: "path",
      d: expect.stringContaining("M "),
      closed: true,
    });
  });

  it("path thiếu points → null (không vẽ bừa)", () => {
    expect(aiStrokeShape(stroke({ points: undefined }), 200, 100)).toBeNull();
    expect(aiStrokeShape(stroke({ points: [] }), 200, 100)).toBeNull();
  });

  it("line: đổi from/to sang pixel", () => {
    const shape = aiStrokeShape(
      stroke({
        kind: "line",
        points: undefined,
        from: { x: 0.25, y: 0.5 },
        to: { x: 0.75, y: 1 },
      }),
      400,
      200,
    );
    expect(shape).toEqual({ kind: "line", x1: 100, y1: 100, x2: 300, y2: 200 });
  });

  it("ellipse: tâm + bán kính từ region", () => {
    const shape = aiStrokeShape(
      stroke({
        kind: "ellipse",
        points: undefined,
        region: { x: 0.1, y: 0.2, width: 0.2, height: 0.4 },
      }),
      200,
      400,
    );
    expect(shape).toEqual({ kind: "ellipse", cx: 40, cy: 160, rx: 20, ry: 80 });
  });

  it("rectangle: khung chữ nhật bo góc theo bề rộng nét", () => {
    const shape = aiStrokeShape(
      stroke({
        kind: "rectangle",
        points: undefined,
        strokeWidth: 0.02,
        region: { x: 0.5, y: 0.5, width: 0.5, height: 0.25 },
      }),
      200,
      400,
    );
    expect(shape).toEqual({
      kind: "rect",
      x: 100,
      y: 200,
      width: 100,
      height: 100,
      radius: 0.02 * 200 * 1.5,
    });
  });

  it("line/ellipse/rectangle thiếu dữ liệu → null", () => {
    expect(aiStrokeShape(stroke({ kind: "line" }), 10, 10)).toBeNull();
    expect(aiStrokeShape(stroke({ kind: "ellipse" }), 10, 10)).toBeNull();
    expect(aiStrokeShape(stroke({ kind: "rectangle" }), 10, 10)).toBeNull();
  });
});

describe("aiStrokePixelWidth — bề rộng nét tính theo cạnh nhỏ", () => {
  it("nhân với cạnh nhỏ của canvas", () => {
    expect(aiStrokePixelWidth(stroke({ strokeWidth: 0.02 }), 400, 200)).toBe(4);
  });

  it("có sàn 1px để nét không biến mất trên canvas nhỏ", () => {
    expect(aiStrokePixelWidth(stroke({ strokeWidth: 0.001 }), 50, 50)).toBe(1);
  });
});

describe("aiStrokeAlpha — độ trong suốt cuối (5C.3)", () => {
  it("= opacity nét × opacity lớp × độ mờ thanh trượt", () => {
    expect(aiStrokeAlpha(stroke({ opacity: 0.5 }), 0.5, 0.5)).toBeCloseTo(0.125);
  });

  it("KHÔNG khuếch đại: opacity 0.9 giữ 0.9, không bão hoà (hồi quy Phase 5A)", () => {
    expect(aiStrokeAlpha(stroke({ opacity: 0.9 }), 1, 1)).toBeCloseTo(0.9);
    expect(aiStrokeAlpha(stroke({ opacity: 0.9 }), 1, 0.8)).toBeCloseTo(0.72);
  });

  it("kẹp trong 0..1 và chịu được giá trị hỏng", () => {
    expect(aiStrokeAlpha(stroke({ opacity: 2 }), 1, 1)).toBe(1);
    expect(aiStrokeAlpha(stroke({ opacity: -1 }), 1, 1)).toBe(0);
    expect(aiStrokeAlpha(stroke({ opacity: 0.5 }), NaN, 1)).toBe(0);
  });

  it("mỗi nguyên lý mỹ thuật một màu riêng, giá trị lạ có màu dự phòng", () => {
    expect(aiStrokeColor(stroke({ style: "composition" }))).toBe("#a855f7");
    expect(aiStrokeColor(stroke({ style: "lighting" }))).toBe("#f97316");
    expect(aiStrokeColor(stroke({ style: "mystery" as never }))).toBe("#38bdf8");
  });
});

describe("orderStrokesByGroup — thứ tự vẽ theo nhóm nội dung (5C.3)", () => {
  it("nền trước, hiệu ứng sau; giữ thứ tự gốc trong cùng nhóm", () => {
    const strokes = [
      stroke({ group: "effects", label: "e1" }),
      stroke({ group: "background", label: "b1" }),
      stroke({ group: "background", label: "b2" }),
      stroke({ group: "subject", label: "s1" }),
    ];
    expect(
      orderStrokesByGroup(strokes).map((s) => s.label),
    ).toEqual(["b1", "b2", "s1", "e1"]);
  });

  it("không sửa mảng gốc", () => {
    const strokes = [stroke({ group: "guide" }), stroke({ group: "background" })];
    orderStrokesByGroup(strokes);
    expect(strokes[0].group).toBe("guide");
  });

  it("có nhãn tiếng Việt cho cả 6 nhóm", () => {
    expect(Object.keys(AI_STROKE_GROUP_LABELS)).toHaveLength(6);
    expect(AI_STROKE_GROUP_LABELS.background).toBe("Hậu cảnh");
    expect(AI_STROKE_GROUP_LABELS.guide).toBe("Đường dóng");
  });
});

/** Context 2D giả ghi lại lời gọi — đủ để kiểm tra thứ tự và tham số vẽ. */
function recordingCtx() {
  const calls: Array<Record<string, unknown>> = [];
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    lineCap: "",
    lineJoin: "",
  };
  // Ghi lại trạng thái tại thời điểm stroke() được gọi
  (ctx.stroke as unknown as (p?: unknown) => void) = vi.fn(() => {
    calls.push({
      color: ctx.strokeStyle,
      width: ctx.lineWidth,
      alpha: ctx.globalAlpha,
    });
  });
  return { ctx, calls };
}

describe("rasterizeAiStrokes — 'Áp dụng về lớp tôi' (5C.2)", () => {
  it("mỗi nét vẽ 2 lần: viền trắng rồi nét màu", () => {
    const { ctx, calls } = recordingCtx();
    const painted = rasterizeAiStrokes(
      ctx as unknown as CanvasRenderingContext2D,
      [{ strokes: [stroke()], opacity: 1 }],
      400,
      200,
      1,
    );

    expect(painted).toBe(1);
    expect(calls).toHaveLength(2);
    expect(calls[0].color).toBe("#ffffff");
    expect(calls[0].width).toBe(aiStrokePixelWidth(stroke(), 400, 200) + 2);
    expect(calls[1].color).toBe("#a855f7");
    expect(calls[1].width).toBe(aiStrokePixelWidth(stroke(), 400, 200));
    expect(calls[1].alpha).toBeCloseTo(0.5);
  });

  it("bỏ nét thiếu hình học, không tính vào số nét đã vẽ", () => {
    const { ctx, calls } = recordingCtx();
    const painted = rasterizeAiStrokes(
      ctx as unknown as CanvasRenderingContext2D,
      [
        { strokes: [stroke({ points: undefined }), stroke()], opacity: 1 },
        { strokes: [stroke({ kind: "line" })], opacity: 1 },
      ],
      400,
      200,
    );

    expect(painted).toBe(1);
    expect(calls).toHaveLength(2);
  });

  it("độ mờ = nét × lớp × thanh trượt (không khuếch đại)", () => {
    const { ctx, calls } = recordingCtx();
    rasterizeAiStrokes(
      ctx as unknown as CanvasRenderingContext2D,
      [{ strokes: [stroke({ opacity: 0.8 })], opacity: 0.5 }],
      400,
      200,
      0.5,
    );

    expect(calls[1].alpha).toBeCloseTo(0.2);
  });

  it("vẽ theo thứ tự nhóm nội dung", () => {
    const { ctx, calls } = recordingCtx();
    rasterizeAiStrokes(
      ctx as unknown as CanvasRenderingContext2D,
      [
        {
          strokes: [
            stroke({ group: "effects", style: "flow" }),
            stroke({ group: "background", style: "composition" }),
          ],
          opacity: 1,
        },
      ],
      400,
      200,
    );

    // 2 nét × (viền + màu) → màu nét ở các vị trí 1 và 3
    expect(calls[1].color).toBe("#a855f7"); // background (composition) trước
    expect(calls[3].color).toBe("#3b82f6"); // effects (flow) sau
  });

  it("canvas cỡ 0 → không vẽ gì", () => {
    const { ctx, calls } = recordingCtx();
    expect(
      rasterizeAiStrokes(
        ctx as unknown as CanvasRenderingContext2D,
        [{ strokes: [stroke()], opacity: 1 }],
        0,
        0,
      ),
    ).toBe(0);
    expect(calls).toHaveLength(0);
  });
});
