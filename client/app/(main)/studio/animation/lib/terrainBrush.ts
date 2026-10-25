/**
 * Địa hình previz 3D (giai đoạn B Phong cảnh): lưới cao độ thuần, không
 * phụ thuộc Three/DOM để kiểm thử được. Lưới phủ mặt đất vuông, hàng j
 * chạy theo trục z, cột i chạy theo trục x.
 */

export interface TerrainGrid {
  /** Cạnh mặt đất (mét). */
  size: number;
  /** Số ô mỗi cạnh (đỉnh = cells + 1). */
  cells: number;
  /** heights[j][i] — cao độ tại đỉnh (i, j). */
  heights: number[][];
}

export const PREVIZ_GROUND_SIZE = 30;
export const PREVIZ_GRID_CELLS = 60;
export const TERRAIN_MIN_HEIGHT = -2;
export const TERRAIN_MAX_HEIGHT = 6;

export function createTerrainGrid(
  size: number = PREVIZ_GROUND_SIZE,
  cells: number = PREVIZ_GRID_CELLS,
): TerrainGrid {
  return {
    size,
    cells,
    heights: Array.from({ length: cells + 1 }, () =>
      new Array(cells + 1).fill(0),
    ),
  };
}

function clampHeight(h: number): number {
  return Math.min(TERRAIN_MAX_HEIGHT, Math.max(TERRAIN_MIN_HEIGHT, h));
}

/** Cao độ tại (x, z) — nội suy song tuyến, ngoài biên kẹp vào mép. */
export function heightAtGrid(grid: TerrainGrid, x: number, z: number): number {
  const { size, cells, heights } = grid;
  const gx = Math.min(
    cells - 0.001,
    Math.max(0, ((x + size / 2) / size) * cells),
  );
  const gz = Math.min(
    cells - 0.001,
    Math.max(0, ((z + size / 2) / size) * cells),
  );
  const i = Math.floor(gx);
  const j = Math.floor(gz);
  const fx = gx - i;
  const fz = gz - j;
  const h00 = heights[j][i];
  const h10 = heights[j][i + 1];
  const h01 = heights[j + 1][i];
  const h11 = heights[j + 1][i + 1];
  return (
    h00 * (1 - fx) * (1 - fz) +
    h10 * fx * (1 - fz) +
    h01 * (1 - fx) * fz +
    h11 * fx * fz
  );
}

export type TerrainBrushMode = "raise" | "lower" | "flatten" | "smooth";

/**
 * Quét cọ lên lưới: nâng/hạ/san phẳng về cao độ tâm/làm mịn theo độ
 * rơi mượt (cos) trong bán kính. Trả lưới mới, không sửa lưới cũ.
 * strength: nâng/hạ tính bằng mét; san phẳng/làm mịn tính bằng tỉ lệ
 * 0..1 mỗi lần quét.
 */
export function applyBrush(
  grid: TerrainGrid,
  mode: TerrainBrushMode,
  cx: number,
  cz: number,
  radius: number,
  strength: number,
): TerrainGrid {
  const { size, cells } = grid;
  const heights = grid.heights.map((row) => [...row]);
  const centerH = heightAtGrid(grid, cx, cz);
  const step = size / cells;
  const gx = ((cx + size / 2) / size) * cells;
  const gz = ((cz + size / 2) / size) * cells;
  const rCells = radius / step;
  const i0 = Math.max(0, Math.floor(gx - rCells));
  const i1 = Math.min(cells, Math.ceil(gx + rCells));
  const j0 = Math.max(0, Math.floor(gz - rCells));
  const j1 = Math.min(cells, Math.ceil(gz + rCells));
  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) {
      const wx = -size / 2 + (i / cells) * size;
      const wz = -size / 2 + (j / cells) * size;
      const d = Math.hypot(wx - cx, wz - cz);
      if (d >= radius) continue;
      const fall = 0.5 * (1 + Math.cos((Math.PI * d) / radius));
      if (mode === "raise") {
        heights[j][i] = clampHeight(heights[j][i] + strength * fall);
      } else if (mode === "lower") {
        heights[j][i] = clampHeight(heights[j][i] - strength * fall);
      } else if (mode === "flatten") {
        heights[j][i] =
          heights[j][i] + (centerH - heights[j][i]) * strength * fall;
      } else {
        // Làm mịn: kéo về trung bình 4 đỉnh kề (đọc từ lưới gốc).
        const up = grid.heights[Math.max(0, j - 1)][i];
        const down = grid.heights[Math.min(cells, j + 1)][i];
        const left = grid.heights[j][Math.max(0, i - 1)];
        const right = grid.heights[j][Math.min(cells, i + 1)];
        const avg = (up + down + left + right) / 4;
        heights[j][i] = heights[j][i] + (avg - heights[j][i]) * strength * fall;
      }
    }
  }
  return { ...grid, heights };
}

/** RNG xác định (mulberry32) — cùng seed cho cùng dãy số. */
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

export type GeneratedTerrainKind = "flat" | "hills" | "beach";

/**
 * Sinh địa hình mẫu cho set dựng sẵn: phẳng (toàn 0), đồi (sóng sin
 * pha ngẫu nhiên theo seed, cao 0..~1.5m), bãi biển (dốc từ sau ra
 * trước, trước thấp dưới mực nước).
 */
export function generateTerrainGrid(
  kind: GeneratedTerrainKind,
  seed: number,
): TerrainGrid {
  const grid = createTerrainGrid();
  if (kind === "flat") return grid;
  const rng = mulberry32(seed);
  const p1 = rng() * Math.PI * 2;
  const p2 = rng() * Math.PI * 2;
  const p3 = rng() * Math.PI * 2;
  const f1 = 0.12 + rng() * 0.08;
  const f2 = 0.25 + rng() * 0.15;
  for (let j = 0; j <= grid.cells; j += 1) {
    for (let i = 0; i <= grid.cells; i += 1) {
      const x = -grid.size / 2 + (i / grid.cells) * grid.size;
      const z = -grid.size / 2 + (j / grid.cells) * grid.size;
      if (kind === "hills") {
        const v =
          Math.sin(x * f1 + p1) * 0.6 +
          Math.sin(z * f1 + p2) * 0.6 +
          Math.sin((x + z) * f2 + p3) * 0.3;
        grid.heights[j][i] = clampHeight(Math.max(0, v));
      } else {
        // Bãi biển: sau (z = -15) cao 1.2m, trước (z = +15) thấp -0.6m.
        const t = (z + grid.size / 2) / grid.size;
        grid.heights[j][i] = clampHeight(
          1.2 + (-0.6 - 1.2) * t + Math.sin(x * 0.3 + p1) * 0.1,
        );
      }
    }
  }
  return grid;
}
