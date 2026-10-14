/**
 * layerOps — các phép biến đổi DANH SÁCH layer dạng thuần (Spec 02 §2, BR-L13).
 *
 * Chỉ đụng meta (`LayerItem[]`), không đụng bitmap/canvas/DOM → test được
 * trong Node. Bitmap (copy khi nhân bản, gộp pixel khi merge) do
 * `useDrawStudio` đảm nhiệm sau khi đã tính danh sách mới ở đây.
 *
 * Thứ tự mảng: **index 0 = lớp trên cùng**.
 */
import type { LayerItem } from "../data";

/** Dịch phần tử từ index này sang index khác — lõi chung của mọi sắp xếp. */
function moveByIndex(
  layers: LayerItem[],
  fromIdx: number,
  toIdx: number,
): LayerItem[] {
  if (fromIdx === toIdx) return layers;
  const copy = [...layers];
  const [moved] = copy.splice(fromIdx, 1);
  copy.splice(toIdx, 0, moved);
  return copy;
}

/**
 * Dịch một layer lên ("up" → về phía index 0) hoặc xuống ("down").
 * Không đổi được (đã ở biên / id không tồn tại) → trả về đúng tham chiếu
 * cũ để caller bỏ qua render thừa.
 */
export function moveLayerInList(
  layers: LayerItem[],
  id: string,
  direction: "up" | "down",
): LayerItem[] {
  const idx = layers.findIndex((l) => l.id === id);
  if (idx === -1) return layers;
  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= layers.length) return layers;
  return moveByIndex(layers, idx, targetIdx);
}

/**
 * Kéo-thả một layer tới index đích (index 0 = trên cùng).
 * Index vượt biên được kẹp vào biên; id không tồn tại → trả tham chiếu cũ.
 */
export function moveLayerToIndex(
  layers: LayerItem[],
  id: string,
  toIndex: number,
): LayerItem[] {
  const idx = layers.findIndex((l) => l.id === id);
  if (idx === -1) return layers;
  const clamped = Math.max(0, Math.min(layers.length - 1, Math.floor(toIndex)));
  return moveByIndex(layers, idx, clamped);
}

/**
 * Nhân bản meta một layer: chèn `clone` (đã tạo sẵn id mới) ngay TRÊN bản
 * gốc. Layer AI không được nhân bản (RC-5); id lạ → trả tham chiếu cũ.
 */
export function duplicateLayerInList(
  layers: LayerItem[],
  id: string,
  clone: LayerItem,
): LayerItem[] {
  const idx = layers.findIndex((l) => l.id === id);
  if (idx === -1) return layers;
  if (layers[idx].kind === "ai") return layers;
  const copy = [...layers];
  copy.splice(idx, 0, clone);
  return copy;
}

/**
 * Gộp meta một layer vào layer ngay DƯỚI nó (index + 1 — vì index 0 ở trên).
 * Layer dưới giữ lại (`targetId`), layer gốc bị loại khỏi danh sách.
 * Không gộp được (đang ở đáy / id lạ / dính layer AI) → `null`.
 * Pixel do caller gộp bằng canvas trước khi áp danh sách này.
 */
export function mergeDownInList(
  layers: LayerItem[],
  id: string,
): { layers: LayerItem[]; targetId: string } | null {
  const idx = layers.findIndex((l) => l.id === id);
  if (idx === -1 || idx + 1 >= layers.length) return null;
  const source = layers[idx];
  const target = layers[idx + 1];
  if (source.kind === "ai" || target.kind === "ai") return null;
  return {
    layers: layers.filter((l) => l.id !== id),
    targetId: target.id,
  };
}

/**
 * Có được xóa layer này không: layer AI không bao giờ xóa bằng nút xóa,
 * và phải luôn giữ lại ≥1 layer người dùng vẽ được.
 */
export function canRemoveLayerInList(
  layers: LayerItem[],
  id: string,
): boolean {
  const target = layers.find((l) => l.id === id);
  if (!target || target.kind === "ai") return false;
  return layers.some((l) => l.kind !== "ai" && l.id !== id);
}
