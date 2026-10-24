import { describe, expect, it } from "vitest";
import {
  createPoseKey,
  eulerDegToQuat,
  expandPoseTemplate,
  quatToEulerDeg,
  samplePoseKeys,
  slerpQuat,
} from "../lib/poseTrack";

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

describe("Dáng mốc", () => {
  it("euler ↔ quaternion đi về đúng (trừ gimbal cực đoan)", () => {
    for (const e of [
      [0, 0, 0],
      [30, 0, 0],
      [0, 45, 0],
      [0, 0, 90],
      [20, 30, 40],
      [-15, 60, -25],
    ] as Array<[number, number, number]>) {
      const back = quatToEulerDeg(eulerDegToQuat(e));
      expect(back[0]).toBeCloseTo(e[0], 4);
      expect(back[1]).toBeCloseTo(e[1], 4);
      expect(back[2]).toBeCloseTo(e[2], 4);
    }
  });

  it("giữa 2 mốc thì slerp đúng nửa đường", () => {
    const q90 = eulerDegToQuat([0, 0, 90]);
    const mid = slerpQuat(IDENTITY, q90, 0.5);
    const deg = quatToEulerDeg(mid);
    expect(deg[2]).toBeCloseTo(45, 4);
  });

  it("ngoài khoảng mốc thì giữ dáng đầu/cuối", () => {
    const a = createPoseKey(1, { Hips: IDENTITY });
    const b = createPoseKey(3, { Hips: eulerDegToQuat([0, 0, 90]) });
    expect(samplePoseKeys([a, b], 0)?.Hips).toEqual(IDENTITY);
    expect(samplePoseKeys([a, b], 5)?.Hips).toEqual(eulerDegToQuat([0, 0, 90]));
    const mid = samplePoseKeys([a, b], 2)?.Hips;
    expect(mid).toBeDefined();
    expect(quatToEulerDeg(mid!)[2]).toBeCloseTo(45, 4);
  });

  it("không có mốc thì trả null", () => {
    expect(samplePoseKeys([], 1)).toBeNull();
    expect(samplePoseKeys(undefined, 1)).toBeNull();
  });

  it("mở rộng dáng mẫu: xương có trong mẫu xoay theo mẫu, còn lại giữ gốc", () => {
    const bind = { Hips: IDENTITY, LeftArm: IDENTITY, RightArm: IDENTITY };
    const out = expandPoseTemplate({ LeftArm: [0, 0, 0.9] }, bind);
    expect(quatToEulerDeg(out.LeftArm)[2]).toBeCloseTo(51.57, 1);
    expect(out.Hips).toEqual(IDENTITY);
    expect(out.RightArm).toEqual(IDENTITY);
  });
});
