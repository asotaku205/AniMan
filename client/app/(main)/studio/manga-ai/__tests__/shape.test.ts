import { describe, expect, it } from "vitest";
import {
  arrowParts,
  boundsFrom,
  buildShapePath,
  clampSides,
  constrainSquare,
  kindLetsFill,
  LINE_KINDS,
  polygonPoints,
  SHAPE_KINDS,
  shapeLabel,
  snapToAngle,
  starPoints,
  type PathCtx,
} from "../lib/shape";

/** `ctx` giả ghi lại lời gọi vẽ để test hình học mà không cần canvas thật. */
function recorder(): { ctx: PathCtx; calls: string[] } {
  const calls: string[] = [];
  const ctx: PathCtx = {
    beginPath: () => calls.push("begin"),
    moveTo: (x, y) => calls.push(`move ${x},${y}`),
    lineTo: (x, y) => calls.push(`line ${x},${y}`),
    ellipse: (x, y, rx, ry) => calls.push(`ellipse ${x},${y},${rx},${ry}`),
    closePath: () => calls.push("close"),
  };
  return { ctx, calls };
}

describe("khoá hướng kéo (Shift) — BRD T-1 #10", () => {
  it("snapToAngle khoá về bội số 45° và giữ nguyên độ dài", () => {
    const from = { x: 0, y: 0 };
    const snapped = snapToAngle(from, { x: 100, y: 8 });
    expect(snapped.y).toBeCloseTo(0);
    expect(Math.hypot(snapped.x, snapped.y)).toBeCloseTo(Math.hypot(100, 8));

    const diag = snapToAngle(from, { x: 100, y: 90 });
    expect(diag.x).toBeCloseTo(diag.y, 6);

    const up = snapToAngle(from, { x: -4, y: -100 });
    expect(up.x).toBeCloseTo(0);
    expect(up.y).toBeLessThan(0);
  });

  it("cú kéo quá ngắn thì trả nguyên điểm cuối", () => {
    expect(snapToAngle({ x: 0, y: 0 }, { x: 0.1, y: 0.1 })).toEqual({
      x: 0.1,
      y: 0.1,
    });
  });

  it("constrainSquare giữ chiều kéo và lấy cạnh dài hơn", () => {
    expect(constrainSquare({ x: 0, y: 0 }, { x: 100, y: 40 })).toEqual({
      x: 100,
      y: 100,
    });
    expect(constrainSquare({ x: 0, y: 0 }, { x: -30, y: -80 })).toEqual({
      x: -80,
      y: -80,
    });
  });

  it("boundsFrom luôn trả hộp bao dương", () => {
    expect(boundsFrom({ x: 40, y: 60 }, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      w: 30,
      h: 40,
    });
  });
});

describe("đa giác và ngôi sao — BRD T-1 #6", () => {
  it("đa giác có đúng số đỉnh, đỉnh đầu hướng lên, nội tiếp ellipse hộp bao", () => {
    const pts = polygonPoints(50, 50, 40, 20, 4);
    expect(pts).toHaveLength(4);
    expect(pts[0].x).toBeCloseTo(50);
    expect(pts[0].y).toBeCloseTo(30);
    for (const p of pts) {
      const dx = (p.x - 50) / 40;
      const dy = (p.y - 50) / 20;
      expect(dx * dx + dy * dy).toBeCloseTo(1);
    }
  });

  it("kẹp số cạnh về 3…12", () => {
    expect(polygonPoints(0, 0, 10, 10, 1)).toHaveLength(3);
    expect(polygonPoints(0, 0, 10, 10, 99)).toHaveLength(12);
    expect(clampSides(NaN)).toBe(3);
    expect(clampSides(5.4)).toBe(5);
  });

  it("ngôi sao có 2× số đỉnh, đỉnh lẻ (bán kính trong) nằm gần tâm hơn", () => {
    const pts = starPoints(0, 0, 100, 100, 5);
    expect(pts).toHaveLength(10);
    const outer = Math.hypot(pts[0].x, pts[0].y);
    const inner = Math.hypot(pts[1].x, pts[1].y);
    expect(outer).toBeCloseTo(100);
    expect(inner).toBeLessThan(outer);
  });
});

describe("mũi tên — BRD T-1 #10", () => {
  it("đầu mũi nằm ở điểm cuối, thân dừng ngay đáy đầu mũi", () => {
    const { shaft, head, headLength } = arrowParts(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      3,
    );
    expect(head[1]).toEqual({ x: 100, y: 0 });
    expect(shaft[0]).toEqual({ x: 0, y: 0 });
    expect(shaft[1].x).toBeCloseTo(100 - headLength);
    expect(headLength).toBeGreaterThan(0);
    // Hai góc đầu mũi đối xứng qua trục
    expect(head[0].y).toBeCloseTo(-head[2].y);
  });

  it("đầu mũi to theo bề rộng nét nhưng không quá 45% cú kéo", () => {
    const thin = arrowParts({ x: 0, y: 0 }, { x: 400, y: 0 }, 2);
    const thick = arrowParts({ x: 0, y: 0 }, { x: 400, y: 0 }, 20);
    expect(thick.headLength).toBeGreaterThan(thin.headLength);
    const short = arrowParts({ x: 0, y: 0 }, { x: 10, y: 0 }, 20);
    expect(short.headLength).toBeLessThanOrEqual(10 * 0.45 + 0.001);
  });

  it("mũi tên dài 0 không vỡ", () => {
    const p = arrowParts({ x: 5, y: 5 }, { x: 5, y: 5 }, 3);
    expect(p.headLength).toBe(0);
  });
});

describe("buildShapePath", () => {
  it("chữ nhật: 3 đoạn nối tiếp sau moveTo, đóng kín", () => {
    const { ctx, calls } = recorder();
    buildShapePath(ctx, "rect", { x: 10, y: 20 }, { x: 40, y: 60 });
    expect(calls.filter((c) => c.startsWith("line"))).toHaveLength(3);
    expect(calls).toContain("close");
    expect(calls[0]).toBe("begin");
    expect(calls[1]).toBe("move 10,20");
  });

  it("hình tròn: một ellipse giữa hộp bao", () => {
    const { ctx, calls } = recorder();
    buildShapePath(ctx, "circle", { x: 0, y: 0 }, { x: 100, y: 50 });
    expect(calls[1]).toBe("ellipse 50,25,50,25");
    expect(calls).not.toContain("close");
  });

  it("đa giác: n đoạn + đóng kín; sao: 2n đoạn", () => {
    const poly = recorder();
    buildShapePath(poly.ctx, "polygon", { x: 0, y: 0 }, { x: 100, y: 100 }, 6);
    expect(poly.calls.filter((c) => c.startsWith("line"))).toHaveLength(5);

    const star = recorder();
    buildShapePath(star.ctx, "star", { x: 0, y: 0 }, { x: 100, y: 100 }, 5);
    expect(star.calls.filter((c) => c.startsWith("line"))).toHaveLength(9);
  });

  it("đường thẳng: 1 đoạn, không đóng kín", () => {
    const { ctx, calls } = recorder();
    buildShapePath(ctx, "line", { x: 0, y: 0 }, { x: 10, y: 10 });
    expect(calls).toEqual(["begin", "move 0,0", "line 10,10"]);
  });

  it("mũi tên: thân + tam giác đầu mũi kín trong cùng đường bao", () => {
    const { ctx, calls } = recorder();
    buildShapePath(ctx, "arrow", { x: 0, y: 0 }, { x: 100, y: 0 }, 5, 3);
    // moveTo thân, rồi moveTo góc đầu + 2 lineTo + close
    expect(calls.filter((c) => c.startsWith("move"))).toHaveLength(2);
    expect(calls.filter((c) => c.startsWith("line"))).toHaveLength(3);
    expect(calls).toContain("close");
  });
});

describe("danh mục hình", () => {
  it("6 kiểu hình của công cụ Hình, 2 kiểu của công cụ Đường", () => {
    expect(SHAPE_KINDS).toHaveLength(6);
    expect(LINE_KINDS).toEqual(["line", "arrow"]);
    for (const kind of SHAPE_KINDS) expect(shapeLabel(kind).length).toBeGreaterThan(0);
  });

  it("chỉ hình kín mới có nền để đổ đặc", () => {
    expect(kindLetsFill("rect")).toBe(true);
    expect(kindLetsFill("polygon")).toBe(true);
    expect(kindLetsFill("star")).toBe(true);
    expect(kindLetsFill("line")).toBe(false);
    expect(kindLetsFill("arrow")).toBe(false);
  });
});
