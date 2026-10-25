/**
 * Hiệu ứng hạt 2D (đợt 3): toán thuần tính hạt trên khung hình từ cùng
 * spec + particleStateAt của 3D — deterministic theo seed, trục y lật đúng
 * chiều (trọng lực âm rơi xuống màn hình, dương bay lên trên).
 */
import { describe, expect, it } from "vitest";
import {
  resolveActiveEffects,
  type EffectEvent,
  type EffectFormula,
  type EffectLayer,
} from "../lib/effectFormula";
import { fxParticlesAt, fxShakeFlashOffsets } from "../lib/fx2d";

function layer(over: Partial<EffectLayer> = {}): EffectLayer {
  return {
    shape: "point",
    count: 1,
    speed: [0, 0],
    life: [2, 2],
    gravity: 0,
    size: [0.2, 0.2],
    colorStart: "#000000",
    colorEnd: "#000000",
    glow: false,
    spread: 0,
    opacity: 1,
    ...over,
  };
}

function formula(layers: EffectLayer[], seed = 7): EffectFormula {
  return {
    id: "fx1",
    name: "Test",
    layers,
    seed,
    burstDefault: false,
    suggestedShake: 0,
    suggestedFlash: 0,
  };
}

function ev(over: Partial<EffectEvent> = {}): EffectEvent {
  return {
    id: "ev1",
    effectId: "fx1",
    startSec: 0,
    durationSec: 0,
    position: { x: 0.5, y: 0.5, z: 0 },
    burst: false,
    shake: 0,
    flash: 0,
    ...over,
  };
}

describe("fxParticlesAt", () => {
  it("deterministic theo seed: cùng đầu vào cho cùng đầu ra", () => {
    const f = formula([layer({ count: 20, speed: [1, 2] })]);
    const e = ev({ burst: true, durationSec: 1 });
    expect(fxParticlesAt(f, e, 0.5, 16 / 9)).toEqual(
      fxParticlesAt(f, e, 0.5, 16 / 9),
    );
  });

  it("trước thời điểm bắt đầu thì không có hạt", () => {
    const f = formula([layer()]);
    expect(fxParticlesAt(f, ev({ startSec: 2 }), 1, 16 / 9)).toEqual([]);
  });

  it("trọng lực âm rơi xuống dưới màn hình (y khung tăng dần)", () => {
    const f = formula([layer({ gravity: -10 })]);
    const e = ev();
    const yEarly = fxParticlesAt(f, e, 0.5, 16 / 9)[0].y;
    const yLate = fxParticlesAt(f, e, 1.5, 16 / 9)[0].y;
    expect(yLate).toBeGreaterThan(yEarly);
    expect(yEarly).toBeGreaterThan(0.5);
  });

  it("trọng lực dương bay lên trên màn hình (y khung giảm dần)", () => {
    const f = formula([layer({ gravity: 10 })]);
    const e = ev();
    const yEarly = fxParticlesAt(f, e, 0.5, 16 / 9)[0].y;
    const yLate = fxParticlesAt(f, e, 1.5, 16 / 9)[0].y;
    expect(yLate).toBeLessThan(yEarly);
    expect(yEarly).toBeLessThan(0.5);
  });

  it("cỡ nội suy 3 điểm: giữa đời phình to rồi xẹp cuối đời", () => {
    const f = formula([layer({ size: [0.2, 0.2], sizeMid: 1 })]);
    const e = ev();
    const atQuarter = fxParticlesAt(f, e, 0.5, 16 / 9)[0].size;
    const atMid = fxParticlesAt(f, e, 1, 16 / 9)[0].size;
    const atThreeQuarter = fxParticlesAt(f, e, 1.5, 16 / 9)[0].size;
    expect(atMid).toBeGreaterThan(atQuarter);
    expect(atMid).toBeGreaterThan(atThreeQuarter);
  });

  it("màu nội suy 3 điểm: giữa đời đúng màu giữa", () => {
    const f = formula([
      layer({ colorStart: "#000000", colorMid: "#ffffff", colorEnd: "#000000" }),
    ]);
    const e = ev();
    const c = fxParticlesAt(f, e, 1, 16 / 9)[0].color;
    expect(c[0]).toBeGreaterThan(0.99);
    expect(c[1]).toBeGreaterThan(0.99);
    expect(c[2]).toBeGreaterThan(0.99);
  });

  it("xoay hạt = spin (độ/giây) × tuổi thọ", () => {
    const f = formula([layer({ spin: 90 })]);
    const e = ev();
    const r = fxParticlesAt(f, e, 1, 16 / 9)[0].rotation;
    expect(r).toBeCloseTo(Math.PI / 2, 9);
  });

  it("nổ cùng lúc: hết sau tuổi thọ dài nhất", () => {
    const f = formula([layer({ life: [1, 1] })]);
    const e = ev({ burst: true });
    expect(fxParticlesAt(f, e, 0.5, 16 / 9)).toHaveLength(1);
    expect(fxParticlesAt(f, e, 2, 16 / 9)).toEqual([]);
  });

  it("rải đều: hạt sinh dần theo chỉ số, hết sau thời lượng + tuổi thọ", () => {
    const f = formula([layer({ count: 4, life: [1, 1] })]);
    const e = ev({ burst: false, durationSec: 2 });
    // delay = index/4*2 = 0, 0.5, 1, 1.5 → lúc 0.1 chỉ hạt đầu đã sinh.
    expect(fxParticlesAt(f, e, 0.1, 16 / 9)).toHaveLength(1);
    expect(fxParticlesAt(f, e, 3.1, 16 / 9)).toEqual([]);
  });

  it("độ lệch ngang tỉ lệ nghịch với tỉ lệ khung (giữ hạt tròn)", () => {
    const f = formula([layer({ shape: "sphere", speed: [1, 1] })]);
    const e = ev();
    const a = fxParticlesAt(f, e, 1, 16 / 9)[0];
    const b = fxParticlesAt(f, e, 1, 4 / 3)[0];
    expect((a.x - 0.5) * (16 / 9)).toBeCloseTo((b.x - 0.5) * (4 / 3), 9);
  });

  it("hình hạt + cộng sáng + ảnh custom đi qua nguyên vẹn", () => {
    const f = formula([
      layer({ texture: "star", glow: true }),
      layer({ texture: "custom", textureDataUrl: "data:image/png;base64,AAA" }),
    ]);
    const e = ev();
    const ps = fxParticlesAt(f, e, 0.5, 16 / 9);
    expect(ps[0].texture).toBe("star");
    expect(ps[0].glow).toBe(true);
    expect(ps[1].texture).toBe("custom");
    expect(ps[1].textureDataUrl).toBe("data:image/png;base64,AAA");
  });

  it("sự kiện thiếu công thức bị bỏ qua (resolveActiveEffects)", () => {
    const f = formula([layer()]);
    expect(resolveActiveEffects([ev({ effectId: "khong-co" })], [f], 0.5)).toEqual(
      [],
    );
  });

  it("event 2D serialize round-trip (F5) vẫn khớp công thức", () => {
    const f = formula([layer()]);
    const e = JSON.parse(JSON.stringify(ev({ startSec: 1.5 }))) as EffectEvent;
    expect(e).toEqual(ev({ startSec: 1.5 }));
    expect(resolveActiveEffects([e], [f], 1.6)).toHaveLength(1);
  });
});

describe("fxShakeFlashOffsets", () => {
  it("không có sự kiện thì rung/chớp bằng 0", () => {
    const o = fxShakeFlashOffsets([], 1, 960, 540);
    expect(o).toEqual({ dx: 0, dy: 0, flash: 0 });
  });

  it("rung giảm dần, chớp chỉ trong 0.3s đầu", () => {
    const e = ev({ shake: 0.5, flash: 0.8, durationSec: 2 });
    const early = fxShakeFlashOffsets([e], 0.1, 960, 540);
    const late = fxShakeFlashOffsets([e], 1, 960, 540);
    expect(Math.abs(early.dx) + Math.abs(early.dy)).toBeGreaterThan(0);
    expect(early.flash).toBeGreaterThan(0);
    expect(late.flash).toBe(0);
    expect(Math.abs(late.dx) + Math.abs(late.dy)).toBeLessThan(
      Math.abs(early.dx) + Math.abs(early.dy),
    );
  });
});
