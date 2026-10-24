/**
 * Địa hình thế giới mở rộng (W8): dữ liệu thuần, không phụ thuộc Three.
 *
 * - Thế giới gồm nhiều CHUNK, mỗi chunk là một lưới đỉnh (CELLS+1)²
 *   lưu cao độ (mét) + lưới ô CELLS² lưu biome, phủ 40×40m.
 * - Chunk (cx, cz) có tâm tại (cx*40, cz*40), phủ
 *   x ∈ [cx*40-20, cx*40+20], z tương tự — chunk (0,0) chính là ô
 *   đất cũ 40×40, nên world cũ migrate thành đúng 1 chunk (0,0)
 *   mà không đổi tọa độ vật nào.
 * - Chunk mới kẹp mép theo chunk kề đã có (hàng đỉnh chung phải
 *   bằng nhau) để mặt đất liền mạch, không thành vách giữa 2 chunk.
 * - Vật bám cao độ: cao độ tại (x, z) nội suy tuyến tính 2 chiều
 *   trong chunk chứa điểm đó; ngoài thế giới (chunk chưa có) = 0.
 */

export const TERRAIN_CELLS = 80;
export const CHUNK_SIZE = 40;
export const CHUNK_CELL = CHUNK_SIZE / TERRAIN_CELLS;
export const TERRAIN_MAX_HEIGHT = 8;
export const TERRAIN_MIN_HEIGHT = -3;

export interface BiomeDef {
  id: string;
  name: string;
  color: string;
}

export const BIOMES: BiomeDef[] = [
  { id: "grass", name: "Đồng cỏ", color: "#5d9150" },
  { id: "forest", name: "Rừng rậm", color: "#2f6b33" },
  { id: "sand", name: "Bãi cát", color: "#d9c07a" },
  { id: "rock", name: "Đá núi", color: "#8a8a8a" },
  { id: "snow", name: "Tuyết", color: "#eef4f8" },
  { id: "field", name: "Ruộng", color: "#a8a05a" },
  { id: "desert", name: "Sa mạc", color: "#d8b878" },
  { id: "swamp", name: "Đầm lầy", color: "#4a6b3f" },
];

export function biomeColor(id: string): string {
  return BIOMES.find((b) => b.id === id)?.color ?? BIOMES[0].color;
}

/** Một chunk địa hình: heights[j][i], i theo x, j theo z (tọa độ chunk). */
export interface TerrainChunk {
  heights: number[][];
  biomes: string[][];
}

export interface TerrainPath {
  id: string;
  points: Array<{ x: number; z: number }>;
}

/** Sông/suối (W9): đường vẽ + chiều rộng + độ sâu đào. Dải nước vẽ
 * riêng bám đường (không dùng mặt nước toàn cục). */
export interface River {
  id: string;
  points: Array<{ x: number; z: number }>;
  width: number;
  depth: number;
}

/** Toàn bộ địa hình thế giới: map chunk + mực nước chung. */
export interface WorldTerrain {
  chunks: Record<string, TerrainChunk>;
  /** Mực nước (mét); -1 = tắt nước. Vùng thấp hơn mực nước thành hồ. */
  waterLevel: number;
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function parseChunkKey(key: string): { cx: number; cz: number } {
  const [cx, cz] = key.split(",").map(Number);
  return { cx, cz };
}

/** Chunk chứa điểm thế giới (wx, wz). Mép +20 thuộc về chunk kề. */
export function chunkCoords(wx: number, wz: number): { cx: number; cz: number } {
  return {
    cx: Math.floor((wx + CHUNK_SIZE / 2) / CHUNK_SIZE),
    cz: Math.floor((wz + CHUNK_SIZE / 2) / CHUNK_SIZE),
  };
}

/** Tọa độ địa phương trong chunk (∈ [-20, 20]) của điểm thế giới. */
export function chunkLocal(w: number, c: number): number {
  return w - c * CHUNK_SIZE;
}

export function createFlatTerrain(): TerrainChunk {
  const heights = Array.from({ length: TERRAIN_CELLS + 1 }, () =>
    new Array(TERRAIN_CELLS + 1).fill(0),
  );
  const biomes = Array.from({ length: TERRAIN_CELLS }, () =>
    new Array(TERRAIN_CELLS).fill("grass"),
  );
  return { heights, biomes };
}

export function createFlatWorld(): WorldTerrain {
  return { chunks: { [chunkKey(0, 0)]: createFlatTerrain() }, waterLevel: -1 };
}

/** Đổi tọa độ địa phương chunk sang tọa độ lưới (số thực, 0..CELLS). */
function toGrid(v: number): number {
  return ((v + CHUNK_SIZE / 2) / CHUNK_SIZE) * TERRAIN_CELLS;
}

/** Cao độ trong 1 chunk tại tọa độ địa phương (lx, lz). */
export function heightAtChunk(chunk: TerrainChunk, lx: number, lz: number): number {
  const gx = Math.min(TERRAIN_CELLS - 0.001, Math.max(0, toGrid(lx)));
  const gz = Math.min(TERRAIN_CELLS - 0.001, Math.max(0, toGrid(lz)));
  const i = Math.floor(gx);
  const j = Math.floor(gz);
  const fx = gx - i;
  const fz = gz - j;
  const h = chunk.heights;
  const h00 = h[j][i];
  const h10 = h[j][i + 1];
  const h01 = h[j + 1][i];
  const h11 = h[j + 1][i + 1];
  return (
    h00 * (1 - fx) * (1 - fz) +
    h10 * fx * (1 - fz) +
    h01 * (1 - fx) * fz +
    h11 * fx * fz
  );
}

/** Cao độ tại điểm thế giới — chunk chưa có thì coi là đất phẳng 0. */
export function heightAtWorld(wt: WorldTerrain, wx: number, wz: number): number {
  const { cx, cz } = chunkCoords(wx, wz);
  const chunk = wt.chunks[chunkKey(cx, cz)];
  if (!chunk) return 0;
  return heightAtChunk(chunk, chunkLocal(wx, cx), chunkLocal(wz, cz));
}

/** Giữ tương thích tên cũ: heightAt = heightAtWorld. */
export const heightAt = heightAtWorld;

function clampHeight(h: number): number {
  return Math.min(TERRAIN_MAX_HEIGHT, Math.max(TERRAIN_MIN_HEIGHT, h));
}

export type TerrainBrushMode = "raise" | "lower" | "flatten";

/**
 * Quét cọ trên 1 chunk tại tọa độ địa phương: nâng/hạ/san phẳng theo
 * độ rơi mượt (cos) trong bán kính. San phẳng = kéo về cao độ tâm.
 */
export function brushChunk(
  chunk: TerrainChunk,
  lx: number,
  lz: number,
  mode: TerrainBrushMode,
  radius: number,
  strength: number,
): TerrainChunk {
  const heights = chunk.heights.map((row) => [...row]);
  const centerH = heightAtChunk(chunk, lx, lz);
  const gx = toGrid(lx);
  const gz = toGrid(lz);
  const rCells = radius / CHUNK_CELL;
  const i0 = Math.max(0, Math.floor(gx - rCells));
  const i1 = Math.min(TERRAIN_CELLS, Math.ceil(gx + rCells));
  const j0 = Math.max(0, Math.floor(gz - rCells));
  const j1 = Math.min(TERRAIN_CELLS, Math.ceil(gz + rCells));
  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) {
      const wx = -CHUNK_SIZE / 2 + (i / TERRAIN_CELLS) * CHUNK_SIZE;
      const wz = -CHUNK_SIZE / 2 + (j / TERRAIN_CELLS) * CHUNK_SIZE;
      const d = Math.hypot(wx - lx, wz - lz);
      if (d >= radius) continue;
      const fall = 0.5 * (1 + Math.cos((Math.PI * d) / radius));
      const w = strength * fall;
      if (mode === "raise") heights[j][i] = clampHeight(heights[j][i] + w);
      else if (mode === "lower") heights[j][i] = clampHeight(heights[j][i] - w);
      else heights[j][i] = heights[j][i] + (centerH - heights[j][i]) * w;
    }
  }
  return { ...chunk, heights };
}

/**
 * Quét cọ tại điểm thế giới: cọ có thể tràn qua biên chunk nên áp
 * cho mọi chunk giao với vòng tròn cọ.
 */
export function brushTerrain(
  wt: WorldTerrain,
  wx: number,
  wz: number,
  mode: TerrainBrushMode,
  radius: number,
  strength: number,
): WorldTerrain {
  const chunks = { ...wt.chunks };
  let changed = false;
  for (const key of Object.keys(chunks)) {
    const { cx, cz } = parseChunkKey(key);
    const minX = cx * CHUNK_SIZE - CHUNK_SIZE / 2;
    const maxX = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
    const minZ = cz * CHUNK_SIZE - CHUNK_SIZE / 2;
    const maxZ = cz * CHUNK_SIZE + CHUNK_SIZE / 2;
    const dx = Math.max(minX - wx, 0, wx - maxX);
    const dz = Math.max(minZ - wz, 0, wz - maxZ);
    if (Math.hypot(dx, dz) >= radius) continue;
    chunks[key] = brushChunk(
      chunks[key],
      chunkLocal(wx, cx),
      chunkLocal(wz, cz),
      mode,
      radius,
      strength,
    );
    changed = true;
  }
  return changed ? { ...wt, chunks } : wt;
}

/** Tô biome cho các ô có tâm trong bán kính cọ, trên 1 chunk. */
export function paintChunk(
  chunk: TerrainChunk,
  lx: number,
  lz: number,
  radius: number,
  biomeId: string,
): TerrainChunk {
  const biomes = chunk.biomes.map((row) => [...row]);
  for (let j = 0; j < TERRAIN_CELLS; j += 1) {
    for (let i = 0; i < TERRAIN_CELLS; i += 1) {
      const wx = -CHUNK_SIZE / 2 + ((i + 0.5) / TERRAIN_CELLS) * CHUNK_SIZE;
      const wz = -CHUNK_SIZE / 2 + ((j + 0.5) / TERRAIN_CELLS) * CHUNK_SIZE;
      if (Math.hypot(wx - lx, wz - lz) < radius) biomes[j][i] = biomeId;
    }
  }
  return { ...chunk, biomes };
}

/** Tô biome tại điểm thế giới (tràn biên chunk như brushTerrain). */
export function paintBiome(
  wt: WorldTerrain,
  wx: number,
  wz: number,
  radius: number,
  biomeId: string,
): WorldTerrain {
  const chunks = { ...wt.chunks };
  let changed = false;
  for (const key of Object.keys(chunks)) {
    const { cx, cz } = parseChunkKey(key);
    const minX = cx * CHUNK_SIZE - CHUNK_SIZE / 2;
    const maxX = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
    const minZ = cz * CHUNK_SIZE - CHUNK_SIZE / 2;
    const maxZ = cz * CHUNK_SIZE + CHUNK_SIZE / 2;
    const dx = Math.max(minX - wx, 0, wx - maxX);
    const dz = Math.max(minZ - wz, 0, wz - maxZ);
    if (Math.hypot(dx, dz) >= radius) continue;
    chunks[key] = paintChunk(chunks[key], chunkLocal(wx, cx), chunkLocal(wz, cz), radius, biomeId);
    changed = true;
  }
  return changed ? { ...wt, chunks } : wt;
}

/**
 * Chunk mới: phẳng, nhưng kẹp mép theo chunk kề đã có để mặt đất
 * liền mạch — hàng đỉnh chung và hàng ô biome chung copy từ kề.
 */
export function createChunkFromNeighbors(
  chunks: Record<string, TerrainChunk>,
  cx: number,
  cz: number,
): TerrainChunk {
  const chunk = createFlatTerrain();
  const west = chunks[chunkKey(cx - 1, cz)];
  const east = chunks[chunkKey(cx + 1, cz)];
  const south = chunks[chunkKey(cx, cz - 1)];
  const north = chunks[chunkKey(cx, cz + 1)];
  if (west) {
    for (let j = 0; j <= TERRAIN_CELLS; j += 1) chunk.heights[j][0] = west.heights[j][TERRAIN_CELLS];
    for (let j = 0; j < TERRAIN_CELLS; j += 1) chunk.biomes[j][0] = west.biomes[j][TERRAIN_CELLS - 1];
  }
  if (east) {
    for (let j = 0; j <= TERRAIN_CELLS; j += 1) chunk.heights[j][TERRAIN_CELLS] = east.heights[j][0];
    for (let j = 0; j < TERRAIN_CELLS; j += 1) chunk.biomes[j][TERRAIN_CELLS - 1] = east.biomes[j][0];
  }
  if (south) {
    for (let i = 0; i <= TERRAIN_CELLS; i += 1) chunk.heights[0][i] = south.heights[TERRAIN_CELLS][i];
    for (let i = 0; i < TERRAIN_CELLS; i += 1) chunk.biomes[0][i] = south.biomes[TERRAIN_CELLS - 1][i];
  }
  if (north) {
    for (let i = 0; i <= TERRAIN_CELLS; i += 1) chunk.heights[TERRAIN_CELLS][i] = north.heights[0][i];
    for (let i = 0; i < TERRAIN_CELLS; i += 1) chunk.biomes[TERRAIN_CELLS - 1][i] = north.biomes[0][i];
  }
  return chunk;
}

/** Xoá 1 chunk khỏi thế giới — world phải còn ít nhất 1 chunk nên
 * xoá chunk cuối cùng thì giữ nguyên (UI chặn trước + báo rõ). */
export function removeChunk(wt: WorldTerrain, cx: number, cz: number): WorldTerrain {
  const keys = Object.keys(wt.chunks);
  if (keys.length <= 1) return wt;
  const key = chunkKey(cx, cz);
  if (!wt.chunks[key]) return wt;
  const chunks = { ...wt.chunks };
  delete chunks[key];
  return { ...wt, chunks };
}

/** Thêm 1 chunk vào thế giới (đã có thì giữ nguyên). */
export function addChunk(wt: WorldTerrain, cx: number, cz: number): WorldTerrain {
  const key = chunkKey(cx, cz);
  if (wt.chunks[key]) return wt;
  return {
    ...wt,
    chunks: { ...wt.chunks, [key]: createChunkFromNeighbors(wt.chunks, cx, cz) },
  };
}

export interface WorldBounds {
  minCx: number;
  maxCx: number;
  minCz: number;
  maxCz: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
}

export function worldBounds(wt: WorldTerrain): WorldBounds {
  const keys = Object.keys(wt.chunks);
  if (keys.length === 0) {
    return { minCx: 0, maxCx: 0, minCz: 0, maxCz: 0, minX: -20, maxX: 20, minZ: -20, maxZ: 20, centerX: 0, centerZ: 0 };
  }
  let minCx = Infinity;
  let maxCx = -Infinity;
  let minCz = Infinity;
  let maxCz = -Infinity;
  for (const key of keys) {
    const { cx, cz } = parseChunkKey(key);
    minCx = Math.min(minCx, cx);
    maxCx = Math.max(maxCx, cx);
    minCz = Math.min(minCz, cz);
    maxCz = Math.max(maxCz, cz);
  }
  const minX = minCx * CHUNK_SIZE - CHUNK_SIZE / 2;
  const maxX = maxCx * CHUNK_SIZE + CHUNK_SIZE / 2;
  const minZ = minCz * CHUNK_SIZE - CHUNK_SIZE / 2;
  const maxZ = maxCz * CHUNK_SIZE + CHUNK_SIZE / 2;
  return { minCx, maxCx, minCz, maxCz, minX, maxX, minZ, maxZ, centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2 };
}

export function worldChunkList(wt: WorldTerrain): Array<{ cx: number; cz: number }> {
  return Object.keys(wt.chunks)
    .map(parseChunkKey)
    .sort((a, b) => a.cz - b.cz || a.cx - b.cx);
}

/** Kẹp tọa độ vật vào trong biên thế giới (chừa lề 0.5m + footprint). */
export function clampToWorld(wt: WorldTerrain, v: number, isX: boolean, footprint: number): number {
  const b = worldBounds(wt);
  const min = (isX ? b.minX : b.minZ) + 0.5 + footprint;
  const max = (isX ? b.maxX : b.maxZ) - 0.5 - footprint;
  return Math.min(max, Math.max(min, v));
}

/**
 * Migrate địa hình cũ (1 ô đất: {heights, biomes, waterLevel}) thành
 * thế giới chunk — ô cũ thành chunk (0,0) nguyên vẹn, tọa độ vật
 * không đổi. WorldTerrain mới đi qua thì giữ nguyên.
 */
export function migrateTerrainToWorld(t: unknown): WorldTerrain {
  const anyT = t as Partial<WorldTerrain> & {
    heights?: number[][];
    biomes?: string[][];
    waterLevel?: number;
  };
  if (anyT && typeof anyT === "object" && anyT.chunks && typeof anyT.chunks === "object") {
    return { chunks: anyT.chunks, waterLevel: anyT.waterLevel ?? -1 };
  }
  if (anyT?.heights && anyT?.biomes) {
    return {
      chunks: { [chunkKey(0, 0)]: { heights: anyT.heights, biomes: anyT.biomes } },
      waterLevel: anyT.waterLevel ?? -1,
    };
  }
  return createFlatWorld();
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

function mix(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/**
 * Màu đỉnh lưới: màu biome của ô gần nhất, pha theo cao độ — thấp gần
 * mực nước thì ngả cát, cao thì ngả đá rồi tuyết; cộng nhiễu nhỏ cố
 * định để mặt đất không phẳng lì như nhựa.
 */
export function terrainVertexColor(
  chunk: TerrainChunk,
  i: number,
  j: number,
  waterLevel: number,
): [number, number, number] {
  const ci = Math.min(TERRAIN_CELLS - 1, Math.max(0, i - (i === TERRAIN_CELLS ? 1 : 0)));
  const cj = Math.min(TERRAIN_CELLS - 1, Math.max(0, j - (j === TERRAIN_CELLS ? 1 : 0)));
  let c = hexRgb(biomeColor(chunk.biomes[cj][ci]));
  const h = chunk.heights[j][i];
  const shore = waterLevel + 0.35;
  if (h <= shore && waterLevel > -1) {
    c = mix(c, hexRgb("#d9c07a"), Math.min(1, (shore - h) / 0.6));
  }
  if (h > 4) c = mix(c, hexRgb("#8a8a8a"), Math.min(1, (h - 4) / 2));
  if (h > 6.5) c = mix(c, hexRgb("#eef4f8"), Math.min(1, (h - 6.5) / 1.5));
  const noise = (((i * 7 + j * 13) % 5) - 2) * 0.015;
  return [
    Math.min(1, Math.max(0, c[0] + noise)),
    Math.min(1, Math.max(0, c[1] + noise)),
    Math.min(1, Math.max(0, c[2] + noise)),
  ];
}

export type Season = "spring" | "summer" | "autumn" | "winter";

/** Pha màu theo mùa: thu ngả cam, đông bạc màu + sáng, xuân tươi hơn. */
export function seasonTint(
  c: [number, number, number],
  season: Season,
): [number, number, number] {
  const [r, g, b] = c;
  if (season === "summer") return c;
  if (season === "autumn") {
    const green = (g + r) / 2;
    return [Math.min(1, r * 1.05), green * 0.72, b * 0.6];
  }
  if (season === "winter") {
    const avg = (r + g + b) / 3;
    return [Math.min(1, avg * 0.9 + 0.12), Math.min(1, avg * 0.9 + 0.12), Math.min(1, avg * 0.95 + 0.15)];
  }
  return [Math.min(1, r * 0.95), Math.min(1, g * 1.08), Math.min(1, b * 0.95)];
}
