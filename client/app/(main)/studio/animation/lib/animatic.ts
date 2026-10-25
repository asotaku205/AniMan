/**
 * Animatic — bản phát thử của bảng phân cảnh: các cảnh chạy nối tiếp theo
 * đúng thời lượng đã đặt để **chốt nhịp phim trước khi làm chuyển động**
 * (khuyến nghị số 1 từ research pain point: animatic làm sớm, sửa nhịp lúc
 * còn rẻ). File này là logic thuần về mốc thời gian; trình phát nằm ở
 * `components/AnimaticPlayer.tsx`.
 */

import { sceneSpeed, type AnimScene } from "./animProject";
import {
  CREDIT_LINE_HEIGHT,
  CREDIT_SPEED_DEFAULT,
  TITLE_CARD_SEC,
  creditRollDuration,
  type PostSettings,
} from "./postFx";

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

/**
 * Timeline phim theo THỜI GIAN CHIẾU (giai đoạn C): mỗi cảnh chiếm
 * durationSec / speed giây trên đồng hồ chiếu; thời gian nội dung trong
 * cảnh = (thời gian chiếu - mốc bắt đầu) × speed. Timeline cũ
 * (animaticTimeline) giữ nguyên để không vỡ code dùng thời gian nội dung.
 */

export interface FilmSegment {
  sceneId: string;
  index: number;
  /** Mốc bắt đầu trên đồng hồ chiếu (giây). */
  startSec: number;
  /** Mốc kết thúc trên đồng hồ chiếu (giây). */
  endSec: number;
  /** Thời lượng nội dung của cảnh (giây). */
  contentDurationSec: number;
  /** Hệ số tốc độ của cảnh. */
  speed: number;
}

/** Dựng các đoạn phim theo thời gian chiếu (đã áp tốc độ từng cảnh). */
export function filmTimeline(scenes: AnimScene[]): FilmSegment[] {
  const segments: FilmSegment[] = [];
  let cursor = 0;
  scenes.forEach((scene, index) => {
    const speed = sceneSpeed(scene);
    const content = Math.max(0, scene.durationSec || 0);
    const wall = content / speed;
    segments.push({
      sceneId: scene.id,
      index,
      startSec: cursor,
      endSec: cursor + wall,
      contentDurationSec: content,
      speed,
    });
    cursor += wall;
  });
  return segments;
}

/** Đoạn đang chiếu tại thời điểm chiếu t; vượt cuối → đoạn cuối. */
export function segmentAtWallTime(
  segments: FilmSegment[],
  tSec: number,
): FilmSegment | null {
  if (segments.length === 0) return null;
  const t = Math.max(0, tSec);
  for (const seg of segments) {
    if (t < seg.endSec) return seg;
  }
  return segments[segments.length - 1];
}

/** Đổi thời gian chiếu trong đoạn ra thời gian nội dung của cảnh. */
export function contentTimeInSegment(seg: FilmSegment, tWallSec: number): number {
  return Math.min(
    seg.contentDurationSec,
    Math.max(0, (tWallSec - seg.startSec) * seg.speed),
  );
}

export interface PreviewTimeline {
  /** Cửa sổ tiêu đề đầu phim (giây, 0 khi tắt). */
  titleSec: number;
  /** Các đoạn cảnh theo thời gian XEM (đã cộng cửa sổ tiêu đề). */
  segments: FilmSegment[];
  /** Cửa sổ credit cuối phim (giây, 0 khi không có dòng nào). */
  creditsSec: number;
  /** Tổng thời gian xem (tiêu đề + cảnh + credit). */
  totalSec: number;
}

/**
 * Timeline phát thử toàn phim: tiêu đề đầu phim + các cảnh theo thời
 * gian chiếu + credit cuối phim.
 */
export function previewTimeline(project: {
  scenes: AnimScene[];
  post?: PostSettings;
}): PreviewTimeline {
  const post = project.post;
  const titleSec = post?.titleCard ? TITLE_CARD_SEC : 0;
  const wall = filmTimeline(project.scenes);
  const segments = wall.map((s) => ({
    ...s,
    startSec: s.startSec + titleSec,
    endSec: s.endSec + titleSec,
  }));
  const lines = post?.creditsLines ?? [];
  const creditsSec =
    lines.length > 0
      ? creditRollDuration(
          lines.length,
          CREDIT_LINE_HEIGHT,
          540,
          post?.creditsSpeed && post.creditsSpeed > 0
            ? post.creditsSpeed
            : CREDIT_SPEED_DEFAULT,
        )
      : 0;
  const wallTotal = wall.length > 0 ? wall[wall.length - 1].endSec : 0;
  return {
    titleSec,
    segments,
    creditsSec,
    totalSec: titleSec + wallTotal + creditsSec,
  };
}
