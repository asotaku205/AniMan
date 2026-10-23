/**
 * Cầu nối World Builder → Thư viện tài sản của Animation Studio (Đợt Đ4).
 * Đúng vai trò đã chốt cho World Builder: nơi quản trị thế giới và nhân
 * vật của câu chuyện — từ đây, nhân vật thành NHÂN VẬT 3D dùng được
 * trong phim, vùng đất thành MẪU PHONG CẢNH khởi điểm cho cảnh quay.
 * Gửi lại cùng một nhân vật/vùng sẽ CẬP NHẬT tài sản cũ (mã cố định theo
 * mã nguồn), không tạo bản trùng.
 */

import { saveAnimAsset } from "../../animation/lib/animStorage";
import { createPrevizObject, vec3 } from "../../animation/lib/previz";
import { TERRAIN, type TerrainType, type WorldCharacter } from "../data";
import type { HexCell } from "../data";

export async function sendWorldCharacterToLibrary(
  char: WorldCharacter,
): Promise<string> {
  await saveAnimAsset({
    kind: "character3d",
    id: `wb-char-${char.id}`,
    name: char.name,
    color: char.color,
    size: 1.7,
    createdAt: Date.now(),
  });
  return `Đã đưa nhân vật "${char.name}" vào thư viện tài sản — mở Animation Studio, mục Thư viện tài sản sẽ có nhân vật này để thêm vào cảnh.`;
}

function objectsForTerrain(terrain: TerrainType) {
  const mk = (
    kind: "box" | "cylinder" | "wall",
    name: string,
    color: string,
    size: number,
    x: number,
    z: number,
  ) => {
    const obj = createPrevizObject(kind, name);
    obj.color = color;
    obj.size = size;
    obj.keys = [
      { ...obj.keys[0], position: vec3(x, kind === "cylinder" ? 0 : 0, z) },
    ];
    return obj;
  };
  switch (terrain) {
    case "forest":
      return [
        mk("cylinder", "Cây cổ thụ", "#2e6b34", 3.4, -2.6, -2),
        mk("cylinder", "Cây vừa", "#357a3c", 2.6, 2.8, -2.4),
        mk("cylinder", "Cây nhỏ", "#3f8f46", 1.9, 0.4, -3),
      ];
    case "city":
      return [
        mk("wall", "Toà nhà trái", "#7a6a55", 2.6, -2.6, -3),
        mk("wall", "Toà nhà phải", "#6a7a8c", 3.1, 2.6, -3),
        mk("box", "Ki-ốt", "#8a4a5e", 0.9, 0.6, -1),
      ];
    case "mountain":
      return [
        mk("box", "Khối núi", "#8c8578", 2.8, -1.8, -3),
        mk("box", "Mỏm đá", "#7a7468", 1.6, 2, -2),
      ];
    case "desert":
      return [
        mk("cylinder", "Xương rồng", "#3f8f46", 1.8, -2.2, -2),
        mk("box", "Tảng đá sa mạc", "#b59a6a", 1, 2.2, -1.4),
      ];
    case "snow":
      return [
        mk("cylinder", "Thông tuyết", "#2e5b4f", 3, -2.4, -2.2),
        mk("box", "Khối băng", "#bfe3ff", 1.1, 2, -1.6),
      ];
    case "sea":
      return [mk("box", "Mặt nước (khối thấp)", "#3f7fbf", 0.25, 0, -1)];
    case "magic":
      return [
        mk("cylinder", "Cột pha lê", "#a855f7", 2.4, -1.8, -2),
        mk("cylinder", "Cột pha lê nhỏ", "#c084fc", 1.6, 1.9, -2.2),
      ];
    default:
      return [
        mk("cylinder", "Cây xanh", "#3f8f46", 2.6, -2.4, -2),
        mk("box", "Phiến đá", "#8c8578", 0.7, 2, -1.2),
      ];
  }
}

export async function sendWorldRegionToLibrary(
  cell: HexCell,
): Promise<string> {
  const name = cell.name ?? TERRAIN[cell.terrain].label;
  await saveAnimAsset({
    kind: "scenery",
    id: `wb-region-${cell.col}-${cell.row}`,
    name: `Phong cảnh — ${name}`,
    backdrop: TERRAIN[cell.terrain].dark,
    objects: objectsForTerrain(cell.terrain),
    createdAt: Date.now(),
  });
  return `Đã tạo phong cảnh "${name}" trong thư viện tài sản — vào Animation Studio để áp cho cảnh 3D.`;
}
