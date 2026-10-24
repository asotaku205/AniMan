import { describe, expect, it } from "vitest";
import {
  autoFitRig,
  boneSegment,
  computeSkinWeights,
  RIG_BONE_NAMES,
  TEST_POSES,
} from "../lib/rig";

describe("Phòng Rig: xương mẫu", () => {
  it("đủ 20 xương, cha đứng trước con, tên không trùng", () => {
    const joints = autoFitRig(1.7);
    expect(joints).toHaveLength(20);
    expect(joints.map((j) => j.name)).toEqual([...RIG_BONE_NAMES]);
    const index = new Map(joints.map((j, i) => [j.name, i]));
    for (const j of joints) {
      if (j.parent) expect(index.get(j.parent)!).toBeLessThan(index.get(j.name)!);
    }
  });

  it("tự căn theo chiều cao: hông ~0.52H, tay trái ở +X, tay phải ở −X", () => {
    const joints = autoFitRig(1.7);
    const by = new Map(joints.map((j) => [j.name, j]));
    expect(by.get("Hips")!.pos[1]).toBeCloseTo(0.884, 5);
    expect(by.get("Head")!.pos[1]).toBeGreaterThan(by.get("Hips")!.pos[1]);
    expect(by.get("LeftArm")!.pos[0]).toBeGreaterThan(0);
    expect(by.get("RightArm")!.pos[0]).toBeLessThan(0);
    expect(by.get("LeftFoot")!.pos[1]).toBeLessThan(by.get("LeftLeg")!.pos[1]);
  });

  it("đoạn xương: gốc là 1 điểm, tay là đoạn vai → khuỷu", () => {
    const joints = autoFitRig(1.7);
    const hips = boneSegment(joints, "Hips");
    expect(hips.a).toEqual(hips.b);
    const arm = boneSegment(joints, "LeftArm");
    const by = new Map(joints.map((j) => [j.name, j]));
    expect(arm.a).toEqual(by.get("LeftShoulder")!.pos);
    expect(arm.b).toEqual(by.get("LeftArm")!.pos);
  });
});

describe("Phòng Rig: trọng số da", () => {
  it("đỉnh ở khớp khuỷu thì xương tay ảnh hưởng mạnh nhất, tổng trọng số = 1", () => {
    const joints = autoFitRig(1.7);
    const by = new Map(joints.map((j) => [j.name, j]));
    const elbow = by.get("LeftArm")!.pos;
    const { skinIndex, skinWeight } = computeSkinWeights(
      [elbow[0], elbow[1], elbow[2]],
      joints,
    );
    const topBone = RIG_BONE_NAMES[skinIndex[0][0]];
    expect(topBone).toBe("LeftArm");
    const sum = skinWeight[0].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(skinIndex[0].length).toBeLessThanOrEqual(4);
  });

  it("đỉnh giữa 2 xương thì chia ảnh hưởng, không dồn hết 1 xương", () => {
    const joints = autoFitRig(1.7);
    const by = new Map(joints.map((j) => [j.name, j]));
    const shoulder = by.get("LeftShoulder")!.pos;
    const elbow = by.get("LeftArm")!.pos;
    const mid = [
      (shoulder[0] + elbow[0]) / 2,
      (shoulder[1] + elbow[1]) / 2,
      (shoulder[2] + elbow[2]) / 2,
    ];
    const { skinWeight } = computeSkinWeights(mid, joints);
    expect(skinWeight[0][0]).toBeLessThan(0.95);
    expect(skinWeight[0].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });
});

describe("Phòng Rig: pose thử", () => {
  it("có đủ pose bind/vẫy/giơ/ngồi, ngồi gập cả 2 chân", () => {
    expect(Object.keys(TEST_POSES)).toEqual(["bind", "wave", "armsUp", "sit"]);
    expect(TEST_POSES.sit.pose.LeftUpLeg).toBeDefined();
    expect(TEST_POSES.sit.pose.RightUpLeg).toBeDefined();
    expect(TEST_POSES.bind.pose).toEqual({});
  });
});
