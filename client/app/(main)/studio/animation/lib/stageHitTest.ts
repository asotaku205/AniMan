/**
 * Tương tác trực tiếp trên sân khấu 2D (S3): bấm vào khung hình để CHỌN
 * layer, kéo để DỜI layer — thay vì phải tìm trong danh sách rồi chỉnh
 * số. Thuần và kiểm thử được: điểm chạm (toạ độ chuẩn hoá 0..1 theo sân
 * khấu) được chiếu ngược qua camera về không gian thế giới, rồi so với
 * hộp hiển thị của từng layer (lớp trên cùng thắng). Hộp dùng kích
 * thước danh nghĩa của layer (62% khung × scale) và bỏ qua góc xoay —
 * đủ chính xác cho thao tác chọn/kéo.
 */

import {
  sampleCamera,
  sampleLayerTransform,
  type SceneLayer,
  type SceneTimeline,
} from "./timeline";

export interface StagePoint {
  x: number;
  y: number;
}

/** Chiếu điểm sân khấu qua camera về không gian thế giới của layer. */
export function stageToWorld(
  timeline: SceneTimeline,
  t: number,
  point: StagePoint,
): StagePoint {
  const cam = sampleCamera(timeline.cameraKeys, t);
  return {
    x: (point.x - 0.5) / cam.zoom + cam.x,
    y: (point.y - 0.5) / cam.zoom + cam.y,
  };
}

export function layerAtPoint(
  timeline: SceneTimeline,
  t: number,
  point: StagePoint,
): SceneLayer | null {
  const world = stageToWorld(timeline, t, point);
  for (let i = timeline.layers.length - 1; i >= 0; i--) {
    const layer = timeline.layers[i];
    if (!layer.visible) continue;
    const tr = sampleLayerTransform(layer, t);
    const half = 0.31 * tr.scale;
    if (Math.abs(world.x - tr.x) <= half && Math.abs(world.y - tr.y) <= half)
      return layer;
  }
  return null;
}
