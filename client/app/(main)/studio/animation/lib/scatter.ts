/**
 * Rải vật có seed (giai đoạn B): cùng seed cho cùng cách rải để người
 * dùng rải lại được đúng cảnh cũ, hoặc đổi seed lấy cách rải khác.
 */

import { mulberry32 } from "./terrainBrush";

export interface ScatterPlacement {
  x: number;
  z: number;
  /** Xoay Y (độ). */
  rotationY: number;
  scale: number;
}

export interface ScatterOptions {
  count: number;
  /** Nửa cạnh vùng rải vuông (mét), mặc định 12 (trong sân 30m). */
  half?: number;
  minScale?: number;
  maxScale?: number;
  seed?: number;
}

export function scatterPlacements(opts: ScatterOptions): ScatterPlacement[] {
  const half = opts.half ?? 12;
  const minScale = opts.minScale ?? 0.8;
  const maxScale = opts.maxScale ?? 1.4;
  const rng = mulberry32(opts.seed ?? 1);
  const out: ScatterPlacement[] = [];
  for (let i = 0; i < opts.count; i += 1) {
    out.push({
      x: (rng() * 2 - 1) * half,
      z: (rng() * 2 - 1) * half,
      rotationY: rng() * 360,
      scale: minScale + rng() * (maxScale - minScale),
    });
  }
  return out;
}
