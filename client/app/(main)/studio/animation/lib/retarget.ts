/**
 * Gắn chuyển động sang người khác (retarget, thuần toán): lấy clip xoay
 * theo tên xương của nguồn (chuẩn Mixamo) gắn sang nhân vật đích có tỉ lệ
 * khác mà không méo.
 *
 * - Xoay: copy theo tên xương, bù hướng thế giới của chi — xoay bù tối
 *   thiểu đưa hướng con sau khi áp xoay nguồn về đúng hướng thế giới
 *   của nguồn, để chi sau khi gắn chỉ đúng hướng dù tư thế gốc khác nhau.
 *   Cùng tư thế gốc thì xoay bù là đơn vị, tức copy y nguyên.
 * - Tỉ lệ: `legLengthScale` cho tỉ lệ dài chân, dùng để scale vị trí hông
 *   (chuyển động gốc) theo nhân vật đích.
 * - Dùng chung quy ước Euler XYZ (radian) với `poseTrack`.
 */

import type { RigJoint } from "./rig";
import { eulerRadToQuat, quatToEulerDeg } from "./poseTrack";

export type EulerRad = [number, number, number];
export type ClipPose = Record<string, EulerRad>;
export type Quat = [number, number, number, number];
type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Quaternion xoay vector a thành vector b (cả hai đã chuẩn hoá). */
export function quatFromUnitVectors(a: V3, b: V3): Quat {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (d > 0.999999) return [0, 0, 0, 1];
  if (d < -0.999999) {
    // Ngược chiều: xoay 180° quanh một trục vuông góc bất kỳ.
    const ortho: V3 =
      Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const cross: V3 = [
      a[1] * ortho[2] - a[2] * ortho[1],
      a[2] * ortho[0] - a[0] * ortho[2],
      a[0] * ortho[1] - a[1] * ortho[0],
    ];
    const cl = Math.hypot(...cross) || 1;
    return [cross[0] / cl, cross[1] / cl, cross[2] / cl, 0];
  }
  const cross: V3 = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const q: Quat = [cross[0], cross[1], cross[2], 1 + d];
  const l = Math.hypot(...q) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

/** Nhân quaternion: q = a * b (áp b trước, rồi a). */
export function quatMultiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** Áp quaternion (đơn vị) lên vector. */
export function quatApplyToVec(q: Quat, v: V3): V3 {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
}

/** Quaternion (poseTrack) → Euler radian, thứ tự XYZ. */
export function quatToEulerRadXYZ(q: Quat): EulerRad {
  const [x, y, z] = quatToEulerDeg(q);
  const d2r = Math.PI / 180;
  return [x * d2r, y * d2r, z * d2r];
}

/**
 * Hướng xương ở tư thế gốc: từ khớp tới con (khớp cuối: từ cha tới khớp;
 * gốc: hướng lên). Dùng để bù tư thế gốc khi retarget.
 */
export function restDirection(joints: RigJoint[], name: string): V3 {
  const by = new Map(joints.map((j) => [j.name, j]));
  const joint = by.get(name);
  if (!joint) return [0, 1, 0];
  const child = joints.find((j) => j.parent === name);
  if (child) return norm(sub(child.pos, joint.pos));
  if (joint.parent) {
    const parent = by.get(joint.parent)!;
    return norm(sub(joint.pos, parent.pos));
  }
  return [0, 1, 0];
}

/** Gắn dáng nguồn sang xương đích (chỉ xương có ở cả hai bên mới giữ). */
export function retargetPose(
  sourceRest: RigJoint[],
  targetRest: RigJoint[],
  sourcePose: ClipPose,
): ClipPose {
  const targetNames = new Set(targetRest.map((j) => j.name));
  const out: ClipPose = {};
  for (const [name, euler] of Object.entries(sourcePose)) {
    if (!targetNames.has(name)) continue;
    const dirS = restDirection(sourceRest, name);
    const dirT = restDirection(targetRest, name);
    const qSrc = eulerRadToQuat(euler);
    // Hướng thế giới của chi ở nguồn; xoay bù tối thiểu đưa hướng con
    // của đích (sau khi áp xoay nguồn) về đúng hướng đó.
    const worldSrc = quatApplyToVec(qSrc, dirS);
    const worldTgtBefore = quatApplyToVec(qSrc, dirT);
    const delta = quatFromUnitVectors(worldTgtBefore, worldSrc);
    const qOut = quatMultiply(delta, qSrc);
    out[name] = quatToEulerRadXYZ(qOut);
  }
  return out;
}

function legPathLength(joints: RigJoint[], side: "Left" | "Right"): number {
  const by = new Map(joints.map((j) => [j.name, j]));
  const hips = by.get("Hips")!;
  const up = by.get(`${side}UpLeg`);
  const leg = by.get(`${side}Leg`);
  const foot = by.get(`${side}Foot`);
  if (!up || !leg || !foot) return 0;
  const seg = (a: RigJoint, b: RigJoint) =>
    Math.hypot(...sub(b.pos, a.pos));
  return seg(hips, up) + seg(up, leg) + seg(leg, foot);
}

/** Tỉ lệ dài chân đích/nguồn (trung bình 2 chân) — dùng scale vị trí hông. */
export function legLengthScale(
  sourceRest: RigJoint[],
  targetRest: RigJoint[],
): number {
  const s = (legPathLength(sourceRest, "Left") + legPathLength(sourceRest, "Right")) / 2;
  const t = (legPathLength(targetRest, "Left") + legPathLength(targetRest, "Right")) / 2;
  if (s <= 0 || t <= 0) return 1;
  return t / s;
}
