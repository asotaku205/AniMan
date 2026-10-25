/**
 * Cú máy mẫu (giai đoạn D): sinh camera keys bình thường từ một cú máy
 * chọn sẵn — xong người dùng sửa từng key tay như cũ được, không bị
 * khoá vào mẫu. Focus pull sinh thêm mốc điểm nét (xem `FocusKey`).
 */

import {
  newPrevizId,
  vec3,
  type FocusKey,
  type PrevizCameraKey,
  type Vec3,
} from "./previz";

export type ShotPresetId =
  | "dolly-in"
  | "dolly-out"
  | "crane-up"
  | "crane-down"
  | "orbit"
  | "tracking"
  | "focus-pull"
  | "handheld";

export const SHOT_PRESETS: Array<{
  id: ShotPresetId;
  label: string;
  desc: string;
}> = [
  { id: "dolly-in", label: "Tiến lại gần", desc: "Máy tiến thẳng về phía điểm nhìn." },
  { id: "dolly-out", label: "Lùi ra xa", desc: "Máy lùi thẳng khỏi điểm nhìn." },
  { id: "crane-up", label: "Nâng máy lên", desc: "Máy nâng cao dần, điểm nhìn giữ nguyên." },
  { id: "crane-down", label: "Hạ máy xuống", desc: "Máy hạ thấp dần, điểm nhìn giữ nguyên." },
  { id: "orbit", label: "Quay quanh", desc: "Máy đi vòng quanh mục tiêu, luôn nhìn vào nó." },
  { id: "tracking", label: "Đi theo nhân vật", desc: "Máy bám theo đường đi của vật đã chọn." },
  { id: "focus-pull", label: "Chuyển điểm nét", desc: "Máy đứng yên, điểm nét chuyển từ gần sang xa (cần bật mờ hậu cảnh)." },
  { id: "handheld", label: "Rung tay nhẹ", desc: "Máy rung nhẹ tự nhiên như quay tay." },
];

export function shotLabel(id: ShotPresetId): string {
  return SHOT_PRESETS.find((p) => p.id === id)?.label ?? id;
}

export interface ShotBuildOptions {
  startTimeSec: number;
  durationSec: number;
  fromPosition: Vec3;
  fromTarget: Vec3;
  /** Vị trí mục tiêu cho quay quanh / đi theo (mặc định = điểm nhìn). */
  targetPosition?: Vec3;
  /** Khoảng tiến/lùi của dolly (mặc định 35% khoảng cách hiện tại). */
  moveDistance?: number;
  /** Độ nâng/hạ của crane (mặc định 2m). */
  height?: number;
  /** Góc quay của orbit (độ, mặc định 90). */
  angleDeg?: number;
  /** Đường đi của vật cho tracking (mốc thời gian + vị trí). */
  pathSamples?: Array<{ timeSec: number; position: Vec3 }>;
  /** Điểm nét đầu/cuối cho focus pull (mặc định 3m → 9m). */
  focusFrom?: number;
  focusTo?: number;
  /** Seed rung tay (mặc định 1 — cùng seed ra cùng key). */
  seed?: number;
}

export interface BuiltShot {
  keys: PrevizCameraKey[];
  focusKeys: FocusKey[];
}

const clampNum = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

function camKey(
  timeSec: number,
  position: Vec3,
  target: Vec3,
): PrevizCameraKey {
  return {
    id: newPrevizId("camkey"),
    timeSec: Math.round(timeSec * 100) / 100,
    position: { ...position },
    target: { ...target },
    easing: "ease-in-out",
  };
}

/** RNG xác định (mulberry32) — cùng seed ra cùng dãy rung. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildShotKeys(
  preset: ShotPresetId,
  opts: ShotBuildOptions,
): BuiltShot {
  const start = Math.max(0, opts.startTimeSec);
  const dur = Math.max(0.1, opts.durationSec);
  const end = start + dur;
  const from = opts.fromPosition;
  const target = opts.fromTarget;
  const aim = opts.targetPosition ?? target;

  switch (preset) {
    case "dolly-in":
    case "dolly-out": {
      const dx = target.x - from.x;
      const dy = target.y - from.y;
      const dz = target.z - from.z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      const move =
        opts.moveDistance ?? dist * 0.35;
      const dir = preset === "dolly-in" ? 1 : -1;
      // Không tiến quá gần điểm nhìn (giữ tối thiểu 0.5m).
      const step = Math.min(
        move,
        preset === "dolly-in" ? Math.max(0, dist - 0.5) : move,
      );
      const to = {
        x: from.x + (dx / dist) * step * dir,
        y: from.y + (dy / dist) * step * dir,
        z: from.z + (dz / dist) * step * dir,
      };
      return {
        keys: [camKey(start, from, target), camKey(end, to, target)],
        focusKeys: [],
      };
    }
    case "crane-up":
    case "crane-down": {
      const h = opts.height ?? 2;
      const dy = preset === "crane-up" ? h : -h;
      return {
        keys: [
          camKey(start, from, target),
          camKey(end, { x: from.x, y: from.y + dy, z: from.z }, target),
        ],
        focusKeys: [],
      };
    }
    case "orbit": {
      const radius = Math.hypot(from.x - aim.x, from.z - aim.z) || 3;
      const startAngle = Math.atan2(from.z - aim.z, from.x - aim.x);
      const span = ((opts.angleDeg ?? 90) * Math.PI) / 180;
      const count = 5;
      const keys: PrevizCameraKey[] = [];
      for (let i = 0; i < count; i++) {
        const k = i / (count - 1);
        const a = startAngle + span * k;
        keys.push(
          camKey(start + dur * k, {
            x: aim.x + Math.cos(a) * radius,
            y: from.y,
            z: aim.z + Math.sin(a) * radius,
          }, aim),
        );
      }
      return { keys, focusKeys: [] };
    }
    case "tracking": {
      const path = [...(opts.pathSamples ?? [])].sort(
        (a, b) => a.timeSec - b.timeSec,
      );
      if (path.length < 2) {
        return { keys: [camKey(start, from, target)], focusKeys: [] };
      }
      const first = path[0].position;
      const offset = {
        x: from.x - first.x,
        y: from.y - first.y,
        z: from.z - first.z,
      };
      const keys = path.map((p) =>
        camKey(start + Math.max(0, p.timeSec - path[0].timeSec), {
          x: p.position.x + offset.x,
          y: p.position.y + offset.y,
          z: p.position.z + offset.z,
        }, p.position),
      );
      return { keys, focusKeys: [] };
    }
    case "focus-pull": {
      return {
        keys: [camKey(start, from, target), camKey(end, from, target)],
        focusKeys: [
          { timeSec: start, focus: opts.focusFrom ?? 3 },
          { timeSec: end, focus: opts.focusTo ?? 9 },
        ],
      };
    }
    case "handheld": {
      const rnd = mulberry32(opts.seed ?? 1);
      const step = 0.5;
      const keys: PrevizCameraKey[] = [];
      for (let t = 0; t <= dur + 1e-6; t += step) {
        const j = () => (rnd() - 0.5) * 0.16;
        keys.push(
          camKey(start + Math.min(t, dur), {
            x: from.x + j(),
            y: from.y + j(),
            z: from.z + j(),
          }, {
            x: target.x + (rnd() - 0.5) * 0.06,
            y: target.y + (rnd() - 0.5) * 0.06,
            z: target.z + (rnd() - 0.5) * 0.06,
          }),
        );
      }
      return { keys, focusKeys: [] };
    }
  }
}
