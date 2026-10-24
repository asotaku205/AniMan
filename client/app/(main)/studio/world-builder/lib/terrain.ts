/**
 * Địa hình sa bàn (W3): dữ liệu thuần, không phụ thuộc Three.
 *
 * - Lưới đỉnh (CELLS+1)² lưu cao độ (mét); lưới ô CELLS² lưu biome.
 * - Lưới cố định 80 ô, còn kích thước thế giới (groundSize) thay đổi
 *   được (20/40/60): đổi size chỉ co giãn lưới, không mất cao độ.
 * - Vật bám cao độ: cao độ tại (x, z) nội suy tuyến tính 2 chiều.
 */

export const TERRAIN_CELLS = 80;
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
];

export function biomeColor(id: string): string {
  return BIOMES.find((b) => b.id === id)?.color ?? BIOMES[0].color;
}

export interface Terrain {
  /** Cao độ đỉnh lưới: heights[j][i], i theo x, j theo z. */
  heights: number[][];
  /** Biome từng ô: biomes[j][i]. */
  biomes: string[][];
  /** Mực nước (mét); -1 = tắt nước. Vùng thấp hơn mực nước thành hồ. */
  waterLevel: number;
}

export interface TerrainPath {
  id: string;
  points: Array<{ x: number; z: number }>;
}

export function createFlatTerrain(): Terrain {
  const heights = Array.from({ length: TERRAIN_CELLS + 1 }, () =>
    new Array(TERRAIN_CELLS + 1).fill(0),
  );
  const biomes = Array.from({ length: TERRAIN_CELLS }, () =>
    new Array(TERRAIN_CELLS).fill("grass"),
  );
  return { heights, biomes, waterLevel: -1 };
}

/** Đổi tọa độ thế giới sang tọa độ lưới (số thực, 0..CELLS). */
function toGrid(size: number, v: number): number {
  return ((v + size / 2) / size) * TERRAIN_CELLS;
}

/** Cao độ tại (x, z) — nội suy tuyến tính 2 chiều trên lưới đỉnh. */
export function heightAt(terrain: Terrain, size: number, x: number, z: number): number {
  const gx = Math.min(TERRAIN_CELLS - 0.001, Math.max(0, toGrid(size, x)));
  const gz = Math.min(TERRAIN_CELLS - 0.001, Math.max(0, toGrid(size, z)));
  const i = Math.floor(gx);
  const j = Math.floor(gz);
  const fx = gx - i;
  const fz = gz - j;
  const h = terrain.heights;
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

function clampHeight(h: number): number {
  return Math.min(TERRAIN_MAX_HEIGHT, Math.max(TERRAIN_MIN_HEIGHT, h));
}

export type TerrainBrushMode = "raise" | "lower" | "flatten";

/**
 * Quét cọ địa hình tại (cx, cz): nâng/hạ/san phẳng theo độ rơi mượt
 * (cos) trong bán kính. San phẳng = kéo cao độ về cao độ điểm trung tâm.
 */
export function brushTerrain(
  terrain: Terrain,
  size: number,
  cx: number,
  cz: number,
  mode: TerrainBrushMode,
  radius: number,
  strength: number,
): Terrain {
  const heights = terrain.heights.map((row) => [...row]);
  const centerH = heightAt(terrain, size, cx, cz);
  const cell = size / TERRAIN_CELLS;
  const gx = toGrid(size, cx);
  const gz = toGrid(size, cz);
  const rCells = radius / cell;
  const i0 = Math.max(0, Math.floor(gx - rCells));
  const i1 = Math.min(TERRAIN_CELLS, Math.ceil(gx + rCells));
  const j0 = Math.max(0, Math.floor(gz - rCells));
  const j1 = Math.min(TERRAIN_CELLS, Math.ceil(gz + rCells));
  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) {
      const wx = -size / 2 + (i / TERRAIN_CELLS) * size;
      const wz = -size / 2 + (j / TERRAIN_CELLS) * size;
      const d = Math.hypot(wx - cx, wz - cz);
      if (d >= radius) continue;
      const fall = 0.5 * (1 + Math.cos((Math.PI * d) / radius));
      const w = strength * fall;
      if (mode === "raise") heights[j][i] = clampHeight(heights[j][i] + w);
      else if (mode === "lower") heights[j][i] = clampHeight(heights[j][i] - w);
      else heights[j][i] = heights[j][i] + (centerH - heights[j][i]) * w;
    }
  }
  return { ...terrain, heights };
}

/** Tô biome cho các ô có tâm trong bán kính cọ. */
export function paintBiome(
  terrain: Terrain,
  size: number,
  cx: number,
  cz: number,
  radius: number,
  biomeId: string,
): Terrain {
  const biomes = terrain.biomes.map((row) => [...row]);
  const cell = size / TERRAIN_CELLS;
  for (let j = 0; j < TERRAIN_CELLS; j += 1) {
    for (let i = 0; i < TERRAIN_CELLS; i += 1) {
      const wx = -size / 2 + ((i + 0.5) / TERRAIN_CELLS) * size;
      const wz = -size / 2 + ((j + 0.5) / TERRAIN_CELLS) * size;
      if (Math.hypot(wx - cx, wz - cz) < radius) biomes[j][i] = biomeId;
    }
  }
  return { ...terrain, biomes };
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
  terrain: Terrain,
  i: number,
  j: number,
): [number, number, number] {
  const ci = Math.min(TERRAIN_CELLS - 1, Math.max(0, i - (i === TERRAIN_CELLS ? 1 : 0)));
  const cj = Math.min(TERRAIN_CELLS - 1, Math.max(0, j - (j === TERRAIN_CELLS ? 1 : 0)));
  let c = hexRgb(biomeColor(terrain.biomes[cj][ci]));
  const h = terrain.heights[j][i];
  const shore = terrain.waterLevel + 0.35;
  if (h <= shore && terrain.waterLevel > -1) {
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
