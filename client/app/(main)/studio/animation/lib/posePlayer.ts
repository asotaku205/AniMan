/**
 * Cầu nối dáng mốc ↔ Three.js (Phase 4): chụp dáng hiện tại của xương
 * và áp dáng đã nội suy lên xương.
 */

import * as THREE from "three";
import type { BoneQuat } from "./poseTrack";

/** Chụp quaternion tuyệt đối hiện tại của mọi xương (để làm dáng mốc). */
export function capturePose(
  boneByName: Map<string, THREE.Bone>,
): Record<string, BoneQuat> {
  const out: Record<string, BoneQuat> = {};
  for (const [name, bone] of boneByName) {
    out[name] = [
      bone.quaternion.x,
      bone.quaternion.y,
      bone.quaternion.z,
      bone.quaternion.w,
    ];
  }
  return out;
}

/** Áp dáng lên xương (xương nào không có trong dáng thì giữ nguyên). */
export function applyPoseToBones(
  boneByName: Map<string, THREE.Bone>,
  pose: Record<string, BoneQuat>,
): void {
  for (const [name, q] of Object.entries(pose)) {
    const bone = boneByName.get(name);
    if (bone) bone.quaternion.set(q[0], q[1], q[2], q[3]);
  }
}
