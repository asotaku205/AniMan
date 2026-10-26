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
 * - v3 (Đợt C): thêm store `assets` — thư viện tài sản dùng chung mọi dự
 *   án (nhân vật 3D, mẫu phong cảnh, hình 2D).
 * - v4 (Rig Pro): thêm store `poses` — thư viện dáng tự tạo của Phòng Rig.
 * - Khôi phục kết nối: thao tác gặp lỗi kết nối đã đóng thì bỏ kết nối
 *   cũ, mở lại kết nối mới và thử lại một lần; lỗi khác vẫn reject như cũ.
 */

import type { AnimProject } from "./animProject";
import type { AnimAsset } from "./animAssets";
import type { SavedPose } from "./poseLibrary";

const DB_NAME = "animan_animation_db";
const DB_VERSION = 4;
const STORE_PROJECTS = "projects";
const STORE_VOICE_BLOBS = "voiceBlobs";
const STORE_ASSETS = "assets";
const STORE_POSES = "poses";

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
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_POSES)) {
        db.createObjectStore(STORE_POSES, { keyPath: "id" });
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

/**
 * Lỗi cho thấy kết nối IndexedDB đã đóng: Chrome báo InvalidStateError
 * kèm thông điệp "connection is closing", fake-indexeddb báo cùng tên
 * lỗi với thông điệp DOM chung. Chỉ lỗi này mới được mở lại và thử lại;
 * lỗi khác (sai dữ liệu, hết quota) vẫn reject như cũ.
 */
function isConnectionClosedError(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.name === "InvalidStateError") return true;
    if (/connection is closing/i.test(err.message)) return true;
  }
  return false;
}

/**
 * Chạy một thao tác qua kết nối dùng chung. Nếu kết nối đã đóng mà
 * module không hay biết (không qua versionchange), lần chạy đầu ném
 * InvalidStateError; khi đó bỏ kết nối cũ đã lưu, mở lại kết nối mới
 * và thử lại đúng một lần. Lần thử lại vẫn lỗi thì reject như cũ để
 * tầng UI báo lỗi rõ thay vì giữ thay đổi chỉ trong state.
 */
async function transact<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  try {
    const db = await openDb();
    return await request(db, storeName, mode, run);
  } catch (err) {
    if (!isConnectionClosedError(err)) throw err;
    dbPromise = null;
    const db = await openDb();
    return await request(db, storeName, mode, run);
  }
}

// ── Dự án phim ───────────────────────────────────────────────────────────────

export async function listAnimProjects(): Promise<AnimProject[]> {
  if (!isBrowser) return [];
  const all =
    (await transact<AnimProject[]>(STORE_PROJECTS, "readonly", (s) =>
      s.getAll(),
    )) ?? [];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getAnimProject(id: string): Promise<AnimProject | null> {
  if (!isBrowser) return null;
  return (
    (await transact<AnimProject | undefined>(
      STORE_PROJECTS,
      "readonly",
      (s) => s.get(id),
    )) ?? null
  );
}

export async function saveAnimProject(project: AnimProject): Promise<void> {
  if (!isBrowser) return;
  await transact(STORE_PROJECTS, "readwrite", (s) => s.put(project));
}

export async function deleteAnimProject(id: string): Promise<void> {
  if (!isBrowser) return;
  await transact(STORE_PROJECTS, "readwrite", (s) => s.delete(id));
}

// ── File tiếng: bản thu giọng + nhạc nền (Blob) ────────────────────────────

/** Key của Blob nhạc nền theo dự án. */
export function bgmBlobKey(projectId: string): string {
  return `bgm-${projectId}`;
}

export async function saveVoiceBlob(key: string, blob: Blob): Promise<void> {
  if (!isBrowser) return;
  await transact(STORE_VOICE_BLOBS, "readwrite", (s) => s.put(blob, key));
}

export async function loadVoiceBlob(key: string): Promise<Blob | null> {
  if (!isBrowser) return null;
  return (
    (await transact<Blob | undefined>(STORE_VOICE_BLOBS, "readonly", (s) =>
      s.get(key),
    )) ?? null
  );
}

export async function deleteVoiceBlob(key: string): Promise<void> {
  if (!isBrowser) return;
  await transact(STORE_VOICE_BLOBS, "readwrite", (s) => s.delete(key));
}

// ── Thư viện tài sản dùng chung (Đợt C) ─────────────────────────────────────

export async function listAnimAssets(): Promise<AnimAsset[]> {
  if (!isBrowser) return [];
  const all =
    (await transact<AnimAsset[]>(STORE_ASSETS, "readonly", (s) =>
      s.getAll(),
    )) ?? [];
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveAnimAsset(asset: AnimAsset): Promise<void> {
  if (!isBrowser) return;
  await transact(STORE_ASSETS, "readwrite", (s) => s.put(asset));
}

export async function deleteAnimAsset(id: string): Promise<void> {
  if (!isBrowser) return;
  await transact(STORE_ASSETS, "readwrite", (s) => s.delete(id));
}

// ── Thư viện dáng tự tạo (Rig Pro) ────────────────────────────────────────

export async function listSavedPoses(): Promise<SavedPose[]> {
  if (!isBrowser) return [];
  const all =
    (await transact<SavedPose[]>(STORE_POSES, "readonly", (s) =>
      s.getAll(),
    )) ?? [];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function savePoseEntry(pose: SavedPose): Promise<void> {
  if (!isBrowser) return;
  await transact(STORE_POSES, "readwrite", (s) => s.put(pose));
}

export async function deletePoseEntry(id: string): Promise<void> {
  if (!isBrowser) return;
  await transact(STORE_POSES, "readwrite", (s) => s.delete(id));
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
