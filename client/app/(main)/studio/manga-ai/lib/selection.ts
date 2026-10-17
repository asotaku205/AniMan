/**
 * selection — hình học vùng chọn (BR-T05, AC-T3.1–T3.4). Module thuần: không
 * React, không DOM, test trực tiếp được.
 *
 * Một vùng chọn là **một đa giác** trong hệ toạ độ artwork, cộng cờ `inverted`
 * (đảo vùng chọn = đa giác bị "lộn ngược" trong cả khung, dùng luật even-odd).
 * Rect chỉ là đa giác 4 điểm, nên mọi phép biến đổi dùng chung một đường.
 */

import type { Point } from "./viewport";

/** Vùng chọn đang hoạt động. */
export interface Selection {
  /** Đường bao kín, toạ độ artwork (>= 3 điểm để dùng được). */
  points: Point[];
  /** `true` = đã đảo: phần **ngoài** đa giác mới là vùng chọn (AC-T3.4). */
  inverted: boolean;
}

/** Hình chữ nhật trong hệ toạ độ artwork. */
export interface ArtRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Hai kiểu tạo vùng chọn của công cụ `select` (BR-T05). */
export type SelectMode = "rect" | "lasso";

/** Bỏ điểm lasso quá sát nhau (px artwork) — tránh hàng nghìn điểm thừa. */
export const LASSO_MIN_STEP = 2;

/** Vùng chọn nhỏ hơn thế này (px²) coi như không dùng được → bỏ chọn. */
export const MIN_SELECTION_AREA = 4;

/** Diện tích đa giác (shoelace, luôn dương). */
export function polygonArea(points: readonly Point[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Vùng bao của một đa giác (không tính cờ đảo). */
export function polygonBounds(points: readonly Point[]): ArtRect {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Vùng chọn chữ nhật từ hai góc bất kỳ (kéo ngược hướng vẫn đúng). */
export function rectSelection(a: Point, b: Point): Selection {
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  return {
    points: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
    inverted: false,
  };
}

/** Vùng chọn tự do (lasso) từ chuỗi điểm đã kéo, bỏ điểm dính nhau. */
export function lassoSelection(points: readonly Point[]): Selection {
  let kept: Point[] = [];
  for (const p of points) kept = appendLassoPoint(kept, p);
  return { points: kept, inverted: false };
}

/**
 * Nối một điểm lasso vào chuỗi đang kéo. Điểm quá gần điểm trước bị bỏ (trả về
 * đúng mảng cũ) → vẽ lasso không phình ra hàng nghìn điểm.
 */
export function appendLassoPoint(
  points: readonly Point[],
  next: Point,
): Point[] {
  const last = points[points.length - 1];
  if (
    last &&
    Math.hypot(next.x - last.x, next.y - last.y) < LASSO_MIN_STEP
  ) {
    return points as Point[];
  }
  return [...points, { x: next.x, y: next.y }];
}

/** Vùng bao dùng cho transform/Delete/fill; đã đảo → cả khung. */
export function selectionBounds(
  sel: Selection,
  canvas?: { w: number; h: number },
): ArtRect {
  if (sel.inverted) {
    return { x: 0, y: 0, w: canvas?.w ?? 0, h: canvas?.h ?? 0 };
  }
  return polygonBounds(sel.points);
}

/** Đủ điểm và đủ rộng để coi là vùng chọn thật (AC-T3.5: ngược lại thì bỏ chọn). */
export function isSelectionUsable(sel: Selection | null): boolean {
  if (!sel) return false;
  if (sel.points.length < 3) return false;
  if (sel.inverted) return true;
  return polygonArea(sel.points) >= MIN_SELECTION_AREA;
}

/** Trọng tâm hình học của vùng chọn (điểm neo cho mọi phép biến đổi). */
export function selectionCenter(sel: Selection): Point {
  const b = polygonBounds(sel.points);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/**
 * Điểm có nằm trong vùng chọn không — luật **even-odd** (khớp `Path2D` lúc
 * clip/tô), rồi lật theo cờ `inverted`.
 */
export function pointInSelection(sel: Selection, p: Point): boolean {
  let inside = false;
  const pts = sel.points;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const a = pts[i];
    const b = pts[j];
    const straddles = a.y > p.y !== b.y > p.y;
    if (
      straddles &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x
    ) {
      inside = !inside;
    }
  }
  return sel.inverted ? !inside : inside;
}

/** Dời cả vùng chọn. */
export function translateSelection(
  sel: Selection,
  dx: number,
  dy: number,
): Selection {
  return {
    ...sel,
    points: sel.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  };
}

/** Đảo vùng chọn (AC-T3.4); đảo hai lần thì về như cũ. */
export function invertSelection(sel: Selection): Selection {
  return { ...sel, inverted: !sel.inverted };
}

/** Phép biến đổi vùng chọn đang áp — thứ tự cố định: scale/lật → xoay → dời. */
export interface SelectionTransform {
  /** Dời thêm, px artwork. */
  dx: number;
  dy: number;
  /** Xoay, độ (AC-T3.1: nút xoay từng 15°). */
  rotate: number;
  /** Phóng to/thu nhỏ **có tỉ lệ** (AC-T3.1). */
  scale: number;
  flipH: boolean;
  flipV: boolean;
}

export const IDENTITY_TRANSFORM: SelectionTransform = {
  dx: 0,
  dy: 0,
  rotate: 0,
  scale: 1,
  flipH: false,
  flipV: false,
};

/** Giới hạn tỉ lệ để vùng chọn không biến thành một điểm. */
export const MIN_TRANSFORM_SCALE = 0.1;
export const MAX_TRANSFORM_SCALE = 8;

/** Bước xoay mỗi lần bấm (AC-T3.1). */
export const ROTATE_STEP = 15;

/** Bước phóng to/thu nhỏ mỗi lần bấm (AC-T3.1). */
export const SCALE_STEP = 1.1;

/**
 * Áp phép biến đổi lên một điểm, neo quanh `center`:
 * `p' = c + d + R(rotate) · S(scale) · F(flip) · (p − c)`.
 */
export function transformPoint(
  p: Point,
  t: SelectionTransform,
  center: Point,
): Point {
  const rad = (t.rotate * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = (p.x - center.x) * t.scale * (t.flipH ? -1 : 1);
  const sy = (p.y - center.y) * t.scale * (t.flipV ? -1 : 1);
  return {
    x: center.x + t.dx + sx * cos - sy * sin,
    y: center.y + t.dy + sx * sin + sy * cos,
  };
}

/**
 * Áp phép biến đổi lên cả vùng chọn. `center` nên là trọng tâm của vùng **gốc**
 * để nhiều phép biến đổi liên tiếp không trôi.
 */
export function transformSelection(
  base: Selection,
  t: SelectionTransform,
  center?: Point,
): Selection {
  const c = center ?? selectionCenter(base);
  return {
    ...base,
    points: base.points.map((p) => transformPoint(p, t, c)),
  };
}

/** Kẹp tỉ lệ phóng to/thu nhỏ về khoảng an toàn. */
export function clampTransformScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_TRANSFORM_SCALE, Math.max(MIN_TRANSFORM_SCALE, scale));
}

/** Nhân tỉ lệ hiện tại thêm `factor` (nút phóng to/thu nhỏ), có kẹp biên. */
export function scaleTransform(
  t: SelectionTransform,
  factor: number,
): SelectionTransform {
  return { ...t, scale: clampTransformScale(t.scale * factor) };
}

/** Tỉ lệ vùng chọn đã đổi hay chưa (để biết có gì cần hợp nhất). */
export function isIdentityTransform(t: SelectionTransform): boolean {
  return (
    t.dx === 0 &&
    t.dy === 0 &&
    t.rotate === 0 &&
    t.scale === 1 &&
    !t.flipH &&
    !t.flipV
  );
}
