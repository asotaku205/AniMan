/**
 * shape — hình học của công cụ Hình và công cụ Đường/mũi tên
 * (BRD T-1 #6: "thêm polygon, star, arrow"; #10: "đường thẳng / mũi tên",
 * `Shift` khoá 45°).
 *
 * Mọi thứ ở đây là toán thuần: hàm nhận `PathCtx` tối thiểu nên test được bằng
 * một bản ghi giả, không cần canvas thật.
 */

import type { Point } from "./viewport";

export type ShapeKind = "rect" | "circle" | "line" | "arrow" | "polygon" | "star";

export const SHAPE_KINDS: readonly ShapeKind[] = [
  "rect",
  "circle",
  "line",
  "arrow",
  "polygon",
  "star",
];

/** Hai kiểu của công cụ Đường/mũi tên. */
export const LINE_KINDS: readonly ShapeKind[] = ["line", "arrow"];

export const SIDES_MIN = 3;
export const SIDES_MAX = 12;

/** Tỉ lệ bán kính trong / ngoài của ngôi sao. */
export const STAR_INNER_RATIO = 0.45;

const SHAPE_LABELS: Record<ShapeKind, string> = {
  rect: "Chữ nhật",
  circle: "Tròn / Ellipse",
  line: "Đường thẳng",
  arrow: "Mũi tên",
  polygon: "Đa giác",
  star: "Ngôi sao",
};

export function shapeLabel(kind: ShapeKind): string {
  return SHAPE_LABELS[kind] ?? SHAPE_LABELS.rect;
}

/** Hình nào có phần nền để đổ đặc (`shapeFill`). */
export function kindLetsFill(kind: ShapeKind): boolean {
  return kind !== "line" && kind !== "arrow";
}

/** Kẹp số cạnh / số cánh sao về 3–12. */
export function clampSides(sides: number): number {
  if (!Number.isFinite(sides)) return SIDES_MIN;
  return Math.min(SIDES_MAX, Math.max(SIDES_MIN, Math.round(sides)));
}

/** Hộp bao của cú kéo A → B (đã chuẩn hoá, luôn dương). */
export function boundsFrom(
  from: Point,
  to: Point,
): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    w: Math.abs(to.x - from.x),
    h: Math.abs(to.y - from.y),
  };
}

/**
 * Khoá hướng kéo về bội số `stepDeg` (mặc định 45°) **giữ nguyên độ dài**, đúng
 * kiểu `Shift` của phần mềm vẽ. Cú kéo quá ngắn thì trả nguyên.
 */
export function snapToAngle(from: Point, to: Point, stepDeg = 45): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return { x: to.x, y: to.y };
  const step = (stepDeg * Math.PI) / 180;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: from.x + Math.cos(angle) * len, y: from.y + Math.sin(angle) * len };
}

/** Khoá cú kéo thành hình vuông (giữ chiều kéo, lấy cạnh dài hơn). */
export function constrainSquare(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    x: from.x + (dx < 0 ? -side : side),
    y: from.y + (dy < 0 ? -side : side),
  };
}

/**
 * Đỉnh đa giác đều **nội tiếp ellipse** của hộp bao. Đỉnh đầu hướng lên
 * (`rotation = -90°`) nên đa giác nhìn "đứng" đúng chiều.
 */
export function polygonPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  sides: number,
  rotation = -Math.PI / 2,
): Point[] {
  const n = clampSides(sides);
  const out: Point[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = rotation + (i * Math.PI * 2) / n;
    out.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return out;
}

/** Đỉnh ngôi sao: 2×`points` đỉnh, xen kẽ bán kính ngoài và bán kính trong. */
export function starPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  points: number,
  rotation = -Math.PI / 2,
): Point[] {
  const n = clampSides(points);
  const out: Point[] = [];
  const total = n * 2;
  for (let i = 0; i < total; i += 1) {
    const a = rotation + (i * Math.PI * 2) / total;
    const k = i % 2 === 0 ? 1 : STAR_INNER_RATIO;
    out.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k });
  }
  return out;
}

/**
 * Thân và đầu mũi tên. Đầu mũi to theo bề rộng nét nhưng không dài quá 45% cả
 * cú kéo (mũi tên ngắn vẫn ra hình mũi tên, không thành cái nêm).
 */
export function arrowParts(
  from: Point,
  to: Point,
  strokeSize: number,
): { shaft: [Point, Point]; head: [Point, Point, Point]; headLength: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const size = Number.isFinite(strokeSize) && strokeSize > 0 ? strokeSize : 1;
  if (len < 0.5) {
    return { shaft: [from, to], head: [to, to, to], headLength: 0 };
  }
  const ux = dx / len;
  const uy = dy / len;
  const headLength = Math.min(len * 0.45, Math.max(10, size * 4));
  const headWidth = headLength * 0.75;
  const base: Point = { x: to.x - ux * headLength, y: to.y - uy * headLength };
  // Pháp tuyến của trục mũi tên
  const px = -uy;
  const py = ux;
  return {
    shaft: [from, base],
    head: [
      { x: base.x + px * (headWidth / 2), y: base.y + py * (headWidth / 2) },
      to,
      { x: base.x - px * (headWidth / 2), y: base.y - py * (headWidth / 2) },
    ],
    headLength,
  };
}

/** Phần `ctx` mà việc dựng đường bao cần (đủ để test bằng bản ghi giả). */
export interface PathCtx {
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rotation: number,
    start: number,
    end: number,
  ): void;
  closePath(): void;
}

/**
 * Dựng đường bao của một hình vào `ctx` (chưa tô, chưa viền).
 * - `rect` / `polygon` / `star`: đa giác kín.
 * - `circle`: ellipse nội tiếp hộp bao.
 * - `line`: một đoạn thẳng (không kín).
 * - `arrow`: thân (không kín) **và** tam giác đầu mũi (kín) trong cùng đường
 *   bao; `fill()` chỉ có tác dụng với tam giác vì thân không có diện tích.
 */
export function buildShapePath(
  ctx: PathCtx,
  kind: ShapeKind,
  from: Point,
  to: Point,
  sides = 5,
  strokeSize = 3,
): void {
  const b = boundsFrom(from, to);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const rx = b.w / 2;
  const ry = b.h / 2;
  ctx.beginPath();
  switch (kind) {
    case "circle":
      ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
      break;
    case "line":
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      break;
    case "arrow": {
      const { shaft, head } = arrowParts(from, to, strokeSize);
      ctx.moveTo(shaft[0].x, shaft[0].y);
      ctx.lineTo(shaft[1].x, shaft[1].y);
      ctx.moveTo(head[0].x, head[0].y);
      ctx.lineTo(head[1].x, head[1].y);
      ctx.lineTo(head[2].x, head[2].y);
      ctx.closePath();
      break;
    }
    case "polygon": {
      const pts = polygonPoints(cx, cy, rx, ry, sides);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      break;
    }
    case "star": {
      const pts = starPoints(cx, cy, rx, ry, sides);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      break;
    }
    default:
      // Chữ nhật: viết bằng moveTo/lineTo để không cần thêm `rect` vào PathCtx
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + b.w, b.y);
      ctx.lineTo(b.x + b.w, b.y + b.h);
      ctx.lineTo(b.x, b.y + b.h);
      ctx.closePath();
      break;
  }
}
