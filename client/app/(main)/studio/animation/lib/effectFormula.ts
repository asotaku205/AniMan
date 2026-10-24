/**
 * Công thức hiệu ứng hạt 3D (Phase 5): mỗi hiệu ứng là một bộ lớp phát
 * hạt, mỗi hạt có tham số cố định rút từ seed — nên cùng một thời điểm
 * timeline luôn cho cùng một hình ảnh, xem thử và xuất phim khớp nhau.
 *
 * Quy ước: trọng lực âm = rơi xuống (mảnh văng, nước), dương = bay lên
 * (lửa, khói nhẹ). Kích thước lớp là [đầu đời, cuối đời] — lửa thu nhỏ
 * dần, khói phình to dần.
 */

export type EmitterShape = "point" | "cone" | "sphere";

export interface EffectLayer {
  /** point: chùm hẹp hướng lên · cone: chùm rộng · sphere: mọi hướng. */
  shape: EmitterShape;
  count: number;
  /** Tốc độ ban đầu (m/s), [nhỏ nhất, lớn nhất]. */
  speed: [number, number];
  /** Tuổi thọ hạt (giây), [nhỏ nhất, lớn nhất]. */
  life: [number, number];
  /** Gia tốc dọc (m/s²). */
  gravity: number;
  /** Kích thước hạt (mét), [đầu đời, cuối đời]. */
  size: [number, number];
  colorStart: string;
  colorEnd: string;
  /** true: cộng sáng (lửa, phép) · false: phủ thường (khói). */
  glow: boolean;
  /** Độ mở chùm (0..1). */
  spread: number;
  /** Độ mờ đỉnh (0..1). */
  opacity: number;
}

export interface EffectFormula {
  id: string;
  name: string;
  layers: EffectLayer[];
  seed: number;
  /** Gắn sự kiện mặc định: nổ cùng lúc hay rải theo thời lượng. */
  burstDefault: boolean;
  /** Rung camera / chớp sáng gợi ý khi gắn sự kiện (0 = không). */
  suggestedShake: number;
  suggestedFlash: number;
}

export interface EffectEvent {
  id: string;
  effectId: string;
  startSec: number;
  /** Thời lượng phát: burst thì hạt nổ cùng lúc, còn không thì hạt
   * rải đều trong khoảng này. */
  durationSec: number;
  position: { x: number; y: number; z: number };
  burst: boolean;
  /** Rung camera (0..1). */
  shake: number;
  /** Chớp sáng trắng (0..1). */
  flash: number;
}

export function newEffectId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Tuổi thọ dài nhất của công thức — để biết khi nào tắt hẳn. */
export function formulaMaxLife(formula: EffectFormula): number {
  return formula.layers.reduce((m, l) => Math.max(m, l.life[1]), 0);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [1, 1, 1];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function sampleDir(
  shape: EmitterShape,
  spread: number,
  rng: () => number,
): [number, number, number] {
  if (shape === "sphere") {
    const z = 2 * rng() - 1;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const phi = rng() * 2 * Math.PI;
    return [r * Math.cos(phi), z, r * Math.sin(phi)];
  }
  const maxAngle =
    shape === "point"
      ? ((15 + spread * 30) * Math.PI) / 180
      : (spread * 80 * Math.PI) / 180;
  const cosMax = Math.cos(maxAngle);
  const cosTheta = 1 - rng() * (1 - cosMax);
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
  const phi = rng() * 2 * Math.PI;
  return [sinTheta * Math.cos(phi), cosTheta, sinTheta * Math.sin(phi)];
}

export interface ParticleSpec {
  index: number;
  count: number;
  dir: [number, number, number];
  speed: number;
  life: number;
  burstDelay: number;
  sizeMul: number;
}

/** Tham số cố định của mọi hạt trong một lớp (rút từ seed). */
export function layerParticles(
  layer: EffectLayer,
  seed: number,
  layerIndex: number,
): ParticleSpec[] {
  const rng = mulberry32(seed ^ ((layerIndex + 1) * 2654435761));
  const out: ParticleSpec[] = [];
  for (let i = 0; i < layer.count; i += 1) {
    out.push({
      index: i,
      count: layer.count,
      dir: sampleDir(layer.shape, layer.spread, rng),
      speed: lerp(layer.speed[0], layer.speed[1], rng()),
      life: lerp(layer.life[0], layer.life[1], rng()),
      burstDelay: rng() * 0.15,
      sizeMul: 0.7 + rng() * 0.6,
    });
  }
  return out;
}

export interface ParticleState {
  pos: [number, number, number];
  size: number;
  color: [number, number, number];
  alpha: number;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Trạng thái một hạt tại thời điểm localSec (giây từ lúc sự kiện bắt
 * đầu). Trả null khi hạt chưa sinh hoặc đã tàn.
 */
export function particleStateAt(
  spec: ParticleSpec,
  layer: EffectLayer,
  localSec: number,
  burst: boolean,
  eventDuration: number,
): ParticleState | null {
  const delay = burst
    ? spec.burstDelay
    : (spec.index / Math.max(1, spec.count)) * eventDuration;
  const age = localSec - delay;
  if (age < 0 || age > spec.life) return null;
  const p = spec.life > 0 ? age / spec.life : 1;
  const c0 = hexToRgb(layer.colorStart);
  const c1 = hexToRgb(layer.colorEnd);
  return {
    pos: [
      spec.dir[0] * spec.speed * age,
      spec.dir[1] * spec.speed * age + 0.5 * layer.gravity * age * age,
      spec.dir[2] * spec.speed * age,
    ],
    size: lerp(layer.size[0], layer.size[1], p) * spec.sizeMul,
    color: [lerp(c0[0], c1[0], p), lerp(c0[1], c1[1], p), lerp(c0[2], c1[2], p)],
    alpha: layer.opacity * Math.min(1, p / 0.1) * (1 - smoothstep(0.7, 1, p)),
  };
}
