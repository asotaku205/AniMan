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

/** Hình hạt: chấm tròn cũ · sao 4 cánh · vệt dài dọc · ảnh tự tải. */
export type EffectTexture = "dot" | "star" | "streak" | "custom";

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
  // --- Field đợt 2 (đều tùy chọn, có mặc định = hành vi cũ) ---
  /** Hình hạt, mặc định "dot" = chấm tròn như trước. */
  texture?: EffectTexture;
  /** Ảnh hạt khi texture = "custom" (data URL, lưu trong công thức). */
  textureDataUrl?: string;
  /** Xoay hạt quanh tâm (độ/giây), mặc định 0 = không xoay. */
  spin?: number;
  /** Cản không khí: vận tốc giảm theo e^-drag·tuổi, mặc định 0. */
  drag?: number;
  /** Nhiễu: biên độ dao động sin quanh quỹ đạo, mặc định 0. */
  turbulence?: number;
  /** Cỡ giữa đời (nội suy 3 điểm); mặc định = giữa tuyến tính cũ. */
  sizeMid?: number;
  /** Màu giữa đời (nội suy 3 điểm); mặc định = giữa tuyến tính cũ. */
  colorMid?: string;
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
  /** Pha nhiễu riêng từng hạt (3 trục), rút từ seed. */
  phase: [number, number, number];
}

/** Hình hạt của lớp (mặc định chấm tròn cũ). */
export function layerTexture(layer: EffectLayer): EffectTexture {
  return layer.texture ?? "dot";
}

/** Tốc độ xoay hạt (độ/giây), mặc định 0. */
export function layerSpin(layer: EffectLayer): number {
  return layer.spin ?? 0;
}

/** Cản không khí, mặc định 0 = không cản. */
export function layerDrag(layer: EffectLayer): number {
  return layer.drag ?? 0;
}

/** Biên độ nhiễu, mặc định 0 = không nhiễu. */
export function layerTurbulence(layer: EffectLayer): number {
  return layer.turbulence ?? 0;
}

/** Cỡ giữa đời; mặc định là điểm giữa tuyến tính cũ. */
export function layerSizeMid(layer: EffectLayer): number {
  return layer.sizeMid ?? (layer.size[0] + layer.size[1]) / 2;
}

/** Màu giữa đời; mặc định là điểm giữa tuyến tính cũ. */
export function layerColorMid(layer: EffectLayer): [number, number, number] {
  if (layer.colorMid) return hexToRgb(layer.colorMid);
  const c0 = hexToRgb(layer.colorStart);
  const c1 = hexToRgb(layer.colorEnd);
  return [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2, (c0[2] + c1[2]) / 2];
}

/**
 * Nội suy 3 điểm theo p (0..1): nửa đầu đi đầu→giữa, nửa sau đi
 * giữa→cuối. Khi giữa là điểm giữa tuyến tính thì trùng tuyến tính cũ.
 */
export function interp3(a: number, mid: number, b: number, p: number): number {
  return p <= 0.5 ? lerp(a, mid, p * 2) : lerp(mid, b, (p - 0.5) * 2);
}

export interface ActiveEffect {
  event: EffectEvent;
  formula: EffectFormula;
}

/**
 * Sự kiện đang hoạt động tại thời điểm t (giây trong cảnh): nổ thì
 * hết sau tuổi thọ dài nhất, rải đều thì hết sau thời lượng + tuổi
 * thọ dài nhất. Sự kiện thiếu công thức bị bỏ qua, không crash.
 */
export function resolveActiveEffects(
  events: EffectEvent[],
  formulas: EffectFormula[],
  t: number,
): ActiveEffect[] {
  const out: ActiveEffect[] = [];
  for (const event of events) {
    const formula = formulas.find((f) => f.id === event.effectId);
    if (!formula) continue;
    const local = t - event.startSec;
    const end = event.burst
      ? formulaMaxLife(formula)
      : event.durationSec + formulaMaxLife(formula);
    if (local >= 0 && local <= end) out.push({ event, formula });
  }
  return out;
}

/**
 * Rung camera + chớp sáng tại thời điểm t — đúng công thức trình dựng
 * đang dùng: rung giảm dần trong thời lượng sự kiện, chớp chỉ trong
 * 0.3s đầu rồi tắt.
 */
export function effectShakeFlash(
  events: EffectEvent[],
  t: number,
): { shake: number; flash: number } {
  let shake = 0;
  let flash = 0;
  for (const event of events) {
    const local = t - event.startSec;
    if (local >= 0 && local <= event.durationSec) {
      shake = Math.max(
        shake,
        event.shake * (1 - local / Math.max(0.1, event.durationSec)),
      );
    }
    if (event.flash > 0 && local >= 0 && local <= 0.3) {
      flash = Math.max(flash, event.flash * (1 - local / 0.3));
    }
  }
  return { shake, flash };
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
      // Rút cuối cùng: không đổi thứ tự rút của các field trước đó.
      phase: [rng() * 2 * Math.PI, rng() * 2 * Math.PI, rng() * 2 * Math.PI],
    });
  }
  return out;
}

export interface ParticleState {
  pos: [number, number, number];
  size: number;
  color: [number, number, number];
  alpha: number;
  /** Góc xoay hạt quanh tâm (radian) tại thời điểm này. */
  angle: number;
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
  const cm = layerColorMid(layer);
  // Cản gió: quãng đi theo (1 - e^-d·tuổi)/d; d = 0 thì đúng speed·tuổi cũ.
  const drag = layerDrag(layer);
  const travel =
    drag > 0
      ? (spec.speed * (1 - Math.exp(-drag * age))) / drag
      : spec.speed * age;
  // Nhiễu: dao động sin quanh quỹ đạo, biên độ = turbulence, pha riêng.
  const tb = layerTurbulence(layer);
  const mid = layerSizeMid(layer);
  return {
    pos: [
      spec.dir[0] * travel + tb * Math.sin(age * 3.1 + spec.phase[0]),
      spec.dir[1] * travel +
        0.5 * layer.gravity * age * age +
        tb * Math.sin(age * 2.7 + spec.phase[1]),
      spec.dir[2] * travel + tb * Math.sin(age * 3.7 + spec.phase[2]),
    ],
    size: interp3(layer.size[0], mid, layer.size[1], p) * spec.sizeMul,
    color: [
      interp3(c0[0], cm[0], c1[0], p),
      interp3(c0[1], cm[1], c1[1], p),
      interp3(c0[2], cm[2], c1[2], p),
    ],
    alpha: layer.opacity * Math.min(1, p / 0.1) * (1 - smoothstep(0.7, 1, p)),
    angle: (layerSpin(layer) * Math.PI) / 180 * age,
  };
}
