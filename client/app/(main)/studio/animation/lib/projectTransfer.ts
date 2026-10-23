/**
 * Xuất/nhập dự án phim (Slice B6): đóng gói TOÀN BỘ dự án (dữ liệu + các
 * file tiếng: bản thu giọng, nhạc nền) thành một file JSON mang đi được
 * để sao lưu, chuyển máy, chia sẻ. Nhập vào luôn tạo dự án MỚI (mã mới)
 * để không đè lên dự án đang có.
 */

import type { AnimProject } from "./animProject";
import { bgmBlobKey, loadVoiceBlob, saveAnimProject, saveVoiceBlob } from "./animStorage";

export interface ProjectPackage {
  format: "animan-project";
  version: 1;
  exportedAt: number;
  project: AnimProject;
  /** key trong kho file tiếng → dữ liệu base64 + loại file. */
  voiceFiles: Record<string, { mime: string; data: string }>;
}

/** Mọi key file tiếng mà dự án đang tham chiếu (bản thu + nhạc nền). */
export function collectVoiceKeys(project: AnimProject): string[] {
  const keys = new Set<string>();
  for (const scene of project.scenes) {
    for (const line of scene.dialogue ?? []) {
      for (const take of line.takes ?? []) keys.add(take.id);
    }
  }
  if (project.bgm) keys.add(project.bgm.blobKey);
  return [...keys];
}

function blobToBase64(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((ab) => {
    const bytes = new Uint8Array(ab);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  });
}

function base64ToBlob(data: string, mime: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime || "application/octet-stream" });
}

/** Đóng gói dự án thành chuỗi JSON của file `.animan-project.json`. */
export async function exportProjectPackage(
  project: AnimProject,
): Promise<string> {
  const voiceFiles: ProjectPackage["voiceFiles"] = {};
  for (const key of collectVoiceKeys(project)) {
    const blob = await loadVoiceBlob(key);
    if (blob) {
      voiceFiles[key] = {
        mime: blob.type || "audio/webm",
        data: await blobToBase64(blob),
      };
    }
  }
  const pkg: ProjectPackage = {
    format: "animan-project",
    version: 1,
    exportedAt: Date.now(),
    project,
    voiceFiles,
  };
  return JSON.stringify(pkg);
}

/** Kiểm tra + bóc gói file dự án. Ném Error tiếng Việt khi file không hợp lệ. */
export function parseProjectPackage(json: string): ProjectPackage {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("File không phải định dạng dự án AniMan (không đọc được nội dung).");
  }
  const pkg = raw as Partial<ProjectPackage>;
  if (
    pkg.format !== "animan-project" ||
    !pkg.project ||
    typeof pkg.project !== "object" ||
    !Array.isArray((pkg.project as AnimProject).scenes) ||
    typeof (pkg.project as AnimProject).name !== "string"
  ) {
    throw new Error("File không phải định dạng dự án AniMan (thiếu dữ liệu dự án).");
  }
  if (pkg.version !== 1) {
    throw new Error(`Phiên bản file dự án (${String(pkg.version)}) chưa được hỗ trợ.`);
  }
  return pkg as ProjectPackage;
}

/**
 * Nhập một file dự án: tạo dự án mới với mã mới (nhạc nền được trỏ sang
 * key của mã mới), ghi lại mọi file tiếng, lưu dự án. Trả về dự án đã nhập.
 */
export async function importProjectPackage(json: string): Promise<AnimProject> {
  const pkg = parseProjectPackage(json);
  const source = pkg.project;
  const newId = `film-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const project: AnimProject = {
    ...source,
    id: newId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    bgm: source.bgm
      ? { ...source.bgm, blobKey: bgmBlobKey(newId) }
      : (source.bgm ?? null),
  };
  for (const [key, file] of Object.entries(pkg.voiceFiles ?? {})) {
    const targetKey =
      source.bgm && key === source.bgm.blobKey ? bgmBlobKey(newId) : key;
    await saveVoiceBlob(targetKey, base64ToBlob(file.data, file.mime));
  }
  await saveAnimProject(project);
  return project;
}
