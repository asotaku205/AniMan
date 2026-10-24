/**
 * Dáng mốc (Phase 4, phần còn lại): tự dựng hành động không cần clip.
 *
 * Một dáng mốc ghi toàn bộ xương của model tại một thời điểm (quaternion
 * tuyệt đối theo xương gốc). Giữa 2 mốc, xương nội suy bằng slerp nên
 * chuyển động mượt. Ngoài khoảng mốc thì giữ dáng mốc đầu/cuối.
 * Thuần toán, không phụ thuộc Three.js — test được trực tiếp.
 */

export type BoneQuat = [number, number, number, number];

export interface PoseKey {
  id: string;
  timeSec: number;
  bones: Record<string, BoneQuat>;
}

export function createPoseKey(
  timeSec: number,
  bones: Record<string, BoneQuat>,
): PoseKey {
  return {
    id: `pose-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    timeSec,
    bones,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Slerp giữa 2 quaternion, luôn đi đường ngắn nhất. */
export function slerpQuat(a: BoneQuat, b: BoneQuat, t: number): BoneQuat {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bx = b[0];
  let by = b[1];
  let bz = b[2];
  let bw = b[3];
  if (dot < 0) {
    dot = -dot;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  if (dot > 0.9995) {
    // Gần nhau: nội suy tuyến tính rồi chuẩn hoá.
    const out: BoneQuat = [
      a[0] + t * (bx - a[0]),
      a[1] + t * (by - a[1]),
      a[2] + t * (bz - a[2]),
      a[3] + t * (bw - a[3]),
    ];
    const len = Math.hypot(...out) || 1;
    return [out[0] / len, out[1] / len, out[2] / len, out[3] / len];
  }
  const theta = Math.acos(clamp(dot, -1, 1));
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;
  return [
    wa * a[0] + wb * bx,
    wa * a[1] + wb * by,
    wa * a[2] + wb * bz,
    wa * a[3] + wb * bw,
  ];
}

/** Euler (radian, thứ tự XYZ) → quaternion. */
export function eulerRadToQuat(e: [number, number, number]): BoneQuat {
  const c1 = Math.cos(e[0] / 2);
  const c2 = Math.cos(e[1] / 2);
  const c3 = Math.cos(e[2] / 2);
  const s1 = Math.sin(e[0] / 2);
  const s2 = Math.sin(e[1] / 2);
  const s3 = Math.sin(e[2] / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}

/** Euler (độ, thứ tự XYZ) → quaternion. */
export function eulerDegToQuat(e: [number, number, number]): BoneQuat {
  const d2r = Math.PI / 180;
  return eulerRadToQuat([e[0] * d2r, e[1] * d2r, e[2] * d2r]);
}

/** Quaternion → Euler (độ, thứ tự XYZ). Ngược với eulerDegToQuat. */
export function quatToEulerDeg(q: BoneQuat): [number, number, number] {
  const [x, y, z, w] = q;
  const m13 = 2 * (x * z + y * w);
  const r2d = 180 / Math.PI;
  const yAngle = Math.asin(clamp(m13, -1, 1));
  let xAngle: number;
  let zAngle: number;
  if (Math.abs(m13) < 0.9999999) {
    xAngle = Math.atan2(-2 * (y * z - x * w), 1 - 2 * (x * x + y * y));
    zAngle = Math.atan2(-2 * (x * y - z * w), 1 - 2 * (y * y + z * z));
  } else {
    xAngle = Math.atan2(2 * (y * z + x * w), 1 - 2 * (x * x + z * z));
    zAngle = 0;
  }
  return [xAngle * r2d, yAngle * r2d, zAngle * r2d];
}

/**
 * Mở rộng dáng mẫu (chỉ vài xương, góc radian) thành dáng đầy đủ:
 * xương có trong mẫu thì xoay theo mẫu, xương còn lại giữ dáng gốc.
 */
export function expandPoseTemplate(
  template: Record<string, [number, number, number]>,
  bind: Record<string, BoneQuat>,
): Record<string, BoneQuat> {
  const out: Record<string, BoneQuat> = {};
  for (const [name, quat] of Object.entries(bind)) {
    out[name] = template[name] ? eulerRadToQuat(template[name]) : [...quat] as BoneQuat;
  }
  return out;
}

/** Dáng xương tại t: null khi không có mốc nào. */
export function samplePoseKeys(
  keys: readonly PoseKey[] | undefined,
  t: number,
): Record<string, BoneQuat> | null {
  if (!keys || keys.length === 0) return null;
  const sorted = [...keys].sort((a, b) => a.timeSec - b.timeSec);
  if (t <= sorted[0].timeSec) return { ...sorted[0].bones };
  const last = sorted[sorted.length - 1];
  if (t >= last.timeSec) return { ...last.bones };
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (t >= a.timeSec && t <= b.timeSec) {
      const span = b.timeSec - a.timeSec;
      const local = span <= 0 ? 1 : (t - a.timeSec) / span;
      const out: Record<string, BoneQuat> = {};
      const names = new Set([...Object.keys(a.bones), ...Object.keys(b.bones)]);
      for (const name of names) {
        const qa = a.bones[name];
        const qb = b.bones[name];
        out[name] = qa && qb ? slerpQuat(qa, qb, local) : (qa ?? qb)!;
      }
      return out;
    }
  }
  return { ...last.bones };
}
