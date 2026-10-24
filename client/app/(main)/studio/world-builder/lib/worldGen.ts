/**
 * Sinh cảnh quan theo vùng (W9): hàm thuần, không phụ thuộc Three.
 *
 * Triết lý giữ nguyên: sinh ra BẢN NHÁP chỉnh được — địa hình sinh
 * xong vẫn sửa bằng cọ, vật sinh xong vẫn kéo/xoá từng vật như vật
 * đặt tay. Mọi hàm nhận seed để kết quả ổn định khi test.
 */

import { createPlacement, type DioramaPlacement } from "./diorama";
import {
  CHUNK_SIZE,
  TERRAIN_CELLS,
  chunkKey,
  heightAtWorld,
  paintBiome,
  parseChunkKey,
  worldBounds,
  type TerrainPath,
  type WorldTerrain,
} from "./terrain";

/** RNG xác định (mulberry32) — cùng seed cho cùng kết quả. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clampH = (h: number) => Math.min(8, Math.max(-3, h));

/** Lặp các đỉnh lưới trong vòng tròn (tọa độ thế giới) qua mọi chunk. */
function forVerticesInRadius(
  wt: WorldTerrain,
  cx: number,
  cz: number,
  radius: number,
  fn: (chunkKeyStr: string, i: number, j: number, wx: number, wz: number, d: number) => void,
): void {
  for (const key of Object.keys(wt.chunks)) {
    const { cx: ccx, cz: ccz } = parseChunkKey(key);
    const ox = ccx * CHUNK_SIZE - CHUNK_SIZE / 2;
    const oz = ccz * CHUNK_SIZE - CHUNK_SIZE / 2;
    // Bỏ qua chunk không giao vòng tròn.
    const dx = Math.max(ox - cx, 0, cx - (ox + CHUNK_SIZE));
    const dz = Math.max(oz - cz, 0, cz - (oz + CHUNK_SIZE));
    if (Math.hypot(dx, dz) >= radius) continue;
    for (let j = 0; j <= TERRAIN_CELLS; j += 1) {
      for (let i = 0; i <= TERRAIN_CELLS; i += 1) {
        const wx = ox + (i / TERRAIN_CELLS) * CHUNK_SIZE;
        const wz = oz + (j / TERRAIN_CELLS) * CHUNK_SIZE;
        const d = Math.hypot(wx - cx, wz - cz);
        if (d < radius) fn(key, i, j, wx, wz, d);
      }
    }
  }
}

function falloff(d: number, radius: number): number {
  return 0.5 * (1 + Math.cos((Math.PI * d) / radius));
}

/** Nâng chóp núi/đồi: cao nhất ở tâm, nhiễu nhẹ cho tự nhiên. */
export function raisePeak(
  wt: WorldTerrain,
  x: number,
  z: number,
  radius: number,
  peak: number,
  seed = 1,
): WorldTerrain {
  const rng = mulberry32(seed);
  const chunks: Record<string, { heights: number[][]; biomes: string[][] }> = {};
  for (const key of Object.keys(wt.chunks)) {
    const c = wt.chunks[key];
    chunks[key] = { heights: c.heights.map((r) => [...r]), biomes: c.biomes };
  }
  forVerticesInRadius(wt, x, z, radius, (key, i, j, _wx, _wz, d) => {
    const noise = 0.8 + rng() * 0.4;
    chunks[key].heights[j][i] = clampH(chunks[key].heights[j][i] + peak * falloff(d, radius) * noise);
  });
  return { ...wt, chunks };
}

/** Đào lòng chảo (hồ/biển): sâu nhất ở tâm. */
export function lowerBowl(
  wt: WorldTerrain,
  x: number,
  z: number,
  radius: number,
  depth: number,
  seed = 1,
): WorldTerrain {
  const rng = mulberry32(seed);
  const chunks: Record<string, { heights: number[][]; biomes: string[][] }> = {};
  for (const key of Object.keys(wt.chunks)) {
    const c = wt.chunks[key];
    chunks[key] = { heights: c.heights.map((r) => [...r]), biomes: c.biomes };
  }
  forVerticesInRadius(wt, x, z, radius, (key, i, j, _wx, _wz, d) => {
    const noise = 0.85 + rng() * 0.3;
    chunks[key].heights[j][i] = clampH(chunks[key].heights[j][i] - depth * falloff(d, radius) * noise);
  });
  return { ...wt, chunks };
}

/** Tô biome cho ô theo cao độ tâm ô (dùng cho đảo: cát quanh, cỏ trên). */
export function paintByHeight(
  wt: WorldTerrain,
  x: number,
  z: number,
  radius: number,
  pick: (h: number) => string | null,
): WorldTerrain {
  const chunks: Record<string, { heights: number[][]; biomes: string[][] }> = {};
  for (const key of Object.keys(wt.chunks)) {
    const c = wt.chunks[key];
    chunks[key] = { heights: c.heights, biomes: c.biomes.map((r) => [...r]) };
  }
  for (const key of Object.keys(wt.chunks)) {
    const { cx, cz } = parseChunkKey(key);
    const ox = cx * CHUNK_SIZE - CHUNK_SIZE / 2;
    const oz = cz * CHUNK_SIZE - CHUNK_SIZE / 2;
    for (let j = 0; j < TERRAIN_CELLS; j += 1) {
      for (let i = 0; i < TERRAIN_CELLS; i += 1) {
        const wx = ox + ((i + 0.5) / TERRAIN_CELLS) * CHUNK_SIZE;
        const wz = oz + ((j + 0.5) / TERRAIN_CELLS) * CHUNK_SIZE;
        if (Math.hypot(wx - x, wz - z) >= radius) continue;
        const b = pick(heightAtWorld(wt, wx, wz));
        if (b) chunks[key].biomes[j][i] = b;
      }
    }
  }
  return { ...wt, chunks };
}

export type GenKind =
  | "mountain"
  | "hill"
  | "lake"
  | "sea"
  | "island"
  | "desert"
  | "swamp"
  | "forest"
  | "village"
  | "town"
  | "port"
  | "farm";

export const GEN_KINDS: Array<{ id: GenKind; name: string; desc: string }> = [
  { id: "mountain", name: "Núi cao", desc: "Chóp núi + đá + tuyết trên cao." },
  { id: "hill", name: "Đồi", desc: "Gò đất nhẹ, phủ cỏ." },
  { id: "lake", name: "Hồ", desc: "Lòng chảo + nước (mực nước chung)." },
  { id: "sea", name: "Biển", desc: "Hạ vùng rộng dưới mực nước." },
  { id: "island", name: "Đảo", desc: "Gò giữa biển + vành cát + cỏ trên." },
  { id: "desert", name: "Sa mạc", desc: "Cát + cồn cát thấp." },
  { id: "swamp", name: "Đầm lầy", desc: "Đất thấp + vũng nước + cây thưa." },
  { id: "forest", name: "Rừng", desc: "Rải cây theo mật độ, tránh nước/dốc." },
  { id: "village", name: "Làng quê", desc: "Đường chính + nhà 2 bên + đèn + cây." },
  { id: "town", name: "Thị trấn", desc: "Lưới đường bàn cờ + nhà theo ô." },
  { id: "port", name: "Cảng", desc: "Cầu tàu + ga + nhà ven nước." },
  { id: "farm", name: "Nông trại", desc: "Ruộng + nhà nông + cây." },
];

/** Sinh địa hình thuần (không thêm vật) cho 1 loại. */
export function generateTerrain(
  wt: WorldTerrain,
  kind: GenKind,
  x: number,
  z: number,
  radius: number,
  peak: number,
  seed = 1,
): WorldTerrain {
  switch (kind) {
    case "mountain": {
      let next = raisePeak(wt, x, z, radius, peak, seed);
      next = paintByHeight(next, x, z, radius, (h) => (h > 5 ? "snow" : h > 3 ? "rock" : null));
      return next;
    }
    case "hill":
      return raisePeak(wt, x, z, radius, Math.min(peak, 2.5), seed);
    case "lake": {
      const next = lowerBowl(wt, x, z, radius, Math.max(peak, 1.5), seed);
      return { ...next, waterLevel: Math.max(next.waterLevel, 0.2) };
    }
    case "sea": {
      const next = lowerBowl(wt, x, z, radius, 3, seed);
      return { ...next, waterLevel: Math.max(next.waterLevel, 0.2) };
    }
    case "island": {
      let next = raisePeak(wt, x, z, radius, 3, seed);
      next = paintByHeight(next, x, z, radius, (h) => (h < 1.2 ? "sand" : "grass"));
      return next;
    }
    case "desert": {
      let next = paintBiome(wt, x, z, radius, "desert");
      const rng = mulberry32(seed);
      for (let k = 0; k < 4; k += 1) {
        const ox = x + (rng() - 0.5) * radius;
        const oz = z + (rng() - 0.5) * radius;
        next = raisePeak(next, ox, oz, radius * 0.3, 0.8, seed + k);
      }
      return next;
    }
    case "swamp": {
      let next = paintBiome(wt, x, z, radius, "swamp");
      next = lowerBowl(next, x, z, radius * 0.4, 0.8, seed);
      return { ...next, waterLevel: Math.max(next.waterLevel, 0.2) };
    }
    default:
      return wt;
  }
}

function worldBoundsOf(wt: WorldTerrain) {
  const b = worldBounds(wt);
  return { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ };
}

function slopeAt(wt: WorldTerrain, x: number, z: number): number {
  const h = heightAtWorld(wt, x, z);
  const hx = heightAtWorld(wt, x + 1, z);
  const hz = heightAtWorld(wt, x, z + 1);
  return Math.max(Math.abs(hx - h), Math.abs(hz - h));
}

/** Rải cây trong vòng tròn: tránh nước, tránh dốc, cách nhau ≥2m. */
export function scatterForest(
  wt: WorldTerrain,
  existing: DioramaPlacement[],
  x: number,
  z: number,
  radius: number,
  density: number,
  seed = 1,
): DioramaPlacement[] {
  const rng = mulberry32(seed);
  const bounds = worldBoundsOf(wt);
  const water = wt.waterLevel;
  const count = Math.min(120, Math.floor(Math.PI * radius * radius * density));
  const out: DioramaPlacement[] = [];
  const models = ["pine", "pine", "tree-green", "tree-pink"] as const;
  let tries = 0;
  while (out.length < count && tries < count * 12) {
    tries += 1;
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius;
    const px = x + Math.cos(a) * r;
    const pz = z + Math.sin(a) * r;
    if (px < bounds.minX + 1 || px > bounds.maxX - 1 || pz < bounds.minZ + 1 || pz > bounds.maxZ - 1) continue;
    const h = heightAtWorld(wt, px, pz);
    if (water > -1 && h < water + 0.1) continue;
    if (slopeAt(wt, px, pz) > 1.2) continue;
    const tooClose = [...existing, ...out].some((pl) => Math.hypot(pl.x - px, pl.z - pz) < 2);
    if (tooClose) continue;
    out.push(
      createPlacement(models[Math.floor(rng() * models.length)], px, pz, null, undefined, null, bounds),
    );
  }
  return out;
}

export interface GeneratedSettlement {
  placements: DioramaPlacement[];
  paths: TerrainPath[];
}

function houseRow(
  wt: WorldTerrain,
  existing: DioramaPlacement[],
  xs: number[],
  z: number,
  flip: boolean,
): DioramaPlacement[] {
  const bounds = worldBoundsOf(wt);
  const out: DioramaPlacement[] = [];
  xs.forEach((hx, idx) => {
    const hz = z + (flip ? -1 : 1) * 5;
    if (idx % 2 === 0) {
      out.push(createPlacement("house-detail", hx, hz, null, undefined, null, bounds));
    } else {
      out.push(createPlacement("house", hx, hz, null, undefined, null, bounds));
    }
    if (idx % 2 === 0) {
      out.push(createPlacement("lamp", hx + 3, z + (flip ? -1 : 1) * 2, null, undefined, null, bounds));
    }
  });
  return out.filter(
    (pl) => !existing.some((e) => Math.hypot(e.x - pl.x, e.z - pl.z) < 3),
  );
}

/** Làng: đường chính dọc X + nhà 2 bên + đèn + cây. */
export function generateVillage(
  wt: WorldTerrain,
  existing: DioramaPlacement[],
  x: number,
  z: number,
  seed = 1,
): GeneratedSettlement {
  const path: TerrainPath = {
    id: `path-${Date.now().toString(36)}`,
    points: [
      { x, z },
      { x: x + 24, z },
    ],
  };
  const xs = [x + 2, x + 8, x + 14, x + 20];
  const placements = [
    ...houseRow(wt, existing, xs, z, true),
    ...houseRow(wt, existing, xs, z, false),
    ...scatterForest(wt, [...existing], x + 12, z + 12, 6, 0.08, seed),
  ];
  return { placements, paths: [path] };
}

/** Thị trấn: 2 đường cắt nhau + nhà theo ô bàn cờ thưa. */
export function generateTown(
  wt: WorldTerrain,
  existing: DioramaPlacement[],
  x: number,
  z: number,
  seed = 1,
): GeneratedSettlement {
  const bounds = worldBoundsOf(wt);
  const paths: TerrainPath[] = [
    { id: `path-${Date.now().toString(36)}-h`, points: [{ x: x - 14, z }, { x: x + 14, z }] },
    { id: `path-${Date.now().toString(36)}-v`, points: [{ x, z: z - 14 }, { x, z: z + 14 }] },
  ];
  const placements: DioramaPlacement[] = [];
  for (let gx = -12; gx <= 12; gx += 8) {
    for (let gz = -12; gz <= 12; gz += 8) {
      if (Math.abs(gx) < 3 || Math.abs(gz) < 3) continue; // chừa đường
      if ((gx + gz) % 16 !== 0) continue; // thưa ra, không kín đặc
      placements.push(
        createPlacement("house-detail", x + gx, z + gz, null, undefined, null, bounds),
      );
    }
  }
  placements.push(
    ...scatterForest(wt, [...existing, ...placements], x, z, 16, 0.03, seed),
  );
  return { placements, paths };
}

/** Cảng: cầu tàu (bridge) vươn ra nước + ga + nhà ven bờ + đèn. */
export function generatePort(
  wt: WorldTerrain,
  existing: DioramaPlacement[],
  x: number,
  z: number,
  _seed = 1,
): GeneratedSettlement {
  const bounds = worldBoundsOf(wt);
  const placements = [
    createPlacement("bridge", x, z + 6, null, undefined, null, bounds),
    createPlacement("station", x + 8, z - 4, null, undefined, null, bounds),
    createPlacement("house-detail", x - 6, z - 4, null, undefined, null, bounds),
    createPlacement("house", x + 2, z - 8, null, undefined, null, bounds),
    createPlacement("lamp", x + 4, z, null, undefined, null, bounds),
  ].filter((pl) => !existing.some((e) => Math.hypot(e.x - pl.x, e.z - pl.z) < 3));
  return { placements, paths: [] };
}

/** Nông trại: ruộng + nhà nông + cây. */
export function generateFarm(
  wt: WorldTerrain,
  existing: DioramaPlacement[],
  x: number,
  z: number,
  radius: number,
  seed = 1,
): { terrain: WorldTerrain; placements: DioramaPlacement[] } {
  const terrain = paintBiome(wt, x, z, radius, "field");
  const bounds = worldBoundsOf(terrain);
  const placements = [
    createPlacement("house", x, z - radius * 0.5, null, undefined, null, bounds),
    ...scatterForest(terrain, existing, x + radius * 0.6, z + radius * 0.6, 4, 0.1, seed),
  ];
  return { terrain, placements };
}

/** Khoảng cách từ điểm tới đoạn thẳng. */
function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (pz - az) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

/** Đào lòng sông dọc đường: sâu nhất ở giữa, feather ra 2 bờ. */
export function carveRiver(
  wt: WorldTerrain,
  points: Array<{ x: number; z: number }>,
  width: number,
  depth: number,
): WorldTerrain {
  if (points.length < 2) return wt;
  const chunks: Record<string, { heights: number[][]; biomes: string[][] }> = {};
  for (const key of Object.keys(wt.chunks)) {
    const c = wt.chunks[key];
    chunks[key] = { heights: c.heights.map((r) => [...r]), biomes: c.biomes };
  }
  for (const key of Object.keys(wt.chunks)) {
    const { cx, cz } = parseChunkKey(key);
    const ox = cx * CHUNK_SIZE - CHUNK_SIZE / 2;
    const oz = cz * CHUNK_SIZE - CHUNK_SIZE / 2;
    for (let j = 0; j <= TERRAIN_CELLS; j += 1) {
      for (let i = 0; i <= TERRAIN_CELLS; i += 1) {
        const wx = ox + (i / TERRAIN_CELLS) * CHUNK_SIZE;
        const wz = oz + (j / TERRAIN_CELLS) * CHUNK_SIZE;
        let d = Infinity;
        for (let s = 0; s < points.length - 1; s += 1) {
          d = Math.min(d, distToSegment(wx, wz, points[s].x, points[s].z, points[s + 1].x, points[s + 1].z));
        }
        if (d < width) {
          chunks[key].heights[j][i] = clampH(
            chunks[key].heights[j][i] - depth * (0.5 + 0.5 * Math.cos((Math.PI * d) / width)),
          );
        }
      }
    }
  }
  return { ...wt, chunks };
}
