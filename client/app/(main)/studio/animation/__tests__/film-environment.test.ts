import { describe, expect, it } from "vitest";
import {
  cloudDriftX,
  cloudLayout,
  lightningIntensity,
  resolveFilmEnvironment,
  sunPositionForTime,
  waterLevelAt,
} from "../lib/filmEnvironment";
import {
  DEFAULT_ENVIRONMENT,
  type SceneEnvironment,
} from "../lib/sceneEnvironment";

describe("môi trường phim khớp trình dựng", () => {
  it("không có environment → giữ fallback cũ (backdrop + mặt đất phẳng)", () => {
    const r = resolveFilmEnvironment(undefined, "#112233");
    expect(r.hasEnv).toBe(false);
    expect(r.background).toBe("#112233");
    expect(r.fog).toBeNull();
    expect(r.waterLevel).toBe(-1);
    expect(r.weather).toBeNull();
    expect(r.hemiIntensity).toBe(0);
    expect(r.sunColor).toBe("#ffffff");
    expect(r.sunIntensity).toBe(1.6);
    expect(r.sunPosition).toEqual([5, 9, 4]);
  });

  it("nắng 10h → trời xanh, nắng đủ, không sương", () => {
    const env: SceneEnvironment = {
      ...DEFAULT_ENVIRONMENT,
      time: 10,
      weather: "clear",
    };
    const r = resolveFilmEnvironment(env, "#112233");
    expect(r.hasEnv).toBe(true);
    expect(r.background).toBe("#8ec3ee");
    expect(r.sunColor).toBe("#fff3d6");
    expect(r.sunIntensity).toBeCloseTo(0.6 + 0.9 * Math.sin(Math.PI / 3), 5);
    expect(r.hemiIntensity).toBeCloseTo(0.9, 5);
    expect(r.fog).toEqual({ near: 70, far: 130 });
    expect(r.weather).toBe("clear");
  });

  it("mưa dông → nắng chỉ còn ~22%, tầm nhìn giảm", () => {
    const env: SceneEnvironment = {
      ...DEFAULT_ENVIRONMENT,
      time: 14,
      weather: "rain",
    };
    const r = resolveFilmEnvironment(env, "#112233");
    expect(r.sunIntensity).toBeCloseTo(
      (0.6 + 0.9 * Math.sin(((14 - 6) / 12) * Math.PI)) * 0.22,
      5,
    );
    expect(r.fog).toEqual({ near: 40, far: 100 });
  });

  it("thanh sương kéo về sương dày", () => {
    const env: SceneEnvironment = {
      ...DEFAULT_ENVIRONMENT,
      weather: "clear",
      fogDensity: 1,
    };
    expect(resolveFilmEnvironment(env, "#000").fog).toEqual({
      near: 8,
      far: 28,
    });
  });

  it("vị trí nắng theo giờ, giống hệt trình dựng", () => {
    const [x, y, z] = sunPositionForTime(10);
    expect(x).toBeCloseTo(10, 5);
    expect(y).toBeCloseTo(Math.sin(Math.PI / 3) * 18 + 2, 5);
    expect(z).toBe(6);
    // Ban đêm: nắng thấp sát đất, không chìm dưới đất.
    const night = sunPositionForTime(0);
    expect(night[0]).toBeCloseTo(0, 5);
    expect(night[1]).toBe(1);
    expect(night[2]).toBe(6);
  });

  it("mây nắng thưa trắng, mây mưa kín xám", () => {
    const clear = cloudLayout("clear");
    expect(clear.clouds).toHaveLength(4);
    expect(clear.color).toBe("#ffffff");
    expect(clear.clouds[0]).toEqual({ x: -25, y: 12, z: -25 });
    expect(clear.clouds[1]).toEqual({ x: 12, y: 14, z: -22 });
    const rain = cloudLayout("rain");
    expect(rain.clouds).toHaveLength(10);
    expect(rain.color).toBe("#848b94");
  });

  it("mây trôi theo gió, nước dập dềnh, sét chỉ khi mưa", () => {
    expect(cloudDriftX(0, "clear")).toBe(-30);
    expect(cloudDriftX(10, "rain")).toBeCloseTo(13.2 - 30, 5);
    expect(waterLevelAt(0.1, 0)).toBe(0.1);
    expect(waterLevelAt(0.1, Math.PI / 1.6)).toBeCloseTo(0.13, 5);
    expect(lightningIntensity(0, "rain")).toBe(0);
    expect(lightningIntensity(123, "clear")).toBe(0);
    expect(lightningIntensity(123, "snow")).toBe(0);
    // Tìm một mốc sét thật rồi kiểm tra chớp sáng bật.
    let flashT = -1;
    for (let t = 0; t < 200; t += 0.01) {
      if (Math.sin(t * 13.7) * Math.sin(t * 7.3) > 0.996) {
        flashT = t;
        break;
      }
    }
    expect(flashT).toBeGreaterThanOrEqual(0);
    expect(lightningIntensity(flashT, "rain")).toBe(1.5);
  });
});
