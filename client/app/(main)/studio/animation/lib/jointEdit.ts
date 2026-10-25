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
 * Sửa vị trí một khớp bằng ô số: dời cả nhánh con theo cùng delta như
 * kéo chuột (giữ nguyên độ dài đoạn xương, không đứt chuỗi). Khi bật
 * đối xứng, cả nhánh đối tác mirror theo nhánh đã dời; khớp giữa hoặc
 * khớp tự thêm (không có tên Left/Right) thì không mirror.
 */
export function applySingleJointEdit(
  joints: RigJoint[],
  name: string,
  pos: Vec3,
  mirror: boolean,
): RigJoint[] {
  const cur = joints.find((j) => j.name === name);
  if (!cur) return joints;
  const delta: Vec3 = [
    pos[0] - cur.pos[0],
    pos[1] - cur.pos[1],
    pos[2] - cur.pos[2],
  ];
  let next = translateSubtree(joints, name, delta);
  // Khớp giữa (Hips, cột sống...) không có đối tác nên không mirror:
  // nhánh của nó vốn đã chứa cả hai bên, mirror sẽ ghi đè nhánh phải
  // lệch khỏi nhánh trái.
  if (mirror && mirrorBoneName(name)) {
    const subtree = [name, ...descendantsOf(joints, name)];
    const updated = new Map<string, Vec3>(
      subtree.map((n) => {
        const moved = next.find((j) => j.name === n)!;
        return [n, [...moved.pos] as Vec3];
      }),
    );
    next = mirrorSubtreeEdit(next, subtree, updated);
  }
  return next;
}

/** Đoạn khớp mới nhô lên trên khớp cha khi tự thêm khớp (mét). */
export const CUSTOM_JOINT_STEP_M = 0.1;

/**
 * Thêm một khớp mới cho vật không phải người (nhà, đồ vật...): làm con
 * của khớp đang chọn, không chọn khớp nào thì làm khớp gốc ở gốc tọa
 * độ. Tên tự sinh không trùng ("Khớp 1", "Khớp 2"...).
 */
export function addJoint(
  joints: RigJoint[],
  parentName: string | null,
): { joints: RigJoint[]; name: string } {
  const names = new Set(joints.map((j) => j.name));
  let n = 1;
  while (names.has(`Khớp ${n}`)) n += 1;
  const name = `Khớp ${n}`;
  const parent =
    parentName != null ? joints.find((j) => j.name === parentName) : undefined;
  const pos: Vec3 =
    parent != null
      ? [parent.pos[0], parent.pos[1] + CUSTOM_JOINT_STEP_M, parent.pos[2]]
      : [0, 0, 0];
  return {
    joints: [
      ...joints,
      { name, parent: parent != null ? parent.name : null, pos },
    ],
    name,
  };
}

/**
 * Xoá một khớp: các khớp con được gắn lại về khớp cha của khớp bị xoá
 * (giữ chuỗi liền mạch), không xoá cả nhánh. Xoá khớp gốc thì con
 * thành khớp gốc.
 */
export function removeJoint(joints: RigJoint[], name: string): RigJoint[] {
  const target = joints.find((j) => j.name === name);
  if (!target) return joints;
  return joints
    .filter((j) => j.name !== name)
    .map((j) =>
      j.parent === name ? { ...j, parent: target.parent } : j,
    );
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
