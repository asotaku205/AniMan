/**
 * Sa bàn 3D của World Builder (W1): dữ liệu thuần, không phụ thuộc Three.
 *
 * - Màn hình chính là MÔ HÌNH 3D, đế PHẲNG 40×40 (bản đầu), vật đặt
 *   theo lưới snap 0.5, xoay từng nấc 45°.
 * - Lưu placement RECORDS (không dùng scene.toJSON): mỗi vật chỉ là một
 *   bản ghi nhỏ {modelId, storyEntityId, x, z, rotationY, scale...} nên
 *   lưu bền rẻ, khôi phục nhanh và chuyển được sang studio khác.
 * - Hồ sơ truyện sống trong vật: vật có storyEntityId trỏ sang một thực
 *   thể truyện (nhân vật/địa điểm/sự kiện) — không có màn hình quản trị
 *   chữ riêng.
 */

export const GROUND_SIZE = 40;
export const SNAP_STEP = 0.5;

export type DioramaModelId =
  | "school"
  | "house"
  | "tree-pink"
  | "tree-green"
  | "shrine"
  | "bridge"
  | "station"
  | "character";

export type ModelPartShape = "box" | "cone" | "cylinder" | "sphere";

export interface ModelPart {
  shape: ModelPartShape;
  /** Kích thước: box [rộng, cao, sâu]; cone [bán kính, cao, số mặt];
   * cylinder [bán kính, cao, _]; sphere [bán kính, _, _]. */
  size: [number, number, number];
  /** Tâm của chi tiết (đơn vị thế giới, y tính từ mặt đất). */
  offset: [number, number, number];
  /** Màu hex — "__entity__" nghĩa là lấy màu của thực thể gắn với vật
   * (dùng cho mẫu Nhân vật). */
  color: string;
  rotationY?: number;
}

export interface ModelDef {
  id: DioramaModelId;
  name: string;
  /** Nhãn giấy phép của bộ mẫu gốc (chỉ CC0/CC-BY mới đóng gói được). */
  license: string;
  /** Bán kính vòng chọn quanh vật. */
  footprint: number;
  parts: ModelPart[];
}

/** Mẫu vật dựng từ khối cơ bản — bản đầu dùng hình khối thay cho file
 * GLB thật (đủ để bày bố cục, test luồng đặt vật); GLB thật nạp sau
 * qua cùng placement records. */
export const MODEL_DEFS: ModelDef[] = [
  {
    id: "school",
    name: "Trường học",
    license: "CC0 · KayKit",
    footprint: 4.2,
    parts: [
      { shape: "box", size: [7, 3, 4.5], offset: [0, 1.5, 0], color: "#e8dcc8" },
      { shape: "cone", size: [5.4, 2, 4], offset: [0, 4, 0], color: "#b4572e", rotationY: Math.PI / 4 },
      { shape: "box", size: [1.2, 2, 0.3], offset: [0, 1, 2.35], color: "#7c4a2d" },
      { shape: "box", size: [1.4, 1, 0.2], offset: [-2.2, 1.8, 2.3], color: "#9fc6e8" },
      { shape: "box", size: [1.4, 1, 0.2], offset: [2.2, 1.8, 2.3], color: "#9fc6e8" },
    ],
  },
  {
    id: "house",
    name: "Nhà gỗ nhỏ",
    license: "CC0 · Kenney",
    footprint: 2.4,
    parts: [
      { shape: "box", size: [3.4, 2.2, 3], offset: [0, 1.1, 0], color: "#c9a876" },
      { shape: "cone", size: [2.9, 1.6, 4], offset: [0, 3, 0], color: "#5b8c5a", rotationY: Math.PI / 4 },
      { shape: "box", size: [0.9, 1.5, 0.2], offset: [0, 0.75, 1.55], color: "#6b4a2a" },
    ],
  },
  {
    id: "tree-pink",
    name: "Cây anh đào",
    license: "CC0 · Quaternius",
    footprint: 1.2,
    parts: [
      { shape: "cylinder", size: [0.22, 1.6, 0], offset: [0, 0.8, 0], color: "#7c4a2d" },
      { shape: "sphere", size: [1.25, 0, 0], offset: [0, 2.5, 0], color: "#f2a7c3" },
      { shape: "sphere", size: [0.7, 0, 0], offset: [0.8, 2, 0.3], color: "#f7c3d8" },
    ],
  },
  {
    id: "tree-green",
    name: "Cây xanh",
    license: "CC0 · Kenney",
    footprint: 1.1,
    parts: [
      { shape: "cylinder", size: [0.2, 1.4, 0], offset: [0, 0.7, 0], color: "#7c4a2d" },
      { shape: "cone", size: [1.1, 2.2, 8], offset: [0, 2.5, 0], color: "#4e7d3a" },
    ],
  },
  {
    id: "shrine",
    name: "Đền nhỏ",
    license: "CC-BY · Poly Pizza",
    footprint: 2,
    parts: [
      { shape: "box", size: [3.6, 0.5, 2.4], offset: [0, 1.9, 0], color: "#c0392b" },
      { shape: "box", size: [0.35, 1.7, 0.35], offset: [-1.4, 0.85, 0], color: "#8a5a33" },
      { shape: "box", size: [0.35, 1.7, 0.35], offset: [1.4, 0.85, 0], color: "#8a5a33" },
      { shape: "box", size: [1.2, 1, 1], offset: [0, 0.5, 0], color: "#e8dcc8" },
    ],
  },
  {
    id: "bridge",
    name: "Cầu gỗ",
    license: "CC0 · KayKit",
    footprint: 2.6,
    parts: [
      { shape: "box", size: [5, 0.35, 1.6], offset: [0, 0.9, 0], color: "#a9793f" },
      { shape: "box", size: [0.3, 0.9, 0.3], offset: [-2.2, 0.45, 0.6], color: "#7c4a2d" },
      { shape: "box", size: [0.3, 0.9, 0.3], offset: [2.2, 0.45, 0.6], color: "#7c4a2d" },
      { shape: "box", size: [0.3, 0.9, 0.3], offset: [-2.2, 0.45, -0.6], color: "#7c4a2d" },
      { shape: "box", size: [0.3, 0.9, 0.3], offset: [2.2, 0.45, -0.6], color: "#7c4a2d" },
    ],
  },
  {
    id: "station",
    name: "Sân ga",
    license: "CC0 · Kenney",
    footprint: 3,
    parts: [
      { shape: "box", size: [6, 0.4, 2.6], offset: [0, 0.2, 0], color: "#8a8f98" },
      { shape: "box", size: [4, 2, 2], offset: [0, 1.4, -0.4], color: "#b9bec7" },
      { shape: "box", size: [4.6, 0.3, 2.6], offset: [0, 2.55, 0], color: "#5b6470" },
    ],
  },
  {
    id: "character",
    name: "Nhân vật",
    license: "Tự tạo trong app",
    footprint: 0.8,
    parts: [
      { shape: "cylinder", size: [0.34, 1.1, 0], offset: [0, 0.55, 0], color: "__entity__" },
      { shape: "sphere", size: [0.36, 0, 0], offset: [0, 1.5, 0], color: "#f6c89f" },
      { shape: "sphere", size: [0.38, 0, 0], offset: [0, 1.62, -0.06], color: "__entity__" },
    ],
  },
];

export function modelDef(id: DioramaModelId): ModelDef {
  return MODEL_DEFS.find((m) => m.id === id) ?? MODEL_DEFS[0];
}

export interface DioramaPlacement {
  id: string;
  modelId: DioramaModelId;
  /** Thực thể truyện gắn với vật — null là vật trang trí thuần túy. */
  storyEntityId: string | null;
  name: string;
  x: number;
  z: number;
  rotationY: number;
  scale: number;
  visible: boolean;
}

export interface EntityRelation {
  /** Id thực thể ở đầu kia của quan hệ. */
  entityId: string;
  /** Nhãn quan hệ theo góc nhìn của thực thể này (VD: "Bạn thân"). */
  label: string;
}

export interface StoryEntity {
  id: string;
  kind: "character" | "place" | "event";
  name: string;
  role: string;
  traits: string[];
  description: string;
  color: string;
  /** Quan hệ với các thực thể khác (hồ sơ sống trong vật). */
  relations: EntityRelation[];
}

export interface DioramaState {
  placements: DioramaPlacement[];
  entities: StoryEntity[];
}

let placementCounter = 0;
export function newPlacementId(): string {
  placementCounter += 1;
  return `pl-${Date.now().toString(36)}-${placementCounter.toString(36)}`;
}

/** Snap về lưới 0.5 (theo nghiên cứu: snap 0.5–1 cho sa bàn). */
export function snapToGrid(v: number): number {
  return Math.round(v / SNAP_STEP) * SNAP_STEP;
}

/** Kẹp trong mặt đất 40×40 (chừa lề theo footprint). */
export function clampGround(v: number, footprint = 0): number {
  const limit = GROUND_SIZE / 2 - 0.5 - footprint;
  return Math.min(limit, Math.max(-limit, v));
}

export function createPlacement(
  modelId: DioramaModelId,
  x: number,
  z: number,
  storyEntityId: string | null = null,
  name?: string,
): DioramaPlacement {
  const def = modelDef(modelId);
  return {
    id: newPlacementId(),
    modelId,
    storyEntityId,
    name: name ?? def.name,
    x: snapToGrid(clampGround(x, def.footprint)),
    z: snapToGrid(clampGround(z, def.footprint)),
    rotationY: 0,
    scale: 1,
    visible: true,
  };
}

/** Xoay vật thêm một nấc 45° (chuẩn xoay của sa bàn). */
export function rotatePlacement(p: DioramaPlacement): DioramaPlacement {
  return { ...p, rotationY: (p.rotationY + Math.PI / 4) % (Math.PI * 2) };
}

/** Ánh xạ vị trí ô hex cũ (14×9) sang tọa độ mặt đất sa bàn. */
export function hexToGround(col: number, row: number): { x: number; z: number } {
  return {
    x: snapToGrid((col - 6.5) * 2.6),
    z: snapToGrid((row - 4) * 3.2),
  };
}

/** Nhân vật cũ (bản đồ hex) — chỉ cần các trường này để chuyển đổi. */
export interface LegacyCharacter {
  id: string;
  name: string;
  role: string;
  traits: string[];
  backstory: string;
  hexCol: number;
  hexRow: number;
  color: string;
}

/**
 * Chuyển dữ liệu nhân vật cũ sang sa bàn: mỗi nhân vật thành một thực
 * thể truyện + một vật Nhân vật đặt đúng vị trí tương đương ô hex cũ.
 * Địa điểm cũ (vùng đất đặt tên) không tự chuyển thành vật — người dùng
 * đặt lại bằng mẫu 3D, tránh bày sai bố cục.
 */
export function migrateLegacyWorld(
  chars: readonly LegacyCharacter[],
): DioramaState {
  const entities: StoryEntity[] = chars.map((c) => ({
    id: c.id,
    kind: "character",
    name: c.name,
    role: c.role,
    traits: c.traits,
    description: c.backstory,
    color: c.color,
    relations: [],
  }));
  const placements: DioramaPlacement[] = chars.map((c) => {
    const { x, z } = hexToGround(c.hexCol, c.hexRow);
    return {
      ...createPlacement("character", x, z, c.id, c.name),
      id: `pl-${c.id}`,
    };
  });
  return { entities, placements };
}

/** Bộ vật khởi điểm cho sa bàn trống (trường + đền + cầu + cây). */
export function starterPlacements(): DioramaPlacement[] {
  return [
    createPlacement("school", 0, -6),
    createPlacement("shrine", 11, 5),
    createPlacement("bridge", -9, 7),
    createPlacement("tree-pink", -5, -11),
    createPlacement("tree-green", 7, -12),
    createPlacement("tree-green", -13, -3),
    createPlacement("station", -12, -10),
  ];
}

/** Thêm đặc điểm (trùng thì bỏ qua, rỗng thì bỏ qua). */
export function addTrait(entity: StoryEntity, trait: string): StoryEntity {
  const clean = trait.trim();
  if (!clean || entity.traits.includes(clean)) return entity;
  return { ...entity, traits: [...entity.traits, clean] };
}

export function removeTrait(entity: StoryEntity, trait: string): StoryEntity {
  return { ...entity, traits: entity.traits.filter((t) => t !== trait) };
}

/** Thêm quan hệ tới một thực thể khác (tự quan hệ với chính mình thì bỏ qua). */
export function addRelation(
  entity: StoryEntity,
  targetId: string,
  label: string,
): StoryEntity {
  const clean = label.trim();
  if (!clean || targetId === entity.id) return entity;
  if (entity.relations.some((r) => r.entityId === targetId)) {
    return {
      ...entity,
      relations: entity.relations.map((r) =>
        r.entityId === targetId ? { ...r, label: clean } : r,
      ),
    };
  }
  return {
    ...entity,
    relations: [...entity.relations, { entityId: targetId, label: clean }],
  };
}

export function removeRelation(
  entity: StoryEntity,
  targetId: string,
): StoryEntity {
  return {
    ...entity,
    relations: entity.relations.filter((r) => r.entityId !== targetId),
  };
}
