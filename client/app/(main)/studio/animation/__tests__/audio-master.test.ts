import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUDIO_MASTER,
  bgmGainEnvelope,
  computeMasterGain,
  measurePeak,
  mergeDuckWindows,
  normalizeChannels,
} from "../lib/audioMaster";

describe("hạ nhạc dưới thoại", () => {
  it("gộp các khoảng thoại chồng lấp và nới mỗi đầu", () => {
    const merged = mergeDuckWindows(
      [
        { startSec: 5, endSec: 7 },
        { startSec: 6.5, endSec: 9 },
        { startSec: 12, endSec: 13 },
      ],
      0.1,
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].startSec).toBeCloseTo(4.9);
    expect(merged[0].endSec).toBeCloseTo(9.1);
  });

  it("đường cong nhạc: ngoài thoại giữ nguyên, giữa thoại hạ đúng mức, cuối phim tắt dần", () => {
    const env = bgmGainEnvelope(
      [{ startSec: 5, endSec: 7 }],
      20,
      0.35,
      DEFAULT_AUDIO_MASTER,
    );
    const at = (t: number) => {
      let v = env[0][1];
      for (let i = 0; i < env.length - 1; i++) {
        const [t0, v0] = env[i];
        const [t1, v1] = env[i + 1];
        if (t >= t0 && t <= t1) {
          const k = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
          v = v0 + (v1 - v0) * k;
        }
      }
      if (t >= env[env.length - 1][0]) v = env[env.length - 1][1];
      return v;
    };
    expect(at(2)).toBeCloseTo(0.35);
    expect(at(6)).toBeCloseTo(0.35 * DEFAULT_AUDIO_MASTER.duckLevel);
    expect(at(20)).toBeLessThan(0.001);
    // Đoạn hạ phải dốc lên lại sau thoại, không dính mức thấp tới cuối.
    expect(at(10)).toBeCloseTo(0.35);
  });
});

describe("cân âm lượng tổng", () => {
  it("đo đỉnh và tính hệ số khuếch đại về mức chuẩn", () => {
    expect(measurePeak([new Float32Array([0.5, -0.5, 0.25])])).toBe(0.5);
    expect(
      computeMasterGain(0.5, DEFAULT_AUDIO_MASTER),
    ).toBeCloseTo(0.89 / 0.5);
    expect(computeMasterGain(0, DEFAULT_AUDIO_MASTER)).toBe(1);
    expect(computeMasterGain(0.1, DEFAULT_AUDIO_MASTER)).toBe(
      DEFAULT_AUDIO_MASTER.maxGain,
    );
  });

  it("chuẩn hoá mẫu: đỉnh về mức chuẩn, mẫu vỡ bị kẹp, im lặng giữ nguyên", () => {
    const ch = [new Float32Array([0.5, -0.25, 0.5])];
    const gain = normalizeChannels(ch, DEFAULT_AUDIO_MASTER);
    expect(gain).toBeCloseTo(0.89 / 0.5);
    expect(Math.max(...Array.from(ch[0]).map(Math.abs))).toBeCloseTo(0.89);
    const loud = [new Float32Array([2, -2])];
    normalizeChannels(loud, DEFAULT_AUDIO_MASTER);
    expect(Math.max(...Array.from(loud[0]).map(Math.abs))).toBeLessThanOrEqual(0.99);
    const silent = [new Float32Array([0, 0])];
    expect(normalizeChannels(silent, DEFAULT_AUDIO_MASTER)).toBe(1);
  });
});
