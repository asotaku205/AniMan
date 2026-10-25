/**
 * Hậu kỳ cảnh khi XUẤT PHIM HOÀN CHỈNH: tái dùng đúng cài đặt hậu kỳ
 * của trình dựng cảnh (phát sáng / mờ hậu cảnh / dư ảnh) + khung dọc
 * 9:16 cho trình dựng. Toàn hàm thuần để test được không cần WebGL.
 */

import {
  DEFAULT_SCENE_POST,
  scenePostOf,
  type ScenePostSettings,
} from "./scenePost";

/** Có hiệu ứng hậu kỳ nào đang bật không (phát sáng / mờ hậu cảnh / dư ảnh). */
export function filmPostActive(post: ScenePostSettings): boolean {
  return (
    !!post.bloom?.enabled || !!post.dof?.enabled || !!post.afterimage?.enabled
  );
}

/**
 * Cài đặt hậu kỳ hiệu lực khi xuất phim: tắt công tắc hậu kỳ thì về
 * mặc định tắt hết (bản xuất giữ nguyên như cũ); bật thì dùng đúng
 * cài đặt đã kẹp của cảnh.
 */
export function effectiveFilmPost(
  scene: { scenePost?: ScenePostSettings } | null | undefined,
  applyScenePost: boolean,
): ScenePostSettings {
  if (!applyScenePost) return DEFAULT_SCENE_POST;
  return scenePostOf(scene);
}

export interface FrameBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Khung dọc 9:16 lớn nhất vừa trong ô xem (căn giữa) + khung an toàn
 * 90% bên trong (lề 5% mỗi phía) để căn hình đúng tỉ lệ sẽ xuất ra.
 */
export function verticalFrame(
  viewWidth: number,
  viewHeight: number,
): { frame: FrameBox; safe: FrameBox } {
  const zero: FrameBox = { x: 0, y: 0, width: 0, height: 0 };
  if (!(viewWidth > 0) || !(viewHeight > 0)) {
    return { frame: { ...zero }, safe: { ...zero } };
  }
  let fw = viewWidth;
  let fh = (fw * 16) / 9;
  if (fh > viewHeight) {
    fh = viewHeight;
    fw = (fh * 9) / 16;
  }
  const fx = (viewWidth - fw) / 2;
  const fy = (viewHeight - fh) / 2;
  const insetX = fw * 0.05;
  const insetY = fh * 0.05;
  return {
    frame: { x: fx, y: fy, width: fw, height: fh },
    safe: {
      x: fx + insetX,
      y: fy + insetY,
      width: fw - insetX * 2,
      height: fh - insetY * 2,
    },
  };
}
