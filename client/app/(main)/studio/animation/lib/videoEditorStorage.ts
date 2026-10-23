/**
 * Lưu trữ phòng biên tập video (IndexedDB `animan_video_editor_db`):
 * - store `project`: bản ghi duy nhất "current" — tiêu đề + danh sách cue.
 * - store `takes`: bản thu lồng tiếng tự ghi theo cue (Blob) — key = cueId.
 * File video gốc KHÔNG lưu (trình duyệt không giữ File bền vững) — người
 * dùng chọn lại file khi mở lại; cue và bản thu vẫn còn nguyên.
 */

import type { DialogueLine } from "./dialogue";

const DB_NAME = "animan_video_editor_db";
const DB_VERSION = 1;

export interface VideoEditorProject {
  id: "current";
  title: string;
  cues: DialogueLine[];
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("project")) {
        db.createObjectStore("project", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("takes")) {
        db.createObjectStore("takes");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

const isBrowser = typeof window !== "undefined" && "indexedDB" in window;

export async function loadVideoProject(): Promise<VideoEditorProject | null> {
  if (!isBrowser) return null;
  try {
    return (await tx("project", "readonly", (s) => s.get("current"))) ?? null;
  } catch {
    return null;
  }
}

export async function saveVideoProject(
  project: VideoEditorProject,
): Promise<void> {
  if (!isBrowser) return;
  try {
    await tx("project", "readwrite", (s) => s.put(project));
  } catch {
    // bỏ qua lỗi lưu trữ
  }
}

export async function saveTake(cueId: string, blob: Blob): Promise<void> {
  if (!isBrowser) return;
  try {
    await tx("takes", "readwrite", (s) => s.put(blob, cueId));
  } catch {
    // bỏ qua
  }
}

export async function loadTake(cueId: string): Promise<Blob | null> {
  if (!isBrowser) return null;
  try {
    return (await tx("takes", "readonly", (s) => s.get(cueId))) ?? null;
  } catch {
    return null;
  }
}

export async function deleteTake(cueId: string): Promise<void> {
  if (!isBrowser) return;
  try {
    await tx("takes", "readwrite", (s) => s.delete(cueId));
  } catch {
    // bỏ qua
  }
}
