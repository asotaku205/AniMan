/**
 * Thư viện studio dịch & lồng tiếng — mô hình thuần (Slice S1):
 * cây Series → Season → Episode theo chuẩn OOONA (Title → Episode →
 * task), cue giữ cả bản gốc lẫn bản dịch, nhân vật + glossary thuộc
 * series. File này chỉ có dữ liệu + hàm thuần; lưu trữ ở
 * `libraryStorage.ts`, UI ở thư viện/editor.
 */

export type EpisodeStatus =
  | "not-started"
  | "translating"
  | "dubbing"
  | "qc"
  | "exported";

export const EPISODE_STATUS_OPTIONS: Array<{
  id: EpisodeStatus;
  label: string;
}> = [
  { id: "not-started", label: "Chưa làm" },
  { id: "translating", label: "Đang dịch" },
  { id: "dubbing", label: "Đang lồng tiếng" },
  { id: "qc", label: "Đã QC" },
  { id: "exported", label: "Đã xuất" },
];

export interface Character {
  id: string;
  name: string;
  /** Ghi chú giọng/xưng hô — đính kèm khi dịch để AI giữ nhất quán. */
  voiceNote: string;
  color: string;
}

export interface Series {
  id: string;
  title: string;
  sourceLang: string;
  targetLang: string;
  glossary: string;
  styleNote: string;
  characters: Character[];
  /**
   * Tuỳ chọn tổ chức (Sơn chốt 23/10: để người dùng chọn):
   * - useSeasons: true = cây 3 cấp Series → Season → Episode;
   *   false = 2 cấp Series → Episode (vẫn có 1 season ẩn làm neo dữ liệu).
   * - languageMode: "single" = mỗi tập 1 bản dịch (trường text);
   *   "multi" = nhiều ngôn ngữ đích, lưu trong CueV2.translations.
   */
  useSeasons: boolean;
  languageMode: "single" | "multi";
  /** Danh sách ngôn ngữ đích khi languageMode = "multi". */
  targetLangs: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Season {
  id: string;
  seriesId: string;
  number: number;
  title: string;
}

export interface Episode {
  id: string;
  seasonId: string;
  number: number;
  title: string;
  status: EpisodeStatus;
  /** Tên file video người dùng đã chọn (chỉ để hiển thị/nhắc chọn lại). */
  videoName: string | null;
  durationSec: number;
  updatedAt: number;
}

export interface TakeMeta {
  id: string;
  durationSec: number;
  /** 0..1.5 */
  volume: number;
  createdAt: number;
  note?: string;
}

/** Cue v2: tương thích DialogueLine về các trường cốt lõi + phần mở rộng. */
export interface CueV2 {
  id: string;
  episodeId: string;
  startSec: number;
  durationSec: number;
  /** Nhân vật nói (Character.id trong series). */
  speakerId?: string;
  /** Lời thoại gốc. */
  sourceText: string;
  /** Bản dịch/bản làm việc chính hiển thị trên video. */
  text: string;
  /** Các bản dịch theo ngôn ngữ khi series ở chế độ nhiều ngôn ngữ. */
  translations?: Record<string, string>;
  takes: TakeMeta[];
  selectedTakeId?: string;
  /** Cờ "cần xem lại" (AI dịch hoặc QC gắn). */
  flag?: string;
}

let libCounter = 0;
export function newLibraryId(prefix: string): string {
  libCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${libCounter.toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export function createSeries(title: string): Series {
  const now = Date.now();
  return {
    id: newLibraryId("series"),
    title: title.trim() || "Series chưa đặt tên",
    sourceLang: "ja",
    targetLang: "vi",
    glossary: "",
    styleNote: "",
    characters: [],
    useSeasons: true,
    languageMode: "single",
    targetLangs: ["vi"],
    createdAt: now,
    updatedAt: now,
  };
}

export function createSeason(seriesId: string, number: number): Season {
  return {
    id: newLibraryId("season"),
    seriesId,
    number,
    title: `Mùa ${number}`,
  };
}

export function createEpisode(seasonId: string, number: number): Episode {
  return {
    id: newLibraryId("episode"),
    seasonId,
    number,
    title: `Tập ${number}`,
    status: "not-started",
    videoName: null,
    durationSec: 0,
    updatedAt: Date.now(),
  };
}

export function createCue(
  episodeId: string,
  startSec: number,
  durationSec = 2.5,
): CueV2 {
  return {
    id: newLibraryId("cue"),
    episodeId,
    startSec,
    durationSec,
    sourceText: "",
    text: "",
    takes: [],
  };
}

export interface EpisodeProgress {
  totalCues: number;
  translated: number;
  dubbed: number;
  /** % theo cue đã có bản dịch (hoặc bản chính) — thước đo tiến độ chính. */
  percent: number;
}

/** Tiến độ một tập từ danh sách cue của nó. */
export function episodeProgress(cues: readonly CueV2[]): EpisodeProgress {
  const total = cues.length;
  const translated = cues.filter((c) => c.text.trim().length > 0).length;
  const dubbed = cues.filter((c) => c.selectedTakeId).length;
  return {
    totalCues: total,
    translated,
    dubbed,
    percent: total === 0 ? 0 : Math.round((translated / total) * 100),
  };
}

/** Tên nhân vật theo id (để hiển thị overlay/cue sheet). */
export function characterName(
  series: Series | null | undefined,
  speakerId: string | undefined,
): string | null {
  if (!series || !speakerId) return null;
  return series.characters.find((c) => c.id === speakerId)?.name ?? null;
}

/**
 * Ngữ cảnh series cho lượt dịch AI: glossary + bảng nhân vật (tên +
 * giọng/xưng hô) + ghi chú phong cách — gộp thành 1 chuỗi glossary mở
 * rộng để tái dùng endpoint dịch hiện có.
 */
export function buildSeriesContext(series: Series): string {
  const parts: string[] = [];
  if (series.glossary.trim()) parts.push(series.glossary.trim());
  if (series.characters.length > 0) {
    const lines = series.characters.map(
      (c) => `- ${c.name}${c.voiceNote.trim() ? `: ${c.voiceNote.trim()}` : ""}`,
    );
    parts.push(`Nhân vật:\n${lines.join("\n")}`);
  }
  if (series.styleNote.trim()) {
    parts.push(`Phong cách: ${series.styleNote.trim()}`);
  }
  return parts.join("\n");
}
