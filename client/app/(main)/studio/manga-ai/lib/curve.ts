/**
 * curve — công cụ đường cong (BRD T-1 #15: "Bézier 2 nút điều khiển").
 *
 * Thiết kế chốt 17/10/2026 (người dùng chọn): **kéo A → B + thanh "độ cong"**.
 * Hai điểm điều khiển nằm ở 1/3 và 2/3 dây cung, lệch cùng một phía theo pháp
 * tuyến; `bow = 0` → đường thẳng, `bow = ±100` → lệch nửa chiều dài dây cung.
 * Đây là đường Bézier bậc 3 thật (2 điểm điều khiển), vẽ bằng `bezierCurveTo`.
 */

import type { Point } from "./viewport";

export const CURVE_BOW_MIN = -100;
export const CURVE_BOW_MAX = 100;

/** Kẹp độ cong về -100…+100 và làm tròn. */
export function clampBow(bow: number): number {
  if (!Number.isFinite(bow)) return 0;
  return Math.min(CURVE_BOW_MAX, Math.max(CURVE_BOW_MIN, Math.round(bow)));
}

/**
 * Hai điểm điều khiển của đường cong từ `from` tới `to`.
 * Véc-tơ pháp tuyến là dây cung quay 90°, nên độ cong dương/âm uốn hai phía.
 */
export function curveControlPoints(
  from: Point,
  to: Point,
  bow: number,
): [Point, Point] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const k = (clampBow(bow) / 100) * (len / 2);
  if (len < 0.0001) {
    return [
      { x: from.x, y: from.y },
      { x: to.x, y: to.y },
    ];
  }
  // Pháp tuyến đơn vị của dây cung
  const nx = -dy / len;
  const ny = dx / len;
  return [
    { x: from.x + dx / 3 + nx * k, y: from.y + dy / 3 + ny * k },
    { x: from.x + (dx * 2) / 3 + nx * k, y: from.y + (dy * 2) / 3 + ny * k },
  ];
}

/** Điểm trên đường cong tại tham số `t` (0…1) — dùng cho test và kiểm chứng. */
export function pointOnCurve(
  from: Point,
  to: Point,
  bow: number,
  t: number,
): Point {
  const [c1, c2] = curveControlPoints(from, to, bow);
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return {
    x: w0 * from.x + w1 * c1.x + w2 * c2.x + w3 * to.x,
    y: w0 * from.y + w1 * c1.y + w2 * c2.y + w3 * to.y,
  };
}
