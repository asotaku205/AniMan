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

import {
  CHUNK_SIZE,
  createFlatWorld,
  type WorldTerrain,
} from "./terrain";

export const GROUND_SIZE = CHUNK_SIZE; // 1 chunk = 40m (giữ tên cũ cho code ngoài)
export const SNAP_STEP = 0.5;

export type DioramaModelId =
  | "school"
  | "house"
  | "tree-pink"
  | "tree-green"
  | "shrine"
  | "bridge"
  | "station"
  | "character"
  | "house-detail"
  | "pine"
  | "lamp"
  | "rock"
  | "cave-gate"
  | "grass-tuft"
  | "bench"
  | "wall"
  | "tower"
  | "stall";

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
    id: "house-detail",
    name: "Nhà chi tiết",
    license: "Tự tạo trong app",
    footprint: 3,
    parts: [
      { shape: "box", size: [4.4, 2.6, 3.6], offset: [0, 1.3, 0], color: "#e8dcc8" },
      { shape: "cone", size: [3.6, 1.6, 4], offset: [0, 3.4, 0], color: "#a8442c", rotationY: Math.PI / 4 },
      { shape: "box", size: [0.9, 1.7, 0.25], offset: [0, 0.85, 1.9], color: "#6b3f22" },
      { shape: "box", size: [1, 0.9, 0.2], offset: [-1.4, 1.5, 1.85], color: "#9fc6e8" },
      { shape: "box", size: [1, 0.9, 0.2], offset: [1.4, 1.5, 1.85], color: "#9fc6e8" },
      { shape: "box", size: [0.5, 0.9, 0.5], offset: [1.5, 4.1, -0.8], color: "#8a8a8a" },
    ],
  },
  {
    id: "pine",
    name: "Cây thông",
    license: "Tự tạo trong app",
    footprint: 1.4,
    parts: [
      { shape: "cylinder", size: [0.22, 0.9, 0], offset: [0, 0.45, 0], color: "#6b3f22" },
      { shape: "cone", size: [1.5, 1.4, 8], offset: [0, 1.4, 0], color: "#2f6b33" },
      { shape: "cone", size: [1.15, 1.2, 8], offset: [0, 2.3, 0], color: "#357a3b" },
      { shape: "cone", size: [0.8, 1, 8], offset: [0, 3.1, 0], color: "#3f8a44" },
    ],
  },
  {
    id: "lamp",
    name: "Đèn đường",
    license: "Tự tạo trong app",
    footprint: 0.8,
    parts: [
      { shape: "cylinder", size: [0.12, 3.2, 0], offset: [0, 1.6, 0], color: "#2b2b33" },
      { shape: "cylinder", size: [0.3, 0.25, 0], offset: [0, 0.12, 0], color: "#3a3a44" },
      { shape: "sphere", size: [0.32, 0, 0], offset: [0, 3.4, 0], color: "#ffe9a8" },
      { shape: "box", size: [0.7, 0.15, 0.15], offset: [0.3, 3.2, 0], color: "#2b2b33" },
    ],
  },
  {
    id: "rock",
    name: "Tảng đá",
    license: "Tự tạo trong app",
    footprint: 1.2,
    parts: [
      { shape: "box", size: [1.6, 1, 1.2], offset: [0, 0.5, 0], color: "#8a8a8a", rotationY: 0.4 },
      { shape: "box", size: [0.9, 0.7, 0.8], offset: [0.7, 1.1, 0.3], color: "#9a9a9a", rotationY: -0.3 },
    ],
  },
  {
    id: "cave-gate",
    name: "Cổng hang",
    license: "Tự tạo trong app",
    footprint: 2.2,
    parts: [
      { shape: "box", size: [0.8, 3, 1.2], offset: [-1.4, 1.5, 0], color: "#6b6b6b" },
      { shape: "box", size: [0.8, 3, 1.2], offset: [1.4, 1.5, 0], color: "#6b6b6b" },
      { shape: "box", size: [3.8, 1, 1.2], offset: [0, 3.5, 0], color: "#7a7a7a" },
      { shape: "box", size: [2.2, 2.6, 0.3], offset: [0, 1.3, 0.1], color: "#11111a" },
    ],
  },
  {
    id: "grass-tuft",
    name: "Bụi cỏ",
    license: "Tự tạo trong app",
    footprint: 0.5,
    parts: [
      { shape: "cone", size: [0.3, 0.7, 4], offset: [0, 0.35, 0], color: "#5d9150" },
      { shape: "cone", size: [0.24, 0.55, 4], offset: [0.25, 0.27, 0.15], color: "#6fae5e" },
      { shape: "cone", size: [0.24, 0.5, 4], offset: [-0.22, 0.25, -0.12], color: "#4e7d3a" },
    ],
  },
  {
    id: "bench",
    name: "Ghế đá",
    license: "Tự tạo trong app",
    footprint: 1,
    parts: [
      { shape: "box", size: [1.6, 0.15, 0.5], offset: [0, 0.55, 0], color: "#8a8a8a" },
      { shape: "box", size: [0.15, 0.55, 0.45], offset: [-0.65, 0.27, 0], color: "#6b6b6b" },
      { shape: "box", size: [0.15, 0.55, 0.45], offset: [0.65, 0.27, 0], color: "#6b6b6b" },
    ],
  },
  {
    id: "wall",
    name: "Tường thành",
    license: "Tự tạo trong app",
    footprint: 2,
    parts: [
      { shape: "box", size: [4, 2.4, 0.8], offset: [0, 1.2, 0], color: "#9a9a9a" },
      { shape: "box", size: [4.2, 0.4, 1], offset: [0, 2.6, 0], color: "#8a8a8a" },
    ],
  },
  {
    id: "tower",
    name: "Tháp canh",
    license: "Tự tạo trong app",
    footprint: 2,
    parts: [
      { shape: "cylinder", size: [1.4, 4.5, 0], offset: [0, 2.25, 0], color: "#9a9a9a" },
      { shape: "cone", size: [1.9, 1.8, 8], offset: [0, 5.4, 0], color: "#a8442c" },
    ],
  },
  {
    id: "stall",
    name: "Sạp chợ",
    license: "Tự tạo trong app",
    footprint: 1.4,
    parts: [
      { shape: "box", size: [1.8, 0.9, 1], offset: [0, 0.45, 0], color: "#7c4a2d" },
      { shape: "box", size: [2.2, 0.15, 1.6], offset: [0, 2.1, 0], color: "#d9c07a", rotationY: 0.2 },
      { shape: "box", size: [0.12, 2.1, 0.12], offset: [-1, 1.05, -0.6], color: "#6b3f22" },
      { shape: "box", size: [0.12, 2.1, 0.12], offset: [1, 1.05, -0.6], color: "#6b3f22" },
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

/** Trạng thái tài sản 5 mức (W2, theo nghiên cứu pipeline asset 3D):
 * từ phác thảo 2D tới sẵn sàng dùng trong phim. */
export type AssetStatus =
  | "sketch"
  | "rough"
  | "textured"
  | "rigged"
  | "ready";

export const ASSET_STATUSES: Array<{ id: AssetStatus; label: string }> = [
  { id: "sketch", label: "Phác thảo 2D" },
  { id: "rough", label: "Mẫu thô" },
  { id: "textured", label: "Có chất liệu" },
  { id: "rigged", label: "Đã gắn xương" },
  { id: "ready", label: "Sẵn sàng" },
];

/** Vật tự ghép từ chi tiết (W4): người dùng tự đặt tên, thêm/bớt
 * chi tiết khối cơ bản, lưu lại dùng nhiều lần như mẫu có sẵn. */
export interface CustomModel {
  id: string;
  name: string;
  parts: ModelPart[];
}

export interface DioramaPlacement {
  id: string;
  /** Mẫu khối cơ bản — khi có glbAssetId/customModelId thì loại đó
   * được ưu tiên dựng (thứ tự: GLB > tự ghép > khối có sẵn). */
  modelId: DioramaModelId;
  /** Id vật tự ghép (null = không dùng). */
  customModelId?: string | null;
  /** Màu tổng thể ghi đè (null = giữ màu gốc từng chi tiết). */
  tint?: string | null;
  /** Màu ghi đè từng chi tiết theo chỉ số part. */
  partColors?: Record<number, string>;
  /** Khóa vật: vẫn chọn được nhưng không kéo dời được. */
  locked?: boolean;
  rotationX?: number;
  rotationZ?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  /** Id asset GLB trong kho tài sản Animation Studio (null = dùng khối). */
  glbAssetId?: string | null;
  /** Trạng thái tài sản của vật (mặc định "rough" cho mẫu khối). */
  assetStatus?: AssetStatus;
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

/** Trường tự do do người dùng tự thêm (W2: không khóa cứng trường). */
export interface CustomField {
  key: string;
  value: string;
}

/** Một hình trong hồ sơ thiết kế 2D (bản vẽ góc / biểu cảm). */
export interface DesignImage {
  label: string;
  dataUrl: string;
}

/** Hồ sơ thiết kế 2D của thực thể (W2): bản vẽ 3 góc + bảng màu +
 * bảng biểu cảm — nguyên liệu cho nút "Gói bàn giao cho AI 3D". */
export interface Design2D {
  front?: string | null;
  side?: string | null;
  back?: string | null;
  palette: string[];
  expressions: DesignImage[];
}

export interface StoryEntity {
  id: string;
  /** Loại tự do (W2): "character"/"place"/"event" chỉ là gợi ý, người
   * dùng tự đặt loại mới (VD: "Quốc gia", "Sinh vật"). */
  kind: string;
  name: string;
  role: string;
  traits: string[];
  description: string;
  color: string;
  /** Quan hệ với các thực thể khác (hồ sơ sống trong vật). */
  relations: EntityRelation[];
  customFields: CustomField[];
  design2d: Design2D;
  articles: Article[];
  /** Id phe phái (null = chưa thuộc phe nào). */
  factionId?: string | null;
}

/** Bài viết lore gắn vào thực thể (W5): bấm vật là đọc được. */
export interface Article {
  id: string;
  title: string;
  body: string;
}

/** Phe phái / tổ chức (W5): tô màu viền vật theo phe trên sa bàn. */
export interface Faction {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
  description: string;
}

/** Sự kiện trong dòng thời gian của world (W2). */
export interface WorldEvent {
  id: string;
  title: string;
  /** Nhãn thời gian tự do (VD: "Năm 1023", "Kỷ nguyên Thứ ba"). */
  dateLabel: string;
  /** Kỷ nguyên để nhóm/lọc timeline (W5, để trống = không kỷ nguyên). */
  era?: string;
  order: number;
  entityIds: string[];
  description: string;
}

export interface DioramaState {
  placements: DioramaPlacement[];
  entities: StoryEntity[];
  events: WorldEvent[];
  /** Địa hình thế giới theo chunk (W8) — không còn 1 ô đất cố định. */
  terrain: WorldTerrain;
  paths: import("./terrain").TerrainPath[];
  /** Sông/suối (W9): đường + rộng + sâu — dải nước vẽ riêng. */
  rivers: import("./terrain").River[];
  customModels: CustomModel[];
  factions: Faction[];
  sky: SkySettings;
  views: CameraView[];
}

/** Bầu trời của world (W6): giờ trong ngày, thời tiết, mùa. */
export interface SkySettings {
  /** Giờ trong ngày 0–24. */
  time: number;
  weather: "clear" | "fog" | "rain" | "snow";
  season: import("./terrain").Season;
}

/** Góc nhìn đã lưu (W6): vị trí camera + điểm nhìn. */
export interface CameraView {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
}

/** Nhãn hiển thị cho loại thực thể: loại chuẩn dịch sang tiếng Việt,
 * loại tự đặt giữ nguyên tên người dùng gõ. */
export function entityKindLabel(kind: string): string {
  if (kind === "character") return "Nhân vật";
  if (kind === "place") return "Địa điểm";
  if (kind === "event") return "Sự kiện";
  return kind || "Thực thể";
}

/** Bán kính vòng chọn: GLB mặc định 2; vật tự ghép tính từ chi
 * tiết xa tâm nhất; khối có sẵn dùng footprint của mẫu. */
export function placementFootprint(
  p: DioramaPlacement,
  customModels: CustomModel[] = [],
): number {
  if (p.glbAssetId) return 2;
  if (p.customModelId) {
    const m = customModels.find((c) => c.id === p.customModelId);
    if (m) {
      let r = 0.8;
      for (const part of m.parts) {
        r = Math.max(
          r,
          Math.abs(part.offset[0]) + part.size[0] / 2,
          Math.abs(part.offset[2]) + part.size[2] / 2,
        );
      }
      return r;
    }
  }
  return modelDef(p.modelId).footprint;
}

/** Chi tiết dựng cho vật: tự ghép > khối có sẵn (GLB xử lý riêng). */
export function placementParts(
  p: DioramaPlacement,
  customModels: CustomModel[] = [],
): ModelPart[] {
  if (p.customModelId) {
    const m = customModels.find((c) => c.id === p.customModelId);
    if (m) return m.parts;
  }
  return modelDef(p.modelId).parts;
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

/** Kẹp trong biên thế giới (chừa lề 0.5m + footprint). Mặc định là
 * chunk (0,0) ±20 — world nhiều chunk truyền min/max từ worldBounds. */
export function clampGround(v: number, footprint = 0, min = -20, max = 20): number {
  return Math.min(max - 0.5 - footprint, Math.max(min + 0.5 + footprint, v));
}

export function createPlacement(
  modelId: DioramaModelId,
  x: number,
  z: number,
  storyEntityId: string | null = null,
  name?: string,
  glbAssetId?: string | null,
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number },
): DioramaPlacement {
  const def = modelDef(modelId);
  const footprint = glbAssetId ? 2 : def.footprint;
  const minX = bounds?.minX ?? -20;
  const maxX = bounds?.maxX ?? 20;
  const minZ = bounds?.minZ ?? -20;
  const maxZ = bounds?.maxZ ?? 20;
  return {
    id: newPlacementId(),
    modelId,
    glbAssetId: glbAssetId ?? null,
    assetStatus: glbAssetId ? "rough" : "rough",
    storyEntityId,
    name: name ?? def.name,
    x: snapToGrid(clampGround(x, footprint, minX, maxX)),
    z: snapToGrid(clampGround(z, footprint, minZ, maxZ)),
    rotationY: 0,
    scale: 1,
    visible: true,
    rotationX: 0,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    locked: false,
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
    customFields: [],
    design2d: { palette: [], expressions: [] },
    articles: [],
    factionId: null,
  }));
  const placements: DioramaPlacement[] = chars.map((c) => {
    const { x, z } = hexToGround(c.hexCol, c.hexRow);
    return {
      ...createPlacement("character", x, z, c.id, c.name),
      id: `pl-${c.id}`,
    };
  });
  return {
    entities,
    placements,
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

/** Thêm trường tự do (trùng key thì cập nhật giá trị). */
export function addCustomField(
  entity: StoryEntity,
  key: string,
  value: string,
): StoryEntity {
  const k = key.trim();
  if (!k) return entity;
  const fields = entity.customFields ?? [];
  if (fields.some((f) => f.key === k)) {
    return {
      ...entity,
      customFields: fields.map((f) => (f.key === k ? { ...f, value } : f)),
    };
  }
  return { ...entity, customFields: [...fields, { key: k, value }] };
}

export function removeCustomField(
  entity: StoryEntity,
  key: string,
): StoryEntity {
  return {
    ...entity,
    customFields: (entity.customFields ?? []).filter((f) => f.key !== key),
  };
}

/** Bảng màu thiết kế: trùng màu thì bỏ qua. */
export function addPaletteColor(
  entity: StoryEntity,
  color: string,
): StoryEntity {
  const d = entity.design2d ?? { palette: [], expressions: [] };
  if (d.palette.includes(color)) return entity;
  return { ...entity, design2d: { ...d, palette: [...d.palette, color] } };
}

export function removePaletteColor(
  entity: StoryEntity,
  color: string,
): StoryEntity {
  const d = entity.design2d ?? { palette: [], expressions: [] };
  return { ...entity, design2d: { ...d, palette: d.palette.filter((c) => c !== color) } };
}

/** Biểu cảm thiết kế: trùng nhãn thì vẽ đè. */
export function addDesignExpression(
  entity: StoryEntity,
  label: string,
  dataUrl: string,
): StoryEntity {
  const clean = label.trim() || "Không tên";
  const d = entity.design2d ?? { palette: [], expressions: [] };
  const rest = d.expressions.filter((e) => e.label !== clean);
  return {
    ...entity,
    design2d: { ...d, expressions: [...rest, { label: clean, dataUrl }] },
  };
}

export function removeDesignExpression(
  entity: StoryEntity,
  label: string,
): StoryEntity {
  const d = entity.design2d ?? { palette: [], expressions: [] };
  return {
    ...entity,
    design2d: { ...d, expressions: d.expressions.filter((e) => e.label !== label) },
  };
}

let eventCounter = 0;

/** Thêm sự kiện vào timeline (order tự tăng sau sự kiện cuối). */
export function addWorldEvent(
  events: WorldEvent[],
  input: Omit<WorldEvent, "id" | "order"> & { order?: number },
): WorldEvent[] {
  const order =
    input.order ?? (events.length ? Math.max(...events.map((e) => e.order)) + 1 : 0);
  eventCounter += 1;
  return [
    ...events,
    { ...input, id: `ev-${Date.now().toString(36)}-${eventCounter.toString(36)}`, order },
  ];
}

export function removeWorldEvent(
  events: WorldEvent[],
  id: string,
): WorldEvent[] {
  return events.filter((e) => e.id !== id);
}

/** Sự kiện xếp theo thứ tự timeline (ổn định khi trùng order). */
export function sortedEvents(events: WorldEvent[]): WorldEvent[] {
  return [...events].sort((a, b) => a.order - b.order);
}

let customCounter = 0;

/** Tạo vật tự ghép mới (1 khối thân mặc định để không rỗng). */
export function createCustomModel(name: string): CustomModel {
  customCounter += 1;
  return {
    id: `cm-${Date.now().toString(36)}-${customCounter.toString(36)}`,
    name: name.trim() || "Vật tự ghép",
    parts: [
      { shape: "box", size: [1.6, 1, 1.6], offset: [0, 0.5, 0], color: "#b08968" },
    ],
  };
}

export function addPartToModel(model: CustomModel, part: ModelPart): CustomModel {
  return { ...model, parts: [...model.parts, part] };
}

export function removePartFromModel(model: CustomModel, index: number): CustomModel {
  if (model.parts.length <= 1) return model;
  return { ...model, parts: model.parts.filter((_, i) => i !== index) };
}

export function updatePartInModel(
  model: CustomModel,
  index: number,
  patch: Partial<ModelPart>,
): CustomModel {
  return {
    ...model,
    parts: model.parts.map((part, i) => (i === index ? { ...part, ...patch } : part)),
  };
}

let articleCounter = 0;
let factionCounter = 0;

/** Thêm bài viết lore vào thực thể. */
export function addArticle(
  entity: StoryEntity,
  title: string,
  body: string,
): StoryEntity {
  articleCounter += 1;
  return {
    ...entity,
    articles: [
      ...(entity.articles ?? []),
      { id: `art-${Date.now().toString(36)}-${articleCounter.toString(36)}`, title: title.trim() || "Không tên", body },
    ],
  };
}

export function removeArticle(entity: StoryEntity, id: string): StoryEntity {
  return { ...entity, articles: (entity.articles ?? []).filter((a) => a.id !== id) };
}

/** Tạo phe phái mới. */
export function createFaction(name: string, color: string): Faction {
  factionCounter += 1;
  return {
    id: `fac-${Date.now().toString(36)}-${factionCounter.toString(36)}`,
    name: name.trim() || "Phe mới",
    color,
    memberIds: [],
    description: "",
  };
}

/** @mention: tách body thành đoạn text và tên thực thể được nhắc tới. */
export function parseMentions(
  body: string,
  entities: StoryEntity[],
): Array<{ type: "text" | "mention"; value: string; entityId?: string }> {
  const out: Array<{ type: "text" | "mention"; value: string; entityId?: string }> = [];
  // Khớp tên dài nhất trước để tên có khoảng trắng ("Hội Pháp sư") vẫn
  // nhận diện đúng, tên không khớp thì giữ nguyên dạng text.
  const byLength = [...entities].sort((a, b) => b.name.length - a.name.length);
  const pushText = (text: string) => {
    if (!text) return;
    const prev = out[out.length - 1];
    if (prev?.type === "text") prev.value += text;
    else out.push({ type: "text", value: text });
  };
  let i = 0;
  while (i < body.length) {
    if (body[i] !== "@") {
      const next = body.indexOf("@", i);
      const end = next === -1 ? body.length : next;
      pushText(body.slice(i, end));
      i = end;
      continue;
    }
    const hit = byLength.find((e) => body.startsWith(`@${e.name}`, i));
    if (hit) {
      out.push({ type: "mention", value: `@${hit.name}`, entityId: hit.id });
      i += hit.name.length + 1;
    } else {
      pushText("@");
      i += 1;
    }
  }
  return out;
}

let viewCounter = 0;

export function createCameraView(
  name: string,
  position: [number, number, number],
  target: [number, number, number],
): CameraView {
  viewCounter += 1;
  return {
    id: `view-${Date.now().toString(36)}-${viewCounter.toString(36)}`,
    name: name.trim() || "Góc nhìn",
    position,
    target,
  };
}

/** Mặt trời theo giờ: độ cao, cường độ, màu nắng, màu nền, cường độ
 * ánh sáng môi trường — để canvas và test dùng chung một công thức. */
export function skySun(sky: SkySettings): {
  elevation: number;
  sunIntensity: number;
  sunColor: string;
  skyBg: string;
  hemiIntensity: number;
} {
  const t = sky.time;
  const day = t >= 6 && t <= 18;
  const phase = ((t - 6) / 12) * Math.PI;
  const elevation = day ? Math.sin(phase) : -0.15;
  const sunIntensity = day ? 0.6 + 0.9 * Math.sin(phase) : 0.12;
  const warm = day && (t < 8 || t > 16);
  const sunColor = day ? (warm ? "#ffb066" : "#fff3d6") : "#8ea2c8";
  const skyBg = day ? (warm ? "#f2b880" : "#8ec3ee") : "#0d0817";
  const hemiIntensity = day ? 0.9 : 0.35;
  return { elevation, sunIntensity, sunColor, skyBg, hemiIntensity };
}
