/**
 * symmetry — trục đối xứng khi vẽ (BRD T-1 #13: trục dọc / ngang / hai đường chéo).
 *
 * Module thuần: chỉ tính **ma trận biến đổi canvas**, chỗ gọi tự `setTransform`
 * rồi vẽ lại. Nhờ vậy nét đối xứng không cần thuật toán vẽ riêng: vẽ đúng một
 * lần, lặp lại N lần với N ma trận.
 */

import type { Point } from "./viewport";

export type SymmetryMode =
  | "off"
  | "vertical"
  | "horizontal"
  | "cross"
  | "diagonal";

/** Ma trận affine 2D kiểu canvas: `[a c e; b d f]`. */
export interface SymmetryMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  /** Nhãn đọc được, dùng cho test và log. */
  label: string;
}

export const SYMMETRY_MODES: readonly SymmetryMode[] = [
  "off",
  "vertical",
  "horizontal",
  "cross",
  "diagonal",
];

const SYMMETRY_LABELS: Record<SymmetryMode, string> = {
  off: "Tắt",
  vertical: "Dọc",
  horizontal: "Ngang",
  cross: "Dọc + ngang",
  diagonal: "2 chéo",
};

const SYMMETRY_HINTS: Record<SymmetryMode, string> = {
  off: "Vẽ bình thường, không đối xứng",
  vertical: "Gương qua trục dọc giữa khung (2 nét)",
  horizontal: "Gương qua trục ngang giữa khung (2 nét)",
  cross: "Gương cả trục dọc lẫn trục ngang (4 nét)",
  diagonal: "Gương qua hai đường chéo của khung (4 nét)",
};

/** Nhãn tiếng Việt của một chế độ đối xứng. */
export function symmetryLabel(mode: SymmetryMode): string {
  return SYMMETRY_LABELS[mode] ?? SYMMETRY_LABELS.off;
}

/** Câu giải thích đầy đủ của một chế độ đối xứng (tooltip trên nút chọn). */
export function symmetryHint(mode: SymmetryMode): string {
  return SYMMETRY_HINTS[mode] ?? SYMMETRY_HINTS.off;
}

/**
 * Danh sách ma trận cần vẽ cho một chế độ. Phần tử đầu **luôn** là ma trận đơn
 * vị (nét gốc), nên số nét = `symmetryTransforms(...).length`.
 *
 * - `vertical`: gương qua trục dọc giữa khung (2 nét).
 * - `horizontal`: gương qua trục ngang giữa khung (2 nét).
 * - `cross`: dọc + ngang + quay 180° (4 nét).
 * - `diagonal`: hai đường chéo + quay 180° (4 nét).
 */
export function symmetryTransforms(
  mode: SymmetryMode,
  width: number,
  height: number,
): SymmetryMatrix[] {
  const identity: SymmetryMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, label: "identity" };
  if (mode === "off" || width <= 0 || height <= 0) return [identity];

  const cx = width / 2;
  const cy = height / 2;
  // Gương trái/phải: x' = width - x
  const vertical: SymmetryMatrix = { a: -1, b: 0, c: 0, d: 1, e: width, f: 0, label: "vertical" };
  // Gương trên/dưới: y' = height - y
  const horizontal: SymmetryMatrix = { a: 1, b: 0, c: 0, d: -1, e: 0, f: height, label: "horizontal" };
  // Quay 180° quanh tâm khung
  const rotate180: SymmetryMatrix = { a: -1, b: 0, c: 0, d: -1, e: width, f: height, label: "rotate180" };
  // Gương qua đường chéo chính (y = x, dời về tâm khung)
  const diagonal: SymmetryMatrix = { a: 0, b: 1, c: 1, d: 0, e: cx - cy, f: cy - cx, label: "diagonal" };
  // Gương qua đường chéo phụ (x + y = cx + cy)
  const antiDiagonal: SymmetryMatrix = { a: 0, b: -1, c: -1, d: 0, e: cx + cy, f: cx + cy, label: "antiDiagonal" };

  switch (mode) {
    case "vertical":
      return [identity, vertical];
    case "horizontal":
      return [identity, horizontal];
    case "cross":
      return [identity, vertical, horizontal, rotate180];
    case "diagonal":
      return [identity, diagonal, antiDiagonal, rotate180];
    default:
      return [identity];
  }
}

/** Phần `ctx` mà việc lặp nét đối xứng cần (đủ để test bằng bản ghi giả). */
export interface TransformCtx {
  save(): void;
  restore(): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
}

/**
 * Vẽ `draw` một lần cho mỗi ma trận của chế độ đối xứng. Trả về số lần đã vẽ.
 * `save`/`restore` bao từng lượt nên `draw` có thể đổi `globalAlpha`/`filter`
 * thoải mái mà không rò sang lượt sau.
 */
export function drawWithSymmetry(
  ctx: TransformCtx,
  mode: SymmetryMode,
  width: number,
  height: number,
  draw: () => void,
): number {
  const list = symmetryTransforms(mode, width, height);
  for (const m of list) {
    ctx.save();
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    draw();
    ctx.restore();
  }
  return list.length;
}

/** Đoạn thẳng chỉ đường cho trục đối xứng (vẽ trên lớp phủ, không xuất ảnh). */
export interface GuideSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Các đường trục để vẽ gợi ý trong lúc đang bật đối xứng. Trả về `[]` với chế
 * độ `off`. Đường chéo luôn nối hai góc đối nhau của khung.
 */
export function symmetryGuides(
  mode: SymmetryMode,
  width: number,
  height: number,
): GuideSegment[] {
  if (mode === "off") return [];
  const cx = width / 2;
  const cy = height / 2;
  const vertical: GuideSegment = { x1: cx, y1: 0, x2: cx, y2: height };
  const horizontal: GuideSegment = { x1: 0, y1: cy, x2: width, y2: cy };
  switch (mode) {
    case "vertical":
      return [vertical];
    case "horizontal":
      return [horizontal];
    case "cross":
      return [vertical, horizontal];
    case "diagonal":
      return [
        { x1: 0, y1: 0, x2: width, y2: height },
        { x1: width, y1: 0, x2: 0, y2: height },
      ];
    default:
      return [];
  }
}

/**
 * Điểm ảnh gương của `p` theo một ma trận (dùng cho công cụ hiệu ứng: mỗi bản
 * gương phải lấy mẫu pixel tại đúng chỗ gương).
 */
export function transformSymmetryPoint(p: Point, m: SymmetryMatrix): Point {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}
