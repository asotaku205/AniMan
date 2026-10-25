/**
 * Gập/xòe ngón tay trong Phòng Rig (Rig UX).
 *
 * Thuần toán học, không phụ thuộc Three. Gập/xòe đổi VỊ TRÍ các khớp
 * ngón (không chỉ xoay preview) nên file xuất ra giữ đúng dáng ngón.
 *
 * Cách tính: từ chuỗi thẳng gốc (điểm gốc + 2 đoạn xương), xòe xoay
 * cả ngón quanh trục Y qua gốc ngón, gập xoay từng đoạn quanh một trục
 * vuông góc với hướng ngón (giả định lòng bàn tay hướng xuống, chuẩn
 * T-pose — gập làm đầu ngón đi xuống rồi cuộn vào). Góc gập tích lũy
 * theo đoạn nên chuỗi vẫn nối liền và độ dài đoạn không đổi.
 */

import type { RigJoint } from "./rig";

export type Vec3 = [number, number, number];
export type FingerSide = "Left" | "Right";
export type FingerName = "Thumb" | "Index" | "Middle" | "Ring" | "Pinky";

export const FINGER_SIDES: FingerSide[] = ["Left", "Right"];
export const FINGER_NAMES: FingerName[] = [
  "Thumb",
  "Index",
  "Middle",
  "Ring",
  "Pinky",
];

/** Hệ số xòe của từng ngón (nhân với góc xòe, đổi dấu theo bên tay). */
const SPREAD_COEFF: Record<FingerName, number> = {
  Thumb: 0.6,
  Index: 1,
  Middle: 0,
  Ring: -0.5,
  Pinky: -1,
};

/** Góc gập từng đốt ở mức gập = 1 (radian): gốc, giữa, ngọn. */
const CURL_INCREMENTS: [number, number, number] = [0.5, 0.55, 0.4];
/** Góc xòe tối đa ở mức xòe = 1 (radian). */
const SPREAD_MAX_RAD = 0.4;

export const fingerKey = (side: FingerSide, finger: FingerName): string =>
  `${side}:${finger}`;

/** Phân tích tên khớp ngón → bên tay + ngón, null khi không phải khớp ngón. */
export function parseFingerJoint(
  name: string,
): { side: FingerSide; finger: FingerName } | null {
  const m = /^(Left|Right)Hand(Thumb|Index|Middle|Ring|Pinky)[123]$/.exec(name);
  if (!m) return null;
  return { side: m[1] as FingerSide, finger: m[2] as FingerName };
}

export interface FingerBase {
  /** Vị trí đốt gốc (khớp ngón 1) khi ngón thẳng. */
  p0: Vec3;
  /** Đoạn xương gốc→giữa và giữa→ngọn khi ngón thẳng. */
  v1: Vec3;
  v2: Vec3;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Xoay vector quanh trục Y (đứng) theo góc `angle` (radian). */
function rotY(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

/** Xoay vector quanh trục đơn vị `axis` theo góc `angle` (công thức Rodrigues). */
function rotAxis(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const cr = cross(axis, v);
  const dot = axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2];
  return [
    v[0] * c + cr[0] * s + axis[0] * dot * (1 - c),
    v[1] * c + cr[1] * s + axis[1] * dot * (1 - c),
    v[2] * c + cr[2] * s + axis[2] * dot * (1 - c),
  ];
}

/** Chuỗi thẳng gốc của một ngón từ joints hiện tại, null khi thiếu khớp. */
export function getFingerBase(
  joints: RigJoint[],
  side: FingerSide,
  finger: FingerName,
): FingerBase | null {
  const by = new Map(joints.map((j) => [j.name, j.pos]));
  const p0 = by.get(`${side}Hand${finger}1`);
  const p1 = by.get(`${side}Hand${finger}2`);
  const p2 = by.get(`${side}Hand${finger}3`);
  if (!p0 || !p1 || !p2) return null;
  return { p0: [...p0] as Vec3, v1: sub(p1, p0), v2: sub(p2, p1) };
}

/**
 * Vị trí 3 khớp ngón sau khi gập/xòe, tính từ chuỗi thẳng gốc.
 * `curl` và `spread` đều từ 0 đến 1. Gập/xòe = 0 trả đúng chuỗi gốc.
 */
export function poseFingerFromBase(
  base: FingerBase,
  side: FingerSide,
  finger: FingerName,
  curl: number,
  spread: number,
): { j1: Vec3; j2: Vec3; j3: Vec3 } {
  const s = side === "Left" ? 1 : -1;
  const spreadAngle = -s * spread * SPREAD_MAX_RAD * SPREAD_COEFF[finger];
  const w1 = rotY(base.v1, spreadAngle);
  const w2 = rotY(base.v2, spreadAngle);
  // Trục gập: vuông góc với hướng ngón và trục đứng; ngón gần thẳng
  // đứng thì lấy trục X làm dự phòng (độ dài vẫn giữ đúng).
  let axis = cross(norm(w1), [0, 1, 0]);
  if (Math.hypot(...axis) < 1e-6) axis = [1, 0, 0];
  axis = norm(axis);
  // Gập về phía dưới (lòng bàn tay hướng xuống): góc âm quanh trục này.
  const c1 = -curl * CURL_INCREMENTS[0];
  const c2 = c1 - curl * CURL_INCREMENTS[1];
  const d1 = rotAxis(w1, axis, c1);
  const d2 = rotAxis(w2, axis, c2);
  const j1 = base.p0;
  const j2 = add(j1, d1);
  const j3 = add(j2, d2);
  return { j1, j2, j3 };
}

/** Áp gập/xòe của một ngón lên joints (chỉ đổi khớp ngón 2 và 3, gốc giữ nguyên). */
export function applyFingerPoseToJoints(
  joints: RigJoint[],
  side: FingerSide,
  finger: FingerName,
  curl: number,
  spread: number,
  base: FingerBase,
): RigJoint[] {
  const posed = poseFingerFromBase(base, side, finger, curl, spread);
  const next: Record<string, Vec3> = {
    [`${side}Hand${finger}1`]: posed.j1,
    [`${side}Hand${finger}2`]: posed.j2,
    [`${side}Hand${finger}3`]: posed.j3,
  };
  return joints.map((j) => (next[j.name] ? { ...j, pos: next[j.name] } : j));
}
