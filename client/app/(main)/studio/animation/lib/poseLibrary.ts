/**
 * Thư viện dáng (thuần toán): dáng tự tạo lưu tên, dùng lại cho mọi model
 * cùng bộ xương. Dáng ghi xoay Euler (radian, XYZ) theo tên xương — cùng
 * quy ước với dáng mẫu của Phòng Rig.
 */

import type { EulerRad } from "./retarget";

export interface SavedPose {
  id: string;
  name: string;
  createdAt: number;
  bones: Record<string, EulerRad>;
}

export function newPoseId(): string {
  return `pose-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/**
 * Lật dáng trái/phải: đổi tên xương Left ↔ Right, đảo dấu góc Y và Z
 * (lật qua mặt phẳng dọc giữa người). Lật 2 lần về như cũ.
 */
export function mirrorPose(
  pose: Record<string, EulerRad>,
): Record<string, EulerRad> {
  const out: Record<string, EulerRad> = {};
  for (const [name, e] of Object.entries(pose)) {
    const mirrored = name
      .replace(/^Left/, "__TMP__")
      .replace(/^Right/, "Left")
      .replace(/^__TMP__/, "Right");
    out[mirrored] = [e[0], -e[1], -e[2]];
  }
  return out;
}
