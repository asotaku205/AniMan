/**
 * Thư viện tài sản của Animation Studio (Đợt C — quản lý phong cảnh &
 * nhân vật): tài sản DÙNG CHUNG cho mọi dự án, lưu bền ở kho `assets`.
 *
 * - Nhân vật 3D: định nghĩa (tên, màu, chiều cao) → chèn vào bất kỳ cảnh nào.
 * - Mẫu phong cảnh 3D: bộ vật thể + màu nền dựng sẵn (có sẵn 4 mẫu) hoặc do
 *   người dùng lưu từ một cảnh đã dựng — áp vào cảnh khác trong một chạm,
 *   giữ nguyên các nhân vật đang có trong cảnh.
 * - Hình 2D: ảnh nền/nhân vật/đạo cụ tải lên một lần, chèn thành layer cho
 *   mọi cảnh thay vì tải lại từng lần.
 */

import {
  createPrevizObject,
  vec3,
  type PrevizObject,
} from "./previz";

export interface Character3DAsset {
  kind: "character3d";
  id: string;
  name: string;
  color: string;
  /** Chiều cao tổng (mét). */
  size: number;
  createdAt: number;
}

export interface SceneryAsset {
  kind: "scenery";
  id: string;
  name: string;
  backdrop: string;
  objects: PrevizObject[];
  createdAt: number;
}

export type ImageAssetCategory = "background" | "character" | "prop";

export const IMAGE_CATEGORY_LABEL: Record<ImageAssetCategory, string> = {
  background: "Hình nền",
  character: "Nhân vật",
  prop: "Đạo cụ",
};

export interface ImageAsset {
  kind: "image";
  id: string;
  name: string;
  category: ImageAssetCategory;
  dataUrl: string;
  createdAt: number;
}

/** Mô hình 3D có sẵn (file .glb) người dùng nạp vào — đẹp hơn hẳn hình
 * nhân khối; dùng trong cảnh 3D như một vật thể bình thường. */
export interface Model3DAsset {
  kind: "model3d";
  id: string;
  name: string;
  /** Định dạng nguồn; không có giá trị nghĩa là tài sản GLB đời cũ. */
  format?: "glb" | "vrm";
  /** Toàn bộ file .glb/.vrm dạng data URL (base64). */
  dataUrl: string;
  createdAt: number;
  /** Kết quả kiểm tra cấu trúc lúc nạp (xương/clip/tam giác...) — mô
   * hình nạp trước đợt này thì chưa có, bấm "Kiểm tra" để bổ sung. */
  inspection?: import("./modelInspect").ModelInspection;
}

/** Nhân vật 2D người dùng tự vẽ trong app (R4): gồm bộ biểu cảm, mỗi
 * biểu cảm là một hình vẽ riêng nền trong suốt (xem characterSheet.ts). */
export interface Character2DAsset {
  kind: "character2d";
  id: string;
  name: string;
  expressions: Array<{ label: string; dataUrl: string | null }>;
  createdAt: number;
}

/** Chuyển động 2D người dùng lưu tên (gắn chuyển động 2D): mẫu +
 * tham số, kèm điểm đường vẽ nếu có — áp cho vật khác/dự án khác thì
 * dựng lại keys từ tư thế nghỉ của vật đó, không chép cứng tư thế cũ. */
export interface Motion2DAsset {
  kind: "motion2d";
  id: string;
  name: string;
  presetId: string;
  params: import("./timeline").MotionParams;
  /** Điểm đường vẽ kèm theo (nếu có) — áp cùng tham số thời gian. */
  pathPoints?: Array<{ x: number; y: number }>;
  createdAt: number;
}

/** Hiệu ứng hạt 3D người dùng tự dựng (Phase 5): công thức lưu
 * riêng, dùng chung cho mọi cảnh. */
export interface EffectAsset {
  kind: "effect";
  id: string;
  name: string;
  formula: import("./effectFormula").EffectFormula;
  createdAt: number;
}

export type AnimAsset =
  | Character3DAsset
  | SceneryAsset
  | ImageAsset
  | Model3DAsset
  | Character2DAsset
  | EffectAsset
  | Motion2DAsset;

let assetCounter = 0;
export function newAssetId(prefix: string): string {
  assetCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${assetCounter.toString(36)}`;
}

// ── Dựng vật thể mẫu ─────────────────────────────────────────────────────────

function objAt(
  kind: PrevizObject["kind"],
  name: string,
  color: string,
  size: number,
  x: number,
  y: number,
  z: number,
  rotationY = 0,
): PrevizObject {
  const obj = createPrevizObject(kind, name);
  obj.color = color;
  obj.size = size;
  obj.keys = [
    { ...obj.keys[0], position: vec3(x, y, z), rotationY },
  ];
  return obj;
}

/** Nhân vật 3D từ định nghĩa thư viện → vật thể sẵn sàng cho một cảnh. */
export function characterObjectFromAsset(
  asset: Character3DAsset,
  x = 0,
  z = 0,
): PrevizObject {
  const obj = createPrevizObject("character", asset.name);
  obj.color = asset.color;
  obj.size = asset.size;
  obj.keys = [{ ...obj.keys[0], position: vec3(x, 0, z) }];
  return obj;
}

// ── Phong cảnh có sẵn ────────────────────────────────────────────────────────

export interface BuiltinScenery {
  id: string;
  name: string;
  backdrop: string;
  build: () => PrevizObject[];
}

export const BUILTIN_SCENERY: BuiltinScenery[] = [
  {
    id: "builtin-classroom",
    name: "Phòng học",
    backdrop: "#1d1836",
    build: () => [
      objAt("wall", "Bảng đen", "#274435", 1.7, 0, 0, -3.2),
      objAt("box", "Bàn học 1", "#8a6d4b", 0.8, -1.4, 0, -0.6),
      objAt("box", "Bàn học 2", "#8a6d4b", 0.8, 0.2, 0, -0.6),
      objAt("box", "Bàn học 3", "#8a6d4b", 0.8, 1.8, 0, -0.6),
      objAt("box", "Bàn giáo viên", "#6d5138", 1, -2.2, 0, -2.2),
    ],
  },
  {
    id: "builtin-street",
    name: "Đường phố",
    backdrop: "#16283f",
    build: () => [
      objAt("wall", "Toà nhà trái", "#3c4a63", 2.2, -4.2, 0, -2, 25),
      objAt("wall", "Toà nhà phải", "#4a3c5e", 2.6, 4.2, 0, -2.5, -25),
      objAt("box", "Thùng hàng", "#7a6248", 0.7, 2.4, 0, 0.8),
      objAt("cylinder", "Cột đèn", "#5b7a99", 2.6, -2.6, 0, 0.4),
    ],
  },
  {
    id: "builtin-forest",
    name: "Rừng cây",
    backdrop: "#0f2417",
    build: () => [
      objAt("cylinder", "Cây lớn", "#3f7a3a", 3.2, -2.8, 0, -1.6),
      objAt("cylinder", "Cây vừa", "#35703f", 2.4, 2.6, 0, -2.2),
      objAt("cylinder", "Cây nhỏ", "#4c8a44", 1.8, 0.8, 0, -3),
      objAt("box", "Tảng đá", "#5e5e66", 0.8, -1.2, 0, 0.6),
      objAt("box", "Bụi cây", "#2e5e2e", 0.6, 1.6, 0, 0.2),
    ],
  },
  {
    id: "builtin-park",
    name: "Công viên",
    backdrop: "#14301c",
    build: () => [
      objAt("cylinder", "Cây to", "#3f7a3a", 3.4, -3, 0, -2),
      objAt("cylinder", "Cây vừa", "#35703f", 2.6, 3.1, 0, -2.4),
      objAt("cylinder", "Cây nhỏ", "#4c8a44", 1.9, 0.6, 0, -3.2),
      objAt("box", "Ghế dài", "#7a5230", 0.55, -0.9, 0, 0.4),
      objAt("cylinder", "Cột đèn", "#5b7a99", 2.7, 2.2, 0, 0.6),
      objAt("box", "Bồn hoa", "#8a4a5e", 0.5, 1.4, 0, -0.8),
    ],
  },
  {
    id: "builtin-schoolyard",
    name: "Sân trường",
    backdrop: "#1a2a45",
    build: () => [
      objAt("wall", "Dãy lớp học", "#5e6d8c", 2.4, 0, 0, -4),
      objAt("box", "Cột cờ", "#8c8c96", 3, -3.4, 0, -1.5),
      objAt("cylinder", "Cây phượng", "#3f7a3a", 3, 3.6, 0, -1.8),
      objAt("box", "Ghế đá 1", "#6e6e78", 0.5, -1.8, 0, 0.8),
      objAt("box", "Ghế đá 2", "#6e6e78", 0.5, 2, 0, 0.8),
    ],
  },
  {
    id: "builtin-bedroom",
    name: "Phòng ngủ",
    backdrop: "#241a2e",
    build: () => [
      objAt("wall", "Tường sau", "#43355a", 1.8, 0, 0, -2.6),
      objAt("box", "Giường", "#7a4a56", 1.1, -1.8, 0, -1.4),
      objAt("box", "Bàn nhỏ", "#6d5138", 0.7, 1.6, 0, -1.8),
      objAt("cylinder", "Đèn bàn", "#c9a86a", 0.9, 1.6, 0, -1.8),
      objAt("box", "Tủ sách", "#513f63", 1.3, 2.8, 0, -2.2),
    ],
  },
];

/** Nhân vật mẫu có sẵn (không cần lưu — dùng ngay, sửa rồi lưu bản riêng). */
export const BUILTIN_CHARACTERS: Array<{
  name: string;
  color: string;
  size: number;
}> = [
  { name: "Nhân vật chính", color: "#e8b4a0", size: 1.7 },
  { name: "Bạn đồng hành", color: "#a0c4e8", size: 1.62 },
  { name: "Thầy giáo", color: "#c9b48a", size: 1.78 },
];

/**
 * Áp một phong cảnh vào danh sách vật thể hiện tại của cảnh: thay toàn bộ
 * vật thể KHÔNG phải nhân vật + màu nền; nhân vật đang có được giữ nguyên.
 */
export function applyScenery(
  currentObjects: readonly PrevizObject[],
  scenery: { backdrop: string; objects: PrevizObject[] },
): { backdrop: string; objects: PrevizObject[] } {
  const characters = currentObjects.filter((o) => o.kind === "character");
  return {
    backdrop: scenery.backdrop,
    objects: [...scenery.objects, ...characters],
  };
}
