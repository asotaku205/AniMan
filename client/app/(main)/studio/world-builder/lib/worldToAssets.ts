/**
 * Cầu nối World Builder → Animation Studio (W7, thay bản Đợt Đ4 dùng bản
 * đồ hex cũ). Theo nguyên tắc tự tạo: mọi thứ chuyển sang đều là điểm
 * khởi đầu chỉnh được, không phải thành phẩm đóng hộp.
 *
 * - Địa điểm → dự án 3D mới, cảnh đầu tiên mang tên địa điểm + ghi chú
 *   mô tả (người dùng tự dựng tiếp trong Animation Studio).
 * - Góc nhìn sa bàn → ảnh nền 2D trong thư viện tài sản.
 * - Nhân vật → tài sản nhân vật 2D (biểu cảm từ hồ sơ thiết kế).
 */

import { createAnimProject, createAnimScene } from "../../animation/lib/animProject";
import { newAssetId } from "../../animation/lib/animAssets";
import { saveAnimAsset, saveAnimProject } from "../../animation/lib/animStorage";
import type { DioramaPlacement, StoryEntity } from "./diorama";

/** Tạo dự án 3D từ một địa điểm (placement gắn thực thể). */
export async function placeToAnimationProject(
  place: DioramaPlacement,
  entities: StoryEntity[],
): Promise<string> {
  const ent = place.storyEntityId ? entities.find((e) => e.id === place.storyEntityId) : undefined;
  const name = ent?.name ?? place.name;
  const project = createAnimProject(`Địa điểm: ${name}`, "3d");
  const scene = createAnimScene(`Địa điểm: ${name}`, 5);
  scene.note = [
    `Chuyển từ World Builder — địa điểm "${name}"`,
    ent?.description ? `Mô tả: ${ent.description}` : "",
    `Vị trí trên sa bàn: (${place.x}, ${place.z}), xoay ${Math.round((place.rotationY * 180) / Math.PI)}°.`,
    "Mở Animation Studio để dựng cảnh tiếp từ đây.",
  ]
    .filter(Boolean)
    .join("\n");
  project.scenes = [scene];
  await saveAnimProject(project);
  return project.id;
}

/** Lưu ảnh chụp sa bàn thành ảnh nền 2D trong thư viện tài sản. */
export async function viewToBackgroundAsset(viewName: string, dataUrl: string): Promise<string> {
  const id = newAssetId("image");
  await saveAnimAsset({
    kind: "image",
    id,
    name: `Nền từ sa bàn — ${viewName}`,
    category: "background",
    dataUrl,
    createdAt: Date.now(),
  });
  return id;
}

/**
 * Lưu nhân vật thành tài sản 2D: biểu cảm từ hồ sơ thiết kế; nếu chưa
 * vẽ biểu cảm nào thì dùng ảnh mặt trước làm "Mặc định" (nếu có).
 * Trả null khi nhân vật chưa có ảnh thiết kế nào.
 */
export async function entityToCharacterAsset(entity: StoryEntity): Promise<string | null> {
  const design = entity.design2d;
  const expressions = (design?.expressions ?? [])
    .filter((e) => e.dataUrl)
    .map((e) => ({ label: e.label, dataUrl: e.dataUrl }));
  if (expressions.length === 0 && design?.front) {
    expressions.push({ label: "Mặc định", dataUrl: design.front });
  }
  if (expressions.length === 0) return null;
  const id = newAssetId("character");
  await saveAnimAsset({
    kind: "character2d",
    id,
    name: entity.name,
    expressions,
    createdAt: Date.now(),
  });
  return id;
}
