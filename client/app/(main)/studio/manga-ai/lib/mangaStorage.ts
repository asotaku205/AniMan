import type { MangaProject, MangaProjectPage } from "../hooks/useMangaProjects";
import type { LayerItem, PanelLayerStack, PanelStacks } from "../data";
import { createUserLayer, normalizeLayers } from "../data";

const DB_NAME = "animan_manga_studio_db";
/**
 * Phiên bản object store của IndexedDB — cấu trúc store không đổi nên giữ 1.
 * Bản ghi tự mang trường `schemaVersion` và được migration lúc **đọc**
 * (spec 02 §3.1–§3.2), không cần nâng version DB.
 */
const DB_VERSION = 1;
const STORE_PROJECTS = "projects";
const STORE_PAGE_DRAWINGS = "page_drawings";

/** Schema hiện tại của bản ghi trang vẽ (spec 02 §3.1). */
export const PAGE_DRAWING_SCHEMA_VERSION = 2;

// Helper tạo key trang vẽ: tách biệt tuyệt đối theo projectId và pageNumber
export function makePageKey(projectId: string, pageNumber: number): string {
  return `${projectId}_p${pageNumber}`;
}

export interface StoredPageDrawing {
  id: string; // `${projectId}_p${pageNumber}`
  /** Vắng mặt (hoặc < 2) = bản ghi Schema v1. */
  schemaVersion?: number;
  projectId: string;
  pageNumber: number;
  layoutId?: string;
  /** v2: ngăn xếp layer theo khung (spec 02 §2.2). */
  stacks?: PanelStacks;
  /** v1: panelId -> composite — vẫn ghi kèm để đọc ngược được (§3.2). */
  panels?: Record<string, string>;
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
 * Đọc bản ghi **Schema v1** (panel phẳng) → ngăn xếp theo khung — spec 02 §3.2:
 * - mỗi `panelId` trong `panels` thành một stack riêng;
 * - bản ghi có `layers` meta → dùng meta đó (chuẩn hoá v2), pixel của panel giao
 *   cho layer người dùng **đầu tiên**;
 * - không có → một layer mặc định `Sketch (Phác thảo)`.
 *
 * Hàm thuần (không đụng IndexedDB) — test được ở môi trường node.
 */
export function migrateStoredPageToStacks(record: {
  panels?: Record<string, string>;
  layers?: unknown;
  activeLayerId?: string;
}): PanelStacks {
  const stacks: PanelStacks = {};
  const meta = normalizeLayers(record.layers);

  for (const [panelId, dataUrl] of Object.entries(record.panels ?? {})) {
    // Clone để mỗi panel có mảng/đối tượng layer RIÊNG (không dùng chung tham chiếu)
    const layers =
      meta.length > 0
        ? meta.map((l) => ({ ...l }))
        : [createUserLayer("Sketch (Phác thảo)")];

    const pixels: Record<string, string> = {};
    const pixelTarget = layers.find((l) => l.kind === "user");
    if (dataUrl && pixelTarget) pixels[pixelTarget.id] = dataUrl;

    const activeExists = layers.some((l) => l.id === record.activeLayerId);
    stacks[panelId] = {
      panelId,
      layers,
      activeLayerId: activeExists ? record.activeLayerId! : (layers[0]?.id ?? ""),
      pixels,
    };
  }
  return stacks;
}

/**
 * Chuẩn hoá `stacks` đọc từ IndexedDB (bản ghi v2): bỏ entry hỏng,
 * sửa `activeLayerId` trỏ sai, loại pixel mồ côi (layerId không còn tồn tại).
 */
export function normalizePanelStacks(raw: unknown): PanelStacks {
  if (!raw || typeof raw !== "object") return {};
  const out: PanelStacks = {};
  for (const [panelId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const s = value as Partial<PanelLayerStack>;
    const layers = normalizeLayers(s.layers);
    if (layers.length === 0) continue;

    const activeLayerId = layers.some((l) => l.id === s.activeLayerId)
      ? (s.activeLayerId as string)
      : layers[0].id;

    const pixels: Record<string, string> = {};
    if (s.pixels && typeof s.pixels === "object") {
      for (const [id, url] of Object.entries(s.pixels)) {
        if (layers.some((l) => l.id === id) && typeof url === "string") {
          pixels[id] = url;
        }
      }
    }

    out[panelId] = {
      panelId,
      layers,
      activeLayerId,
      pixels,
      ...(s.aiOverlay && Array.isArray(s.aiOverlay.strokes) ? { aiOverlay: s.aiOverlay } : {}),
    };
  }
  return out;
}

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
 * Tải **ngăn xếp theo khung** (Schema v2) của trang — spec 02 §3.3.
 * Bản ghi v1 được migration tự động lúc đọc; `legacyPanels` trả về composite
 * v1 (nếu có) để các nơi chưa chuyển code vẫn đọc được.
 */
export async function getPageStacksFromDB(
  projectId: string,
  pageNumber: number,
): Promise<{
  stacks: PanelStacks;
  legacyPanels: Record<string, string> | null;
}> {
  const record = await getPageDrawingRecordFromDB(projectId, pageNumber);
  if (!record) return { stacks: {}, legacyPanels: null };
  const stacks =
    record.schemaVersion === PAGE_DRAWING_SCHEMA_VERSION && record.stacks
      ? normalizePanelStacks(record.stacks)
      : migrateStoredPageToStacks(record);
  return { stacks, legacyPanels: record.panels ?? null };
}

/**
 * Lưu nét vẽ và layer của đúng trang trong đúng dự án vào IndexedDB
 * — **Schema v1** (composite phẳng). Chỉ còn dùng cho đường dẫn cũ
 * (`useMangaProjects`/`saveDraft`) tới khi hook chuyển sang `stacks` (Phase 2).
 */
export async function savePageDrawingV1ToDB(
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

/**
 * Lưu **ngăn xếp layer theo khung** (Schema v2) — spec 02 §3.3.
 * Luôn ghi `schemaVersion: 2` + `stacks`; đồng thời ghi `panels` (composite)
 * để dữ liệu cũ đọc ngược được (§3.2).
 */
export async function savePageDrawingToDB(
  projectId: string,
  pageNumber: number,
  stacks: PanelStacks,
  layoutId?: string,
  panels?: Record<string, string>,
): Promise<void> {
  if (!projectId || !pageNumber) return;
  try {
    const db = await openDB();
    const key = makePageKey(projectId, pageNumber);
    const data: StoredPageDrawing = {
      id: key,
      schemaVersion: PAGE_DRAWING_SCHEMA_VERSION,
      projectId,
      pageNumber,
      layoutId,
      stacks,
      panels,
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
