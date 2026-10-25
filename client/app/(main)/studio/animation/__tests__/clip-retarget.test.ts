/**
 * Test khớp clip từ file khác sang nhân vật (clip retarget, Phase 4).
 * Dùng chung skeleton mẫu của test retarget cũ (rig-pro.test.ts).
 */

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  bakeClipForTarget,
  bindToRigJoints,
  boneRetargetDeltas,
  decideClipFit,
  mixerBindToRigJoints,
  normalizeBoneName,
} from "../lib/clipRetarget";
import {
  legLengthScale,
  quatApplyToVec,
  quatMultiply,
  retargetPose,
  type Quat,
} from "../lib/retarget";
import type { RigJoint } from "../lib/rig";
import { eulerRadToQuat, quatToEulerDeg } from "../lib/poseTrack";

function close(a: number, b: number, digits = 5) {
  expect(a).toBeCloseTo(b, digits);
}

/** So sánh quaternion, chấp nhận đổi dấu (q và -q là cùng một xoay). */
function closeQuat(a: ArrayLike<number>, b: Quat, digits = 5) {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = dot < 0 ? -1 : 1;
  for (let i = 0; i < 4; i++) close(a[i], s * b[i], digits);
}

function quatToEulerRad(q: Quat): [number, number, number] {
  const [x, y, z] = quatToEulerDeg(q);
  const d2r = Math.PI / 180;
  return [x * d2r, y * d2r, z * d2r];
}

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

describe("clip retarget: xoay bù cố định tương đương retargetPose", () => {
  it("q * R0 cho cùng kết quả với retargetPose trên nhiều xoay mẫu", () => {
    const deltas = boneRetargetDeltas(src, tgt);
    const samples: Array<[number, number, number]> = [
      [0, 0, 0],
      [0.5, 0, 0],
      [0, 0, Math.PI / 2],
      [0, -0.7, 0],
      [0.3, -0.5, 0.8],
    ];
    for (const e of samples) {
      const q = eulerRadToQuat(e);
      const viaPose = eulerRadToQuat(retargetPose(src, tgt, { LeftArm: e }).LeftArm);
      const viaDelta = quatMultiply(q, deltas.get("LeftArm")!);
      closeQuat(viaDelta, viaPose, 4);
    }
  });

  it("cùng tư thế gốc thì delta là đơn vị", () => {
    const deltas = boneRetargetDeltas(src, src);
    closeQuat(deltas.get("LeftArm")!, [0, 0, 0, 1]);
  });

  it("hướng thế giới sau khi áp delta khớp với nguồn", () => {
    const deltas = boneRetargetDeltas(src, tgt);
    const q = eulerRadToQuat([0, 0, Math.PI / 2]);
    const out = quatMultiply(q, deltas.get("LeftArm")!);
    // Nguồn giơ tay +X thành +Y; đích tay −Y cũng phải thành +Y.
    const world = quatApplyToVec(out, [0, -1, 0]);
    close(world[0], 0, 4);
    close(world[1], 1, 4);
    close(world[2], 0, 4);
  });
});

describe("clip retarget: decideClipFit", () => {
  it("cùng skeleton thì dùng trực tiếp, không thiếu xương", () => {
    expect(decideClipFit(src, src, ["Hips", "LeftArm"])).toEqual({
      retarget: false,
      missingBones: [],
    });
  });

  it("hướng xương gốc khác thì phải bake", () => {
    expect(decideClipFit(src, tgt, ["LeftArm"]).retarget).toBe(true);
  });

  it("chỉ dài chân khác cũng phải bake (để scale vị trí hông)", () => {
    const longer = src.map((j) =>
      j.name === "LeftFoot" ? { ...j, pos: [0.1, -0.1, 0] as [number, number, number] } : j,
    );
    // Hướng xương không đổi (chân vẫn thẳng −Y) nhưng chân dài hơn.
    expect(decideClipFit(src, longer, ["Hips"]).retarget).toBe(true);
    close(legLengthScale(src, longer), 1.2, 5);
  });

  it("liệt kê xương thiếu, không tính xương thiếu vào quyết định hướng", () => {
    const fit = decideClipFit(src, src, ["LeftArm", "NoSuchBone"]);
    expect(fit.missingBones).toEqual(["NoSuchBone"]);
    expect(fit.retarget).toBe(false);
  });
});

describe("clip retarget: bindToRigJoints", () => {
  it("tính đúng vị trí gốc qua cha đã xoay", () => {
    const rotZ90: Quat = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
    const joints = bindToRigJoints([
      { name: "Hips", parentName: null, position: [0, 1, 0], quaternion: [0, 0, 0, 1] },
      { name: "LeftArm", parentName: "Hips", position: [0.3, 0.4, 0], quaternion: rotZ90 },
      // Con nằm +X cục bộ của cha đã xoay 90° quanh Z -> +Y thế giới.
      { name: "LeftForeArm", parentName: "LeftArm", position: [0.3, 0, 0], quaternion: [0, 0, 0, 1] },
    ]);
    const fore = joints.find((j) => j.name === "LeftForeArm")!;
    close(fore.pos[0], 0.3, 5);
    close(fore.pos[1], 1.7, 5);
    close(fore.pos[2], 0, 5);
  });

  it("cha đứng sau con vẫn giải được, cha lạ coi như gốc", () => {
    const joints = bindToRigJoints([
      { name: "Child", parentName: "Root", position: [1, 0, 0], quaternion: [0, 0, 0, 1] },
      { name: "Root", parentName: null, position: [0, 2, 0], quaternion: [0, 0, 0, 1] },
      { name: "Orphan", parentName: "Ghost", position: [5, 5, 5], quaternion: [0, 0, 0, 1] },
    ]);
    expect(joints.find((j) => j.name === "Child")!.pos).toEqual([1, 2, 0]);
    expect(joints.find((j) => j.name === "Orphan")!.parent).toBeNull();
  });

  it("mixerBindToRigJoints đọc đúng từ bind của mixer (xương three thật)", () => {
    const hips = new THREE.Bone();
    hips.name = "Hips";
    hips.position.set(0, 1, 0);
    const arm = new THREE.Bone();
    arm.name = "LeftArm";
    arm.position.set(0.3, 0.4, 0);
    hips.add(arm);
    const bind = new Map<THREE.Bone, { position: THREE.Vector3; quaternion: THREE.Quaternion }>([
      [hips, { position: hips.position.clone(), quaternion: hips.quaternion.clone() }],
      [arm, { position: arm.position.clone(), quaternion: arm.quaternion.clone() }],
    ]);
    const joints = mixerBindToRigJoints({ bind });
    expect(joints.find((j) => j.name === "LeftArm")).toEqual({
      name: "LeftArm",
      parent: "Hips",
      pos: [0.3, 1.4, 0],
    });
  });
});

describe("clip retarget: bakeClipForTarget", () => {
  function makeClip() {
    const q0 = eulerRadToQuat([0, 0, 0]);
    const q1 = eulerRadToQuat([0, 0, Math.PI / 2]);
    return new THREE.AnimationClip("walk", 2, [
      new THREE.QuaternionKeyframeTrack("LeftArm.quaternion", [0, 1], [...q0, ...q1]),
      new THREE.VectorKeyframeTrack("Hips.position", [0, 1], [0, 1, 0, 0, 1.2, 0]),
      new THREE.QuaternionKeyframeTrack("NoSuchBone.quaternion", [0], [0, 0, 0, 1]),
      new THREE.NumberKeyframeTrack("Mesh.morphTargetInfluences[0]", [0, 1], [0, 1]),
    ]);
  }

  it("cùng skeleton, không thiếu xương, không tiền tố -> dùng nguyên clip gốc", () => {
    const clip = new THREE.AnimationClip("idle", 1, [
      new THREE.QuaternionKeyframeTrack("LeftArm.quaternion", [0], [0, 0, 0, 1]),
    ]);
    const out = bakeClipForTarget(clip, src, src)!;
    expect(out.status).toBe("direct");
    expect(out.clip).toBe(clip);
    expect(out.missingBones).toEqual([]);
  });

  it("khác tỉ lệ -> bake: xoay khớp retargetPose, hông scale theo chân, xương thiếu bị bỏ", () => {
    const out = bakeClipForTarget(makeClip(), src, tgt)!;
    expect(out.status).toBe("retargeted");
    expect(out.clip.name).toBe("walk (đã khớp)");
    expect(out.missingBones).toEqual(["NoSuchBone"]);
    const names = out.clip.tracks.map((t) => t.name);
    expect(names).not.toContain("NoSuchBone.quaternion");
    expect(names).toContain("Mesh.morphTargetInfluences[0]");
    // Xoay keyframe 2 khớp với retargetPose của cùng dáng.
    const armTrack = out.clip.tracks.find((t) => t.name === "LeftArm.quaternion")!;
    const expected = eulerRadToQuat(
      retargetPose(src, tgt, { LeftArm: [0, 0, Math.PI / 2] }).LeftArm,
    );
    closeQuat(Array.from(armTrack.values).slice(4, 8), expected, 4);
    // Vị trí hông nhân 1.2.
    const hipsTrack = out.clip.tracks.find((t) => t.name === "Hips.position")!;
    const hv = Array.from(hipsTrack.values);
    expect(hv.length).toBe(6);
    [0, 1.2, 0, 0, 1.44, 0].forEach((v, i) => close(hv[i], v, 5));
    // Clip gốc không bị sửa.
    const origArm = makeClip().tracks.find((t) => t.name === "LeftArm.quaternion")!;
    closeQuat(
      Array.from(origArm.values).slice(4, 8),
      eulerRadToQuat([0, 0, Math.PI / 2]),
      4,
    );
  });

  it("tiền tố mixamorig được chuẩn hoá tên track, không đổi giá trị khi cùng rests", () => {
    const clip = new THREE.AnimationClip("wave", 1, [
      new THREE.QuaternionKeyframeTrack("mixamorig:LeftArm.quaternion", [0], [0, 0, 0, 1]),
    ]);
    const out = bakeClipForTarget(clip, src, src)!;
    expect(out.status).toBe("retargeted");
    expect(out.clip.tracks.map((t) => t.name)).toEqual(["LeftArm.quaternion"]);
  });

  it("không còn xương nào dùng được -> null (để panel từ chối gắn)", () => {
    const clip = new THREE.AnimationClip("bad", 1, [
      new THREE.QuaternionKeyframeTrack("NoSuchBone.quaternion", [0], [0, 0, 0, 1]),
    ]);
    expect(bakeClipForTarget(clip, src, tgt)).toBeNull();
  });
});

describe("clip retarget: normalizeBoneName", () => {
  it("bỏ tiền tố mixamorig, giữ nguyên tên thường", () => {
    expect(normalizeBoneName("mixamorig:Hips")).toBe("Hips");
    expect(normalizeBoneName("mixamorig_LeftArm")).toBe("LeftArm");
    expect(normalizeBoneName("LeftArm")).toBe("LeftArm");
  });
});
