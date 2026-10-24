/**
 * Lưu bền Novel Studio (N1): IndexedDB `animan_novel_db`, 3 store
 * novels/chapters/scenes (keyPath "id"). Xoá tiểu thuyết/chương kéo
 * theo con (cascade) để không còn dữ liệu mồ côi.
 */

import type {
  Beat,
  BibleEntity,
  CharacterArc,
  NovelExportData,
  NovelSnapshot,
  NovelBridge,
  Chapter,
  Novel,
  OpenQuestion,
  Plotline,
  Scene,
} from "./novel";

const DB_NAME = "animan_novel_db";
const DB_VERSION = 5;
const STORE_NOVELS = "novels";
const STORE_CHAPTERS = "chapters";
const STORE_SCENES = "scenes";
const STORE_PLOTLINES = "plotlines";
const STORE_BEATS = "beats";
const STORE_ARCS = "arcs";
const STORE_QUESTIONS = "questions";
const STORE_ENTITIES = "entities";
const STORE_SNAPSHOTS = "snapshots";
const STORE_BRIDGES = "bridges";

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
      if (!db.objectStoreNames.contains(STORE_PLOTLINES)) {
        db.createObjectStore(STORE_PLOTLINES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_BEATS)) {
        db.createObjectStore(STORE_BEATS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_ARCS)) {
        db.createObjectStore(STORE_ARCS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_QUESTIONS)) {
        db.createObjectStore(STORE_QUESTIONS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_ENTITIES)) {
        db.createObjectStore(STORE_ENTITIES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_BRIDGES)) {
        db.createObjectStore(STORE_BRIDGES, { keyPath: "id" });
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

export async function listBridges(): Promise<NovelBridge[]> {
  return getAll<NovelBridge>(STORE_BRIDGES);
}

export async function saveBridge(bridge: NovelBridge): Promise<void> {
  return put(STORE_BRIDGES, bridge);
}

export async function deleteBridge(id: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, STORE_BRIDGES, "readwrite", ([s]) => s.delete(id));
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

export async function listPlotlines(): Promise<Plotline[]> {
  return getAll<Plotline>(STORE_PLOTLINES);
}

export async function listBeats(): Promise<Beat[]> {
  return getAll<Beat>(STORE_BEATS);
}

export async function listArcs(): Promise<CharacterArc[]> {
  return getAll<CharacterArc>(STORE_ARCS);
}

export async function listQuestions(): Promise<OpenQuestion[]> {
  return getAll<OpenQuestion>(STORE_QUESTIONS);
}

export async function savePlotline(plotline: Plotline): Promise<void> {
  await put(STORE_PLOTLINES, plotline);
}

export async function saveBeat(beat: Beat): Promise<void> {
  await put(STORE_BEATS, beat);
}

export async function saveArc(arc: CharacterArc): Promise<void> {
  await put(STORE_ARCS, arc);
}

export async function saveQuestion(question: OpenQuestion): Promise<void> {
  await put(STORE_QUESTIONS, question);
}

export async function deleteBeat(id: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, STORE_BEATS, "readwrite", ([s]) => s.delete(id));
}

export async function deletePlotlineCascade(id: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  const beats = await request<Beat[]>(db, STORE_BEATS, "readonly", ([s]) => s.getAll());
  await request(db, [STORE_PLOTLINES, STORE_BEATS], "readwrite", ([plotlines, beatsStore]) => {
    plotlines.delete(id);
    for (const b of beats ?? []) {
      if (b.plotlineId === id) beatsStore.delete(b.id);
    }
    return beatsStore.count();
  });
}

export async function deleteArc(id: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, STORE_ARCS, "readwrite", ([s]) => s.delete(id));
}

export async function deleteQuestion(id: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, STORE_QUESTIONS, "readwrite", ([s]) => s.delete(id));
}

/** Gỡ liên kết tới cảnh đã xoá khỏi beat/cung/câu hỏi (không xoá chúng). */
async function unlinkSceneRefs(db: IDBDatabase, sceneIds: Set<string>): Promise<void> {
  const beats = await request<Beat[]>(db, STORE_BEATS, "readonly", ([s]) => s.getAll());
  const arcs = await request<CharacterArc[]>(db, STORE_ARCS, "readonly", ([s]) => s.getAll());
  const questions = await request<OpenQuestion[]>(db, STORE_QUESTIONS, "readonly", ([s]) => s.getAll());
  await request(
    db,
    [STORE_BEATS, STORE_ARCS, STORE_QUESTIONS],
    "readwrite",
    ([beatsStore, arcsStore, questionsStore]) => {
      for (const b of beats ?? []) {
        if (b.sceneId && sceneIds.has(b.sceneId)) beatsStore.put({ ...b, sceneId: null });
      }
      for (const a of arcs ?? []) {
        const kept = a.milestones.filter((m) => !sceneIds.has(m.sceneId));
        if (kept.length !== a.milestones.length) arcsStore.put({ ...a, milestones: kept });
      }
      for (const q of questions ?? []) {
        const planted = q.plantedSceneId && sceneIds.has(q.plantedSceneId) ? null : q.plantedSceneId;
        const answered = q.answeredSceneId && sceneIds.has(q.answeredSceneId) ? null : q.answeredSceneId;
        if (planted !== q.plantedSceneId || answered !== q.answeredSceneId) {
          questionsStore.put({ ...q, plantedSceneId: planted, answeredSceneId: answered });
        }
      }
      return questionsStore.count();
    },
  );
}

export async function listEntities(): Promise<BibleEntity[]> {
  return getAll<BibleEntity>(STORE_ENTITIES);
}

export async function saveEntity(entity: BibleEntity): Promise<void> {
  await put(STORE_ENTITIES, entity);
}

/** Xoá thực thể + gỡ liên kết entityId ở các cung trỏ tới nó. */
export async function deleteEntity(id: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  const arcs = await request<CharacterArc[]>(db, STORE_ARCS, "readonly", ([s]) => s.getAll());
  await request(db, [STORE_ENTITIES, STORE_ARCS], "readwrite", ([entitiesStore, arcsStore]) => {
    entitiesStore.delete(id);
    for (const a of arcs ?? []) {
      if (a.entityId === id) arcsStore.put({ ...a, entityId: null });
    }
    return arcsStore.count();
  });
}

export async function listSnapshots(): Promise<NovelSnapshot[]> {
  return getAll<NovelSnapshot>(STORE_SNAPSHOTS);
}

export async function saveSnapshot(snapshot: NovelSnapshot): Promise<void> {
  await put(STORE_SNAPSHOTS, snapshot);
}

export async function deleteSnapshot(id: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, STORE_SNAPSHOTS, "readwrite", ([s]) => s.delete(id));
}

/**
 * Thay toàn bộ cây dữ liệu của một tiểu thuyết bằng dữ liệu snapshot
 * (dùng khi khôi phục): xoá con cũ rồi ghi con mới trong 1 transaction.
 * Bản thân novel được lưu riêng (để giữ dailyWords + mục tiêu).
 */
export async function replaceNovelData(novelId: string, data: NovelExportData): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  const chapters = await request<Chapter[]>(db, STORE_CHAPTERS, "readonly", ([s]) => s.getAll());
  const chapterIds = new Set((chapters ?? []).filter((c) => c.novelId === novelId).map((c) => c.id));
  const scenes = await request<Scene[]>(db, STORE_SCENES, "readonly", ([s]) => s.getAll());
  const plotlines = await request<Plotline[]>(db, STORE_PLOTLINES, "readonly", ([s]) => s.getAll());
  const plotlineIds = new Set((plotlines ?? []).filter((p) => p.novelId === novelId).map((p) => p.id));
  const beats = await request<Beat[]>(db, STORE_BEATS, "readonly", ([s]) => s.getAll());
  const arcs = await request<CharacterArc[]>(db, STORE_ARCS, "readonly", ([s]) => s.getAll());
  const questions = await request<OpenQuestion[]>(db, STORE_QUESTIONS, "readonly", ([s]) => s.getAll());
  const entities = await request<BibleEntity[]>(db, STORE_ENTITIES, "readonly", ([s]) => s.getAll());
  await request(
    db,
    [STORE_CHAPTERS, STORE_SCENES, STORE_PLOTLINES, STORE_BEATS, STORE_ARCS, STORE_QUESTIONS, STORE_ENTITIES],
    "readwrite",
    ([chaptersStore, scenesStore, plotlinesStore, beatsStore, arcsStore, questionsStore, entitiesStore]) => {
      for (const c of chapters ?? []) {
        if (c.novelId === novelId) chaptersStore.delete(c.id);
      }
      for (const sc of scenes ?? []) {
        if (chapterIds.has(sc.chapterId)) scenesStore.delete(sc.id);
      }
      for (const p of plotlines ?? []) {
        if (p.novelId === novelId) plotlinesStore.delete(p.id);
      }
      for (const b of beats ?? []) {
        if (plotlineIds.has(b.plotlineId)) beatsStore.delete(b.id);
      }
      for (const a of arcs ?? []) {
        if (a.novelId === novelId) arcsStore.delete(a.id);
      }
      for (const q of questions ?? []) {
        if (q.novelId === novelId) questionsStore.delete(q.id);
      }
      for (const e of entities ?? []) {
        if (e.novelId === novelId) entitiesStore.delete(e.id);
      }
      for (const c of data.chapters) chaptersStore.put(c);
      for (const sc of data.scenes) scenesStore.put(sc);
      for (const p of data.plotlines) plotlinesStore.put(p);
      for (const b of data.beats) beatsStore.put(b);
      for (const a of data.arcs) arcsStore.put(a);
      for (const q of data.questions) questionsStore.put(q);
      for (const e of data.entities) entitiesStore.put(e);
      return entitiesStore.count();
    },
  );
}

export async function deleteScene(id: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, STORE_SCENES, "readwrite", ([s]) => s.delete(id));
  await unlinkSceneRefs(db, new Set([id]));
}

export async function deleteChapterCascade(id: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  const scenes = await request<Scene[]>(db, STORE_SCENES, "readonly", ([s]) => s.getAll());
  const deletedSceneIds = new Set((scenes ?? []).filter((sc) => sc.chapterId === id).map((sc) => sc.id));
  await request(db, [STORE_CHAPTERS, STORE_SCENES], "readwrite", ([chapters, scenesStore]) => {
    chapters.delete(id);
    for (const sc of scenes ?? []) {
      if (sc.chapterId === id) scenesStore.delete(sc.id);
    }
    return scenesStore.count();
  });
  await unlinkSceneRefs(db, deletedSceneIds);
}

export async function deleteNovelCascade(id: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  const chapters = await request<Chapter[]>(db, STORE_CHAPTERS, "readonly", ([s]) => s.getAll());
  const chapterIds = new Set((chapters ?? []).filter((c) => c.novelId === id).map((c) => c.id));
  const scenes = await request<Scene[]>(db, STORE_SCENES, "readonly", ([s]) => s.getAll());
  const plotlines = await request<Plotline[]>(db, STORE_PLOTLINES, "readonly", ([s]) => s.getAll());
  const plotlineIds = new Set((plotlines ?? []).filter((p) => p.novelId === id).map((p) => p.id));
  const beats = await request<Beat[]>(db, STORE_BEATS, "readonly", ([s]) => s.getAll());
  const arcs = await request<CharacterArc[]>(db, STORE_ARCS, "readonly", ([s]) => s.getAll());
  const questions = await request<OpenQuestion[]>(db, STORE_QUESTIONS, "readonly", ([s]) => s.getAll());
  const entities = await request<BibleEntity[]>(db, STORE_ENTITIES, "readonly", ([s]) => s.getAll());
  const snapshots = await request<NovelSnapshot[]>(db, STORE_SNAPSHOTS, "readonly", ([s]) => s.getAll());
  const bridges = await request<NovelBridge[]>(db, STORE_BRIDGES, "readonly", ([s]) => s.getAll());
  await request(
    db,
    [STORE_NOVELS, STORE_CHAPTERS, STORE_SCENES, STORE_PLOTLINES, STORE_BEATS, STORE_ARCS, STORE_QUESTIONS, STORE_ENTITIES, STORE_SNAPSHOTS, STORE_BRIDGES],
    "readwrite",
    ([novels, chaptersStore, scenesStore, plotlinesStore, beatsStore, arcsStore, questionsStore, entitiesStore, snapshotsStore, bridgesStore]) => {
      novels.delete(id);
      for (const c of chapters ?? []) {
        if (c.novelId === id) chaptersStore.delete(c.id);
      }
      for (const sc of scenes ?? []) {
        if (chapterIds.has(sc.chapterId)) scenesStore.delete(sc.id);
      }
      for (const p of plotlines ?? []) {
        if (p.novelId === id) plotlinesStore.delete(p.id);
      }
      for (const b of beats ?? []) {
        if (plotlineIds.has(b.plotlineId)) beatsStore.delete(b.id);
      }
      for (const a of arcs ?? []) {
        if (a.novelId === id) arcsStore.delete(a.id);
      }
      for (const q of questions ?? []) {
        if (q.novelId === id) questionsStore.delete(q.id);
      }
      for (const e of entities ?? []) {
        if (e.novelId === id) entitiesStore.delete(e.id);
      }
      for (const snap of snapshots ?? []) {
        if (snap.novelId === id) snapshotsStore.delete(snap.id);
      }
      for (const br of bridges ?? []) {
        if (br.novelId === id) bridgesStore.delete(br.id);
      }
      return snapshotsStore.count();
    },
  );
}
