/**
 * Bản nháp camera phim (dời máy quay / sửa thanh trượt): bản nháp chỉ
 * có hiệu lực tại đúng giây đã sửa. Rê thời gian đi chỗ khác thì khung
 * hình quay về key camera đã lưu — kéo camera không được kéo theo mọi
 * khung hình, và nút "Đặt key" cũng không được lưu nháp vào sai giây.
 */

import {
  samplePrevizCamera,
  type PrevizCameraKey,
  type SampledCamera,
  type Vec3,
} from "./previz";

/** Sai số cho phép khi so giây hiện tại với giây đã sửa (giây). */
export const CAMERA_DRAFT_EPS = 0.05;

export interface ShotCameraInput {
  draftDirty: boolean;
  draftTimeSec: number;
  draftPos: Vec3;
  draftTarget: Vec3;
  keys: readonly PrevizCameraKey[];
  timeSec: number;
}

/**
 * Camera phim đang hiển thị tại timeSec: bản nháp khi đang có nháp và
 * playhead đang ở (gần) giây đã sửa, còn lại nội suy từ key đã lưu.
 */
export function resolveShotCamera(input: ShotCameraInput): SampledCamera {
  if (
    input.draftDirty &&
    Math.abs(input.timeSec - input.draftTimeSec) <= CAMERA_DRAFT_EPS
  ) {
    return {
      position: { ...input.draftPos },
      target: { ...input.draftTarget },
    };
  }
  return samplePrevizCamera(input.keys, input.timeSec);
}
