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
} from "./terrain";

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
export type WorldPresetId = "blank" | "village" | "port" | "snow";

export const WORLD_PRESETS: Array<{
  id: WorldPresetId;
  name: string;
  desc: string;
}> = [
  { id: "blank", name: "Sa bàn trống", desc: "Bắt đầu từ con số 0." },
  { id: "village", name: "Làng quê", desc: "Trường học, nhà, cây, 2 nhân vật + 1 sự kiện." },
  { id: "port", name: "Thành phố cảng", desc: "Hồ/biển, cầu, ga — địa hình nước mẫu." },
  { id: "snow", name: "Vương quốc tuyết", desc: "Núi cao, tuyết, đền thờ — địa hình núi mẫu." },
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
