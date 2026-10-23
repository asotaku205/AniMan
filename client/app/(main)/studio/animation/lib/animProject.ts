/**
 * Mô hình **dự án phim** của Animation Studio.
 *
 * Quyết định thiết kế (Sơn chốt 23/10/2026):
 * - Khi tạo dự án, người dùng chọn TRƯỚC **2D hoặc 3D**; mỗi dự án mang
 *   một loại hình cố định và workspace/UI/tính năng đi theo loại đó.
 * - Pipeline Novel → Manga → Animation là quy trình GỢI Ý, không bắt buộc:
 *   dự án có thể gắn nguồn manga (`sourceMangaProjectId`) hoặc làm độc lập.
 * - Hoàn thiện TOOL trước, AI thêm sau: mô hình này không chứa trường AI.
 *
 * File này chỉ chứa kiểu dữ liệu + hàm thuần (không đụng IndexedDB/DOM)
 * để kiểm thử được; lưu trữ nằm ở `animStorage.ts`.
 */

import { DEFAULT_POST, type PostSettings } from "./postFx";

export type AnimProjectKind = "2d" | "3d";

export interface AnimScene {
  id: string;
  name: string;
  /** Thời lượng cảnh (giây) — animatic và timeline đều tính theo đây. */
  durationSec: number;
  /** Panel nguồn trong Manga Studio (trang/khung) nếu cảnh nạp từ manga. */
  source?: { mangaProjectId: string; page: number; panelId: string } | null;
  note?: string;
  /** Timeline 2D của cảnh (layer/keyframe/camera) — chỉ dự án 2d dùng. */
  timeline?: import("./timeline").SceneTimeline;
  /** Track thoại/phụ đề của cảnh (từ chữ trong panel hoặc điền tay). */
  dialogue?: import("./dialogue").DialogueLine[];
  /** Cảnh previz 3D (vật thể/camera keyframe) — chỉ dự án 3d dùng. */
  previz?: import("./previz").PrevizScene;
  /** Thời tiết/hiệu ứng không khí của cảnh (S2) — cả 2D lẫn 3D dùng. */
  weather?: import("./layerEffects").SceneWeather | null;
}

/** Nhạc nền của toàn phim — file tiếng nằm ở kho Blob, key = `blobKey`. */
export interface ProjectBgm {
  blobKey: string;
  /** Tên file gốc để hiển thị. */
  name: string;
  /** Âm lượng 0–1 (mặc định 0.35 để không lấn thoại). */
  volume: number;
  /** Lặp lại khi nhạc ngắn hơn phim. */
  loop: boolean;
}

export interface AnimProject {
  id: string;
  name: string;
  kind: AnimProjectKind;
  createdAt: number;
  updatedAt: number;
  /** Khung hình xuất bản mặc định của dự án. */
  width: number;
  height: number;
  /** 12 (anime on-2s) hoặc 24 (chuẩn điện ảnh). */
  fps: 12 | 24;
  /** Dự án manga nguồn nếu tạo từ pipeline; null = dự án độc lập. */
  sourceMangaProjectId: string | null;
  scenes: AnimScene[];
  /** Nhạc nền toàn phim (Slice B1); null = không có nhạc nền. */
  bgm?: ProjectBgm | null;
  /** Cài đặt hậu kỳ bản xuất (Đợt Đ3): chuyển cảnh, màu, màn hình tiêu đề. */
  post?: PostSettings;
}

export const ANIM_KIND_LABEL: Record<AnimProjectKind, string> = {
  "2d": "Phim 2D",
  "3d": "Phim 3D",
};

let idCounter = 0;
/** ID ngắn duy nhất trong phiên + bền qua các lần gọi (Date.now + counter + random). */
export function newAnimId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.floor(
    Math.random() * 1e6,
  ).toString(36)}`;
}

export function createAnimScene(name: string, durationSec = 3): AnimScene {
  return {
    id: newAnimId("scene"),
    name: name.trim() || "Cảnh mới",
    durationSec: Math.min(120, Math.max(0.5, durationSec)),
    source: null,
    note: "",
  };
}

/** Cài đặt hậu kỳ hiệu lực của dự án (có mặc định cho dự án đời cũ). */
export function postSettingsOf(project: AnimProject): PostSettings {
  return project.post ?? DEFAULT_POST;
}

export function createAnimProject(
  name: string,
  kind: AnimProjectKind,
  opts: { sourceMangaProjectId?: string | null; fps?: 12 | 24 } = {},
): AnimProject {
  const now = Date.now();
  return {
    id: newAnimId("anim"),
    name: name.trim() || (kind === "2d" ? "Phim 2D chưa đặt tên" : "Phim 3D chưa đặt tên"),
    kind,
    createdAt: now,
    updatedAt: now,
    width: 1920,
    height: 1080,
    fps: opts.fps ?? 24,
    sourceMangaProjectId: opts.sourceMangaProjectId ?? null,
    scenes: [createAnimScene("Cảnh 1", 3)],
    bgm: null,
  };
}

/** Tổng thời lượng dự án (giây). */
export function projectDurationSec(project: AnimProject): number {
  return project.scenes.reduce((sum, s) => sum + (s.durationSec || 0), 0);
}

/** Định dạng giây → "m:ss" cho thẻ dự án/timeline. */
export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

// ── Thao tác cảnh (thuần, trả về project mới) ────────────────────────────────

export function addScene(project: AnimProject, name?: string): AnimProject {
  const scene = createAnimScene(name ?? `Cảnh ${project.scenes.length + 1}`);
  return { ...project, scenes: [...project.scenes, scene], updatedAt: Date.now() };
}

export function updateScene(
  project: AnimProject,
  sceneId: string,
  patch: Partial<AnimScene>,
): AnimProject {
  return {
    ...project,
    scenes: project.scenes.map((s) =>
      s.id === sceneId
        ? {
            ...s,
            ...patch,
            durationSec:
              patch.durationSec !== undefined
                ? Math.min(120, Math.max(0.5, patch.durationSec))
                : s.durationSec,
          }
        : s,
    ),
    updatedAt: Date.now(),
  };
}

export function removeScene(project: AnimProject, sceneId: string): AnimProject {
  return {
    ...project,
    scenes: project.scenes.filter((s) => s.id !== sceneId),
    updatedAt: Date.now(),
  };
}

export function duplicateScene(project: AnimProject, sceneId: string): AnimProject {
  const idx = project.scenes.findIndex((s) => s.id === sceneId);
  if (idx < 0) return project;
  const copy: AnimScene = {
    ...project.scenes[idx],
    id: newAnimId("scene"),
    name: `${project.scenes[idx].name} (bản sao)`,
  };
  const scenes = [...project.scenes];
  scenes.splice(idx + 1, 0, copy);
  return { ...project, scenes, updatedAt: Date.now() };
}

/** Dời cảnh lên/xuống trong thứ tự phát. */
export function moveScene(
  project: AnimProject,
  sceneId: string,
  dir: -1 | 1,
): AnimProject {
  const idx = project.scenes.findIndex((s) => s.id === sceneId);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= project.scenes.length) return project;
  const scenes = [...project.scenes];
  [scenes[idx], scenes[target]] = [scenes[target], scenes[idx]];
  return { ...project, scenes, updatedAt: Date.now() };
}
