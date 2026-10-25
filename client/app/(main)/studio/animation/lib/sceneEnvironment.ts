/**
 * Phong cảnh của cảnh previz 3D (giai đoạn B): bầu trời, thời tiết,
 * sương, mặt nước, địa hình. Kiểu dữ liệu + hàm thuần; dựng hình Three
 * nằm ở PrevizEditor, cọ nằm ở terrainBrush.
 *
 * Tái dùng logic bầu trời/thời tiết của World Builder (skySun,
 * weatherParams, weatherLabel) — import, không viết lại công thức.
 */

import {
  skySun,
  weatherLabel,
  weatherParams,
  type SkySettings,
} from "../../world-builder/lib/diorama";
import {
  createTerrainGrid,
  generateTerrainGrid,
  heightAtGrid,
  type TerrainGrid,
} from "./terrainBrush";
import { createPrevizObject, type PrevizObject } from "./previz";

export type EnvironmentWeather = SkySettings["weather"];

export interface SceneEnvironment {
  /** Giờ trong ngày 0–24. */
  time: number;
  weather: EnvironmentWeather;
  /** Mật độ sương 0..1 — 0 = theo thời tiết, 1 = sương dày đặc. */
  fogDensity: number;
  /** Mực nước (mét); -1 = tắt mặt nước. */
  waterLevel: number;
  terrain: TerrainGrid;
}

export const DEFAULT_ENVIRONMENT: SceneEnvironment = {
  time: 10,
  weather: "clear",
  fogDensity: 0,
  waterLevel: -1,
  terrain: createTerrainGrid(),
};

/** Màu trời + nắng đã tính hệ quả thời tiết (nắng mưa chỉ còn ~20%). */
export function environmentSky(env: SceneEnvironment): {
  skyBg: string;
  sunColor: string;
  sunIntensity: number;
  hemiIntensity: number;
} {
  const sun = skySun({ time: env.time, weather: env.weather, season: "summer" });
  const wp = weatherParams(env.weather);
  return {
    skyBg: sun.skyBg,
    sunColor: sun.sunColor,
    sunIntensity: sun.sunIntensity * wp.sunFactor,
    hemiIntensity: Math.max(0.1, sun.hemiIntensity * wp.sunFactor),
  };
}

/** Tầm nhìn sương: thời tiết làm nền, thanh sương kéo dần về sương dày. */
export function effectiveFog(env: SceneEnvironment): {
  near: number;
  far: number;
} {
  const wp = weatherParams(env.weather);
  return {
    near: wp.fogNear + (8 - wp.fogNear) * env.fogDensity,
    far: wp.fogFar + (28 - wp.fogFar) * env.fogDensity,
  };
}

/** Dòng mô tả hệ quả thời tiết (tái dùng nhãn của World Builder). */
export function weatherConsequence(weather: EnvironmentWeather): string {
  return weatherLabel(weather);
}

export const WEATHER_OPTIONS: Array<{ id: EnvironmentWeather; label: string }> = [
  { id: "clear", label: "Nắng" },
  { id: "fog", label: "Sương mù" },
  { id: "rain", label: "Mưa dông" },
  { id: "snow", label: "Tuyết" },
];

/** Đặt một vật thể mẫu lên mặt đất tại (x, z). */
function place(
  kind: PrevizObject["kind"],
  name: string,
  x: number,
  z: number,
  terrain: TerrainGrid,
  opts?: { color?: string; size?: number; rotY?: number },
): PrevizObject {
  const obj = createPrevizObject(kind, name);
  obj.keys[0] = {
    ...obj.keys[0],
    position: { x, y: heightAtGrid(terrain, x, z), z },
    rotationY: opts?.rotY ?? 0,
  };
  if (opts?.color) obj.color = opts.color;
  if (opts?.size) obj.size = opts.size;
  return obj;
}

export type PresetSetId = "room" | "street" | "forest" | "beach";

export interface PresetSet {
  id: PresetSetId;
  name: string;
  desc: string;
  environment: SceneEnvironment;
  objects: PrevizObject[];
}

/** Một set dựng sẵn: môi trường + vật mẫu đã đặt đúng mặt đất. */
export function buildPreset(id: PresetSetId): PresetSet {
  if (id === "room") {
    const terrain = createTerrainGrid();
    return {
      id,
      name: "Phòng",
      desc: "Phòng kín: 3 bức tường + bàn + giường, nắng trưa.",
      environment: {
        time: 14,
        weather: "clear",
        fogDensity: 0,
        waterLevel: -1,
        terrain,
      },
      objects: [
        place("wall", "Tường sau", 0, -6, terrain, { size: 3 }),
        place("wall", "Tường trái", -6, 0, terrain, { size: 3, rotY: 90 }),
        place("wall", "Tường phải", 6, 0, terrain, { size: 3, rotY: 90 }),
        place("box", "Bàn", -2, -3, terrain, { color: "#8a6d4b", size: 1.2 }),
        place("box", "Giường", 3, -4, terrain, { color: "#7a5a8a", size: 1.8 }),
      ],
    };
  }
  if (id === "street") {
    const terrain = createTerrainGrid();
    const objects: PrevizObject[] = [];
    for (let i = 0; i < 4; i += 1) {
      objects.push(
        place("wall", `Nhà ${i + 1}`, -8 + i * 5, -7, terrain, {
          size: 2 + (i % 2) * 0.8,
        }),
      );
      objects.push(
        place("wall", `Nhà ${i + 5}`, -8 + i * 5, 7, terrain, {
          size: 2 + ((i + 1) % 2) * 0.8,
        }),
      );
    }
    objects.push(place("box", "Bồn cây", -3, 0, terrain, { color: "#4a7c43", size: 0.9 }));
    objects.push(place("box", "Bồn cây", 3, 0, terrain, { color: "#4a7c43", size: 0.9 }));
    return {
      id,
      name: "Phố",
      desc: "Con phố hai dãy nhà, nắng chiều.",
      environment: {
        time: 15,
        weather: "clear",
        fogDensity: 0,
        waterLevel: -1,
        terrain,
      },
      objects,
    };
  }
  if (id === "forest") {
    const terrain = generateTerrainGrid("hills", 7);
    const objects: PrevizObject[] = [];
    for (let i = 0; i < 14; i += 1) {
      const angle = (i / 14) * Math.PI * 2;
      const r = 5 + (i % 4) * 2;
      objects.push(
        place("cylinder", `Cây ${i + 1}`, Math.cos(angle) * r, Math.sin(angle) * r, terrain, {
          color: "#3f6b3a",
          size: 1.6 + (i % 3) * 0.4,
        }),
      );
    }
    for (let i = 0; i < 5; i += 1) {
      objects.push(
        place("box", `Đá ${i + 1}`, -6 + i * 3, 4 - (i % 2) * 2, terrain, {
          color: "#7a7568",
          size: 0.7,
        }),
      );
    }
    return {
      id,
      name: "Rừng",
      desc: "Đồi thoải + cây và đá rải quanh, nắng sáng.",
      environment: {
        time: 10,
        weather: "clear",
        fogDensity: 0.1,
        waterLevel: -1,
        terrain,
      },
      objects,
    };
  }
  const terrain = generateTerrainGrid("beach", 3);
  return {
    id,
    name: "Bãi biển",
    desc: "Dốc cát xuống mặt nước, nắng chiều.",
    environment: {
      time: 16,
      weather: "clear",
      fogDensity: 0,
      waterLevel: 0.1,
      terrain,
    },
    objects: [
      place("box", "Đá 1", -5, -6, terrain, { color: "#7a7568", size: 1 }),
      place("box", "Đá 2", 6, -4, terrain, { color: "#7a7568", size: 0.8 }),
      place("cylinder", "Thân dừa", -3, -2, terrain, { color: "#6b4a2f", size: 2.2 }),
      place("box", "Dù", 4, 2, terrain, { color: "#e8b4a0", size: 1.1 }),
    ],
  };
}

export const PRESET_SET_META: Array<{
  id: PresetSetId;
  name: string;
  desc: string;
}> = (["room", "street", "forest", "beach"] as PresetSetId[]).map((id) => {
  const p = buildPreset(id);
  return { id, name: p.name, desc: p.desc };
});
