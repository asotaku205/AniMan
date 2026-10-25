/**
 * Chụp dáng hiện tại từ xương thật (three.js): đọc xoay Euler (radian,
 * XYZ) của từng xương để lưu vào thư viện dáng. Dùng chung quy ước với
 * dáng mẫu của Phòng Rig.
 */

import * as THREE from "three";
import type { EulerRad } from "./retarget";

export function captureBoneEulers(
  boneByName: Map<string, THREE.Bone>,
): Record<string, EulerRad> {
  const out: Record<string, EulerRad> = {};
  const euler = new THREE.Euler(0, 0, 0, "XYZ");
  for (const [name, bone] of boneByName) {
    bone.updateWorldMatrix(true, false);
    const wq = bone.getWorldQuaternion(new THREE.Quaternion());
    const parentWQ = bone.parent
      ? bone.parent.getWorldQuaternion(new THREE.Quaternion())
      : new THREE.Quaternion();
    const local = parentWQ.invert().multiply(wq);
    euler.setFromQuaternion(local, "XYZ");
    out[name] = [euler.x, euler.y, euler.z];
  }
  return out;
}
