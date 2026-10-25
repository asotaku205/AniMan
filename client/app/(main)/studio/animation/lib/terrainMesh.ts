/**
 * Dựng lưới địa hình previz thành geometry Three (giai đoạn B). Chỉ
 * chứa code dựng hình; toán lưới nằm ở terrainBrush (đã có test).
 */

import * as THREE from "three";
import type { TerrainGrid } from "./terrainBrush";

/** Màu mặt đất theo cao độ: cát thấp, cỏ giữa, đá cao. */
export function terrainColorForHeight(h: number): THREE.Color {
  if (h < 0.2) return new THREE.Color("#b8a06a");
  if (h < 1.0) return new THREE.Color("#55794a");
  return new THREE.Color("#7a7568");
}

/**
 * Geometry mặt đất từ lưới: mặt phẳng chia ô, đỉnh nâng theo cao độ,
 * tô màu theo cao độ. Hàng j của lưới chạy theo trục z (xem
 * terrainBrush: sau khi xoay mặt phẳng, hàng iy ứng với z tăng dần).
 */
export function createTerrainGeometry(grid: TerrainGrid): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(
    grid.size,
    grid.size,
    grid.cells,
    grid.cells,
  );
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  for (let v = 0; v < pos.count; v += 1) {
    const iy = Math.floor(v / (grid.cells + 1));
    const ix = v % (grid.cells + 1);
    const h = grid.heights[iy][ix];
    pos.setY(v, h);
    const c = terrainColorForHeight(h);
    colors[v * 3] = c.r;
    colors[v * 3 + 1] = c.g;
    colors[v * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
