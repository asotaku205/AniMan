/**
 * viewport — phép biến đổi khung nhìn cho pan/zoom (BR-T06: đổi góc nhìn,
 * KHÔNG đổi pixel dữ liệu).
 *
 * Quy ước: `screen = artwork * scale + t`
 * - `scale`: số pixel màn hình cho 1 pixel artwork (tuyệt đối).
 * - `t` (`tx`, `ty`): gốc artwork nằm ở đâu trong hộp khung nhìn (screen px).
 *
 * BRD nói zoom 10%–800% là **tương đối** so với khung vừa khít (`fitView`).
 * Hook tự tính `fitScale` rồi gọi `clampScale` với
 * `[fitScale * MIN_ZOOM, fitScale * MAX_ZOOM]`.
 */

export interface ViewportView {
  scale: number;
  tx: number;
  ty: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Hệ số zoom tương đối nhỏ nhất / lớn nhất (BR-T06: 10%–800%). */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;

/** Biên `scale` mặc định, dùng khi không có `fitScale` để quy chiếu. */
export const MIN_SCALE = MIN_ZOOM;
export const MAX_SCALE = MAX_ZOOM;

/** Kẹp `scale` vào [min, max]; giá trị không hợp lệ → biên dưới. */
export function clampScale(
  scale: number,
  min = MIN_SCALE,
  max = MAX_SCALE,
): number {
  if (!Number.isFinite(scale)) return min;
  return Math.max(min, Math.min(max, scale));
}

/**
 * Khung vừa khít ảnh vào hộp khung nhìn, căn giữa (letterbox — RC-1).
 * Thay thế đúng hành vi `Math.min(rect.w/w, rect.h/h)` + căn giữa hiện tại.
 */
export function fitView(
  artW: number,
  artH: number,
  viewW: number,
  viewH: number,
): ViewportView {
  if (artW <= 0 || artH <= 0 || viewW <= 0 || viewH <= 0) {
    return { scale: 1, tx: 0, ty: 0 };
  }
  const scale = Math.min(viewW / artW, viewH / artH);
  return {
    scale,
    tx: (viewW - artW * scale) / 2,
    ty: (viewH - artH * scale) / 2,
  };
}

/** Dịch khung nhìn theo screen px; không đổi `scale`. */
export function panBy(view: ViewportView, dx: number, dy: number): ViewportView {
  return { scale: view.scale, tx: view.tx + dx, ty: view.ty + dy };
}

/** Phóng/thu quanh một điểm màn hình, giữ điểm artwork dưới con trỏ đứng yên. */
export function zoomAt(
  view: ViewportView,
  factor: number,
  sx: number,
  sy: number,
  min = MIN_SCALE,
  max = MAX_SCALE,
): ViewportView {
  const scale = clampScale(view.scale * factor, min, max);
  if (view.scale === 0) return { scale, tx: view.tx, ty: view.ty };
  const ratio = scale / view.scale;
  return {
    scale,
    tx: sx - (sx - view.tx) * ratio,
    ty: sy - (sy - view.ty) * ratio,
  };
}

/** Điểm màn hình → toạ độ artwork (pixel backing). */
export function screenToArtwork(
  view: ViewportView,
  sx: number,
  sy: number,
): Point {
  return { x: (sx - view.tx) / view.scale, y: (sy - view.ty) / view.scale };
}

/** Toạ độ artwork → điểm màn hình. */
export function artworkToScreen(
  view: ViewportView,
  ax: number,
  ay: number,
): Point {
  return { x: ax * view.scale + view.tx, y: ay * view.scale + view.ty };
}
