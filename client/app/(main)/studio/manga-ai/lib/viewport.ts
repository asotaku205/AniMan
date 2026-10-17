/**
 * viewport — phép biến đổi khung nhìn cho pan/zoom (BR-T06: đổi góc nhìn,
 * KHÔNG đổi pixel dữ liệu).
 *
 * Quy ước: `screen = artwork * scale + t`
 * - `scale`: số pixel màn hình cho 1 pixel artwork (tuyệt đối).
 * - `t` (`tx`, `ty`): gốc artwork nằm ở đâu trong hộp khung nhìn (screen px).
 *
 * Zoom 100%–800% là **tương đối** so với khung vừa khít (`fitView`). Hook tự
 * tính `fitScale` rồi gọi `clampScale` với `[fitScale * MIN_ZOOM, fitScale * MAX_ZOOM]`.
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

/**
 * Hệ số zoom tương đối nhỏ nhất / lớn nhất so với khung vừa khít (BR-T06).
 * Chốt 17/10/2026: **100%–800%** — không cho thu nhỏ dưới khung vừa khít, để
 * panel luôn phủ kín khung vẽ (hết khoảng trắng thừa) và 100% là cỡ tham chiếu
 * (cỡ pixel thật khi xuất xem ở `getPanelBackingSize`).
 */
export const MIN_ZOOM = 1;
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

/**
 * Kẹp độ lệch pan để khung vẽ **không bao giờ hở khoảng trắng**:
 * - ảnh lớn hơn khung → đi xa nhất là vừa chạm biên (`±(hiển thị − khung)/2`);
 * - ảnh nhỏ hơn hoặc bằng khung → ép căn giữa (lệch 0).
 * `dispW`/`dispH` là cỡ ảnh ĐANG hiển thị (artwork × scale).
 */
export function clampPan(
  panX: number,
  panY: number,
  dispW: number,
  dispH: number,
  frameW: number,
  frameH: number,
): Point {
  const maxX = Math.max(0, (dispW - frameW) / 2);
  const maxY = Math.max(0, (dispH - frameH) / 2);
  // `+0` chứ không `-0` (kẹp số âm về 0 cho kết quả so sánh ổn định)
  const axis = (v: number, max: number) => {
    const c = Math.max(-max, Math.min(max, Number.isFinite(v) ? v : 0));
    return c === 0 ? 0 : c;
  };
  return { x: axis(panX, maxX), y: axis(panY, maxY) };
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
