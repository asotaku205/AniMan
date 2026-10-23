/**
 * Lưu trữ dự án phim (Animation Studio) trong IndexedDB của trình duyệt —
 * cùng chuẩn với Manga Studio (`animan_manga_studio_db`) nhưng DB riêng
 * `animan_animation_db` để hai studio không giẫm chân nhau.
 *
 * Mọi hàm đều an toàn khi gọi phía server (trả về rỗng/no-op) vì trang Next
 * có thể render trước ở server; dữ liệu thật chỉ có ở client.
 */

import type { AnimProject } from "./animProject";

const DB_NAME = "animan_animation_db";
const DB_VERSION = 1;
const STORE_PROJECTS = "projects";

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const store = db.transaction(STORE_PROJECTS, mode).objectStore(STORE_PROJECTS);
          const request = run(store);
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export async function listAnimProjects(): Promise<AnimProject[]> {
  const all = await tx<AnimProject[]>("readonly", (store) => store.getAll());
  return (all ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getAnimProject(id: string): Promise<AnimProject | null> {
  return tx<AnimProject>("readonly", (store) => store.get(id));
}

export async function saveAnimProject(project: AnimProject): Promise<void> {
  await tx("readwrite", (store) => store.put(project));
}

export async function deleteAnimProject(id: string): Promise<void> {
  await tx("readwrite", (store) => store.delete(id));
}

/**
 * Danh sách dự án manga của người dùng (để chọn nguồn khi tạo dự án 2D) —
 * đọc qua chính hàm của Manga Studio; lỗi/không có thì trả mảng rỗng.
 */
export async function listMangaProjectOptions(): Promise<
  Array<{ id: string; title: string }>
> {
  try {
    const { getAllProjectsFromDB } = await import(
      "../../manga-ai/lib/mangaStorage"
    );
    const projects = await getAllProjectsFromDB();
    return projects.map((p) => ({ id: p.id, title: p.title }));
  } catch {
    return [];
  }
}
