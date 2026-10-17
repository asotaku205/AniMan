/**
 * gradient — công cụ chuyển sắc (BRD T-1 #11: "Chuyển sắc 2 đầu màu").
 *
 * Thiết kế chốt 17/10/2026 (người dùng chọn): đầu thứ nhất là **màu đang vẽ**,
 * đầu thứ hai chọn trong thanh thuộc tính: trong suốt (mặc định) / trắng / đen.
 * Kiểu: ngang dọc (linear) hoặc toả tròn (radial).
 */

/** Màu ở đầu thứ hai của dải chuyển sắc. */
export type GradientEnd = "transparent" | "white" | "black";

/** Cách trải màu giữa hai đầu. */
export type GradientShape = "linear" | "radial";

export const GRADIENT_ENDS: readonly GradientEnd[] = ["transparent", "white", "black"];
export const GRADIENT_SHAPES: readonly GradientShape[] = ["linear", "radial"];

const END_LABELS: Record<GradientEnd, string> = {
  transparent: "Trong suốt",
  white: "Trắng",
  black: "Đen",
};

const SHAPE_LABELS: Record<GradientShape, string> = {
  linear: "Ngang dọc",
  radial: "Toả tròn",
};

export function gradientEndLabel(end: GradientEnd): string {
  return END_LABELS[end] ?? END_LABELS.transparent;
}

export function gradientShapeLabel(shape: GradientShape): string {
  return SHAPE_LABELS[shape] ?? SHAPE_LABELS.linear;
}

/** `#rgb` / `#rrggbb` → `[r, g, b]`; mã hỏng → đen. */
export function parseHexColor(color: string): [number, number, number] {
  let c = (color ?? "").replace("#", "").trim();
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(c)) return [0, 0, 0];
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Hai màu dừng của dải. Đầu "trong suốt" giữ **đúng hệ màu** của màu đang vẽ
 * với alpha 0 (thay vì đen trong suốt) để chỗ mờ dần không bị xám bẩn.
 */
export function gradientStops(
  color: string,
  end: GradientEnd,
): { from: string; to: string } {
  if (end === "white") return { from: color, to: "#ffffff" };
  if (end === "black") return { from: color, to: "#000000" };
  const [r, g, b] = parseHexColor(color);
  return { from: color, to: `rgba(${r}, ${g}, ${b}, 0)` };
}

/** Vùng `ctx` cần cho việc dựng dải chuyển sắc (đủ để test bằng bản ghi giả). */
export interface GradientCtx {
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): CanvasGradient;
}

/**
 * Dải chuyển sắc cho cú kéo A → B. Kiểu toả tròn lấy A làm tâm và bán kính là
 * khoảng cách A–B (kéo càng xa vệt màu càng loang rộng).
 */
export function buildGradient(
  ctx: GradientCtx,
  shape: GradientShape,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  end: GradientEnd,
): CanvasGradient {
  const stops = gradientStops(color, end);
  const gradient =
    shape === "radial"
      ? ctx.createRadialGradient(
          from.x,
          from.y,
          0,
          from.x,
          from.y,
          Math.max(1, Math.hypot(to.x - from.x, to.y - from.y)),
        )
      : ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  gradient.addColorStop(0, stops.from);
  gradient.addColorStop(1, stops.to);
  return gradient;
}
