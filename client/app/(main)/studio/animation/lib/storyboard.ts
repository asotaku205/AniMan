/**
 * Bảng phân cảnh & trạng thái sản xuất (R5): mỗi cảnh mang trạng thái
 * làm việc (kiểu phần mềm quản lý sản xuất hoạt hình rút gọn), loại cú
 * máy dự kiến, ghi chú camera và hình phác vẽ tay. Hàm thuần để tính
 * tiến độ toàn dự án; phần chụp khung hình thật làm hình phác nằm ở
 * captureSceneThumbnail (cần canvas của trình duyệt).
 */

import type { AnimScene } from "./animProject";
import { drawSceneFrame } from "./renderFrame";

export type SceneStatus = "todo" | "doing" | "review" | "done";

export const SCENE_STATUSES: Array<{
  id: SceneStatus;
  label: string;
  /** Màu chấm/nhãn trạng thái (hex) — đồng bộ giữa bảng và danh sách cảnh. */
  color: string;
}> = [
  { id: "todo", label: "Chưa làm", color: "#a1a1aa" },
  { id: "doing", label: "Đang làm", color: "#f59e0b" },
  { id: "review", label: "Chờ duyệt", color: "#38bdf8" },
  { id: "done", label: "Hoàn thành", color: "#34d399" },
];

export function sceneStatusOf(scene: AnimScene): SceneStatus {
  return scene.status ?? "todo";
}

export function sceneStatusMeta(status: SceneStatus) {
  return SCENE_STATUSES.find((s) => s.id === status) ?? SCENE_STATUSES[0];
}

/** Các loại cú máy chuẩn để chọn nhanh khi phân cảnh. */
export const SHOT_TYPES = [
  "Toàn cảnh",
  "Trung cảnh",
  "Cận cảnh",
  "Đặc tả",
  "Qua vai",
  "Góc rộng",
  "Từ trên cao",
  "Theo chân nhân vật",
] as const;

export interface ProjectProgress {
  total: number;
  done: number;
  percent: number;
  counts: Record<SceneStatus, number>;
}

/** Tiến độ sản xuất toàn dự án theo trạng thái các cảnh. */
export function projectProgress(
  scenes: readonly AnimScene[],
): ProjectProgress {
  const counts: Record<SceneStatus, number> = {
    todo: 0,
    doing: 0,
    review: 0,
    done: 0,
  };
  for (const s of scenes) counts[sceneStatusOf(s)] += 1;
  const total = scenes.length;
  const done = counts.done;
  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    counts,
  };
}

/**
 * Chụp khung hình đầu cảnh 2D thành hình phác phân cảnh (thu nhỏ
 * 480×270). Trả về null nếu cảnh không có timeline/hình nào nạp được.
 */
export async function captureSceneThumbnail(
  scene: AnimScene,
): Promise<string | null> {
  if (typeof document === "undefined" || !scene.timeline) return null;
  const urls = new Set<string>();
  for (const l of scene.timeline.layers) {
    if (l.imageDataUrl) urls.add(l.imageDataUrl);
  }
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    [...urls].map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            images.set(url, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url;
        }),
    ),
  );
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 270;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  drawSceneFrame(ctx, scene, 0, 480, 270, (url) => images.get(url) ?? null);
  return canvas.toDataURL("image/png");
}
