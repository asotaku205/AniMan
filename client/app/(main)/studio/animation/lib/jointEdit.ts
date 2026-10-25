/**
 * Sửa khớp bằng chuột/số trong Phòng Rig (Rig UX): đối xứng trái/phải
 * và dời nhánh khớp.
 *
 * Thuần toán học, không phụ thuộc Three. Hệ tọa độ: nhân vật nhìn về
 * +Z, gốc ở giữa 2 bàn chân, bên trái là +X, bên phải là −X — nên
 * mirror chỉ đổi dấu X và đổi tên Left<->Right.
 */

import type { RigJoint } from "./rig";

export type Vec3 = [number, number, number];

/** Tên khớp đối tác bên kia, null khi là khớp giữa (hông, cột sống…). */
export function mirrorBoneName(name: string): string | null {
  if (name.startsWith("Left")) return `Right${name.slice(4)}`;
  if (name.startsWith("Right")) return `Left${name.slice(5)}`;
  return null;
}

/** Vị trí mirror qua mặt phẳng giữa (đổi dấu X). */
export function mirrorPosition(pos: readonly number[]): Vec3 {
  return [-pos[0], pos[1], pos[2]];
}

/** Mọi khớp con cháu của `name` (không gồm chính nó), theo thứ tự joints. */
export function descendantsOf(joints: RigJoint[], name: string): string[] {
  const children = new Map<string, string[]>();
  for (const j of joints) {
    if (j.parent) {
      const list = children.get(j.parent) ?? [];
      list.push(j.name);
      children.set(j.parent, list);
    }
  }
  const out: string[] = [];
  const stack = [...(children.get(name) ?? [])];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    out.push(cur);
    stack.push(...(children.get(cur) ?? []));
  }
  // Giữ đúng thứ tự joints thay vì thứ tự duyệt stack.
  const order = new Map(joints.map((j, i) => [j.name, i]));
  return out.sort((a, b) => order.get(a)! - order.get(b)!);
}

/** Dời một khớp và cả nhánh con của nó theo `delta` (kéo chuột). */
export function translateSubtree(
  joints: RigJoint[],
  name: string,
  delta: readonly number[],
): RigJoint[] {
  const moved = new Set([name, ...descendantsOf(joints, name)]);
  return joints.map((j) =>
    moved.has(j.name)
      ? {
          ...j,
          pos: [
            j.pos[0] + delta[0],
            j.pos[1] + delta[1],
            j.pos[2] + delta[2],
          ] as Vec3,
        }
      : j,
  );
}

/**
 * Sửa vị trí một khớp duy nhất (ô số). Khi bật đối xứng, khớp đối tác
 * nhận vị trí mirror; khớp giữa không có đối tác nên đứng yên.
 */
export function applySingleJointEdit(
  joints: RigJoint[],
  name: string,
  pos: Vec3,
  mirror: boolean,
): RigJoint[] {
  const counterpart = mirror ? mirrorBoneName(name) : null;
  return joints.map((j) => {
    if (j.name === name) return { ...j, pos: [...pos] as Vec3 };
    if (counterpart && j.name === counterpart) {
      return { ...j, pos: mirrorPosition(pos) };
    }
    return j;
  });
}

/**
 * Sau khi nhánh bên này đã dời xong (`updated` chứa vị trí mới của từng
 * khớp trong nhánh), mirror toàn bộ nhánh sang bên kia: mỗi khớp đối
 * tác nhận vị trí mirror của khớp tương ứng.
 */
export function mirrorSubtreeEdit(
  joints: RigJoint[],
  subtree: string[],
  updated: Map<string, readonly number[]>,
): RigJoint[] {
  const mirrored = new Map<string, Vec3>();
  for (const name of subtree) {
    const cp = mirrorBoneName(name);
    const pos = updated.get(name);
    if (cp && pos) mirrored.set(cp, mirrorPosition(pos));
  }
  if (mirrored.size === 0) return joints;
  return joints.map((j) =>
    mirrored.has(j.name) ? { ...j, pos: mirrored.get(j.name)! } : j,
  );
}
