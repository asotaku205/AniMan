import { describe, expect, it } from "vitest";
import {
  applyMotionPreset,
  bakeMotionInstance,
  motionPresetById,
  MOTION_PRESETS,
} from "../lib/motionAttach";
import {
  catmullRomAngle,
  catmullRomPoint,
  sampleLayerTransform,
  sampleMotionInstance,
  sampleMotionPath,
  sampleTransform,
  upsertTransformKey,
  IDENTITY_TRANSFORM,
  type MotionInstance,
  type MotionPath,
  type SceneLayer,
  type TransformKey,
} from "../lib/timeline";

const rest = { ...IDENTITY_TRANSFORM, x: 0.3, y: 0.4, scale: 1.2 };

const key = (
  timeSec: number,
  x: number,
  easing: TransformKey["easing"] = "linear",
): TransformKey => ({
  id: `k-${timeSec}`,
  timeSec,
  transform: { ...IDENTITY_TRANSFORM, x },
  easing,
});

const layerWith = (patch: Partial<SceneLayer>): SceneLayer => ({
  id: "layer-1",
  name: "Lớp 1",
  color: "#3b2d5c",
  imageDataUrl: null,
  visible: true,
  keys: [],
  motions: [],
  ...patch,
});

describe("preset builders — sinh keys từ tư thế nghỉ thật", () => {
  it("trượt vào từ trái: key đầu ngoài khung, key cuối đúng tư thế nghỉ", () => {
    const preset = motionPresetById("slide-in")!;
    const keys = preset.build(rest, {
      startSec: 2,
      durationSec: 1,
      direction: "left",
      strength: 1,
      easing: "ease-out",
      loop: "once",
    });
    expect(keys[0].timeSec).toBe(2);
    expect(keys[0].transform.x).toBeLessThan(0);
    expect(keys[0].transform.opacity).toBe(0);
    expect(keys[keys.length - 1].timeSec).toBe(3);
    expect(keys[keys.length - 1].transform.x).toBeCloseTo(0.3);
    expect(keys[keys.length - 1].transform.y).toBeCloseTo(0.4);
  });

  it("trượt vào từ dưới và từ phải đều bắt đầu ngoài khung", () => {
    const preset = motionPresetById("slide-in")!;
    const fromBottom = preset.build(rest, {
      startSec: 0, durationSec: 1, direction: "bottom",
      strength: 1, easing: "linear", loop: "once",
    });
    expect(fromBottom[0].transform.y).toBeGreaterThan(1);
    const fromRight = preset.build(rest, {
      startSec: 0, durationSec: 1, direction: "right",
      strength: 1, easing: "linear", loop: "once",
    });
    expect(fromRight[0].transform.x).toBeGreaterThan(1);
  });

  it("rơi xuống nảy dùng easing bounce, kết thúc ở tư thế nghỉ", () => {
    const preset = motionPresetById("drop-bounce")!;
    const keys = preset.build(rest, {
      startSec: 1, durationSec: 1, direction: "left",
      strength: 1, easing: "ease-in-out", loop: "once",
    });
    expect(keys[0].easing).toBe("bounce");
    expect(keys[0].transform.y).toBeLessThan(rest.y);
    expect(keys[1].transform.y).toBeCloseTo(rest.y);
  });

  it("phóng to rồi về: giữa phình, đầu/cuối đúng cỡ nghỉ", () => {
    const preset = motionPresetById("pop")!;
    const keys = preset.build(rest, {
      startSec: 0, durationSec: 2, direction: "left",
      strength: 1, easing: "ease-in-out", loop: "once",
    });
    expect(keys[0].transform.scale).toBeCloseTo(1.2);
    expect(keys[1].transform.scale).toBeCloseTo(1.2 * 1.3);
    expect(keys[2].transform.scale).toBeCloseTo(1.2);
  });

  it("lắc đầu: xoay qua lại rồi về 0, vị trí không đổi", () => {
    const preset = motionPresetById("shake-head-no")!;
    const keys = preset.build(rest, {
      startSec: 0, durationSec: 1, direction: "left",
      strength: 1, easing: "ease-in-out", loop: "once",
    });
    expect(keys[0].transform.rotation).toBeCloseTo(0);
    expect(keys[1].transform.rotation).toBeCloseTo(-12);
    expect(keys[keys.length - 1].transform.rotation).toBeCloseTo(0);
    for (const k of keys) expect(k.transform.x).toBeCloseTo(0.3);
  });

  it("mọi preset đều có key đầu ở startSec và key cuối ở startSec+duration", () => {
    for (const preset of MOTION_PRESETS) {
      const keys = preset.build(rest, {
        startSec: 2, durationSec: 1.5, direction: "left",
        strength: 1, easing: "ease-in-out", loop: "once",
      });
      expect(keys.length).toBeGreaterThanOrEqual(2);
      expect(keys[0].timeSec).toBeCloseTo(2);
      expect(keys[keys.length - 1].timeSec).toBeCloseTo(3.5);
    }
  });
});

describe("áp mẫu — thay keys trong đoạn, giữ keys ngoài đoạn", () => {
  it("key cũ trong đoạn bị thay, key ngoài đoạn giữ nguyên, không trùng giờ", () => {
    const old = [key(0, 0.1), key(1.2, 0.5), key(5, 0.9)];
    const preset = motionPresetById("fade-in")!;
    const { keys, instance } = applyMotionPreset(old, preset, {
      startSec: 1, durationSec: 1, direction: "left",
      strength: 1, easing: "linear", loop: "once",
    }, IDENTITY_TRANSFORM);
    expect(instance).toBeNull();
    const times = keys.map((k) => k.timeSec);
    expect(times).toEqual([0, 1, 2, 5]);
    expect(keys.find((k) => k.timeSec === 1)!.transform.opacity).toBe(0);
    expect(keys.find((k) => k.timeSec === 5)!.transform.x).toBeCloseTo(0.9);
  });

  it("áp mẫu lặp không chạm keys mà tạo instance với keys chu kỳ tương đối", () => {
    const old = [key(0, 0.1)];
    const preset = motionPresetById("pop")!;
    const { keys, instance } = applyMotionPreset(old, preset, {
      startSec: 2, durationSec: 1, direction: "left",
      strength: 1, easing: "linear", loop: "loop",
    }, rest);
    expect(keys).toEqual(old);
    expect(instance).not.toBeNull();
    expect(instance!.cycleKeys[0].timeSec).toBeCloseTo(0);
    expect(
      instance!.cycleKeys[instance!.cycleKeys.length - 1].timeSec,
    ).toBeCloseTo(1);
  });

  it("chuyển thành keys: bake 1 chu kỳ thành keys tuyệt đối, thay đoạn", () => {
    const preset = motionPresetById("pop")!;
    const { instance } = applyMotionPreset([], preset, {
      startSec: 2, durationSec: 1, direction: "left",
      strength: 1, easing: "linear", loop: "loop",
    }, rest);
    const baked = bakeMotionInstance([key(0, 0.1), key(5, 0.9)], instance!);
    const times = baked.map((k) => k.timeSec);
    expect(times).toContain(2);
    expect(times).toContain(3);
    expect(times).toContain(0);
    expect(times).toContain(5);
    expect(new Set(times).size).toBe(times.length);
  });
});

describe("loop / pingpong theo thời gian", () => {
  const inst: MotionInstance = {
    id: "minst-1",
    presetId: "pop",
    name: "Phóng to rồi về",
    params: {
      startSec: 2, durationSec: 1, direction: "left",
      strength: 1, easing: "linear", loop: "loop",
    },
    cycleKeys: [
      { id: "a", timeSec: 0, transform: { ...IDENTITY_TRANSFORM, scale: 1 }, easing: "linear" },
      { id: "b", timeSec: 0.5, transform: { ...IDENTITY_TRANSFORM, scale: 1.3 }, easing: "linear" },
      { id: "c", timeSec: 1, transform: { ...IDENTITY_TRANSFORM, scale: 1 }, easing: "linear" },
    ],
  };

  it("trước startSec chưa chiếm quyền, sau đó lặp đúng chu kỳ", () => {
    expect(sampleMotionInstance(inst, 1.5)).toBeNull();
    expect(sampleMotionInstance(inst, 2.5)!.scale).toBeCloseTo(1.3);
    expect(sampleMotionInstance(inst, 3.5)!.scale).toBeCloseTo(1.3);
    expect(sampleMotionInstance(inst, 2.25)!.scale).toBeCloseTo(1.15);
  });

  it("pingpong: đi rồi về, tại 3/4 chu kỳ kép về đúng điểm giữa ngược chiều", () => {
    const ping: MotionInstance = {
      ...inst,
      params: { ...inst.params, loop: "pingpong" },
    };
    expect(sampleMotionInstance(ping, 2.5)!.scale).toBeCloseTo(1.3);
    // 2 + 1.5 = 3.5: nửa sau chu kỳ kép → gương của 0.5 → cũng 1.3? kiểm tra điểm 1.75
    expect(sampleMotionInstance(ping, 3.75)!.scale).toBeCloseTo(1.15);
    expect(sampleMotionInstance(ping, 4)!.scale).toBeCloseTo(1);
  });
});

describe("đường cong Catmull-Rom", () => {
  const pts = [
    { x: 0.1, y: 0.5 },
    { x: 0.4, y: 0.2 },
    { x: 0.7, y: 0.8 },
    { x: 0.9, y: 0.5 },
  ];

  it("đầu/cuối đúng điểm user bấm, điểm giữa đúng điểm kiểm soát", () => {
    const start = catmullRomPoint(pts, 0);
    expect(start.x).toBeCloseTo(0.1);
    expect(start.y).toBeCloseTo(0.5);
    const end = catmullRomPoint(pts, 1);
    expect(end.x).toBeCloseTo(0.9);
    expect(end.y).toBeCloseTo(0.5);
    const mid = catmullRomPoint(pts, 1 / 3);
    expect(mid.x).toBeCloseTo(0.4);
    expect(mid.y).toBeCloseTo(0.2);
    const mid2 = catmullRomPoint(pts, 2 / 3);
    expect(mid2.x).toBeCloseTo(0.7);
    expect(mid2.y).toBeCloseTo(0.8);
  });

  it("đường thẳng thì điểm cong nằm trên đường thẳng, không gấp khúc", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ];
    for (const u of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const p = catmullRomPoint(line, u);
      expect(p.x).toBeCloseTo(p.y, 6);
    }
  });

  it("góc tiếp tuyến: ngang ~0°, dọc ~90°", () => {
    expect(
      catmullRomAngle(
        [
          { x: 0, y: 0.5 },
          { x: 1, y: 0.5 },
        ],
        0.5,
      ),
    ).toBeCloseTo(0);
    expect(
      catmullRomAngle(
        [
          { x: 0.5, y: 0 },
          { x: 0.5, y: 1 },
        ],
        0.5,
      ),
    ).toBeCloseTo(90);
  });
});

describe("đường đi trong sampleLayerTransform", () => {
  const path: MotionPath = {
    id: "path-1",
    points: [
      { x: 0.1, y: 0.5 },
      { x: 0.9, y: 0.5 },
    ],
    startSec: 2,
    durationSec: 2,
    orientToPath: true,
    easing: "linear",
  };

  it("ngoài đoạn thì về keys cũ, trong đoạn thì đi theo đường và xoay theo hướng", () => {
    const layer = layerWith({
      keys: [key(0, 0.5)],
      motionPath: path,
    });
    expect(sampleLayerTransform(layer, 1).x).toBeCloseTo(0.5);
    const mid = sampleLayerTransform(layer, 3);
    expect(mid.x).toBeCloseTo(0.5);
    expect(mid.rotation).toBeCloseTo(0);
    const end = sampleLayerTransform(layer, 4);
    expect(end.x).toBeCloseTo(0.9);
  });

  it("orient tắt thì giữ xoay từ keys, chỉ ghi đè vị trí", () => {
    const layer = layerWith({
      keys: [
        {
          id: "r",
          timeSec: 0,
          transform: { ...IDENTITY_TRANSFORM, rotation: 30 },
          easing: "linear",
        },
      ],
      motionPath: { ...path, orientToPath: false },
    });
    const mid = sampleLayerTransform(layer, 3);
    expect(mid.x).toBeCloseTo(0.5);
    expect(mid.rotation).toBeCloseTo(30);
  });

  it("instance lặp chiếm quyền sau startSec, trước đó keys cũ vẫn thắng", () => {
    const preset = motionPresetById("pop")!;
    const { instance } = applyMotionPreset([], preset, {
      startSec: 2, durationSec: 1, direction: "left",
      strength: 1, easing: "linear", loop: "loop",
    }, rest);
    const layer = layerWith({
      keys: [key(0, 0.5)],
      motionInstances: [instance!],
    });
    expect(sampleLayerTransform(layer, 1).scale).toBeCloseTo(1);
    expect(sampleLayerTransform(layer, 2.5).scale).toBeCloseTo(1.2 * 1.3);
  });

  it("serialize round-trip: F5 rồi mở lại vẫn cho cùng transform", () => {
    const preset = motionPresetById("wiggle")!;
    const { instance } = applyMotionPreset([], preset, {
      startSec: 1, durationSec: 2, direction: "left",
      strength: 1, easing: "linear", loop: "pingpong",
    }, rest);
    const layer = layerWith({ motionInstances: [instance!], motionPath: path });
    const restored = JSON.parse(JSON.stringify(layer)) as SceneLayer;
    for (const t of [0, 1.5, 2.5, 3, 5]) {
      const a = sampleLayerTransform(layer, t);
      const b = sampleLayerTransform(restored, t);
      expect(b.x).toBeCloseTo(a.x);
      expect(b.y).toBeCloseTo(a.y);
      expect(b.rotation).toBeCloseTo(a.rotation);
      expect(b.scale).toBeCloseTo(a.scale);
    }
  });

  it("không instance/đường thì hành vi cũ giữ nguyên", () => {
    const layer = layerWith({ keys: [key(0, 0.2), key(2, 0.8)] });
    expect(sampleLayerTransform(layer, 1).x).toBeCloseTo(0.5);
    expect(sampleTransform([key(0, 0.2)], 5).x).toBeCloseTo(0.2);
    expect(upsertTransformKey([key(0, 0.2)], key(0, 0.9))[0].transform.x).toBeCloseTo(0.9);
  });
});
