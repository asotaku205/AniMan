/**
 * stroke — toán học của nét vẽ: làm mượt điểm vào và suy tham số render từ
 * thuộc tính nét (BR-T02, BR-T03). Module thuần, không DOM.
 */

import type { Point } from "./viewport";

/** Kẹp về 0–100 (giá trị không hợp lệ → 0). */
function percent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * Làm mượt nét tự do bằng **trung bình động lũy thừa** (BR-T03, "exponential
 * smoothing"): điểm ra tiến dần về điểm vào vừa nhận.
 * - `smoothing = 0` → bám tay tuyệt đối (trả đúng điểm vào, không lệch).
 * - `smoothing = 100` → rất mượt: mỗi điểm chỉ dịch 5% quãng đường.
 */
export function smoothPoint(prev: Point, next: Point, smoothing: number): Point {
  const s = percent(smoothing) / 100;
  if (s === 0) return { x: next.x, y: next.y };
  const alpha = 1 - s * 0.95;
  return {
    x: prev.x + (next.x - prev.x) * alpha,
    y: prev.y + (next.y - prev.y) * alpha,
  };
}

/** Làm mượt cả chuỗi điểm; điểm đầu giữ nguyên làm mốc. */
export function smoothStroke(
  points: readonly Point[],
  smoothing: number,
): Point[] {
  if (points.length === 0) return [];
  const out: Point[] = [{ x: points[0].x, y: points[0].y }];
  for (let i = 1; i < points.length; i += 1) {
    out.push(smoothPoint(out[i - 1], points[i], smoothing));
  }
  return out;
}

/**
 * Độ cứng đầu cọ → bán kính blur (px) cho viền nét:
 * `hardness = 100` → 0 (viền sắc), `hardness = 0` → `size / 2` (mờ hết cỡ).
 */
export function hardnessBlurRadius(hardness: number, size: number): number {
  const h = Number.isFinite(hardness) ? Math.min(100, Math.max(0, hardness)) : 100;
  const s = Number.isFinite(size) && size > 0 ? size : 1;
  return ((1 - h / 100) * s) / 2;
}

/**
 * Alpha của **một nhát cọ** khi bôi xuống, theo `flow` (BR-T02).
 * Nét chính vẫn hợp nhất vào layer **một lần** với `opacity` cả nét (AC-T2.6),
 * nên `flow` quyết định độ đậm dần khi các nhát chồng nhau.
 */
export function dabAlpha(flow: number): number {
  return Math.max(0.01, percent(flow) / 100);
}

/**
 * Hạt mực của **một nhịp phun** airbrush (BRD T-1 #12), toạ độ tương đối so với
 * tâm cọ. Bán kính lấy `sqrt(rng)` để hạt trải **đều theo diện tích** thay vì
 * dồn cục vào giữa; `rng` tiêm được nên test chạy tất định.
 */
export function sprayDabs(
  count: number,
  radius: number,
  rng: () => number = Math.random,
): Point[] {
  const n = Number.isFinite(count) ? Math.max(1, Math.round(count)) : 1;
  const r = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  const out: Point[] = [];
  for (let i = 0; i < n; i += 1) {
    const angle = rng() * Math.PI * 2;
    const dist = Math.sqrt(rng()) * r;
    out.push({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
  }
  return out;
}

/** Số hạt mỗi nhịp phun theo `flow` (%): flow càng cao phun càng dày. */
export function airbrushDabsPerTick(flow: number): number {
  return Math.max(1, Math.round(percent(flow) / 12));
}

/** Bán kính một hạt mực so với cỡ nét: hạt nhỏ, tán đều trong vùng phun. */
export function airbrushDabRadius(size: number): number {
  const s = Number.isFinite(size) && size > 0 ? size : 1;
  return Math.max(0.6, s * 0.12);
}
