/**
 * Nhập sa bàn World Builder thành cảnh previz 3D (giai đoạn B): địa
 * hình + vật đã đặt trên sa bàn chuyển sang thành điểm khởi đầu chỉnh
 * được trong Animation Studio. Sông và đường vẽ riêng của sa bàn không
 * chuyển (previz chưa có sông); vật ngoài sân 30m và vật đã ẩn thì bỏ.
 */

import { heightAtWorld } from "../../world-builder/lib/terrain";
import type { DioramaState } from "../../world-builder/lib/diorama";
import { createPrevizObject, type PrevizObject } from "./previz";
import {
  createTerrainGrid,
  heightAtGrid,
  type TerrainGrid,
} from "./terrainBrush";
import type { SceneEnvironment } from "./sceneEnvironment";

export const PREVIZ_HALF = 15;

/** Địa hình + trời + nước của sa bàn → môi trường previz. */
export function dioramaToEnvironment(state: DioramaState): SceneEnvironment {
  const grid: TerrainGrid = createTerrainGrid();
  for (let j = 0; j <= grid.cells; j += 1) {
    for (let i = 0; i <= grid.cells; i += 1) {
      const wx = -grid.size / 2 + (i / grid.cells) * grid.size;
      const wz = -grid.size / 2 + (j / grid.cells) * grid.size;
      grid.heights[j][i] = heightAtWorld(state.terrain, wx, wz);
    }
  }
  return {
    time: state.sky.time,
    weather: state.sky.weather,
    fogDensity: state.sky.weather === "fog" ? 0.6 : 0,
    waterLevel: state.terrain.waterLevel >= 0 ? state.terrain.waterLevel : -1,
    terrain: grid,
  };
}

/** Vật trên sa bàn → vật thể previz, đứng đúng mặt đất đã chuyển. */
export function dioramaToObjects(
  state: DioramaState,
  env: SceneEnvironment,
): PrevizObject[] {
  const out: PrevizObject[] = [];
  for (const p of state.placements ?? []) {
    if (!p.visible) continue;
    if (Math.abs(p.x) > PREVIZ_HALF || Math.abs(p.z) > PREVIZ_HALF) continue;
    const y = heightAtGrid(env.terrain, p.x, p.z);
    if (p.glbAssetId) {
      const obj = createPrevizObject("model", p.name || "Mô hình");
      obj.modelAssetId = p.glbAssetId;
      obj.size = p.scale || 1;
      obj.keys[0] = {
        ...obj.keys[0],
        position: { x: p.x, y, z: p.z },
        rotationY: (p.rotationY * 180) / Math.PI,
      };
      out.push(obj);
    } else {
      const obj = createPrevizObject("box", p.name || "Vật trang trí");
      obj.color = p.tint ?? "#8a6d4b";
      obj.size = Math.max(0.5, p.scale || 1);
      obj.keys[0] = {
        ...obj.keys[0],
        position: { x: p.x, y, z: p.z },
        rotationY: (p.rotationY * 180) / Math.PI,
      };
      out.push(obj);
    }
  }
  return out;
}
