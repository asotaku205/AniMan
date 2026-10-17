import { describe, expect, it } from "vitest";
import {
  clampBow,
  CURVE_BOW_MAX,
  CURVE_BOW_MIN,
  curveControlPoints,
  pointOnCurve,
} from "../lib/curve";

describe("curveControlPoints (BRD T-1 #15: Bézier 2 nút điều khiển)", () => {
  it("độ cong 0 → hai điểm điều khiển nằm trên dây cung, chia 1/3 và 2/3", () => {
    const [c1, c2] = curveControlPoints({ x: 0, y: 0 }, { x: 90, y: 0 }, 0);
    expect(c1).toEqual({ x: 30, y: 0 });
    expect(c2).toEqual({ x: 60, y: 0 });
  });

  it("cong dương và âm lệch hai phía pháp tuyến, đối xứng nhau", () => {
    const [up] = curveControlPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 50);
    const [down] = curveControlPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, -50);
    expect(up.y).toBeGreaterThan(0);
    expect(down.y).toBeCloseTo(-up.y);
    expect(up.x).toBeCloseTo(down.x);
  });

  it("cong 100 → lệch nửa chiều dài dây cung, vuông góc với dây cung", () => {
    const [c1] = curveControlPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 100);
    expect(Math.abs(c1.y)).toBeCloseTo(50);
    expect(c1.x).toBeCloseTo(100 / 3);
  });

  it("dây cung nằm dọc thì lệch theo phương ngang", () => {
    const [c1] = curveControlPoints({ x: 10, y: 0 }, { x: 10, y: 80 }, 100);
    expect(Math.abs(c1.x - 10)).toBeCloseTo(40);
    expect(c1.y).toBeCloseTo(80 / 3);
  });

  it("dây cung dài 0 → hai điểm điều khiển trùng hai đầu, không NaN", () => {
    const [c1, c2] = curveControlPoints({ x: 5, y: 5 }, { x: 5, y: 5 }, 40);
    expect(c1).toEqual({ x: 5, y: 5 });
    expect(c2).toEqual({ x: 5, y: 5 });
  });

  it("kẹp độ cong về -100…+100", () => {
    expect(clampBow(999)).toBe(CURVE_BOW_MAX);
    expect(clampBow(-999)).toBe(CURVE_BOW_MIN);
    expect(clampBow(NaN)).toBe(0);
    expect(clampBow(12.6)).toBe(13);
  });
});

describe("pointOnCurve", () => {
  it("cong 0 → đường cong chạy đúng dây cung", () => {
    const mid = pointOnCurve({ x: 0, y: 0 }, { x: 100, y: 0 }, 0, 0.5);
    expect(mid.y).toBeCloseTo(0);
    expect(mid.x).toBeCloseTo(50);
  });

  it("cong 100 → điểm giữa lệch 3/4 độ lệch của điểm điều khiển", () => {
    const mid = pointOnCurve({ x: 0, y: 0 }, { x: 100, y: 0 }, 100, 0.5);
    expect(mid.y).toBeCloseTo(50 * 0.75);
  });

  it("hai đầu luôn nằm trên hai điểm mút", () => {
    const a = pointOnCurve({ x: 3, y: 4 }, { x: 90, y: 20 }, 70, 0);
    const b = pointOnCurve({ x: 3, y: 4 }, { x: 90, y: 20 }, 70, 1);
    expect(a).toEqual({ x: 3, y: 4 });
    expect(b).toEqual({ x: 90, y: 20 });
  });
});
