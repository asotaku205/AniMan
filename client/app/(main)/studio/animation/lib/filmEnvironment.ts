/**
 * Môi trường phim cho renderer phim (xem thử + xuất phim): ánh xạ
 * scene.environment ra tham số dựng hình — DÙNG ĐÚNG công thức của
 * trình dựng (PrevizEditor) để xem thử khớp tuyệt đối với chỉnh sửa:
 * màu trời/nắng theo giờ + thời tiết, vị trí nắng theo giờ, sương,
 * mây, mực nước, chớp sét. Không có environment thì trả về fallback
 * cũ (backdrop + mặt đất phẳng) để cảnh cũ không vỡ.
 */

import { weatherParams } from "../../world-builder/lib/diorama";
import {
  effectiveFog,
  environmentSky,
  type SceneEnvironment,
} from "./sceneEnvironment";

export interface FilmEnvironment {
  hasEnv: boolean;
  background: string;
  sunColor: string;
  sunIntensity: number;
  sunPosition: [number, number, number];
  hemiIntensity: number;
  fog: { near: number; far: number } | null;
  waterLevel: number;
  weather: SceneEnvironment["weather"] | null;
}

/** Vị trí nắng theo giờ — đúng công thức trình dựng. */
export function sunPositionForTime(time: number): [number, number, number] {
  const angle = ((time - 6) / 12) * Math.PI;
  return [
    Math.cos(angle) * 20,
    Math.max(1, Math.sin(angle) * 18 + 2),
    6,
  ];
}

export function resolveFilmEnvironment(
  env: SceneEnvironment | undefined,
  backdrop: string,
): FilmEnvironment {
  if (!env) {
    return {
      hasEnv: false,
      background: backdrop,
      sunColor: "#ffffff",
      sunIntensity: 1.6,
      sunPosition: [5, 9, 4],
      hemiIntensity: 0,
      fog: null,
      waterLevel: -1,
      weather: null,
    };
  }
  const sky = environmentSky(env);
  const fog = effectiveFog(env);
  return {
    hasEnv: true,
    background: sky.skyBg,
    sunColor: sky.sunColor,
    sunIntensity: sky.sunIntensity,
    sunPosition: sunPositionForTime(env.time),
    hemiIntensity: sky.hemiIntensity,
    fog: { near: fog.near, far: fog.far },
    waterLevel: env.waterLevel,
    weather: env.weather,
  };
}

function hexChannel(hex: string, at: number): number {
  return parseInt(hex.slice(at, at + 2), 16);
}

function toHex(v: number): string {
  return Math.round(v).toString(16).padStart(2, "0");
}

/** Bố cục mây — đúng công thức trình dựng (số lượng theo độ phủ,
 *  màu trắng → xám theo độ xám thời tiết, vị trí tất định). */
export function cloudLayout(weather: SceneEnvironment["weather"]): {
  color: string;
  clouds: Array<{ x: number; y: number; z: number }>;
} {
  const wp = weatherParams(weather);
  const color = `#${toHex(255 + (hexChannel("#5b6470", 1) - 255) * wp.cloudDark)}${toHex(255 + (hexChannel("#5b6470", 3) - 255) * wp.cloudDark)}${toHex(255 + (hexChannel("#5b6470", 5) - 255) * wp.cloudDark)}`;
  const clouds: Array<{ x: number; y: number; z: number }> = [];
  const count = Math.round(wp.cloudCover * 10);
  for (let i = 0; i < count; i += 1) {
    clouds.push({
      x: -25 + ((i * 37) % 50),
      y: 12 + (i % 3) * 2,
      z: -25 + ((i * 53) % 50),
    });
  }
  return { color, clouds };
}

/** Mây trôi theo gió — đúng công thức vòng lặp trình dựng. */
export function cloudDriftX(
  t: number,
  weather: SceneEnvironment["weather"],
): number {
  return ((t * weatherParams(weather).wind * 0.6) % 60) - 30;
}

/** Mặt nước dập dềnh nhẹ quanh mực nước. */
export function waterLevelAt(waterLevel: number, t: number): number {
  return waterLevel + Math.sin(t * 0.8) * 0.03;
}

/** Chớp sét mưa dông — đúng công thức trình dựng (chỉ mưa). */
export function lightningIntensity(
  t: number,
  weather: SceneEnvironment["weather"] | null,
): number {
  if (weather !== "rain") return 0;
  return Math.sin(t * 13.7) * Math.sin(t * 7.3) > 0.996 ? 1.5 : 0;
}
