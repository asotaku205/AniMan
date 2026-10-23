import { describe, expect, it } from "vitest";
import {
  effectValuesAt,
  layerEffectAt,
  type LayerEffectKey,
} from "../lib/layerEffects";
import {
  defaultParticles,
  particlePointsAt,
} from "../lib/particles";
import {
  strokeProgress,
  strokeVisiblePoints,
  type SceneStroke,
} from "../lib/strokes";
import { createPrevizObject, samplePrevizObject } from "../lib/previz";

const BASE = { opacity: 1, shake: 0, glow: 0, pulse: 0 };

describe("R3 · mốc hiệu ứng theo thời gian", () => {
  const keys: LayerEffectKey[] = [
    { id: "a", timeSec: 0, values: { opacity: 1, shake: 0, glow: 0, pulse: 0 } },
    { id: "b", timeSec: 2, values: { opacity: 0.2, shake: 1, glow: 1, pulse: 0.5 } },
  ];

  it("nội suy tuyến tính giữa hai mốc, giữ nguyên ngoài khoảng", () => {
    const mid = effectValuesAt(BASE, keys, 1);
    expect(mid.opacity).toBeCloseTo(0.6);
    expect(mid.glow).toBeCloseTo(0.5);
    expect(effectValuesAt(BASE, keys, -1).opacity).toBe(1);
    expect(effectValuesAt(BASE, keys, 5).glow).toBe(1);
    expect(effectValuesAt(BASE, [], 1)).toEqual(BASE);
  });

  it("layerEffectAt nhân độ mờ của mốc vào opacityMul", () => {
    const s = layerEffectAt(undefined, [0, 2], 1, 2, keys);
    expect(s.opacityMul).toBeCloseTo(0.6);
    expect(s.glowPx).toBeCloseTo(13);
  });
});

describe("R3 · hệ hạt tự chế", () => {
  it("tất định: cùng thông số + cùng t cho cùng vị trí; số hạt đúng", () => {
    const sys = defaultParticles();
    const a = particlePointsAt(sys, 1.3);
    const b = particlePointsAt(sys, 1.3);
    expect(a).toEqual(b);
    expect(a.length).toBe(sys.count);
  });

  it("hạt bay theo hướng đặt: hướng lên thì đa số hạt ở phía trên nguồn phát", () => {
    const sys = {
      ...defaultParticles(),
      directionDeg: 180,
      spreadDeg: 0,
      speed: 0.3,
      lifetimeSec: 2,
      emitterY: 0.9,
      emitterWidth: 0,
      gravity: 0,
    };
    const pts = particlePointsAt(sys, 0.01);
    const above = pts.filter((p) => p.y < 0.9).length;
    expect(above).toBeGreaterThan(pts.length * 0.8);
  });
});

describe("R3 · vệt vẽ tay", () => {
  const stroke: SceneStroke = {
    id: "s1",
    color: "#7df9ff",
    widthPx: 6,
    points: [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 1, y: 0 },
    ],
    startSec: 1,
    durationSec: 2,
  };

  it("tiến độ theo thời gian và phần nét hiện theo độ dài", () => {
    expect(strokeProgress(stroke, 0.5)).toBe(0);
    expect(strokeProgress(stroke, 2)).toBeCloseTo(0.5);
    expect(strokeProgress(stroke, 9)).toBe(1);
    expect(strokeVisiblePoints(stroke, 0.5)).toHaveLength(0);
    const half = strokeVisiblePoints(stroke, 2);
    expect(half[half.length - 1].x).toBeCloseTo(0.5);
    expect(strokeVisiblePoints(stroke, 3)).toHaveLength(3);
  });
});

describe("R3 · phát sáng 3D theo mốc key", () => {
  it("nội suy glow giữa hai key, key không đặt glow thì dùng mức chung", () => {
    const obj = createPrevizObject("character", "Nhân vật");
    obj.glow = 0.2;
    obj.keys = [
      { ...obj.keys[0], timeSec: 0, glow: 0 },
      { ...obj.keys[0], id: "k2", timeSec: 2, glow: 1 },
    ];
    expect(samplePrevizObject(obj, 0).glow).toBe(0);
    expect(samplePrevizObject(obj, 1).glow).toBeCloseTo(0.5);
    expect(samplePrevizObject(obj, 2).glow).toBe(1);
    obj.keys = [{ ...obj.keys[0], glow: undefined }];
    expect(samplePrevizObject(obj, 0).glow).toBe(0.2);
  });
});
