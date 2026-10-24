import { TERRAIN_CELLS, seasonTint, terrainVertexColor } from "./terrain";
import type { DioramaState } from "./diorama";

/**
 * Vẽ bản đồ 2D nhìn từ trên xuống (W6): màu ô đất theo biome + mùa,
 * nước phủ lên ô thấp hơn mực nước, đường đi, vật thể kèm tên.
 * Chỉ chạy trong trình duyệt (dùng canvas 2D), không dùng Three.js.
 */
export function drawTopDownMap(state: DioramaState, px = 1024): string {
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const size = state.groundSize;
  const cell = px / TERRAIN_CELLS;
  const toPx = (x: number, z: number): [number, number] => [
    ((x + size / 2) / size) * px,
    ((z + size / 2) / size) * px,
  ];
  for (let j = 0; j < TERRAIN_CELLS; j += 1) {
    for (let i = 0; i < TERRAIN_CELLS; i += 1) {
      const c = seasonTint(terrainVertexColor(state.terrain, i, j), state.sky.season);
      ctx.fillStyle = `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
      ctx.fillRect(i * cell, j * cell, cell + 0.5, cell + 0.5);
    }
  }
  // Nước: ô thấp hơn mực nước phủ xanh mờ.
  if (state.terrain.waterLevel > -1) {
    ctx.fillStyle = "rgba(64,120,200,0.55)";
    for (let j = 0; j < TERRAIN_CELLS; j += 1) {
      for (let i = 0; i < TERRAIN_CELLS; i += 1) {
        const h = state.terrain.heights[Math.min(TERRAIN_CELLS, j + 1)]?.[Math.min(TERRAIN_CELLS, i + 1)] ?? 0;
        if (h < state.terrain.waterLevel) ctx.fillRect(i * cell, j * cell, cell + 0.5, cell + 0.5);
      }
    }
  }
  // Đường đi.
  ctx.strokeStyle = "#c4a06a";
  ctx.lineWidth = Math.max(2, px / 256);
  ctx.lineCap = "round";
  for (const path of state.paths) {
    if (path.points.length < 2) continue;
    ctx.beginPath();
    path.points.forEach((pt, idx) => {
      const [pxx, pzz] = toPx(pt.x, pt.z);
      if (idx === 0) ctx.moveTo(pxx, pzz);
      else ctx.lineTo(pxx, pzz);
    });
    ctx.stroke();
  }
  // Vật thể: chấm tròn + tên (chỉ vật gắn thực thể mới ghi tên).
  ctx.font = `${Math.max(11, px / 64)}px sans-serif`;
  for (const p of state.placements) {
    if (!p.visible) continue;
    const [pxx, pzz] = toPx(p.x, p.z);
    const ent = p.storyEntityId ? state.entities.find((e) => e.id === p.storyEntityId) : undefined;
    ctx.fillStyle = ent?.color ?? "#888888";
    ctx.beginPath();
    ctx.arc(pxx, pzz, Math.max(4, px / 160), 0, Math.PI * 2);
    ctx.fill();
    if (ent) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      const label = ent.name;
      const w = ctx.measureText(label).width;
      ctx.fillRect(pxx + 6, pzz - 8, w + 8, 16);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, pxx + 10, pzz + 4);
    }
  }
  return canvas.toDataURL("image/png");
}
