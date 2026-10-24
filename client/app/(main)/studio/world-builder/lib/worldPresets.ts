import {
  createPlacement,
  createFaction,
  type DioramaState,
  type StoryEntity,
} from "./diorama";
import {
  brushTerrain,
  createFlatWorld,
  paintBiome,
  worldBounds,
} from "./terrain";
import {
  generateFarm,
  generateTerrain,
  generateVillage,
  paintByHeight,
  raisePeak,
  scatterForest,
} from "./worldGen";

function baseEntity(
  id: string,
  kind: string,
  name: string,
  role: string,
  color: string,
): StoryEntity {
  return {
    id,
    kind,
    name,
    role,
    traits: [],
    description: "",
    color,
    relations: [],
    customFields: [],
    design2d: { palette: [], expressions: [] },
    articles: [],
    factionId: null,
  };
}

function blankState(): DioramaState {
  return {
    entities: [],
    placements: [],
    events: [],
    terrain: createFlatWorld(),
    paths: [],
    rivers: [],
    customModels: [],
    factions: [],
    sky: { time: 10, weather: "clear", season: "summer" },
    views: [],
  };
}

/**
 * 3 world mẫu khởi điểm (W7): mỗi world là một DioramaState hoàn chỉnh
 * để người dùng mở ra là có ngay thứ để vọc, thay vì sa bàn trống.
 */
export type WorldPresetId = "blank" | "village" | "port" | "snow" | "fantasy" | "adventure" | "romance" | "horror";

export const WORLD_PRESETS: Array<{
  id: WorldPresetId;
  name: string;
  desc: string;
}> = [
  { id: "blank", name: "Sa bàn trống", desc: "Bắt đầu từ con số 0." },
  { id: "village", name: "Làng quê", desc: "Trường học, nhà, cây, 2 nhân vật + 1 sự kiện." },
  { id: "port", name: "Thành phố cảng", desc: "Hồ/biển, cầu, ga — địa hình nước mẫu." },
  { id: "snow", name: "Vương quốc tuyết", desc: "Núi cao, tuyết, đền thờ — địa hình núi mẫu." },
  { id: "fantasy", name: "Fantasy", desc: "Núi tuyết, rừng, cổng hang, làng quê." },
  { id: "adventure", name: "Phiêu lưu", desc: "Biển + đảo cát + cây — thế giới đảo." },
  { id: "romance", name: "Lãng mạn", desc: "Hồ, nông trại, làng quê lúc hoàng hôn." },
  { id: "horror", name: "Kinh dị", desc: "Đầm lầy, sương mù, đêm tối." },
];

export function buildPresetWorld(preset: WorldPresetId): DioramaState {
  const s = blankState();
  if (preset === "blank") return s;
  if (preset === "village") {
    const kira = baseEntity("ent-kira", "character", "Kira", "Học sinh chuyển trường", "#ef4444");
    const ren = baseEntity("ent-ren", "character", "Ren", "Bạn cùng lớp", "#38bdf8");
    kira.relations = [{ entityId: ren.id, label: "bạn thân" }];
    ren.relations = [{ entityId: kira.id, label: "bạn thân" }];
    s.entities = [kira, ren];
    s.placements = [
      createPlacement("school", -6, -4),
      createPlacement("house-detail", 4, -5),
      createPlacement("house", 8, 3),
      createPlacement("pine", -2, 5),
      createPlacement("pine", 2, 7),
      createPlacement("lamp", 0, 0),
      createPlacement("character", -1, 2, kira.id, kira.name),
      createPlacement("character", 1.5, 3, ren.id, ren.name),
    ];
    s.events = [
      {
        id: "ev-1",
        title: "Kira chuyển đến làng",
        dateLabel: "Mùa xuân, năm đầu",
        order: 1,
        entityIds: [kira.id, ren.id],
        description: "Ngày đầu tiên Kira bước qua cổng trường làng.",
      },
    ];
    const fac = createFaction("Lớp học", "#8b5cf6");
    fac.memberIds = [kira.id, ren.id];
    kira.factionId = fac.id;
    ren.factionId = fac.id;
    s.factions = [fac];
    return s;
  }
  if (preset === "port") {
    let terrain = createFlatWorld();
    terrain = brushTerrain(terrain, -8, 0, "lower", 12, 2.5);
    terrain = { ...terrain, waterLevel: 0.2 };
    terrain = paintBiome(terrain, -8, 0, 12, "sand");
    terrain = paintBiome(terrain, 6, 6, 8, "field");
    s.terrain = terrain;
    s.placements = [
      createPlacement("bridge", -4, 0),
      createPlacement("station", 8, -6),
      createPlacement("house-detail", 6, 4),
      createPlacement("rock", -12, 8),
      createPlacement("lamp", 2, -2),
    ];
    s.sky = { time: 15, weather: "clear", season: "summer" };
    return s;
  }
  if (preset === "fantasy") {
    let terrain = createFlatWorld();
    terrain = generateTerrain(terrain, "mountain", -8, -6, 14, 7, 11);
    const b = worldBounds(terrain);
    const bounds = { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ };
    const trees = scatterForest(terrain, [], 6, 6, 10, 0.1, 11);
    const v = generateVillage(terrain, trees, -2, 8, 11);
    s.terrain = terrain;
    s.placements = [
      ...trees,
      ...v.placements,
      createPlacement("cave-gate", -4, -1, null, undefined, null, bounds),
      createPlacement("tower", -10, -10, null, undefined, null, bounds),
    ];
    s.paths = v.paths;
    return s;
  }
  if (preset === "adventure") {
    let terrain = createFlatWorld();
    terrain = generateTerrain(terrain, "sea", 0, 0, 60, 3, 12);
    terrain = raisePeak(terrain, 0, 0, 12, 5, 12);
    terrain = paintByHeight(terrain, 0, 0, 12, (h) => (h < 1.2 ? "sand" : "grass"));
    s.terrain = terrain;
    s.placements = scatterForest(terrain, [], 0, 0, 9, 0.06, 12);
    s.sky = { time: 12, weather: "clear", season: "summer" };
    return s;
  }
  if (preset === "romance") {
    let terrain = createFlatWorld();
    terrain = generateTerrain(terrain, "lake", -6, -4, 8, 2, 13);
    const farm = generateFarm(terrain, [], 6, 4, 8, 13);
    terrain = farm.terrain;
    const v = generateVillage(terrain, farm.placements, -4, 10, 13);
    s.terrain = terrain;
    s.placements = [...farm.placements, ...v.placements];
    s.paths = v.paths;
    s.sky = { time: 17, weather: "clear", season: "spring" };
    return s;
  }
  if (preset === "horror") {
    let terrain = createFlatWorld();
    terrain = generateTerrain(terrain, "swamp", 0, 0, 14, 1, 14);
    s.terrain = terrain;
    s.placements = scatterForest(terrain, [], 0, 0, 12, 0.04, 14);
    s.sky = { time: 22, weather: "fog", season: "autumn" };
    return s;
  }
  // snow
  let terrain = createFlatWorld();
  terrain = brushTerrain(terrain, 0, -6, "raise", 14, 5);
  terrain = paintBiome(terrain, 0, -6, 14, "snow");
  terrain = paintBiome(terrain, -10, 8, 7, "forest");
  s.terrain = terrain;
  s.placements = [
    createPlacement("shrine", 0, -6),
    createPlacement("pine", -8, 6),
    createPlacement("pine", -5, 9),
    createPlacement("pine", 7, 8),
    createPlacement("house", 10, -2),
  ];
  s.sky = { time: 9, weather: "snow", season: "winter" };
  return s;
}
