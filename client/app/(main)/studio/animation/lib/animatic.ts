/**
 * Animatic — bản phát thử của bảng phân cảnh: các cảnh chạy nối tiếp theo
 * đúng thời lượng đã đặt để **chốt nhịp phim trước khi làm chuyển động**
 * (khuyến nghị số 1 từ research pain point: animatic làm sớm, sửa nhịp lúc
 * còn rẻ). File này là logic thuần về mốc thời gian; trình phát nằm ở
 * `components/AnimaticPlayer.tsx`.
 */

import type { AnimScene } from "./animProject";

export interface AnimaticSegment {
  sceneId: string;
  index: number;
  startSec: number;
  endSec: number;
}

/** Dựng các đoạn thời gian liên tục từ danh sách cảnh. */
export function animaticTimeline(scenes: AnimScene[]): AnimaticSegment[] {
  const segments: AnimaticSegment[] = [];
  let cursor = 0;
  scenes.forEach((scene, index) => {
    const dur = Math.max(0, scene.durationSec || 0);
    segments.push({
      sceneId: scene.id,
      index,
      startSec: cursor,
      endSec: cursor + dur,
    });
    cursor += dur;
  });
  return segments;
}

/** Cảnh đang chiếu tại thời điểm t (giây); t vượt cuối → cảnh cuối. */
export function segmentAtTime(
  segments: AnimaticSegment[],
  tSec: number,
): AnimaticSegment | null {
  if (segments.length === 0) return null;
  const t = Math.max(0, tSec);
  for (const seg of segments) {
    if (t < seg.endSec) return seg;
  }
  return segments[segments.length - 1];
}

/** Tiến độ 0..1 của một cảnh tại thời điểm t. */
export function segmentProgress(seg: AnimaticSegment, tSec: number): number {
  const span = seg.endSec - seg.startSec;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (tSec - seg.startSec) / span));
}
