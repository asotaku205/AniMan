import { describe, expect, it } from "vitest";
import {
  layerEffectAt,
  weatherParticles,
} from "../lib/layerEffects";

describe("hiệu ứng layer (S2)", () => {
  it("không hiệu ứng → mẫu trung tính", () => {
    const s = layerEffectAt(undefined, [0, 5], 2.5, 5);
    expect(s.opacityMul).toBe(1);
    expect(s.glowPx).toBe(0);
    expect(s.scaleMul).toBe(1);
  });

  it("mờ hiện/khuất dần theo khoảng key của layer", () => {
    const fx = { fadeInSec: 1, fadeOutSec: 1 };
    expect(layerEffectAt(fx, [1, 5], 1, 6).opacityMul).toBe(0);
    expect(layerEffectAt(fx, [1, 5], 1.5, 6).opacityMul).toBeCloseTo(0.5);
    expect(layerEffectAt(fx, [1, 5], 3, 6).opacityMul).toBe(1);
    expect(layerEffectAt(fx, [1, 5], 5, 6).opacityMul).toBe(0);
  });

  it("rung/phát sáng/nhịp đều tất định theo t", () => {
    const fx = { shake: 0.8, glow: 0.5, pulse: 0.6 };
    const a = layerEffectAt(fx, [0, 4], 1.234, 4);
    const b = layerEffectAt(fx, [0, 4], 1.234, 4);
    expect(a).toEqual(b);
    expect(a.glowPx).toBeCloseTo(13);
    expect(Math.abs(a.shakeX)).toBeLessThanOrEqual(0.012);
  });

  it("hạt thời tiết: số hạt theo mật độ và tất định", () => {
    const w = { type: "snow" as const, intensity: 0.5 };
    const a = weatherParticles(w, 1.5);
    const b = weatherParticles(w, 1.5);
    expect(a).toEqual(b);
    expect(a.length).toBe(65);
    expect(weatherParticles({ type: "rain", intensity: 1 }, 0).length).toBe(130);
    expect(weatherParticles({ type: "rain", intensity: 0 }, 0).length).toBe(0);
  });
});
