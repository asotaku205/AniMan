/**
 * Rãnh hành động (Phase 4): chọn đoạn clip đang phát tại thời điểm t.
 * Thuần logic, không phụ thuộc Three.js — test được trực tiếp.
 */

import type { ActionSegment } from "./previz";

export interface ActiveAction {
  segment: ActionSegment;
  /** Thời gian trong clip, đã nhân tốc độ (chưa vòng lặp — mixer tự vòng). */
  localSec: number;
}

export function createActionSegment(
  clipName: string,
  startSec: number,
  durationSec = 2,
): ActionSegment {
  return {
    id: `act-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    clipName,
    startSec,
    durationSec: Math.max(0.1, durationSec),
    loop: true,
    speed: 1,
  };
}

/**
 * Đoạn đang phát tại t. Đoạn chồng nhau thì đoạn bắt đầu muộn nhất
 * thắng (người dùng xếp đoạn mới đè lên đoạn cũ).
 */
export function sampleActionSegment(
  actions: readonly ActionSegment[] | undefined,
  t: number,
): ActiveAction | null {
  if (!actions || actions.length === 0) return null;
  let best: ActionSegment | null = null;
  for (const a of actions) {
    if (t >= a.startSec && t < a.startSec + a.durationSec) {
      if (!best || a.startSec >= best.startSec) best = a;
    }
  }
  if (!best) return null;
  return { segment: best, localSec: (t - best.startSec) * best.speed };
}
