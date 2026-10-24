import { describe, expect, it } from "vitest";
import {
  formulaMaxLife,
  layerParticles,
  particleStateAt,
  type EffectLayer,
} from "../lib/effectFormula";

const LAYER: EffectLayer = {
  shape: "sphere",
  count: 10,
  speed: [2, 2],
  life: [1, 1],
  gravity: -10,
  size: [0.4, 0.2],
  colorStart: "#ffffff",
  colorEnd: "#000000",
  glow: true,
  spread: 1,
  opacity: 1,
};

describe("Công thức hiệu ứng", () => {
  it("cùng seed cho cùng tham số hạt", () => {
    const a = layerParticles(LAYER, 42, 0);
    const b = layerParticles(LAYER, 42, 0);
    expect(a).toEqual(b);
    expect(layerParticles(LAYER, 43, 0)).not.toEqual(a);
  });

  it("hướng cầu có độ dài 1, hướng nón nằm trong chùm", () => {
    const sphere = layerParticles({ ...LAYER, shape: "sphere" }, 7, 0);
    for (const s of sphere) {
      const len = Math.hypot(...s.dir);
      expect(len).toBeCloseTo(1, 5);
    }
    const point = layerParticles({ ...LAYER, shape: "point", spread: 0 }, 7, 0);
    for (const s of point) {
      // Chùm hẹp nhất: góc tối đa 15° → cos ≥ cos15°.
      expect(s.dir[1]).toBeGreaterThanOrEqual(Math.cos((15 * Math.PI) / 180) - 1e-9);
    }
  });

  it("nổ: hạt chưa tới giờ thì null, giữa đời thì rơi theo trọng lực", () => {
    const [spec] = layerParticles(LAYER, 7, 0);
    expect(particleStateAt(spec, LAYER, -0.1, true, 0)).toBeNull();
    const mid = particleStateAt(spec, LAYER, 0.5, true, 0);
    expect(mid).not.toBeNull();
    // Tuổi thật = 0.5 - burstDelay; y = dir.y*2*tuổi + 0.5*(-10)*tuổi²
    const age = 0.5 - spec.burstDelay;
    expect(mid!.pos[1]).toBeCloseTo(spec.dir[1] * 2 * age - 5 * age * age, 5);
    // Màu theo tuổi: trắng → đen
    expect(mid!.color[0]).toBeCloseTo(1 - age, 2);
    // Quá tuổi thọ thì null
    expect(particleStateAt(spec, LAYER, 1.5, true, 0)).toBeNull();
  });

  it("rải đều: hạt thứ i sinh ở i/count * thời lượng", () => {
    const specs = layerParticles(LAYER, 7, 0);
    const last = specs[specs.length - 1];
    // Hạt cuối chưa sinh ở 0.5s khi thời lượng 10s (delay 9s)
    expect(particleStateAt(last, LAYER, 0.5, false, 10)).toBeNull();
    expect(particleStateAt(last, LAYER, 9.5, false, 10)).not.toBeNull();
  });

  it("tuổi thọ dài nhất của công thức", () => {
    expect(formulaMaxLife({ id: "x", name: "x", layers: [LAYER, { ...LAYER, life: [0.5, 2.5] }], seed: 1, burstDefault: true, suggestedShake: 0, suggestedFlash: 0 })).toBe(2.5);
  });
});
