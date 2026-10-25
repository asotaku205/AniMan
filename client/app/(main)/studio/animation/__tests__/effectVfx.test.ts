import { describe, expect, it } from "vitest";
import {
  effectShakeFlash,
  interp3,
  layerColorMid,
  layerDrag,
  layerParticles,
  layerSizeMid,
  layerSpin,
  layerTexture,
  layerTurbulence,
  particleStateAt,
  resolveActiveEffects,
  type EffectEvent,
  type EffectFormula,
  type EffectLayer,
  type ParticleSpec,
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

const FORMULA: EffectFormula = {
  id: "fx-1",
  name: "Test",
  layers: [LAYER],
  seed: 7,
  burstDefault: true,
  suggestedShake: 0,
  suggestedFlash: 0,
};

function ev(partial: Partial<EffectEvent> & { id: string }): EffectEvent {
  return {
    effectId: "fx-1",
    startSec: 2,
    durationSec: 3,
    position: { x: 0, y: 0, z: 0 },
    burst: true,
    shake: 0,
    flash: 0,
    ...partial,
  };
}

/** Spec tự dựng: tốc độ 0, trọng lực 0 → vị trí chỉ còn nhiễu. */
function stillSpec(): ParticleSpec {
  return {
    index: 0,
    count: 1,
    dir: [0, 1, 0],
    speed: 0,
    life: 2,
    burstDelay: 0,
    sizeMul: 1,
    phase: [0, 0, 0],
  };
}

describe("resolveActiveEffects", () => {
  it("chưa tới giờ thì không hoạt động", () => {
    expect(resolveActiveEffects([ev({ id: "a" })], [FORMULA], 1.9)).toEqual([]);
  });

  it("nổ: hoạt động tới hết tuổi thọ dài nhất, sau đó tắt", () => {
    const events = [ev({ id: "a" })];
    expect(resolveActiveEffects(events, [FORMULA], 2)).toHaveLength(1);
    // maxLife = 1 → còn hoạt động đúng tại mốc 3, tắt sau đó.
    expect(resolveActiveEffects(events, [FORMULA], 3)).toHaveLength(1);
    expect(resolveActiveEffects(events, [FORMULA], 3.01)).toEqual([]);
  });

  it("rải đều: hoạt động tới hết thời lượng + tuổi thọ dài nhất", () => {
    const events = [ev({ id: "a", burst: false })];
    expect(resolveActiveEffects(events, [FORMULA], 5.9)).toHaveLength(1);
    expect(resolveActiveEffects(events, [FORMULA], 6)).toHaveLength(1);
    expect(resolveActiveEffects(events, [FORMULA], 6.01)).toEqual([]);
  });

  it("sự kiện trỏ tới công thức không tồn tại thì bị bỏ qua", () => {
    expect(
      resolveActiveEffects([ev({ id: "a", effectId: "fx-lac" })], [FORMULA], 2.5),
    ).toEqual([]);
    expect(resolveActiveEffects([], [FORMULA], 2.5)).toEqual([]);
  });

  it("trả về đúng công thức của từng sự kiện", () => {
    const found = resolveActiveEffects([ev({ id: "a" })], [FORMULA], 2.5);
    expect(found[0].formula).toBe(FORMULA);
    expect(found[0].event.id).toBe("a");
  });
});

describe("effectShakeFlash (khớp trình dựng)", () => {
  it("rung giảm dần trong thời lượng, hết thời lượng thì 0", () => {
    const events = [ev({ id: "a", shake: 1, durationSec: 2 })];
    expect(effectShakeFlash(events, 2).shake).toBeCloseTo(1, 5);
    expect(effectShakeFlash(events, 3).shake).toBeCloseTo(0.5, 5);
    expect(effectShakeFlash(events, 4.1).shake).toBe(0);
  });

  it("chớp chỉ trong 0.3s đầu, giảm dần về 0", () => {
    const events = [ev({ id: "a", flash: 0.8 })];
    expect(effectShakeFlash(events, 2).flash).toBeCloseTo(0.8, 5);
    expect(effectShakeFlash(events, 2.15).flash).toBeCloseTo(0.4, 5);
    expect(effectShakeFlash(events, 2.31).flash).toBe(0);
  });
});

describe("field mới: mặc định tương thích ngược", () => {
  it("công thức cũ không có field mới thì dùng mặc định cũ", () => {
    expect(layerTexture(LAYER)).toBe("dot");
    expect(layerSpin(LAYER)).toBe(0);
    expect(layerDrag(LAYER)).toBe(0);
    expect(layerTurbulence(LAYER)).toBe(0);
    // Cỡ giữa mặc định = điểm giữa tuyến tính cũ.
    expect(layerSizeMid(LAYER)).toBeCloseTo(0.3, 10);
    expect(layerColorMid(LAYER)).toEqual([0.5, 0.5, 0.5]);
  });

  it("nội suy 3 điểm: nửa đầu đầu→giữa, nửa sau giữa→cuối", () => {
    expect(interp3(0, 10, 20, 0)).toBe(0);
    expect(interp3(0, 10, 20, 0.25)).toBe(5);
    expect(interp3(0, 10, 20, 0.5)).toBe(10);
    expect(interp3(0, 10, 20, 0.75)).toBe(15);
    expect(interp3(0, 10, 20, 1)).toBe(20);
  });

  it("không đặt giữa thì đường cong 3 điểm trùng tuyến tính cũ", () => {
    const st = particleStateAt(stillSpec(), LAYER, 1, true, 0);
    expect(st).not.toBeNull();
    // life 2, tuổi 1 → p = 0.5 → cỡ 0.3, màu xám giữa.
    expect(st!.size).toBeCloseTo(0.3, 10);
    expect(st!.color[0]).toBeCloseTo(0.5, 10);
  });

  it("đặt cỡ giữa + màu giữa thì hạt đi qua đúng điểm giữa", () => {
    const layer: EffectLayer = {
      ...LAYER,
      gravity: 0,
      sizeMid: 1,
      colorMid: "#ff0000",
    };
    const mid = particleStateAt(stillSpec(), layer, 1, true, 0);
    expect(mid!.size).toBeCloseTo(1, 10);
    expect(mid!.color).toEqual([1, 0, 0]);
    const quarter = particleStateAt(stillSpec(), layer, 0.5, true, 0);
    // p = 0.25 → nửa đường đầu→giữa: cỡ 0.7, màu hồng nhạt.
    expect(quarter!.size).toBeCloseTo(0.7, 10);
    expect(quarter!.color[0]).toBeCloseTo(1, 10);
    expect(quarter!.color[1]).toBeCloseTo(0.5, 10);
  });
});

describe("cản gió (drag)", () => {
  it("drag = 0 cho đúng vị trí cũ", () => {
    const [spec] = layerParticles(LAYER, 7, 0);
    const st = particleStateAt(spec, LAYER, 0.5, true, 0);
    const age = 0.5 - spec.burstDelay;
    expect(st!.pos[0]).toBeCloseTo(spec.dir[0] * 2 * age, 10);
    expect(st!.pos[1]).toBeCloseTo(spec.dir[1] * 2 * age - 5 * age * age, 10);
  });

  it("drag > 0: quãng đi theo (1 - e^-d·tuổi)/d, ngắn hơn khi không cản", () => {
    const spec: ParticleSpec = {
      ...stillSpec(),
      dir: [1, 0, 0],
      speed: 4,
    };
    const layer: EffectLayer = { ...LAYER, gravity: 0, drag: 2 };
    const st = particleStateAt(spec, layer, 1, true, 0);
    expect(st!.pos[0]).toBeCloseTo(4 * (1 - Math.exp(-2)) / 2, 10);
    expect(st!.pos[0]).toBeLessThan(4);
  });
});

describe("nhiễu (turbulence)", () => {
  it("turbulence = 0 cho đúng vị trí cũ", () => {
    const spec: ParticleSpec = { ...stillSpec(), dir: [1, 0, 0], speed: 3 };
    const st = particleStateAt(spec, { ...LAYER, gravity: 0 }, 1, true, 0);
    expect(st!.pos[0]).toBeCloseTo(3, 10);
    expect(st!.pos[1]).toBeCloseTo(0, 10);
  });

  it("turbulence > 0: lệch từng trục không vượt biên độ", () => {
    const layer: EffectLayer = { ...LAYER, gravity: 0, turbulence: 0.5 };
    const spec: ParticleSpec = { ...stillSpec(), phase: [0.3, 1.1, 2.2] };
    const st = particleStateAt(spec, layer, 1, true, 0);
    for (const v of st!.pos) expect(Math.abs(v)).toBeLessThanOrEqual(0.5 + 1e-9);
    // Có nhiễu thật (không trùng vị trí không nhiễu).
    expect(st!.pos).not.toEqual([0, 0, 0]);
  });
});

describe("xoay hạt (spin)", () => {
  it("spin = 0 thì góc xoay 0; spin 90°/s thì sau 1s xoay π/2", () => {
    expect(particleStateAt(stillSpec(), LAYER, 1, true, 0)!.angle).toBe(0);
    const layer: EffectLayer = { ...LAYER, gravity: 0, spin: 90 };
    expect(particleStateAt(stillSpec(), layer, 1, true, 0)!.angle).toBeCloseTo(
      Math.PI / 2,
      10,
    );
  });
});
