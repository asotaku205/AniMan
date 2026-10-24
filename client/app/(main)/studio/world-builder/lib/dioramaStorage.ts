/**
 * Lưu bền sa bàn World Builder (IndexedDB — theo nguyên tắc lưu trữ bất
 * biến của AniMan: mọi dữ liệu studio phải tự khôi phục khi F5, lỗi lưu
 * phải hiển thị chứ không nuốt âm thầm).
 *
 * Chỉ lưu placement RECORDS + thực thể truyện (dữ liệu nhỏ, dạng JSON),
 * không lưu scene Three.js. Khôi phục = dựng lại mô hình từ records.
 */

import { clampGround } from "./diorama";
import { migrateTerrainToWorld } from "./terrain";
import type { DioramaState } from "./diorama";

/** Chuẩn hoá state khi đọc (W8): địa hình cũ 1 ô → thế giới chunk,
 * vật ngoài chunk (0,0) (world 60m cũ) kẹp vào trong biên mới. */
export function normalizeState(state: DioramaState): DioramaState {
  const terrain = migrateTerrainToWorld((state as unknown as { terrain: unknown }).terrain);
  const placements = (state.placements ?? []).map((pl) => ({
    ...pl,
    x: clampGround(pl.x, 0),
    z: clampGround(pl.z, 0),
  }));
  return { ...state, terrain, placements, rivers: state.rivers ?? [] };
}

const DB_NAME = "animan_world_builder_db";
const DB_VERSION = 1;
const STORE = "diorama";
const RECORD_ID = "main";

const isBrowser = typeof window !== "undefined" && "indexedDB" in window;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
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
    req.onerror = () => {
      dbPromise = null;
      reject(new Error("Không mở được kho lưu sa bàn."));
    };
    req.onblocked = () => {
      dbPromise = null;
      reject(new Error("Kho lưu sa bàn đang bị khoá bởi tab khác."));
    };
  });
  return dbPromise;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error("Không đọc/ghi được kho lưu sa bàn."));
  });
}

export async function loadDiorama(): Promise<DioramaState | null> {
  if (!isBrowser) return null;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const rec = await request(
      tx.objectStore(STORE).get(RECORD_ID) as IDBRequest<{
        id: string;
        state: DioramaState;
      } | null>,
    );
    if (!rec || !Array.isArray(rec.state?.placements)) return null;
    // Bản lưu cũ (W1/W2 sớm) thiếu trường mới — chuẩn hoá để UI mới
    // không vỡ, dữ liệu cũ giữ nguyên.
    const normalized = normalizeState({
      ...rec.state,
      events: rec.state.events ?? [],
    } as DioramaState);
    return {
      ...normalized,
      paths: rec.state.paths ?? [],
      customModels: rec.state.customModels ?? [],
      factions: rec.state.factions ?? [],
      sky: rec.state.sky ?? { time: 10, weather: "clear", season: "summer" },
      views: rec.state.views ?? [],
      entities: (rec.state.entities ?? []).map((e) => ({
        ...e,
        relations: e.relations ?? [],
        customFields: e.customFields ?? [],
        design2d: e.design2d ?? { palette: [], expressions: [] },
        articles: e.articles ?? [],
        factionId: e.factionId ?? null,
      })),
    };
  } catch {
    return null;
  }
}

export async function saveDiorama(state: DioramaState): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await request(
    tx.objectStore(STORE).put({ id: RECORD_ID, state, savedAt: Date.now() }),
  );
}

/** ============ W7: nhiều world ============ */

export interface WorldRecord {
  id: string;
  name: string;
  updatedAt: number;
  state: DioramaState;
}

const WORLDS_STORE = "worlds";
const ACTIVE_KEY = "animan-world-active";

let worldCounter = 0;
export function newWorldId(): string {
  worldCounter += 1;
  return `world-${Date.now().toString(36)}-${worldCounter.toString(36)}`;
}

/** Mở DB v2 (thêm store worlds; store diorama cũ giữ nguyên để migrate). */
export function openDbV2(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(WORLDS_STORE)) {
        db.createObjectStore(WORLDS_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = run(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listWorlds(): Promise<WorldRecord[]> {
  if (!isBrowser) return [];
  const db = await openDbV2();
  const all = await tx<WorldRecord[]>(db, WORLDS_STORE, "readonly", (s) => s.getAll());
  return (all ?? [])
    .map((rec) => ({ ...rec, state: normalizeState(rec.state) }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveWorld(rec: WorldRecord): Promise<void> {
  if (!isBrowser) return;
  const db = await openDbV2();
  await tx(db, WORLDS_STORE, "readwrite", (s) => s.put(rec));
}

export async function deleteWorld(id: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDbV2();
  await tx(db, WORLDS_STORE, "readwrite", (s) => s.delete(id));
}

/** Migrate world đơn "main" cũ thành world đầu tiên (chạy 1 lần). */
export async function migrateLegacyWorld(): Promise<WorldRecord | null> {
  const legacy = await loadDiorama();
  if (!legacy) return null;
  const rec: WorldRecord = {
    id: newWorldId(),
    name: "Thế giới đầu tiên",
    updatedAt: Date.now(),
    state: legacy,
  };
  await saveWorld(rec);
  return rec;
}

export function getActiveWorldId(): string | null {
  if (!isBrowser) return null;
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveWorldId(id: string): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* bỏ qua */
  }
}
