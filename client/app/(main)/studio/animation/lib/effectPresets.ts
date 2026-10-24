/**
 * Mẫu hiệu ứng khởi đầu cho Effect Studio (Phase 5): người dùng chọn
 * mẫu rồi chỉnh thanh trượt thành hiệu ứng của riêng mình.
 */

import type { EffectFormula, EffectLayer } from "./effectFormula";

function layer(partial: Partial<EffectLayer> & Pick<EffectLayer, "shape">): EffectLayer {
  return {
    count: 40,
    speed: [1, 3],
    life: [0.5, 1],
    gravity: 0,
    size: [0.3, 0.1],
    colorStart: "#ffffff",
    colorEnd: "#888888",
    glow: true,
    spread: 0.5,
    opacity: 1,
    ...partial,
  };
}

function preset(
  id: string,
  name: string,
  layers: EffectLayer[],
  opts: Partial<Pick<EffectFormula, "burstDefault" | "suggestedShake" | "suggestedFlash">> = {},
): EffectFormula {
  return {
    id: `preset-${id}`,
    name,
    layers,
    seed: 1234567,
    burstDefault: true,
    suggestedShake: 0,
    suggestedFlash: 0,
    ...opts,
  };
}

export const EFFECT_PRESETS: EffectFormula[] = [
  preset(
    "explosion",
    "Nổ",
    [
      layer({ shape: "sphere", count: 30, speed: [1, 3], life: [0.1, 0.3], size: [1.2, 0.2], colorStart: "#ffffff", colorEnd: "#ffcc33", glow: true, opacity: 1 }),
      layer({ shape: "sphere", count: 60, speed: [2, 6], life: [0.4, 0.9], size: [0.5, 0.15], colorStart: "#ffdd55", colorEnd: "#ff4400", glow: true, opacity: 1 }),
      layer({ shape: "sphere", count: 30, speed: [0.5, 1.5], life: [1.2, 2.2], size: [0.25, 0.9], colorStart: "#555555", colorEnd: "#222222", glow: false, opacity: 0.7 }),
      layer({ shape: "sphere", count: 25, speed: [6, 12], life: [0.5, 1], gravity: -9.8, size: [0.12, 0.02], colorStart: "#ffee88", colorEnd: "#442200", glow: true, opacity: 1 }),
    ],
    { burstDefault: true, suggestedShake: 0.6, suggestedFlash: 0.8 },
  ),
  preset("fire", "Lửa", [
    layer({ shape: "cone", count: 80, speed: [0.8, 1.6], life: [0.6, 1.2], gravity: 1.2, size: [0.35, 0.05], colorStart: "#ffdd55", colorEnd: "#ff2200", glow: true, spread: 0.4, opacity: 1 }),
  ], { burstDefault: false }),
  preset("smoke", "Khói", [
    layer({ shape: "sphere", count: 40, speed: [0.3, 0.8], life: [1.5, 3], gravity: 0.4, size: [0.2, 0.9], colorStart: "#777777", colorEnd: "#333333", glow: false, spread: 0.5, opacity: 0.5 }),
  ], { burstDefault: false }),
  preset("splash", "Nước bắn", [
    layer({ shape: "cone", count: 70, speed: [2, 5], life: [0.5, 1], gravity: -9.8, size: [0.18, 0.05], colorStart: "#cceeff", colorEnd: "#2266cc", glow: false, spread: 0.6, opacity: 0.9 }),
  ], { burstDefault: true }),
  preset("magic", "Tia phép", [
    layer({ shape: "sphere", count: 60, speed: [0.5, 1.5], life: [0.8, 1.6], gravity: 0.5, size: [0.22, 0.05], colorStart: "#cc88ff", colorEnd: "#2244ff", glow: true, spread: 0.7, opacity: 1 }),
    layer({ shape: "sphere", count: 20, speed: [0.2, 0.6], life: [1, 2], size: [0.1, 0.02], colorStart: "#ffffff", colorEnd: "#88ccff", glow: true, spread: 0.9, opacity: 1 }),
  ], { burstDefault: true, suggestedFlash: 0.3 }),
  preset("sparks", "Tia lửa", [
    layer({ shape: "sphere", count: 50, speed: [3, 8], life: [0.3, 0.8], gravity: -4, size: [0.1, 0.02], colorStart: "#ffffcc", colorEnd: "#ff8800", glow: true, spread: 1, opacity: 1 }),
  ], { burstDefault: true }),
];
