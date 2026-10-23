/**
 * Hiệu ứng (S2): tham số hiệu ứng cho layer 2D + thời tiết cho cả cảnh
 * (2D lẫn 3D). Mọi hàm đều THUẦN và tất định theo thời gian t — cùng
 * cảnh + cùng t → cùng khung hình ở editor, phát thử và bản xuất.
 */

export interface LayerEffects {
  /** Số giây mờ hiện dần từ đầu khoảng xuất hiện của layer. */
  fadeInSec: number;
  /** Số giây mờ khuất dần ở cuối khoảng xuất hiện của layer. */
  fadeOutSec: number;
  /** Rung 0..1 (0 = không rung). */
  shake: number;
  /** Phát sáng 0..1. */
  glow: number;
  /** Nhịp phồng/xẹp 0..1. */
  pulse: number;
}

export const NO_LAYER_EFFECTS: LayerEffects = {
  fadeInSec: 0,
  fadeOutSec: 0,
  shake: 0,
  glow: 0,
  pulse: 0,
};

export function layerEffectsOf(
  effects: Partial<LayerEffects> | undefined,
): LayerEffects {
  return { ...NO_LAYER_EFFECTS, ...(effects ?? {}) };
}

export interface LayerEffectSample {
  opacityMul: number;
  shakeX: number;
  shakeY: number;
  glowPx: number;
  scaleMul: number;
}

function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Mẫu hiệu ứng tại thời điểm t. Khoảng xuất hiện của layer = từ key đầu
 * đến key cuối (không có key hoặc 1 key thì tính theo thời lượng cảnh).
 */
/** Bộ giá trị hiệu ứng có thể đặt mốc theo thời gian (R3). */
export interface LayerEffectValues {
  /** Độ mờ 0..1 (1 = rõ hoàn toàn). */
  opacity: number;
  shake: number;
  glow: number;
  pulse: number;
}

/** Một mốc hiệu ứng: tại timeSec, layer mang đúng các giá trị này;
 * giữa hai mốc nội suy tuyến tính — người dùng tự chế hiệu ứng bằng
 * cách đặt nhiều mốc (ví dụ phát sáng tăng dần rồi tắt hẳn). */
export interface LayerEffectKey {
  id: string;
  timeSec: number;
  values: LayerEffectValues;
}

export function effectValuesAt(
  base: LayerEffectValues,
  keys: readonly LayerEffectKey[] | undefined,
  t: number,
): LayerEffectValues {
  if (!keys || keys.length === 0) return base;
  const sorted = [...keys].sort((a, b) => a.timeSec - b.timeSec);
  if (t <= sorted[0].timeSec) return { ...sorted[0].values };
  const last = sorted[sorted.length - 1];
  if (t >= last.timeSec) return { ...last.values };
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (t >= a.timeSec && t <= b.timeSec) {
      const span = b.timeSec - a.timeSec;
      const f = span <= 0 ? 1 : (t - a.timeSec) / span;
      return {
        opacity: a.values.opacity + (b.values.opacity - a.values.opacity) * f,
        shake: a.values.shake + (b.values.shake - a.values.shake) * f,
        glow: a.values.glow + (b.values.glow - a.values.glow) * f,
        pulse: a.values.pulse + (b.values.pulse - a.values.pulse) * f,
      };
    }
  }
  return { ...last.values };
}

export function layerEffectAt(
  effects: Partial<LayerEffects> | undefined,
  keyTimes: readonly number[],
  t: number,
  sceneDuration: number,
  effectKeys?: readonly LayerEffectKey[],
): LayerEffectSample {
  const fx = layerEffectsOf(effects);
  const values = effectValuesAt(
    { opacity: 1, shake: fx.shake, glow: fx.glow, pulse: fx.pulse },
    effectKeys,
    t,
  );
  const start = keyTimes.length > 0 ? Math.min(...keyTimes) : 0;
  const end =
    keyTimes.length > 1 ? Math.max(...keyTimes) : Math.max(sceneDuration, start);
  let opacityMul = 1;
  if (fx.fadeInSec > 0 && t < start + fx.fadeInSec)
    opacityMul = Math.min(opacityMul, Math.max(0, (t - start) / fx.fadeInSec));
  if (fx.fadeOutSec > 0 && t > end - fx.fadeOutSec)
    opacityMul = Math.min(opacityMul, Math.max(0, (end - t) / fx.fadeOutSec));
  const shakeAmp = values.shake * 0.012;
  const shakeX = shakeAmp * Math.sin(t * 39.7) * Math.cos(t * 27.3);
  const shakeY = shakeAmp * Math.cos(t * 34.1) * Math.sin(t * 23.9);
  const scaleMul = 1 + values.pulse * 0.05 * Math.sin(t * Math.PI * 2 * 0.9);
  return {
    opacityMul: Math.max(0, Math.min(1, opacityMul * values.opacity)),
    shakeX,
    shakeY,
    glowPx: values.glow * 26,
    scaleMul,
  };
}

// ── Thời tiết của cảnh (2D + 3D) ─────────────────────────────────────────────

export type WeatherType = "rain" | "snow" | "sparkles";

export interface SceneWeather {
  type: WeatherType;
  /** Mật độ/hiệu lực 0..1. */
  intensity: number;
}

export interface WeatherParticle {
  x: number;
  y: number;
  size: number;
  alpha: number;
  drift: number;
}

/** Hạt thời tiết tất định cho canvas 2D (toạ độ tỉ lệ 0..1). */
export function weatherParticles(
  weather: SceneWeather,
  t: number,
  count = 130,
): WeatherParticle[] {
  const total = Math.round(count * Math.max(0, Math.min(1, weather.intensity)));
  const out: WeatherParticle[] = [];
  for (let i = 0; i < total; i++) {
    const rx = hash01(i * 3 + 1);
    const ry = hash01(i * 7 + 2);
    const rs = hash01(i * 13 + 5);
    if (weather.type === "rain") {
      const speed = 0.55 + rs * 0.3;
      out.push({
        x: (rx + t * 0.03) % 1,
        y: (ry + t * speed) % 1,
        size: 0.012 + rs * 0.01,
        alpha: 0.25 + rs * 0.3,
        drift: -0.18,
      });
    } else if (weather.type === "snow") {
      const speed = 0.05 + rs * 0.05;
      out.push({
        x: (rx + Math.sin(t * 0.7 + i) * 0.012) % 1,
        y: (ry + t * speed) % 1,
        size: 0.004 + rs * 0.008,
        alpha: 0.35 + rs * 0.45,
        drift: 0,
      });
    } else {
      // Lấp lánh: hạt đứng yên, độ sáng nhấp nháy theo pha riêng
      const tw = 0.5 + 0.5 * Math.sin(t * 2.4 + i * 1.7);
      out.push({
        x: rx,
        y: ry,
        size: 0.003 + rs * 0.006,
        alpha: 0.15 + tw * 0.6,
        drift: 0,
      });
    }
  }
  return out;
}
