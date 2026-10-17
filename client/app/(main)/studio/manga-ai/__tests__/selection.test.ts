import { describe, expect, it } from "vitest";
import {
  appendLassoPoint,
  IDENTITY_TRANSFORM,
  invertSelection,
  isIdentityTransform,
  isSelectionUsable,
  lassoSelection,
  MAX_TRANSFORM_SCALE,
  MIN_TRANSFORM_SCALE,
  pointInSelection,
  polygonArea,
  polygonBounds,
  rectSelection,
  scaleTransform,
  selectionBounds,
  selectionCenter,
  translateSelection,
  transformPoint,
  transformSelection,
  type Selection,
} from "../lib/selection";

const square = (x: number, y: number, size = 100): Selection => ({
  points: [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ],
  inverted: false,
});

describe("rectSelection (kéo chọn chữ nhật, BR-T05)", () => {
  it("chuẩn hoá hai góc bất kỳ — kéo ngược hướng vẫn ra cùng khung", () => {
    const forward = rectSelection({ x: 10, y: 20 }, { x: 60, y: 90 });
    const backward = rectSelection({ x: 60, y: 90 }, { x: 10, y: 20 });
    expect(forward).toEqual(backward);
    expect(polygonBounds(forward.points)).toEqual({
      x: 10,
      y: 20,
      w: 50,
      h: 70,
    });
  });

  it("là 4 điểm, không đảo", () => {
    const sel = rectSelection({ x: 0, y: 0 }, { x: 4, y: 4 });
    expect(sel.points).toHaveLength(4);
    expect(sel.inverted).toBe(false);
  });

  it("kéo chỉ theo một trục ra vùng chọn dẹt (để chỗ gọi tự bỏ chọn)", () => {
    const sel = rectSelection({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(polygonArea(sel.points)).toBe(0);
  });
});

describe("lassoSelection (vùng chọn tự do, BR-T05)", () => {
  it("bỏ điểm dính nhau dưới ngưỡng bước", () => {
    const sel = lassoSelection([
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
    expect(sel.points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
  });

  it("không sửa điểm đã đủ xa", () => {
    const points = [
      { x: 3, y: 4 },
      { x: 103, y: 4 },
      { x: 103, y: 104 },
    ];
    expect(lassoSelection(points).points).toEqual(points);
  });

  it("appendLassoPoint: bỏ điểm quá gần, giữ nguyên mảng cũ nếu không thêm", () => {
    const first = appendLassoPoint([], { x: 0, y: 0 });
    expect(first).toEqual([{ x: 0, y: 0 }]);
    const same = appendLassoPoint(first, { x: 1, y: 1 });
    expect(same).toBe(first);
    const grown = appendLassoPoint(first, { x: 5, y: 0 });
    expect(grown).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ]);
  });
});

describe("isSelectionUsable (AC-T3.5)", () => {
  it("null / quá ít điểm / diện tích quá nhỏ → không dùng được", () => {
    expect(isSelectionUsable(null)).toBe(false);
    expect(isSelectionUsable({ points: [], inverted: false })).toBe(false);
    expect(
      isSelectionUsable({ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }], inverted: false }),
    ).toBe(false);
    expect(isSelectionUsable(rectSelection({ x: 0, y: 0 }, { x: 100, y: 0 }))).toBe(
      false,
    );
  });

  it("hình chữ nhật đủ lớn → dùng được", () => {
    expect(isSelectionUsable(rectSelection({ x: 0, y: 0 }, { x: 20, y: 20 }))).toBe(
      true,
    );
  });

  it("vùng đảo luôn dùng được (chỉ cần đa giác hợp lệ)", () => {
    expect(isSelectionUsable(invertSelection(square(0, 0)))).toBe(true);
  });
});

describe("pointInSelection (luật even-odd + cờ đảo)", () => {
  it("phân biệt trong/ngoài đa giác", () => {
    const sel = square(0, 0);
    expect(pointInSelection(sel, { x: 50, y: 50 })).toBe(true);
    expect(pointInSelection(sel, { x: 150, y: 50 })).toBe(false);
    expect(pointInSelection(sel, { x: -1, y: -1 })).toBe(false);
  });

  it("đảo vùng chọn thì kết quả lật ngược", () => {
    const inverted = invertSelection(square(0, 0));
    expect(pointInSelection(inverted, { x: 50, y: 50 })).toBe(false);
    expect(pointInSelection(inverted, { x: 150, y: 50 })).toBe(true);
  });

  it("vùng bao của vùng đảo là cả khung", () => {
    const inverted = invertSelection(square(0, 0));
    expect(selectionBounds(inverted)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(selectionBounds(inverted, { w: 1200, h: 1600 })).toEqual({
      x: 0,
      y: 0,
      w: 1200,
      h: 1600,
    });
  });
});

describe("invertSelection / translateSelection", () => {
  it("đảo hai lần về như cũ", () => {
    const sel = square(10, 10);
    expect(invertSelection(invertSelection(sel))).toEqual(sel);
  });

  it("đảo không làm mất trọng tâm", () => {
    const sel = square(10, 10, 40);
    expect(selectionCenter(invertSelection(sel))).toEqual(selectionCenter(sel));
  });

  it("dời cả đa giác, giữ cờ đảo", () => {
    const moved = translateSelection(invertSelection(square(0, 0, 10)), 5, -5);
    expect(moved.inverted).toBe(true);
    expect(polygonBounds(moved.points)).toEqual({ x: 5, y: -5, w: 10, h: 10 });
  });
});

describe("transformPoint (AC-T3.1)", () => {
  const center = { x: 0, y: 0 };

  it("xoay 90° quanh tâm: (10,0) → (0,10)", () => {
    const p = transformPoint(
      { x: 10, y: 0 },
      { ...IDENTITY_TRANSFORM, rotate: 90 },
      center,
    );
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10);
  });

  it("lật ngang rồi lật dọc = xoay 180°", () => {
    const flipped = transformPoint(
      { x: 10, y: 4 },
      { ...IDENTITY_TRANSFORM, flipH: true, flipV: true },
      center,
    );
    expect(flipped.x).toBeCloseTo(-10);
    expect(flipped.y).toBeCloseTo(-4);
  });

  it("phóng to có tỉ lệ quanh tâm", () => {
    const p = transformPoint(
      { x: 10, y: 20 },
      { ...IDENTITY_TRANSFORM, scale: 2 },
      { x: 10, y: 10 },
    );
    expect(p).toEqual({ x: 10, y: 30 });
  });

  it("dời cộng thêm sau khi xoay/phóng", () => {
    const p = transformPoint(
      { x: 0, y: 0 },
      { ...IDENTITY_TRANSFORM, scale: 2, dx: 5, dy: -3 },
      center,
    );
    expect(p).toEqual({ x: 5, y: -3 });
  });
});

describe("transformSelection", () => {
  it("xoay 90° quanh trọng tâm vùng chọn giữ nguyên kích thước bao", () => {
    const base: Selection = {
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 20 },
        { x: 0, y: 20 },
      ],
      inverted: false,
    };
    const rotated = transformSelection(base, {
      ...IDENTITY_TRANSFORM,
      rotate: 90,
    });
    const b = polygonBounds(rotated.points);
    expect(b.w).toBeCloseTo(20);
    expect(b.h).toBeCloseTo(40);
    expect(b.x).toBeCloseTo(10);
    expect(b.y).toBeCloseTo(-10);
  });

  it("neo ở trọng tâm gốc: hai lần xoay 15° không trôi", () => {
    const base = square(0, 0, 100);
    const center = selectionCenter(base);
    const t = { ...IDENTITY_TRANSFORM, rotate: 15 };
    const once = selectionCenter(transformSelection(base, t, center));
    const twice = selectionCenter(
      transformSelection(base, { ...t, rotate: 30 }, center),
    );
    expect(once.x).toBeCloseTo(twice.x);
    expect(once.y).toBeCloseTo(twice.y);
    expect(once.x).toBeCloseTo(center.x);
    expect(once.y).toBeCloseTo(center.y);
  });

  it("giữ cờ đảo khi biến đổi", () => {
    const inverted = invertSelection(square(0, 0, 10));
    expect(
      transformSelection(inverted, { ...IDENTITY_TRANSFORM, dx: 3, dy: 3 })
        .inverted,
    ).toBe(true);
  });
});

describe("scaleTransform / isIdentityTransform", () => {
  it("nhân tỉ lệ và kẹp biên", () => {
    expect(scaleTransform(IDENTITY_TRANSFORM, 2).scale).toBe(2);
    expect(scaleTransform(IDENTITY_TRANSFORM, 1e6).scale).toBe(MAX_TRANSFORM_SCALE);
    expect(scaleTransform(IDENTITY_TRANSFORM, 0).scale).toBe(MIN_TRANSFORM_SCALE);
  });

  it("tỉ lệ không hợp lệ → về 1", () => {
    expect(scaleTransform({ ...IDENTITY_TRANSFORM, scale: NaN }, 1).scale).toBe(1);
  });

  it("nhận ra phép biến đổi rỗng (không cần hợp nhất pixel)", () => {
    expect(isIdentityTransform(IDENTITY_TRANSFORM)).toBe(true);
    expect(isIdentityTransform({ ...IDENTITY_TRANSFORM, dy: 1 })).toBe(false);
    expect(isIdentityTransform({ ...IDENTITY_TRANSFORM, flipV: true })).toBe(false);
  });
});
