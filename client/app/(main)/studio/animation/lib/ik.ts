/**
 * IK hai khớp (thuần toán, không phụ thuộc Three): giải vị trí khuỷu/gối
 * và khớp cuối cho chuỗi gốc → giữa → cuối.
 *
 * - Target trong tầm với: khớp cuối chạm đúng target.
 * - Target ngoài tầm với: duỗi thẳng về phía target.
 * - Target quá gần gốc: gập hết cỡ.
 * - Pole vector quyết định khuỷu/gối bẻ về phía nào.
 */

export type Vec3 = [number, number, number];

export interface TwoBoneSolution {
  /** Vị trí mới của khớp giữa (khuỷu/gối). */
  mid: Vec3;
  /** Vị trí mới của khớp cuối (bàn tay/bàn chân). */
  end: Vec3;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);

export function solveTwoBoneIK(
  root: Vec3,
  midRest: Vec3,
  endRest: Vec3,
  target: Vec3,
  pole: Vec3,
): TwoBoneSolution {
  const L1 = len(sub(midRest, root));
  const L2 = len(sub(endRest, midRest));
  const toTarget = sub(target, root);
  const dRaw = len(toTarget);
  // Kẹp khoảng cách vào [|L1−L2|, L1+L2] để không NaN khi duỗi/gập hết cỡ.
  const d = Math.min(Math.max(dRaw, Math.abs(L1 - L2)), L1 + L2);
  const axis: Vec3 =
    dRaw < 1e-9 ? [0, 1, 0] : scale(toTarget, 1 / dRaw);
  // a: khoảng từ gốc tới hình chiếu của khớp giữa lên trục gốc → target.
  const a = d < 1e-9 ? 0 : (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  // Hướng bẻ: thành phần của (pole − gốc) vuông góc với trục.
  const poleDir = sub(pole, root);
  const perp = sub(poleDir, scale(axis, dot(poleDir, axis)));
  const perpLen = len(perp);
  const bend: Vec3 =
    perpLen < 1e-9
      ? // Pole trùng trục: chọn một hướng vuông góc bất kỳ.
        Math.abs(axis[1]) < 0.9
        ? (() => {
            const p = sub([0, 1, 0], scale(axis, axis[1]));
            const l = len(p) || 1;
            return scale(p, 1 / l);
          })()
        : [1, 0, 0]
      : scale(perp, 1 / perpLen);
  const mid = add(add(root, scale(axis, a)), scale(bend, h));
  const end = add(root, scale(axis, d));
  return { mid, end };
}
