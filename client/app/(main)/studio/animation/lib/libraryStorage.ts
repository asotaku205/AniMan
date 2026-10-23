/**
 * Lưu trữ thư viện studio (IndexedDB `animan_video_editor_db` v2):
 * stores `series` / `seasons` / `episodes` / `cues` / `takeBlobs`.
 * Các store cũ của v1 (`project`, `takes`) được GIỮ NGUYÊN trong schema
 * để migrate lười (lazy) ở lần mở đầu tiên: bản ghi `current` cũ thành
 * 1 series "Dự án cũ" → 1 mùa → 1 tập, cue cũ thành CueV2, bản thu cũ
 * (key theo cueId) thành take đầu tiên đã chọn của cue đó.
 */

import {
  createCue,
  type CueV2,
  type Episode,
  type Season,
  type Series,
} from "./library";

const DB_NAME = "animan_video_editor_db";
const DB_VERSION = 3;

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Một kết nối IndexedDB DUY NHẤT dùng chung cho cả module (trước đây
 * mỗi thao tác mở 1 kết nối mới và không xử lý blocked/versionchange
 * — trên trình duyệt thật, nếu còn tab cũ giữ bản DB cũ thì lần mở
 * nâng cấp bị treo vĩnh viễn và mọi lần lưu thất bại ÂM THẦM: dữ
 * liệu chỉ sống trong React state, F5 là mất hết). Nay: cache kết
 * nối, đóng khi có tab khác nâng cấp, và REJECT khi bị blocked để
 * tầng UI hiện lỗi thay vì nuốt mất.
 */
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // v1 stores (giữ để migrate)
      if (!db.objectStoreNames.contains("project")) {
        db.createObjectStore("project", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("takes")) {
        db.createObjectStore("takes");
      }
      // v2 stores
      if (!db.objectStoreNames.contains("series")) {
        db.createObjectStore("series", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("seasons")) {
        db.createObjectStore("seasons", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("episodes")) {
        db.createObjectStore("episodes", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("cues")) {
        const cues = db.createObjectStore("cues", { keyPath: "id" });
        cues.createIndex("episodeId", "episodeId", { unique: false });
      }
      if (!db.objectStoreNames.contains("takeBlobs")) {
        db.createObjectStore("takeBlobs");
      }
      // v3: file video của từng tập — lưu Blob ngay trong IndexedDB để
      // F5 / chuyển tab / quay lại sau không phải chọn lại file.
      if (!db.objectStoreNames.contains("episodeVideos")) {
        db.createObjectStore("episodeVideos");
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
      reject(req.error);
    };
    req.onblocked = () => {
      dbPromise = null;
      reject(
        new Error(
          "IndexedDB bị chặn bởi một tab/phiên bản cũ đang mở — đóng các tab AniMan khác rồi tải lại trang.",
        ),
      );
    };
  });
  return dbPromise;
}

function request<T>(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = run(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const isBrowser = typeof window !== "undefined" && "indexedDB" in window;

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function listSeries(): Promise<Series[]> {
  if (!isBrowser) return [];
  const db = await openDb();
  const all = await request<Series[]>(db, "series", "readonly", (s) =>
    s.getAll(),
  );
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveSeries(series: Series): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, "series", "readwrite", (s) =>
    s.put({ ...series, updatedAt: Date.now() }),
  );
}

export async function listSeasons(seriesId: string): Promise<Season[]> {
  if (!isBrowser) return [];
  const db = await openDb();
  const all = await request<Season[]>(db, "seasons", "readonly", (s) =>
    s.getAll(),
  );
  return all
    .filter((x) => x.seriesId === seriesId)
    .sort((a, b) => a.number - b.number);
}

export async function saveSeason(season: Season): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, "seasons", "readwrite", (s) => s.put(season));
}

export async function listEpisodes(seasonId: string): Promise<Episode[]> {
  if (!isBrowser) return [];
  const db = await openDb();
  const all = await request<Episode[]>(db, "episodes", "readonly", (s) =>
    s.getAll(),
  );
  return all
    .filter((x) => x.seasonId === seasonId)
    .sort((a, b) => a.number - b.number);
}

export async function saveEpisode(episode: Episode): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, "episodes", "readwrite", (s) =>
    s.put({ ...episode, updatedAt: Date.now() }),
  );
}

export async function getEpisode(episodeId: string): Promise<Episode | null> {
  if (!isBrowser) return null;
  const db = await openDb();
  return (
    (await request<Episode | undefined>(db, "episodes", "readonly", (s) =>
      s.get(episodeId),
    )) ?? null
  );
}

export async function getSeriesOfEpisode(
  episode: Episode,
): Promise<{ series: Series; season: Season } | null> {
  if (!isBrowser) return null;
  const db = await openDb();
  const season = await request<Season | undefined>(
    db,
    "seasons",
    "readonly",
    (s) => s.get(episode.seasonId),
  );
  if (!season) return null;
  const series = await request<Series | undefined>(
    db,
    "series",
    "readonly",
    (s) => s.get(season.seriesId),
  );
  return series ? { series, season } : null;
}

export async function listCues(episodeId: string): Promise<CueV2[]> {
  if (!isBrowser) return [];
  const db = await openDb();
  const all = await request<CueV2[]>(db, "cues", "readonly", (s) =>
    s.index("episodeId").getAll(episodeId),
  );
  return all.sort((a, b) => a.startSec - b.startSec);
}

export async function saveCues(cues: CueV2[]): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction("cues", "readwrite");
    const store = t.objectStore("cues");
    for (const cue of cues) store.put(cue);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function replaceEpisodeCues(
  episodeId: string,
  cues: CueV2[],
): Promise<void> {
  if (!isBrowser) return;
  const existing = await listCues(episodeId);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction("cues", "readwrite");
    const store = t.objectStore("cues");
    for (const old of existing) store.delete(old.id);
    for (const cue of cues) store.put(cue);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function saveTakeBlob(takeId: string, blob: Blob): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, "takeBlobs", "readwrite", (s) => s.put(blob, takeId));
}

export async function loadTakeBlob(takeId: string): Promise<Blob | null> {
  if (!isBrowser) return null;
  const db = await openDb();
  return (
    (await request<Blob | undefined>(db, "takeBlobs", "readonly", (s) =>
      s.get(takeId),
    )) ?? null
  );
}

export async function saveEpisodeVideo(
  episodeId: string,
  blob: Blob,
): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, "episodeVideos", "readwrite", (s) =>
    s.put(blob, episodeId),
  );
}

export async function loadEpisodeVideo(
  episodeId: string,
): Promise<Blob | null> {
  if (!isBrowser) return null;
  const db = await openDb();
  return (
    (await request<Blob | undefined>(db, "episodeVideos", "readonly", (s) =>
      s.get(episodeId),
    )) ?? null
  );
}

export async function deleteEpisodeVideo(episodeId: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, "episodeVideos", "readwrite", (s) => s.delete(episodeId));
}

export async function deleteTakeBlob(takeId: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await request(db, "takeBlobs", "readwrite", (s) => s.delete(takeId));
}

// ── Migrate lười từ v1 ───────────────────────────────────────────────────────

interface LegacyProject {
  id: string;
  title: string;
  cues: Array<{
    id: string;
    text: string;
    startSec: number;
    durationSec: number;
    speaker?: string;
  }>;
}

/**
 * Nếu thư viện v2 đang trống mà còn dữ liệu v1 (`project/current`) thì
 * chuyển sang v2. Trả về true nếu đã migrate. An toàn chạy nhiều lần.
 */
export async function migrateLegacyIfNeeded(): Promise<boolean> {
  if (!isBrowser) return false;
  try {
    const existing = await listSeries();
    if (existing.length > 0) return false;
    const db = await openDb();
    const legacy = await request<LegacyProject | undefined>(
      db,
      "project",
      "readonly",
      (s) => s.get("current"),
    );
    if (!legacy || !Array.isArray(legacy.cues)) return false;

    const { createSeries, createSeason, createEpisode } = await import(
      "./library"
    );
    const series = createSeries(legacy.title || "Dự án biên tập cũ");
    const season = createSeason(series.id, 1);
    const episode = createEpisode(season.id, 1);
    episode.title = legacy.title || "Tập 1";
    episode.status = "translating";

    const cues: CueV2[] = [];
    for (const old of legacy.cues) {
      const cue = createCue(episode.id, old.startSec, old.durationSec);
      cue.id = old.id;
      cue.text = old.text ?? "";
      // Bản thu v1 (key = cueId) → take đầu tiên của cue
      const blob = await request<Blob | undefined>(
        db,
        "takes",
        "readonly",
        (s) => s.get(old.id),
      );
      if (blob) {
        const takeId = `take-legacy-${old.id}`;
        await saveTakeBlob(takeId, blob);
        cue.takes = [
          { id: takeId, durationSec: 0, volume: 1, createdAt: Date.now() },
        ];
        cue.selectedTakeId = takeId;
      }
      cues.push(cue);
    }
    await saveSeries(series);
    await saveSeason(season);
    await saveEpisode(episode);
    await saveCues(cues);
    return true;
  } catch {
    return false;
  }
}
