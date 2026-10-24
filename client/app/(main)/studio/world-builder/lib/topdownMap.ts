import { CHUNK_SIZE, TERRAIN_CELLS, seasonTint, terrainVertexColor, worldBounds } from "./terrain";
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
  // Bản đồ phủ toàn bộ biên thế giới (mọi chunk), giữ tỉ lệ thật.
  const b = worldBounds(state.terrain);
  const worldW = b.maxX - b.minX;
  const worldD = b.maxZ - b.minZ;
  const span = Math.max(worldW, worldD);
  const cell = px / (span / (CHUNK_SIZE / TERRAIN_CELLS));
  const toPx = (x: number, z: number): [number, number] => [
    ((x - b.minX) / span) * px,
    ((z - b.minZ) / span) * px,
  ];
  for (const key of Object.keys(state.terrain.chunks)) {
    const chunk = state.terrain.chunks[key];
    const [cx, cz] = key.split(",").map(Number);
    const ox = cx * CHUNK_SIZE - CHUNK_SIZE / 2;
    const oz = cz * CHUNK_SIZE - CHUNK_SIZE / 2;
    for (let j = 0; j < TERRAIN_CELLS; j += 1) {
      for (let i = 0; i < TERRAIN_CELLS; i += 1) {
        const c = seasonTint(terrainVertexColor(chunk, i, j, state.terrain.waterLevel), state.sky.season);
        ctx.fillStyle = `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
        const [pxx, pzz] = toPx(ox + (i / TERRAIN_CELLS) * CHUNK_SIZE, oz + (j / TERRAIN_CELLS) * CHUNK_SIZE);
        ctx.fillRect(pxx, pzz, cell + 0.5, cell + 0.5);
      }
    }
  }
  // Nước: ô thấp hơn mực nước phủ xanh mờ.
  if (state.terrain.waterLevel > -1) {
    ctx.fillStyle = "rgba(64,120,200,0.55)";
    for (const key of Object.keys(state.terrain.chunks)) {
      const chunk = state.terrain.chunks[key];
      const [cx, cz] = key.split(",").map(Number);
      const ox = cx * CHUNK_SIZE - CHUNK_SIZE / 2;
      const oz = cz * CHUNK_SIZE - CHUNK_SIZE / 2;
      for (let j = 0; j < TERRAIN_CELLS; j += 1) {
        for (let i = 0; i < TERRAIN_CELLS; i += 1) {
          const h = chunk.heights[Math.min(TERRAIN_CELLS, j + 1)]?.[Math.min(TERRAIN_CELLS, i + 1)] ?? 0;
          if (h >= state.terrain.waterLevel) continue;
          const [pxx, pzz] = toPx(ox + (i / TERRAIN_CELLS) * CHUNK_SIZE, oz + (j / TERRAIN_CELLS) * CHUNK_SIZE);
          ctx.fillRect(pxx, pzz, cell + 0.5, cell + 0.5);
        }
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
