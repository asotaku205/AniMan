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
export function layerEffectAt(
  effects: Partial<LayerEffects> | undefined,
  keyTimes: readonly number[],
  t: number,
  sceneDuration: number,
): LayerEffectSample {
  const fx = layerEffectsOf(effects);
  const start = keyTimes.length > 0 ? Math.min(...keyTimes) : 0;
  const end =
    keyTimes.length > 1 ? Math.max(...keyTimes) : Math.max(sceneDuration, start);
  let opacityMul = 1;
  if (fx.fadeInSec > 0 && t < start + fx.fadeInSec)
    opacityMul = Math.min(opacityMul, Math.max(0, (t - start) / fx.fadeInSec));
  if (fx.fadeOutSec > 0 && t > end - fx.fadeOutSec)
    opacityMul = Math.min(opacityMul, Math.max(0, (end - t) / fx.fadeOutSec));
  const shakeAmp = fx.shake * 0.012;
  const shakeX = shakeAmp * Math.sin(t * 39.7) * Math.cos(t * 27.3);
  const shakeY = shakeAmp * Math.cos(t * 34.1) * Math.sin(t * 23.9);
  const scaleMul = 1 + fx.pulse * 0.05 * Math.sin(t * Math.PI * 2 * 0.9);
  return {
    opacityMul: Math.max(0, Math.min(1, opacityMul)),
    shakeX,
    shakeY,
    glowPx: fx.glow * 26,
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
