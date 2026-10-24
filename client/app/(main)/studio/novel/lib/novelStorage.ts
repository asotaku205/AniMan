/**
 * Lưu bền Novel Studio (N1): IndexedDB `animan_novel_db`, 3 store
 * novels/chapters/scenes (keyPath "id"). Xoá tiểu thuyết/chương kéo
 * theo con (cascade) để không còn dữ liệu mồ côi.
 */

import type { Chapter, Novel, Scene } from "./novel";

const DB_NAME = "animan_novel_db";
const DB_VERSION = 1;
const STORE_NOVELS = "novels";
const STORE_CHAPTERS = "chapters";
const STORE_SCENES = "scenes";

const isBrowser = typeof indexedDB !== "undefined";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NOVELS)) {
        db.createObjectStore(STORE_NOVELS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_CHAPTERS)) {
        db.createObjectStore(STORE_CHAPTERS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_SCENES)) {
        db.createObjectStore(STORE_SCENES, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function request<T>(
  db: IDBDatabase,
  storeNames: string | string[],
  mode: IDBTransactionMode,
  run: (stores: IDBObjectStore[]) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const stores = (Array.isArray(storeNames) ? storeNames : [storeNames]).map(
      (n) => tx.objectStore(n),
    );
    const req = run(stores);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
  });
}

async function getAll<T>(store: string): Promise<T[]> {
  if (!isBrowser) return [];
  const db = await openDb();
  return (await request<T[]>(db, store, "readonly", ([s]) => s.getAll())) ?? [];
}

async function put<T extends { id: string }>(store: string, value: T): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, store, "readwrite", ([s]) => s.put(value));
}

export async function listNovels(): Promise<Novel[]> {
  return getAll<Novel>(STORE_NOVELS);
}

export async function listChapters(): Promise<Chapter[]> {
  return getAll<Chapter>(STORE_CHAPTERS);
}

export async function listScenes(): Promise<Scene[]> {
  return getAll<Scene>(STORE_SCENES);
}

export async function saveNovel(novel: Novel): Promise<void> {
  await put(STORE_NOVELS, novel);
}

export async function saveChapter(chapter: Chapter): Promise<void> {
  await put(STORE_CHAPTERS, chapter);
}

export async function saveScene(scene: Scene): Promise<void> {
  await put(STORE_SCENES, scene);
}

export async function deleteScene(id: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, STORE_SCENES, "readwrite", ([s]) => s.delete(id));
}

export async function deleteChapterCascade(id: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  const scenes = await request<Scene[]>(db, STORE_SCENES, "readonly", ([s]) => s.getAll());
  await request(db, [STORE_CHAPTERS, STORE_SCENES], "readwrite", ([chapters, scenesStore]) => {
    chapters.delete(id);
    for (const sc of scenes ?? []) {
      if (sc.chapterId === id) scenesStore.delete(sc.id);
    }
    // Trả về request cuối để transaction hoàn tất đúng.
    return scenesStore.count();
  });
}

export async function deleteNovelCascade(id: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  const chapters = await request<Chapter[]>(db, STORE_CHAPTERS, "readonly", ([s]) => s.getAll());
  const chapterIds = new Set((chapters ?? []).filter((c) => c.novelId === id).map((c) => c.id));
  const scenes = await request<Scene[]>(db, STORE_SCENES, "readonly", ([s]) => s.getAll());
  await request(db, [STORE_NOVELS, STORE_CHAPTERS, STORE_SCENES], "readwrite", ([novels, chaptersStore, scenesStore]) => {
    novels.delete(id);
    for (const c of chapters ?? []) {
      if (c.novelId === id) chaptersStore.delete(c.id);
    }
    for (const sc of scenes ?? []) {
      if (chapterIds.has(sc.chapterId)) scenesStore.delete(sc.id);
    }
    return scenesStore.count();
  });
}
