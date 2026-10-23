import { describe, expect, it } from "vitest";
import {
  applyLayerMotions,
  easingCurvePoints,
  EASING_FNS,
  IDENTITY_TRANSFORM,
  sampleCamera,
  sampleTransform,
  upsertCameraKey,
  upsertTransformKey,
  type TransformKey,
} from "../lib/timeline";
import { CAMERA_PRESETS, LAYER_PRESETS } from "../lib/motionPresets";

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

describe("easing — đầu/cuối chuẩn và đơn điệu cơ bản", () => {
  it("mọi easing đều đi từ 0 tới 1 (bounce/elastic/back cho phép vượt biên giữa chừng)", () => {
    for (const id of Object.keys(EASING_FNS) as Array<keyof typeof EASING_FNS>) {
      expect(EASING_FNS[id](0)).toBeCloseTo(0);
      expect(EASING_FNS[id](1)).toBeCloseTo(1);
    }
    expect(EASING_FNS["ease-in"](0.5)).toBeLessThan(0.5);
    expect(EASING_FNS["ease-out"](0.5)).toBeGreaterThan(0.5);
    expect(easingCurvePoints("bounce")).toHaveLength(26);
  });
});

describe("sampleTransform — nội suy keyframe", () => {
  it("giữ key đầu/cuối ngoài khoảng, tuyến tính ở giữa", () => {
    const keys = [key(1, 0.2), key(3, 0.8)];
    expect(sampleTransform(keys, 0).x).toBeCloseTo(0.2);
    expect(sampleTransform(keys, 5).x).toBeCloseTo(0.8);
    expect(sampleTransform(keys, 2).x).toBeCloseTo(0.5);
    expect(sampleTransform([], 1)).toEqual(IDENTITY_TRANSFORM);
  });

  it("easing của key TRƯỚC quyết định đoạn nội suy", () => {
    const keys = [key(0, 0, "ease-in"), key(2, 1)];
    // ease-in tại 0.5 → 0.125 thay vì 0.5
    expect(sampleTransform(keys, 1).x).toBeCloseTo(0.125);
  });

  it("upsert ghi đè key cùng thời điểm và giữ thứ tự", () => {
    const keys = upsertTransformKey([key(2, 0.5)], key(1, 0.1));
    expect(keys.map((k) => k.timeSec)).toEqual([1, 2]);
    const replaced = upsertTransformKey(keys, key(1, 0.9));
    expect(replaced).toHaveLength(2);
    expect(replaced[0].transform.x).toBeCloseTo(0.9);
  });
});

describe("sampleCamera + preset cú máy", () => {
  it("preset Ken Burns phóng vào: zoom tăng đơn điệu từ 1 tới 1.3", () => {
    const preset = CAMERA_PRESETS.find((p) => p.id === "ken-burns-in")!;
    const keys = preset.build(4);
    expect(sampleCamera(keys, 0).zoom).toBeCloseTo(1);
    expect(sampleCamera(keys, 4).zoom).toBeCloseTo(1.3);
    expect(sampleCamera(keys, 2).zoom).toBeGreaterThan(1);
    expect(sampleCamera(keys, 2).zoom).toBeLessThan(1.3);
  });

  it("mọi preset sinh key trong [0, duration] và upsert camera không trùng thời điểm", () => {
    for (const p of [...CAMERA_PRESETS, ...LAYER_PRESETS]) {
      const keys = p.build(3);
      for (const k of keys) {
        expect(k.timeSec).toBeGreaterThanOrEqual(0);
        expect(k.timeSec).toBeLessThanOrEqual(3);
      }
    }
    const one = upsertCameraKey([], {
      id: "a",
      timeSec: 1,
      camera: { x: 0.5, y: 0.5, zoom: 2 },
      easing: "linear",
    });
    const two = upsertCameraKey(one, {
      id: "b",
      timeSec: 1,
      camera: { x: 0.5, y: 0.5, zoom: 3 },
      easing: "linear",
    });
    expect(two).toHaveLength(1);
    expect(two[0].camera.zoom).toBe(3);
  });
});

describe("chuyển động tham số — deterministic và có biên", () => {
  it("cùng thời điểm luôn cho cùng kết quả; tắt cường độ = không đổi", () => {
    const motions = [
      { id: "m1", kind: "breath" as const, intensity: 0.8, speed: 0.5, phase: 0 },
    ];
    const a = applyLayerMotions(IDENTITY_TRANSFORM, motions, 1.3);
    const b = applyLayerMotions(IDENTITY_TRANSFORM, motions, 1.3);
    expect(a).toEqual(b);
    const off = applyLayerMotions(
      IDENTITY_TRANSFORM,
      [{ ...motions[0], intensity: 0 }],
      1.3,
    );
    expect(off.scale).toBeCloseTo(1);
    // breath biên độ tối đa ±2% scale
    expect(Math.abs(a.scale - 1)).toBeLessThanOrEqual(0.02);
  });

  it("pha khác nhau cho kết quả khác nhau (chống đồng loạt như robot)", () => {
    const base = { id: "m", kind: "sway" as const, intensity: 1, speed: 0.4 };
    const a = applyLayerMotions(IDENTITY_TRANSFORM, [{ ...base, phase: 0 }], 0.3);
    const b = applyLayerMotions(IDENTITY_TRANSFORM, [{ ...base, phase: 0.5 }], 0.3);
    expect(a.x).not.toBeCloseTo(b.x);
  });
});

import {
  buildDialogueTrack,
  dialogueLineAt,
  estimateLineDurationSec,
} from "../lib/dialogue";

describe("dialogue — ước lượng & dựng track thoại", () => {
  it("thời lượng đọc tỉ lệ độ dài câu, có sàn/trần", () => {
    expect(estimateLineDurationSec("Ừ.")).toBe(1.2);
    expect(estimateLineDurationSec("x".repeat(26))).toBeCloseTo(2);
    expect(estimateLineDurationSec("x".repeat(500))).toBe(8);
  });

  it("track liên tiếp có nghỉ giữa câu; gợi ý thời lượng cảnh chứa hết thoại", () => {
    const { lines, suggestedSceneDurationSec } = buildDialogueTrack([
      "Câu một.",
      "  ",
      "Câu hai dài hơn một chút.",
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[1].startSec).toBeGreaterThan(
      lines[0].startSec + lines[0].durationSec,
    );
    expect(suggestedSceneDurationSec).toBeGreaterThanOrEqual(
      lines[1].startSec + lines[1].durationSec,
    );
    expect(dialogueLineAt(lines, lines[0].startSec + 0.1)?.text).toBe("Câu một.");
    expect(dialogueLineAt(lines, 999)).toBeNull();
  });
});
