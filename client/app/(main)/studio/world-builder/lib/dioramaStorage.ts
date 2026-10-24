/**
 * Lưu bền sa bàn World Builder (IndexedDB — theo nguyên tắc lưu trữ bất
 * biến của AniMan: mọi dữ liệu studio phải tự khôi phục khi F5, lỗi lưu
 * phải hiển thị chứ không nuốt âm thầm).
 *
 * Chỉ lưu placement RECORDS + thực thể truyện (dữ liệu nhỏ, dạng JSON),
 * không lưu scene Three.js. Khôi phục = dựng lại mô hình từ records.
 */

import type { DioramaState } from "./diorama";

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
    return {
      ...rec.state,
      events: rec.state.events ?? [],
      groundSize: rec.state.groundSize ?? 40,
      terrain: rec.state.terrain ?? {
        heights: Array.from({ length: 81 }, () => new Array(81).fill(0)),
        biomes: Array.from({ length: 80 }, () => new Array(80).fill("grass")),
        waterLevel: -1,
      },
      paths: rec.state.paths ?? [],
      entities: (rec.state.entities ?? []).map((e) => ({
        ...e,
        relations: e.relations ?? [],
        customFields: e.customFields ?? [],
        design2d: e.design2d ?? { palette: [], expressions: [] },
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
