import type { MangaProject, MangaProjectPage } from "../hooks/useMangaProjects";
import type { LayerItem } from "../data";

const DB_NAME = "animan_manga_studio_db";
const DB_VERSION = 1;
const STORE_PROJECTS = "projects";
const STORE_PAGE_DRAWINGS = "page_drawings";

// Helper tạo key trang vẽ: tách biệt tuyệt đối theo projectId và pageNumber
export function makePageKey(projectId: string, pageNumber: number): string {
  return `${projectId}_p${pageNumber}`;
}

export interface StoredPageDrawing {
  id: string; // `${projectId}_p${pageNumber}`
  projectId: string;
  pageNumber: number;
  layoutId?: string;
  panels: Record<string, string>; // panelId -> dataUrl base64
  layers?: LayerItem[];
  activeLayerId?: string;
  updatedAt: number;
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB không khả dụng trong môi trường hiện tại"));
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_PAGE_DRAWINGS)) {
        const pageStore = db.createObjectStore(STORE_PAGE_DRAWINGS, { keyPath: "id" });
        pageStore.createIndex("by_project", "projectId", { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// ─── Dọn dẹp Mock Data cũ và Shared LocalStorage cũ ──────────────────────────

const LEGACY_STORAGE_KEY = "animan_manga_projects_v1";

export function cleanupLegacyMockData() {
  if (typeof window === "undefined") return;
  try {
    // Xóa các key vẽ chung cũ `animan_manga_page_*` vốn gây lỗi dùng chung 1 trang
    for (let i = 1; i <= 20; i++) {
      localStorage.removeItem(`animan_manga_page_${i}`);
    }

    // Kiểm tra và xóa mock data cũ nếu có trong localStorage
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const containsMock = parsed.some(
          (p: any) =>
            p.title === "Chiến Binh Ánh Sáng" ||
            p.title === "Ký Ức Mùa Hè" ||
            p.id === "proj-1" ||
            p.id === "proj-2",
        );
        if (containsMock) {
          // Lọc bỏ mock data
          const realProjects = parsed.filter(
            (p: any) =>
              p.title !== "Chiến Binh Ánh Sáng" &&
              p.title !== "Ký Ức Mùa Hè" &&
              p.id !== "proj-1" &&
              p.id !== "proj-2",
          );
          localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(realProjects));
        }
      }
    }
  } catch {
    // ignore
  }
}

// ─── Project Operations (IndexedDB) ──────────────────────────────────────────

export async function getAllProjectsFromDB(): Promise<MangaProject[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PROJECTS, "readonly");
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = req.result as MangaProject[];
        // Lọc bỏ bất kỳ mock data nào còn sót lại
        const cleaned = (list || []).filter(
          (p) =>
            p &&
            p.id !== "proj-1" &&
            p.id !== "proj-2" &&
            p.title !== "Chiến Binh Ánh Sáng" &&
            p.title !== "Ký Ức Mùa Hè",
        );
        resolve(cleaned);
      };

      req.onerror = () => {
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

export async function saveProjectToDB(project: MangaProject): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, "readwrite");
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.put(project);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // fallback
  }
}

export async function deleteProjectFromDB(projectId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PROJECTS, STORE_PAGE_DRAWINGS], "readwrite");
      const projStore = tx.objectStore(STORE_PROJECTS);
      const pageStore = tx.objectStore(STORE_PAGE_DRAWINGS);

      projStore.delete(projectId);

      // Xóa tất cả các trang vẽ của dự án này trong indexedDB
      const index = pageStore.index("by_project");
      const cursorReq = index.openCursor(IDBKeyRange.only(projectId));

      cursorReq.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // fallback
  }
}

// ─── Page Drawing Operations (IndexedDB) ─────────────────────────────────────

/**
 * Tải nét vẽ và layer của đúng trang trong đúng dự án
 */
export async function getPageDrawingRecordFromDB(
  projectId: string,
  pageNumber: number,
): Promise<StoredPageDrawing | null> {
  if (!projectId || !pageNumber) return null;
  try {
    const db = await openDB();
    const key = makePageKey(projectId, pageNumber);
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PAGE_DRAWINGS, "readonly");
      const store = tx.objectStore(STORE_PAGE_DRAWINGS);
      const req = store.get(key);

      req.onsuccess = () => {
        const record = req.result as StoredPageDrawing | undefined;
        resolve(record || null);
      };

      req.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Tải nét vẽ của đúng trang trong đúng dự án (tương thích ngược)
 */
export async function getPageDrawingFromDB(
  projectId: string,
  pageNumber: number,
): Promise<Record<string, string>> {
  const record = await getPageDrawingRecordFromDB(projectId, pageNumber);
  return record?.panels || {};
}

/**
 * Lưu nét vẽ và layer của đúng trang trong đúng dự án vào IndexedDB
 */
export async function savePageDrawingToDB(
  projectId: string,
  pageNumber: number,
  panels: Record<string, string>,
  layoutId?: string,
  layers?: LayerItem[],
  activeLayerId?: string,
): Promise<void> {
  if (!projectId || !pageNumber) return;
  try {
    const db = await openDB();
    const key = makePageKey(projectId, pageNumber);
    const data: StoredPageDrawing = {
      id: key,
      projectId,
      pageNumber,
      layoutId,
      panels,
      layers,
      activeLayerId,
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PAGE_DRAWINGS, "readwrite");
      const store = tx.objectStore(STORE_PAGE_DRAWINGS);
      const req = store.put(data);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // fallback
  }
}
