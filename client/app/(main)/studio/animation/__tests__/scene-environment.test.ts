import { describe, expect, it } from "vitest";
import {
  applyBrush,
  createTerrainGrid,
  generateTerrainGrid,
  heightAtGrid,
} from "../lib/terrainBrush";
import {
  buildPreset,
  effectiveFog,
  environmentSky,
  weatherConsequence,
} from "../lib/sceneEnvironment";
import { scatterPlacements } from "../lib/scatter";
import {
  dioramaToEnvironment,
  dioramaToObjects,
} from "../lib/dioramaToScene";
import { chunkKey } from "../../world-builder/lib/terrain";
import type { DioramaState } from "../../world-builder/lib/diorama";

describe("terrainBrush", () => {
  it("lưới phẳng toàn 0 và tra cao độ đúng góc/tâm", () => {
    const g = createTerrainGrid(30, 2);
    expect(g.heights).toHaveLength(3);
    expect(heightAtGrid(g, 0, 0)).toBe(0);
    expect(heightAtGrid(g, -15, -15)).toBe(0);
    expect(heightAtGrid(g, 99, 99)).toBe(0);
  });

  it("nội suy song tuyến đúng", () => {
    const g = createTerrainGrid(2, 1);
    g.heights = [
      [0, 10],
      [20, 30],
    ];
    expect(heightAtGrid(g, 0, 0)).toBeCloseTo(15);
    expect(heightAtGrid(g, -1, -1)).toBe(0);
    expect(heightAtGrid(g, 1, 1)).toBeCloseTo(30, 0);
  });

  it("cọ nâng chỉ ảnh hưởng trong bán kính, tâm cao nhất", () => {
    const g = createTerrainGrid();
    const next = applyBrush(g, "raise", 0, 0, 2, 0.5);
    expect(next.heights[30][30]).toBeCloseTo(0.5);
    expect(next.heights[0][0]).toBe(0);
    expect(g.heights[30][30]).toBe(0);
  });

  it("cọ hạ và san phẳng kéo về cao độ tâm", () => {
    const g = createTerrainGrid();
    const raised = applyBrush(g, "raise", 0, 0, 4, 1);
    const lowered = applyBrush(raised, "lower", 0, 0, 4, 0.5);
    expect(lowered.heights[30][30]).toBeLessThan(raised.heights[30][30]);
    const flat = applyBrush(raised, "flatten", 0, 0, 4, 1);
    const center = flat.heights[30][30];
    expect(Math.abs(flat.heights[30][31] - center)).toBeLessThan(
      Math.abs(raised.heights[30][31] - raised.heights[30][30]),
    );
  });

  it("cọ làm mịn giảm đỉnh nhọn", () => {
    const g = createTerrainGrid();
    g.heights[30][30] = 2;
    const next = applyBrush(g, "smooth", 0, 0, 2, 0.5);
    expect(next.heights[30][30]).toBeLessThan(2);
    expect(next.heights[30][30]).toBeGreaterThan(0);
  });

  it("địa hình mẫu: phẳng toàn 0, đồi có biên và xác định theo seed, bãi biển dốc xuống", () => {
    const flat = generateTerrainGrid("flat", 1);
    expect(flat.heights.flat().every((h) => h === 0)).toBe(true);
    const hillsA = generateTerrainGrid("hills", 7);
    const hillsB = generateTerrainGrid("hills", 7);
    const hillsC = generateTerrainGrid("hills", 8);
    expect(hillsA.heights).toEqual(hillsB.heights);
    expect(hillsA.heights).not.toEqual(hillsC.heights);
    expect(Math.max(...hillsA.heights.flat())).toBeLessThanOrEqual(1.6);
    expect(Math.min(...hillsA.heights.flat())).toBeGreaterThanOrEqual(0);
    const beach = generateTerrainGrid("beach", 3);
    const back = beach.heights[0][30];
    const front = beach.heights[60][30];
    expect(back).toBeGreaterThan(front);
    expect(front).toBeLessThan(0);
  });
});

describe("scatter", () => {
  it("cùng seed ra cùng kết quả, trong vùng, đúng tỉ lệ", () => {
    const a = scatterPlacements({ count: 20, seed: 42 });
    const b = scatterPlacements({ count: 20, seed: 42 });
    const c = scatterPlacements({ count: 20, seed: 43 });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a).toHaveLength(20);
    for (const p of a) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(12);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(12);
      expect(p.scale).toBeGreaterThanOrEqual(0.8);
      expect(p.scale).toBeLessThanOrEqual(1.4);
      expect(p.rotationY).toBeGreaterThanOrEqual(0);
      expect(p.rotationY).toBeLessThan(360);
    }
  });
});

describe("sceneEnvironment", () => {
  it("nắng ngày mạnh hơn đêm, mưa giảm nắng so với nắng cùng giờ", () => {
    const day = environmentSky({
      time: 12,
      weather: "clear",
      fogDensity: 0,
      waterLevel: -1,
      terrain: createTerrainGrid(),
    });
    const night = environmentSky({
      time: 23,
      weather: "clear",
      fogDensity: 0,
      waterLevel: -1,
      terrain: createTerrainGrid(),
    });
    const rain = environmentSky({
      time: 12,
      weather: "rain",
      fogDensity: 0,
      waterLevel: -1,
      terrain: createTerrainGrid(),
    });
    expect(day.sunIntensity).toBeGreaterThan(night.sunIntensity);
    expect(rain.sunIntensity).toBeLessThan(day.sunIntensity);
  });

  it("sương: mật độ 0 giữ tầm nhìn thời tiết, mật độ 1 về sương dày", () => {
    const base = {
      time: 10,
      weather: "clear" as const,
      waterLevel: -1,
      terrain: createTerrainGrid(),
    };
    expect(effectiveFog({ ...base, fogDensity: 0 })).toEqual({
      near: 70,
      far: 130,
    });
    expect(effectiveFog({ ...base, fogDensity: 1 })).toEqual({
      near: 8,
      far: 28,
    });
    expect(effectiveFog({ ...base, weather: "fog", fogDensity: 0 })).toEqual({
      near: 12,
      far: 45,
    });
  });

  it("mô tả hệ quả thời tiết nhắc đủ mây/gió/sấm khi mưa", () => {
    expect(weatherConsequence("rain")).toMatch(/Mưa dông/);
    expect(weatherConsequence("rain")).toMatch(/Sấm sét/);
  });

  it("4 set mẫu đều có môi trường + vật, vật đứng trên mặt đất", () => {
    for (const id of ["room", "street", "forest", "beach"] as const) {
      const p = buildPreset(id);
      expect(p.objects.length).toBeGreaterThan(0);
      for (const o of p.objects) {
        const k = o.keys[0];
        expect(k.position.y).toBeGreaterThanOrEqual(-0.7);
      }
    }
    const beach = buildPreset("beach");
    expect(beach.environment.waterLevel).toBeGreaterThanOrEqual(0);
    const forest = buildPreset("forest");
    expect(
      Math.max(...forest.environment.terrain.heights.flat()),
    ).toBeGreaterThan(0);
  });
});

function fakeDiorama(): DioramaState {
  const heights = Array.from({ length: 81 }, () => new Array(81).fill(0));
  const biomes = Array.from({ length: 80 }, () =>
    new Array(80).fill("grass"),
  );
  return {
    placements: [
      {
        id: "p1",
        modelId: "tree",
        glbAssetId: "model-1",
        storyEntityId: null,
        name: "Cây GLB",
        x: 2,
        z: -3,
        rotationY: Math.PI / 2,
        scale: 1.5,
        visible: true,
      },
      {
        id: "p2",
        modelId: "rock",
        tint: "#ff0000",
        storyEntityId: null,
        name: "Đá khối",
        x: -4,
        z: 5,
        rotationY: 0,
        scale: 1,
        visible: true,
      },
      {
        id: "p3",
        modelId: "tree",
        storyEntityId: null,
        name: "Ngoài sân",
        x: 30,
        z: 0,
        rotationY: 0,
        scale: 1,
        visible: true,
      },
      {
        id: "p4",
        modelId: "tree",
        storyEntityId: null,
        name: "Đã ẩn",
        x: 0,
        z: 0,
        rotationY: 0,
        scale: 1,
        visible: false,
      },
    ],
    entities: [],
    events: [],
    terrain: {
      chunks: { [chunkKey(0, 0)]: { heights, biomes } },
      waterLevel: 0.5,
    },
    paths: [],
    rivers: [],
    customModels: [],
    factions: [],
    sky: { time: 9, weather: "fog", season: "summer" },
    views: [],
  } as unknown as DioramaState;
}

describe("dioramaToScene", () => {
  it("chuyển trời/nước và địa hình phẳng từ sa bàn", () => {
    const env = dioramaToEnvironment(fakeDiorama());
    expect(env.time).toBe(9);
    expect(env.weather).toBe("fog");
    expect(env.waterLevel).toBe(0.5);
    expect(env.terrain.heights.flat().every((h) => h === 0)).toBe(true);
  });

  it("chuyển vật: GLB thành model, khối thành hộp màu, bỏ vật ngoài sân và vật ẩn, xoay đổi ra độ", () => {
    const env = dioramaToEnvironment(fakeDiorama());
    const objs = dioramaToObjects(fakeDiorama(), env);
    expect(objs).toHaveLength(2);
    const model = objs.find((o) => o.kind === "model")!;
    expect(model.modelAssetId).toBe("model-1");
    expect(model.size).toBe(1.5);
    expect(model.keys[0].rotationY).toBeCloseTo(90);
    expect(model.keys[0].position).toEqual({ x: 2, y: 0, z: -3 });
    const box = objs.find((o) => o.kind === "box")!;
    expect(box.color).toBe("#ff0000");
  });
});
