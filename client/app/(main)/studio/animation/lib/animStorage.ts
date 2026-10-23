/**
 * Lưu trữ dự án phim (Animation Studio) trong IndexedDB của trình duyệt —
 * DB riêng `animan_animation_db` để các studio không giẫm chân nhau.
 *
 * Chuẩn lưu trữ (khớp libraryStorage sau vụ F5 mất dữ liệu 23/10/2026):
 * - MỘT kết nối IndexedDB dùng chung, có xử lý blocked/versionchange.
 * - Hàm ĐỌC không có dữ liệu thì trả rỗng/null; hàm GHI lỗi thì REJECT kèm
 *   thông điệp tiếng Việt — lỗi lưu không bao giờ bị nuốt âm thầm nữa.
 * - v2 (Slice B1): thêm store `voiceBlobs` chứa file tiếng (bản thu giọng
 *   theo takeId, nhạc nền theo `bgm-<projectId>`).
 */

import type { AnimProject } from "./animProject";

const DB_NAME = "animan_animation_db";
const DB_VERSION = 2;
const STORE_PROJECTS = "projects";
const STORE_VOICE_BLOBS = "voiceBlobs";

const isBrowser =
  typeof window !== "undefined" && "indexedDB" in window;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_VOICE_BLOBS)) {
        db.createObjectStore(STORE_VOICE_BLOBS);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onblocked = () => {
      dbPromise = null;
      reject(
        new Error(
          "Không truy cập được dữ liệu đã lưu — hãy đóng các tab AniMan khác rồi tải lại trang.",
        ),
      );
    };
    req.onerror = () => {
      dbPromise = null;
      reject(
        req.error ??
          new Error("Không mở được kho dữ liệu của Animation Studio."),
      );
    };
  });
  return dbPromise;
}

function request<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = run(tx.objectStore(storeName));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error("Thao tác dữ liệu thất bại."));
  });
}

// ── Dự án phim ───────────────────────────────────────────────────────────────

export async function listAnimProjects(): Promise<AnimProject[]> {
  if (!isBrowser) return [];
  const db = await openDb();
  const all =
    (await request<AnimProject[]>(db, STORE_PROJECTS, "readonly", (s) =>
      s.getAll(),
    )) ?? [];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getAnimProject(id: string): Promise<AnimProject | null> {
  if (!isBrowser) return null;
  const db = await openDb();
  return (
    (await request<AnimProject | undefined>(
      db,
      STORE_PROJECTS,
      "readonly",
      (s) => s.get(id),
    )) ?? null
  );
}

export async function saveAnimProject(project: AnimProject): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, STORE_PROJECTS, "readwrite", (s) => s.put(project));
}

export async function deleteAnimProject(id: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, STORE_PROJECTS, "readwrite", (s) => s.delete(id));
}

// ── File tiếng: bản thu giọng + nhạc nền (Blob) ────────────────────────────

/** Key của Blob nhạc nền theo dự án. */
export function bgmBlobKey(projectId: string): string {
  return `bgm-${projectId}`;
}

export async function saveVoiceBlob(key: string, blob: Blob): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, STORE_VOICE_BLOBS, "readwrite", (s) => s.put(blob, key));
}

export async function loadVoiceBlob(key: string): Promise<Blob | null> {
  if (!isBrowser) return null;
  const db = await openDb();
  return (
    (await request<Blob | undefined>(db, STORE_VOICE_BLOBS, "readonly", (s) =>
      s.get(key),
    )) ?? null
  );
}

export async function deleteVoiceBlob(key: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, STORE_VOICE_BLOBS, "readwrite", (s) => s.delete(key));
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
