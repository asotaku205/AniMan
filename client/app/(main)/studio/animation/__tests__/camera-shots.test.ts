import { describe, expect, it } from "vitest";
import { buildShotKeys } from "../lib/cameraShots";
import { sampleFocus, type FocusKey } from "../lib/previz";

const FROM = {
  fromPosition: { x: 0, y: 1.6, z: 6 },
  fromTarget: { x: 0, y: 1.1, z: 0 },
};

describe("cú máy mẫu", () => {
  it("dolly-in: tiến lại gần điểm nhìn, điểm nhìn không đổi", () => {
    const { keys } = buildShotKeys("dolly-in", {
      startTimeSec: 2,
      durationSec: 3,
      ...FROM,
    });
    expect(keys).toHaveLength(2);
    expect(keys[0].timeSec).toBe(2);
    expect(keys[1].timeSec).toBe(5);
    const d0 = Math.hypot(0 - 0, 1.6 - 1.1, 6 - 0);
    const d1 = Math.hypot(
      keys[1].position.x - 0,
      keys[1].position.y - 1.1,
      keys[1].position.z - 0,
    );
    expect(d1).toBeLessThan(d0);
    expect(keys[1].target).toEqual(FROM.fromTarget);
  });

  it("dolly-out: lùi xa điểm nhìn", () => {
    const { keys } = buildShotKeys("dolly-out", {
      startTimeSec: 0,
      durationSec: 2,
      ...FROM,
    });
    const d0 = Math.hypot(6, 0.5);
    const d1 = Math.hypot(keys[1].position.z, keys[1].position.y - 1.1);
    expect(d1).toBeGreaterThan(d0);
  });

  it("crane-up: chỉ nâng cao độ, không dời ngang", () => {
    const { keys } = buildShotKeys("crane-up", {
      startTimeSec: 0,
      durationSec: 2,
      ...FROM,
      height: 2,
    });
    expect(keys[1].position.x).toBe(0);
    expect(keys[1].position.z).toBe(6);
    expect(keys[1].position.y).toBeCloseTo(3.6);
  });

  it("orbit: các key nằm trên một vòng tròn quanh mục tiêu", () => {
    const target = { x: 1, y: 1, z: -1 };
    const { keys } = buildShotKeys("orbit", {
      startTimeSec: 0,
      durationSec: 4,
      ...FROM,
      targetPosition: target,
      angleDeg: 90,
    });
    expect(keys.length).toBeGreaterThanOrEqual(3);
    const radii = keys.map((k) =>
      Math.hypot(k.position.x - target.x, k.position.z - target.z),
    );
    for (const r of radii) expect(r).toBeCloseTo(radii[0], 6);
    for (const k of keys) expect(k.target).toEqual(target);
  });

  it("tracking: camera bám theo đường đi của vật, giữ nguyên độ lệch", () => {
    const path = [
      { timeSec: 0, position: { x: -2, y: 0, z: 0 } },
      { timeSec: 2, position: { x: 0, y: 0, z: 0 } },
      { timeSec: 4, position: { x: 2, y: 0, z: 0 } },
    ];
    const { keys } = buildShotKeys("tracking", {
      startTimeSec: 0,
      durationSec: 4,
      fromPosition: { x: -2, y: 1.6, z: 4 },
      fromTarget: { x: -2, y: 1, z: 0 },
      pathSamples: path,
    });
    expect(keys).toHaveLength(3);
    expect(keys[2].position.x).toBeCloseTo(2);
    expect(keys[2].position.z).toBeCloseTo(4);
    expect(keys[2].target).toEqual({ x: 2, y: 0, z: 0 });
  });

  it("rung tay: cùng seed ra cùng key, khác seed ra khác key, độ rung có giới hạn", () => {
    const base = { startTimeSec: 0, durationSec: 2, ...FROM, seed: 7 };
    // ID key tăng theo lần gọi nên so sánh bỏ ID.
    const strip = (ks: ReturnType<typeof buildShotKeys>["keys"]) =>
      ks.map(({ id: _id, ...rest }) => rest);
    const a = buildShotKeys("handheld", base).keys;
    const b = buildShotKeys("handheld", base).keys;
    const c = buildShotKeys("handheld", { ...base, seed: 8 }).keys;
    expect(strip(a)).toEqual(strip(b));
    expect(strip(a)).not.toEqual(strip(c));
    for (const k of a) {
      expect(Math.abs(k.position.x - FROM.fromPosition.x)).toBeLessThanOrEqual(0.08);
      expect(Math.abs(k.position.y - FROM.fromPosition.y)).toBeLessThanOrEqual(0.08);
    }
  });

  it("focus pull: nội suy điểm nét theo thời gian, kẹp hai đầu", () => {
    const { keys, focusKeys } = buildShotKeys("focus-pull", {
      startTimeSec: 1,
      durationSec: 2,
      ...FROM,
      focusFrom: 3,
      focusTo: 9,
    });
    expect(keys).toHaveLength(2);
    expect(focusKeys).toHaveLength(2);
    expect(sampleFocus(focusKeys, 0)).toBe(3);
    expect(sampleFocus(focusKeys, 2)).toBe(6);
    expect(sampleFocus(focusKeys, 99)).toBe(9);
    const empty: FocusKey[] = [];
    expect(sampleFocus(empty, 1)).toBeNull();
  });
});
