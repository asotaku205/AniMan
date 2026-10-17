import { describe, expect, it } from "vitest";
import {
  airbrushDabRadius,
  airbrushDabsPerTick,
  dabAlpha,
  hardnessBlurRadius,
  smoothPoint,
  smoothStroke,
  sprayDabs,
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

describe("sprayDabs (cọ phun — BRD T-1 #12)", () => {
  it("trả đúng số hạt, hạt nào cũng nằm trong bán kính phun", () => {
    const dabs = sprayDabs(20, 12);
    expect(dabs).toHaveLength(20);
    for (const d of dabs) {
      expect(Math.hypot(d.x, d.y)).toBeLessThanOrEqual(12.0001);
    }
  });

  it("tất định theo `rng` tiêm vào (test được, không phụ thuộc thời điểm)", () => {
    const seq = [0.1, 0.9, 0.5, 0.25];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const a = sprayDabs(2, 10, rng);
    i = 0;
    const b = sprayDabs(2, 10, rng);
    expect(a).toEqual(b);
  });

  it("bán kính 0 → hạt dồn đúng tâm; số hạt hỏng → 1", () => {
    expect(sprayDabs(3, 0).every((d) => d.x === 0 && d.y === 0)).toBe(true);
    expect(sprayDabs(0, 5)).toHaveLength(1);
    expect(sprayDabs(NaN, 5)).toHaveLength(1);
  });

  it("hạt trải đều theo diện tích: nửa trong, nửa ngoài bán kính 0.707×r", () => {
    let inside = 0;
    const dabs = sprayDabs(400, 10, mulberry32(42));
    for (const d of dabs) if (Math.hypot(d.x, d.y) < 10 * Math.SQRT1_2) inside += 1;
    // Phân bố đều theo diện tích → khoảng 50% (±10%)
    expect(inside).toBeGreaterThan(160);
    expect(inside).toBeLessThan(240);
  });
});

describe("tham số nhịp phun", () => {
  it("flow cao → nhiều hạt hơn, luôn ≥ 1", () => {
    expect(airbrushDabsPerTick(0)).toBe(1);
    expect(airbrushDabsPerTick(40)).toBe(3);
    expect(airbrushDabsPerTick(100)).toBe(8);
    expect(airbrushDabsPerTick(1000)).toBe(8);
  });

  it("bán kính hạt nhỏ so với cỡ nét và tỉ lệ với cỡ nét", () => {
    expect(airbrushDabRadius(48)).toBeCloseTo(5.76);
    expect(airbrushDabRadius(0)).toBeGreaterThan(0);
    expect(airbrushDabRadius(48)).toBeGreaterThan(airbrushDabRadius(16));
  });
});

/** Sinh số giả ngẫu nhiên tất định để test phân bố hạt phun. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
