/**
 * Áp IK lên xương thật (three.js): chụp tư thế gốc rồi xoay xương theo
 * nghiệm IK thuần. Xương ngoài chuỗi IK giữ nguyên.
 */

import * as THREE from "three";
import { solveTwoBoneIK, type Vec3 } from "./ik";

export interface LimbChain {
  root: string;
  mid: string;
  end: string;
}

export const ARM_CHAINS: Record<"left" | "right", LimbChain> = {
  left: { root: "LeftArm", mid: "LeftForeArm", end: "LeftHand" },
  right: { root: "RightArm", mid: "RightForeArm", end: "RightHand" },
};

export const LEG_CHAINS: Record<"left" | "right", LimbChain> = {
  left: { root: "LeftUpLeg", mid: "LeftLeg", end: "LeftFoot" },
  right: { root: "RightUpLeg", mid: "RightLeg", end: "RightFoot" },
};

export interface RestSnapshot {
  positions: Map<string, THREE.Vector3>;
  quats: Map<string, THREE.Quaternion>;
  localQuats: Map<string, THREE.Quaternion>;
}

/** Chụp vị trí + xoay thế giới + xoay local của xương ở tư thế gốc. */
export function captureRest(
  boneByName: Map<string, THREE.Bone>,
): RestSnapshot {
  const positions = new Map<string, THREE.Vector3>();
  const quats = new Map<string, THREE.Quaternion>();
  const localQuats = new Map<string, THREE.Quaternion>();
  for (const [name, bone] of boneByName) {
    bone.updateWorldMatrix(true, false);
    positions.set(name, bone.getWorldPosition(new THREE.Vector3()));
    quats.set(name, bone.getWorldQuaternion(new THREE.Quaternion()));
    localQuats.set(name, bone.quaternion.clone());
  }
  return { positions, quats, localQuats };
}

function aimBone(
  bone: THREE.Bone,
  rest: RestSnapshot,
  desiredChildWorld: THREE.Vector3,
  restChildWorld: THREE.Vector3,
): void {
  bone.updateWorldMatrix(true, false);
  const bonePos = bone.getWorldPosition(new THREE.Vector3());
  const restBoneWorld = rest.positions.get(bone.name);
  const restWQ = rest.quats.get(bone.name);
  const restLocalQ = rest.localQuats.get(bone.name);
  if (!restBoneWorld || !restWQ || !restLocalQ) return;
  const parentWQ = bone.parent
    ? bone.parent.getWorldQuaternion(new THREE.Quaternion())
    : new THREE.Quaternion();
  // Hướng xương ở tư thế gốc, đưa về hệ local của xương rồi quay lại hệ
  // thế giới theo xoay hiện tại của cha — đúng cả khi cha đã xoay (IK).
  const restDirLocal = restChildWorld
    .clone()
    .sub(restBoneWorld)
    .normalize()
    .applyQuaternion(restWQ.clone().invert());
  const restDirWorld = restDirLocal.applyQuaternion(
    parentWQ.clone().multiply(restLocalQ),
  );
  const desiredDir = desiredChildWorld.clone().sub(bonePos);
  if (restDirWorld.lengthSq() < 1e-12 || desiredDir.lengthSq() < 1e-12) return;
  desiredDir.normalize();
  const delta = new THREE.Quaternion().setFromUnitVectors(
    restDirWorld,
    desiredDir,
  );
  const newWQ = delta.multiply(parentWQ.clone().multiply(restLocalQ));
  bone.quaternion.copy(parentWQ.invert().multiply(newWQ));
}

/**
 * Xoay chuỗi 2 khớp để khớp cuối chạm target. Pole mặc định: tay bẻ về
 * sau lưng (−Z), chân bẻ về trước (+Z) vì nhân vật nhìn +Z.
 */
export function applyLimbIK(
  boneByName: Map<string, THREE.Bone>,
  rest: RestSnapshot,
  chain: LimbChain,
  target: Vec3,
  pole?: Vec3,
): void {
  const root = boneByName.get(chain.root);
  const mid = boneByName.get(chain.mid);
  const end = boneByName.get(chain.end);
  if (!root || !mid || !end) return;
  const rR = rest.positions.get(chain.root);
  const rM = rest.positions.get(chain.mid);
  const rE = rest.positions.get(chain.end);
  if (!rR || !rM || !rE) return;
  const isLeg = chain.root.includes("UpLeg");
  const poleVec: Vec3 =
    pole ?? [rM.x, rM.y, rM.z + (isLeg ? 0.3 : -0.3)];
  const sol = solveTwoBoneIK(
    [rR.x, rR.y, rR.z],
    [rM.x, rM.y, rM.z],
    [rE.x, rE.y, rE.z],
    target,
    poleVec,
  );
  const newMid = new THREE.Vector3(...sol.mid);
  const newEnd = new THREE.Vector3(...sol.end);
  aimBone(root, rest, newMid, rM);
  mid.updateWorldMatrix(true, false);
  aimBone(mid, rest, newEnd, rE);
  // Khớp cuối giữ xoay local gốc (đi theo hướng cẳng tay/cẳng chân).
  const endLocal = rest.localQuats.get(chain.end);
  if (endLocal) end.quaternion.copy(endLocal);
}

export function toVec3(v: THREE.Vector3): Vec3 {
  return [v.x, v.y, v.z];
}
