import { describe, expect, it } from "vitest";
import {
  dabAlpha,
  hardnessBlurRadius,
  smoothPoint,
  smoothStroke,
} from "../lib/stroke";

describe("smoothPoint / smoothStroke (BR-T03)", () => {
  it("smoothing 0 → bám tay tuyệt đối", () => {
    const p = smoothPoint({ x: 0, y: 0 }, { x: 100, y: 50 }, 0);
    expect(p).toEqual({ x: 100, y: 50 });
    const path = smoothStroke(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      0,
    );
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it("smoothing > 0 → điểm ra chậm lại, không nhảy hết quãng", () => {
    const p = smoothPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, 50);
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(100);
    expect(p.y).toBe(0);
  });

  it("càng mượt thì càng tiến chậm", () => {
    const low = smoothPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, 20);
    const high = smoothPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, 90);
    expect(high.x).toBeLessThan(low.x);
  });

  it("không đứng yên hoàn toàn ở mức 100 (nét vẫn đi tới)", () => {
    let p = { x: 0, y: 0 };
    for (let i = 0; i < 200; i += 1) {
      p = smoothPoint(p, { x: 100, y: 0 }, 100);
    }
    expect(p.x).toBeGreaterThan(99);
  });

  it("điểm đầu giữ nguyên; mảng rỗng → mảng rỗng", () => {
    expect(smoothStroke([], 50)).toEqual([]);
    expect(smoothStroke([{ x: 7, y: 9 }], 50)).toEqual([{ x: 7, y: 9 }]);
  });

  it("smoothing hỏng/ngoài khoảng → coi như 0", () => {
    expect(smoothPoint({ x: 0, y: 0 }, { x: 10, y: 0 }, NaN)).toEqual({
      x: 10,
      y: 0,
    });
    expect(smoothPoint({ x: 0, y: 0 }, { x: 10, y: 0 }, -50)).toEqual({
      x: 10,
      y: 0,
    });
  });
});

describe("hardnessBlurRadius (độ cứng đầu cọ)", () => {
  it("cứng hoàn toàn (100) → không mờ", () => {
    expect(hardnessBlurRadius(100, 20)).toBe(0);
  });

  it("mềm hoàn toàn (0) → mờ nửa đường kính nét", () => {
    expect(hardnessBlurRadius(0, 20)).toBe(10);
  });

  it("ở giữa → tỉ lệ thuận", () => {
    expect(hardnessBlurRadius(50, 20)).toBe(5);
    expect(hardnessBlurRadius(75, 40)).toBe(5);
  });

  it("giá trị hỏng → coi như cứng (không mờ)", () => {
    expect(hardnessBlurRadius(NaN, 20)).toBe(0);
    expect(hardnessBlurRadius(100, 0)).toBe(0);
  });
});

describe("dabAlpha (flow — BR-T02)", () => {
  it("flow 100 → alpha 1; flow 50 → 0.5", () => {
    expect(dabAlpha(100)).toBe(1);
    expect(dabAlpha(50)).toBe(0.5);
  });

  it("không bao giờ bằng 0 (tránh nét vô hình)", () => {
    expect(dabAlpha(0)).toBeGreaterThan(0);
    expect(dabAlpha(NaN)).toBeGreaterThan(0);
  });
});
