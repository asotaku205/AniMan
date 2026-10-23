/**
 * Timecode chuẩn studio HH:MM:SS:FF theo fps của video (Slice S3).
 * Hàm thuần: hiển thị, parse, và snap thời gian về biên frame — spotting
 * cue luôn rơi đúng frame như các công cụ chuyên nghiệp.
 */

export const FPS_OPTIONS = [23.976, 24, 25, 29.97, 30] as const;

const pad = (n: number, l = 2) => String(n).padStart(l, "0");

/** Giây → "HH:MM:SS:FF" (frame được làm tròn xuống, kẹp trong giây). */
export function formatTimecode(sec: number, fps: number): string {
  const t = Math.max(0, sec);
  const totalFrames = Math.floor(t * fps);
  const framesPerSec = Math.round(fps);
  const ff = totalFrames % framesPerSec;
  const totalSec = Math.floor(totalFrames / framesPerSec);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(ff)}`;
}

/** "HH:MM:SS:FF" (hoặc MM:SS:FF / SS:FF) → giây; sai định dạng → null. */
export function parseTimecode(value: string, fps: number): number | null {
  const parts = value.trim().split(":").map((x) => x.trim());
  if (parts.length < 2 || parts.length > 4) return null;
  const nums = parts.map((x) => Number(x));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const framesPerSec = Math.round(fps);
  let h = 0;
  let m = 0;
  let s = 0;
  let f = 0;
  if (parts.length === 4) [h, m, s, f] = nums;
  else if (parts.length === 3) [m, s, f] = nums;
  else [s, f] = nums;
  if (f >= framesPerSec || s >= 60 || m >= 60) return null;
  return h * 3600 + m * 60 + s + f / fps;
}

/** Snap thời gian về biên frame gần nhất theo fps. */
export function snapToFrame(sec: number, fps: number): number {
  return Math.round(sec * fps) / fps;
}

/** Độ dài 1 frame (giây). */
export function frameDuration(fps: number): number {
  return 1 / fps;
}
