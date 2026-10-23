/**
 * Vệt vẽ tay (R3, chỉ 2D): người dùng vẽ thẳng lên khung hình bằng
 * chuột/bút — nét vẽ xuất hiện DẦN theo thời gian (đoạn đã vẽ hiện ra
 * theo tiến độ), dùng cho vệt sáng phép thuật, đường bay của vật,
 * vòng tròn nhấn mạnh... Hàm thuần: phần nét hiện tại t tính theo độ
 * dài đường vẽ nên editor, phát thử và bản xuất khớp nhau.
 */

export interface StrokePoint {
  x: number;
  y: number;
}

export interface SceneStroke {
  id: string;
  color: string;
  /** Độ dày nét — pixel theo khung 960×540. */
  widthPx: number;
  points: StrokePoint[];
  /** Mốc bắt đầu hiện nét (giây trong cảnh). */
  startSec: number;
  /** Thời gian để nét hiện trọn (giây). */
  durationSec: number;
}

let strokeCounter = 0;

export function newStrokeId(): string {
  strokeCounter += 1;
  return `stroke-${Date.now().toString(36)}-${strokeCounter.toString(36)}`;
}

export function strokeProgress(stroke: SceneStroke, t: number): number {
  if (t < stroke.startSec) return 0;
  if (stroke.durationSec <= 0) return 1;
  return Math.min(1, (t - stroke.startSec) / stroke.durationSec);
}

export function strokeTotalLength(points: readonly StrokePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
  }
  return total;
}

/** Phần nét vẽ cần hiện tại t: các điểm đã "chạy" tới theo tiến độ độ dài. */
export function strokeVisiblePoints(
  stroke: SceneStroke,
  t: number,
): StrokePoint[] {
  const progress = strokeProgress(stroke, t);
  if (progress <= 0 || stroke.points.length === 0) return [];
  if (progress >= 1) return [...stroke.points];
  const target = strokeTotalLength(stroke.points) * progress;
  const out: StrokePoint[] = [stroke.points[0]];
  let walked = 0;
  for (let i = 1; i < stroke.points.length; i++) {
    const a = stroke.points[i - 1];
    const b = stroke.points[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (walked + seg >= target) {
      const f = seg <= 0 ? 1 : (target - walked) / seg;
      out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
      return out;
    }
    walked += seg;
    out.push(b);
  }
  return out;
}
