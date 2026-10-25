import { describe, expect, it } from "vitest";
import { autoFitRig } from "../lib/rig";
import {
  autoFitRigPro,
  RIG_PRO_BONE_NAMES,
} from "../lib/rigPro";
import { solveTwoBoneIK } from "../lib/ik";
import {
  applyBrushStroke,
  normalizeWeights,
} from "../lib/weightPaint";
import {
  legLengthScale,
  quatApplyToVec,
  quatToEulerRadXYZ,
  retargetPose,
  restDirection,
} from "../lib/retarget";
import { eulerRadToQuat } from "../lib/poseTrack";
import { mirrorPose } from "../lib/poseLibrary";
import type { RigJoint } from "../lib/rig";

const close = (a: number, b: number, digits = 5) =>
  expect(a).toBeCloseTo(b, digits);
const closeVec = (
  a: readonly number[],
  b: readonly number[],
  digits = 5,
) => a.forEach((v, i) => close(v, b[i], digits));

describe("Rig Pro: xương mở rộng", () => {
  it("52 xương: 20 lõi giữ nguyên thứ tự + ngón tay + ngón chân, cha trước con", () => {
    const pro = autoFitRigPro(1.7);
    const core = autoFitRig(1.7);
    expect(pro).toHaveLength(52);
    expect(pro.slice(0, 20)).toEqual(core);
    expect(pro.map((j) => j.name)).toEqual([...RIG_PRO_BONE_NAMES]);
    const index = new Map(pro.map((j, i) => [j.name, i]));
    for (const j of pro) {
      if (j.parent) expect(index.get(j.parent)!).toBeLessThan(index.get(j.name)!);
    }
    expect(new Set(pro.map((j) => j.name)).size).toBe(52);
  });

  it("ngón tay trái vươn ra +X từ bàn tay, phải vươn ra −X; ngón chân hướng +Z", () => {
    const pro = autoFitRigPro(1.7);
    const by = new Map(pro.map((j) => [j.name, j]));
    const lh = by.get("LeftHand")!.pos;
    const rh = by.get("RightHand")!.pos;
    expect(by.get("LeftHandMiddle3")!.pos[0]).toBeGreaterThan(lh[0]);
    expect(by.get("RightHandMiddle3")!.pos[0]).toBeLessThan(rh[0]);
    // Ngón dài dần từ gốc tới đầu, cùng một đường thẳng.
    expect(by.get("LeftHandMiddle2")!.pos[0]).toBeGreaterThan(
      by.get("LeftHandMiddle1")!.pos[0],
    );
    expect(by.get("LeftToeBase")!.pos[2]).toBeGreaterThan(
      by.get("LeftFoot")!.pos[2],
    );
    expect(by.get("RightToeBase")!.pos[2]).toBeGreaterThan(
      by.get("RightFoot")!.pos[2],
    );
  });

  it("tự căn theo chiều cao: model cao gấp đôi thì ngón dài gấp đôi", () => {
    const small = new Map(autoFitRigPro(1.0).map((j) => [j.name, j]));
    const big = new Map(autoFitRigPro(2.0).map((j) => [j.name, j]));
    const dSmall =
      small.get("LeftHandMiddle3")!.pos[0] - small.get("LeftHand")!.pos[0];
    const dBig =
      big.get("LeftHandMiddle3")!.pos[0] - big.get("LeftHand")!.pos[0];
    close(dBig / dSmall, 2, 5);
  });
});

describe("Rig Pro: IK hai khớp", () => {
  const root: [number, number, number] = [0, 1, 0];
  const mid: [number, number, number] = [0.3, 1, 0];
  const end: [number, number, number] = [0.6, 1, 0];
  const pole: [number, number, number] = [0.3, 1, -0.5];

  it("target với tới được thì khớp cuối chạm đúng target, độ dài đoạn giữ nguyên", () => {
    const target: [number, number, number] = [0.2, 1.3, 0.2];
    const sol = solveTwoBoneIK(root, mid, end, target, pole);
    closeVec(sol.end, target);
    close(Math.hypot(...sol.mid.map((v, i) => v - root[i])), 0.3);
    close(
      Math.hypot(...sol.end.map((v, i) => v - sol.mid[i])),
      0.3,
    );
  });

  it("target ngoài tầm với thì duỗi thẳng về phía target", () => {
    const target: [number, number, number] = [2, 1, 0];
    const sol = solveTwoBoneIK(root, mid, end, target, pole);
    closeVec(sol.end, [0.6, 1, 0]);
    closeVec(sol.mid, [0.3, 1, 0]);
  });

  it("pole bẻ khuỷu đúng phía: khớp giữa lệch về phía pole", () => {
    const target: [number, number, number] = [0.2, 1.3, 0.2];
    const sol = solveTwoBoneIK(root, mid, end, target, pole);
    // Khớp giữa phải có thành phần −Z (về phía pole, pole ở −Z).
    expect(sol.mid[2]).toBeLessThan(0);
  });

  it("target quá gần gốc thì gập hết cỡ, khớp cuối ở |L1−L2|", () => {
    const target: [number, number, number] = [0.01, 1, 0];
    const sol = solveTwoBoneIK(root, mid, end, target, pole);
    close(Math.hypot(...sol.end.map((v, i) => v - root[i])), 0.01, 4);
  });
});

describe("Rig Pro: cọ tô trọng số", () => {
  // 3 đỉnh trên trục X, xương đích là index 0.
  const positions = [0, 0, 0, 0.05, 0, 0, 1, 0, 0];
  const skinIndex = [
    [0, 1, 2, 3],
    [1, 0, 2, 3],
    [1, 2, 3, 4],
  ];
  const skinWeight = [
    [0.4, 0.3, 0.2, 0.1],
    [0.3, 0.2, 0.3, 0.2],
    [0.4, 0.3, 0.2, 0.1],
  ];

  it("cộng: đỉnh trúng cọ tăng trọng số xương đích, tổng vẫn = 1", () => {
    const out = applyBrushStroke({
      positions,
      skinIndex,
      skinWeight,
      boneIndex: 0,
      hit: [0, 0, 0],
      radius: 0.1,
      strength: 0.5,
      mode: "add",
    });
    expect(out.skinWeight[0][0]).toBeGreaterThan(0.4);
    out.skinWeight[2].forEach((w, i) => close(w, [0.4, 0.3, 0.2, 0.1][i])); // Ngoài cọ: không đổi.
    for (const row of out.skinWeight) {
      close(
        row.reduce((a, b) => a + b, 0),
        1,
        5,
      );
    }
  });

  it("trừ: đỉnh trúng cọ giảm trọng số xương đích", () => {
    const out = applyBrushStroke({
      positions,
      skinIndex,
      skinWeight,
      boneIndex: 0,
      hit: [0, 0, 0],
      radius: 0.1,
      strength: 0.5,
      mode: "subtract",
    });
    expect(out.skinWeight[0][0]).toBeLessThan(0.4);
  });

  it("xương chưa có trong đỉnh thì chiếm slot nhẹ nhất", () => {
    const out = applyBrushStroke({
      positions,
      skinIndex,
      skinWeight,
      boneIndex: 9,
      hit: [1, 0, 0],
      radius: 0.1,
      strength: 1,
      mode: "add",
    });
    expect(out.skinIndex[2]).toContain(9);
    close(
      out.skinWeight[2].reduce((a, b) => a + b, 0),
      1,
      5,
    );
  });

  it("làm mịn kéo trọng số về phía trung bình vùng cọ", () => {
    const out = applyBrushStroke({
      positions,
      skinIndex,
      skinWeight,
      boneIndex: 0,
      hit: [0.025, 0, 0],
      radius: 0.1,
      strength: 1,
      mode: "smooth",
    });
    // Trung bình vùng cọ của xương 0 là (0.4 + 0.2) / 2 = 0.3: đỉnh cao
    // giảm xuống, đỉnh thấp tăng lên, tổng mỗi hàng vẫn = 1.
    expect(out.skinWeight[0][0]).toBeLessThan(0.4);
    expect(out.skinWeight[1][1]).toBeGreaterThan(0.2);
    for (const row of out.skinWeight) {
      close(
        row.reduce((a, b) => a + b, 0),
        1,
        5,
      );
    }
  });

  it("chuẩn hoá: hàng tổng 0 thì không NaN", () => {
    const out = normalizeWeights([[0, 0, 0, 0]]);
    close(
      out[0].reduce((a, b) => a + b, 0),
      1,
      5,
    );
  });
});

describe("Rig Pro: gắn chuyển động sang người khác (retarget)", () => {
  const src: RigJoint[] = [
    { name: "Hips", parent: null, pos: [0, 1.0, 0] },
    { name: "LeftUpLeg", parent: "Hips", pos: [0.1, 1.0, 0] },
    { name: "LeftLeg", parent: "LeftUpLeg", pos: [0.1, 0.5, 0] },
    { name: "LeftFoot", parent: "LeftLeg", pos: [0.1, 0.1, 0] },
    { name: "LeftArm", parent: "Hips", pos: [0.3, 1.4, 0] },
    { name: "LeftForeArm", parent: "LeftArm", pos: [0.6, 1.4, 0] },
    { name: "LeftHand", parent: "LeftForeArm", pos: [0.9, 1.4, 0] },
  ];
  // Đích: tay xuôi xuống (hướng −Y) thay vì dang ngang (+X), chân dài hơn.
  const tgt: RigJoint[] = [
    { name: "Hips", parent: null, pos: [0, 1.2, 0] },
    { name: "LeftUpLeg", parent: "Hips", pos: [0.12, 1.2, 0] },
    { name: "LeftLeg", parent: "LeftUpLeg", pos: [0.12, 0.6, 0] },
    { name: "LeftFoot", parent: "LeftLeg", pos: [0.12, 0.12, 0] },
    { name: "LeftArm", parent: "Hips", pos: [0.36, 1.68, 0] },
    { name: "LeftForeArm", parent: "LeftArm", pos: [0.36, 1.28, 0] },
    { name: "LeftHand", parent: "LeftForeArm", pos: [0.36, 0.88, 0] },
  ];

  it("cùng tư thế gốc thì copy y nguyên", () => {
    const pose = { LeftArm: [0.5, 0, 0] as [number, number, number] };
    const out = retargetPose(src, src, pose);
    closeVec(out.LeftArm, [0.5, 0, 0]);
  });

  it("hướng thế giới của xương sau retarget khớp với nguồn", () => {
    // Nguồn giơ tay lên 90° quanh Z: hướng tay từ +X thành +Y.
    const pose = { LeftArm: [0, 0, Math.PI / 2] as [number, number, number] };
    const out = retargetPose(src, tgt, pose);
    const dirS = restDirection(src, "LeftArm"); // +X
    const dirT = restDirection(tgt, "LeftArm"); // −Y
    expect(dirS).toEqual([1, 0, 0]);
    expect(dirT).toEqual([0, -1, 0]);
    const worldSrc = quatApplyToVec(eulerRadToQuat(pose.LeftArm), dirS);
    const worldTgt = quatApplyToVec(eulerRadToQuat(out.LeftArm), dirT);
    closeVec(worldTgt, worldSrc, 4);
  });

  it("Euler <-> quaternion round-trip", () => {
    const e: [number, number, number] = [0.3, -0.5, 0.8];
    const back = quatToEulerRadXYZ(eulerRadToQuat(e));
    closeVec(back, e, 5);
  });

  it("xương không có ở đích thì bị bỏ, tỉ lệ chân tính đúng", () => {
    const pose = {
      LeftArm: [0.5, 0, 0] as [number, number, number],
      NoSuchBone: [1, 1, 1] as [number, number, number],
    };
    const out = retargetPose(src, tgt, pose);
    expect(out.NoSuchBone).toBeUndefined();
    close(legLengthScale(src, tgt), 1.2, 5);
  });
});

describe("Rig Pro: thư viện dáng", () => {
  it("lật trái/phải đổi bên và đảo dấu Y/Z, lật 2 lần về như cũ", () => {
    const pose = {
      Hips: [0.1, 0.2, 0.3] as [number, number, number],
      LeftArm: [0.5, 0.4, 0.3] as [number, number, number],
      LeftHandIndex1: [0.1, 0.2, 0.3] as [number, number, number],
    };
    const m = mirrorPose(pose);
    closeVec(m.RightArm, [0.5, -0.4, -0.3]);
    closeVec(m.RightHandIndex1, [0.1, -0.2, -0.3]);
    closeVec(m.Hips, [0.1, -0.2, -0.3]);
    expect(m.LeftArm).toBeUndefined();
    const back = mirrorPose(m);
    closeVec(back.LeftArm, [0.5, 0.4, 0.3]);
    closeVec(back.Hips, [0.1, 0.2, 0.3]);
  });
});
