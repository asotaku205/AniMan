/**
 * Dữ liệu Novel Studio, chặng N1 (xương sống): tiểu thuyết → chương →
 * cảnh. Một cảnh là một "trải giấy" 2 trang washi (trái + phải) — đúng
 * trải nghiệm editor hiện tại, chỉ khác là nội dung giờ là dữ liệu
 * thật có lưu bền thay cho chữ hardcode.
 * Thuần logic, không phụ thuộc trình duyệt — test được trực tiếp.
 */

export interface Novel {
  id: string;
  title: string;
  /** Snowflake: 1 câu tiền đề. */
  premise: string;
  /** Snowflake: 1 đoạn tóm tắt. */
  summary: string;
  /** Snowflake: dàn ý dài. */
  outline: string;
  /** Mục tiêu từ/ngày. */
  goalWordsPerDay: number;
  /** Từ viết thêm theo ngày (khóa yyyy-m-d, tăng ròng, tối thiểu 0). */
  dailyWords: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

export interface Chapter {
  id: string;
  novelId: string;
  order: number;
  title: string;
  createdAt: number;
}

export type SceneStatus = "draft" | "writing" | "done";

export const SCENE_STATUS_LABEL: Record<SceneStatus, string> = {
  draft: "Nháp",
  writing: "Đang viết",
  done: "Xong",
};

export interface Scene {
  id: string;
  chapterId: string;
  order: number;
  title: string;
  /** Tóm tắt 1-2 câu hiện trên thẻ Corkboard (N2). */
  synopsis: string;
  /** Trạng thái viết (N2). */
  status: SceneStatus;
  /** Nội dung trang trái / trang phải của trải giấy. */
  contentLeft: string;
  contentRight: string;
  createdAt: number;
  updatedAt: number;
}

let counter = 0;
export function newNovelId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function countWords(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

export function sceneWords(scene: Scene): number {
  return countWords(scene.contentLeft) + countWords(scene.contentRight);
}

export function chapterWords(scenes: readonly Scene[]): number {
  return scenes.reduce((sum, s) => sum + sceneWords(s), 0);
}

export function novelWords(allScenes: readonly Scene[]): number {
  return allScenes.reduce((sum, s) => sum + sceneWords(s), 0);
}

/** Khóa ngày theo giờ địa phương (yyyy-m-d). */
export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Cộng tăng ròng từ vào ngày date (không cho tổng ngày âm). */
export function applyWordDelta(
  dailyWords: Record<string, number>,
  date: string,
  delta: number,
): Record<string, number> {
  return {
    ...dailyWords,
    [date]: Math.max(0, (dailyWords[date] ?? 0) + delta),
  };
}

export function createNovel(title: string): Novel {
  const now = Date.now();
  return {
    id: newNovelId("novel"),
    title,
    premise: "",
    summary: "",
    outline: "",
    goalWordsPerDay: 500,
    dailyWords: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function createChapter(novelId: string, order: number, title: string): Chapter {
  return { id: newNovelId("chap"), novelId, order, title, createdAt: Date.now() };
}

export function createScene(
  chapterId: string,
  order: number,
  title: string,
  contentLeft = "",
  contentRight = "",
): Scene {
  const now = Date.now();
  return {
    id: newNovelId("scene"),
    chapterId,
    order,
    title,
    synopsis: "",
    status: "draft",
    contentLeft,
    contentRight,
    createdAt: now,
    updatedAt: now,
  };
}

export function sortByOrder<T extends { order: number; createdAt: number }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

/** Đổi chỗ item với item kề (dir -1 lên, +1 xuống); biên thì giữ nguyên. */
export function moveOrdered<T extends { id: string; order: number; createdAt: number }>(
  items: readonly T[],
  id: string,
  dir: -1 | 1,
): T[] {
  const sorted = sortByOrder(items);
  const idx = sorted.findIndex((x) => x.id === id);
  const other = sorted[idx + dir];
  if (idx < 0 || !other) return sorted;
  const a = { ...sorted[idx], order: other.order };
  const b = { ...other, order: sorted[idx].order };
  const out = [...sorted];
  out[idx] = b;
  out[idx + dir] = a;
  return sortByOrder(out);
}

// ── N2: tuyến truyện / beat / cung nhân vật / câu hỏi mở ───────────────

export type BeatKind = "goal" | "conflict" | "turn" | "result";

export const BEAT_KIND_LABEL: Record<BeatKind, string> = {
  goal: "Mục tiêu",
  conflict: "Xung đột",
  turn: "Bước ngoặt",
  result: "Kết quả",
};

export interface Plotline {
  id: string;
  novelId: string;
  title: string;
  color: string;
  order: number;
  createdAt: number;
}

export interface Beat {
  id: string;
  plotlineId: string;
  title: string;
  kind: BeatKind;
  /** Cảnh beat gắn vào; null = chưa gắn (đứt mạch). */
  sceneId: string | null;
  order: number;
  createdAt: number;
}

export interface ArcMilestone {
  id: string;
  sceneId: string;
  note: string;
}

export interface CharacterArc {
  id: string;
  novelId: string;
  /** N2 dùng tên gõ tay; N3 map sang thực thể sổ tay. */
  characterName: string;
  startState: string;
  endState: string;
  milestones: ArcMilestone[];
  order: number;
  createdAt: number;
}

export interface OpenQuestion {
  id: string;
  novelId: string;
  question: string;
  plantedSceneId: string | null;
  answeredSceneId: string | null;
  createdAt: number;
}

export function createPlotline(novelId: string, order: number, title: string, color = "#f59e0b"): Plotline {
  return { id: newNovelId("plot"), novelId, title, color, order, createdAt: Date.now() };
}

export function createBeat(plotlineId: string, order: number, title: string, kind: BeatKind, sceneId: string | null = null): Beat {
  return { id: newNovelId("beat"), plotlineId, title, kind, sceneId, order, createdAt: Date.now() };
}

export function createArc(novelId: string, order: number, characterName: string): CharacterArc {
  return { id: newNovelId("arc"), novelId, characterName, startState: "", endState: "", milestones: [], order, createdAt: Date.now() };
}

export function createQuestion(novelId: string, question: string): OpenQuestion {
  return { id: newNovelId("q"), novelId, question, plantedSceneId: null, answeredSceneId: null, createdAt: Date.now() };
}

/** Mọi cảnh của truyện xếp theo thứ tự kể (chương rồi cảnh). */
export function orderScenes(chapters: readonly Chapter[], scenes: readonly Scene[]): Scene[] {
  const orderedChapters = sortByOrder(chapters);
  const out: Scene[] = [];
  for (const c of orderedChapters) {
    out.push(...sortByOrder(scenes.filter((s) => s.chapterId === c.id)));
  }
  return out;
}

/** Beat đã gắn cảnh xếp theo vị trí cảnh; beat chưa gắn xếp cuối. */
export function sortBeatsByScene(beats: readonly Beat[], positionByScene: Map<string, number>): Beat[] {
  return [...beats].sort((a, b) => {
    const pa = a.sceneId ? positionByScene.get(a.sceneId) : undefined;
    const pb = b.sceneId ? positionByScene.get(b.sceneId) : undefined;
    if (pa !== undefined && pb !== undefined) return pa - pb || a.order - b.order;
    if (pa !== undefined) return -1;
    if (pb !== undefined) return 1;
    return a.order - b.order;
  });
}

/** Cảnh báo cung nhân vật: khoảng cách giữa 2 mốc liên tiếp vượt ngưỡng. */
export function arcGapWarnings(
  arc: CharacterArc,
  positionByScene: Map<string, number>,
  threshold = 5,
): Array<{ fromSceneId: string; toSceneId: string; gap: number }> {
  const positions = arc.milestones
    .map((m) => ({ sceneId: m.sceneId, pos: positionByScene.get(m.sceneId) }))
    .filter((x): x is { sceneId: string; pos: number } => x.pos !== undefined)
    .sort((a, b) => a.pos - b.pos);
  const warnings: Array<{ fromSceneId: string; toSceneId: string; gap: number }> = [];
  for (let i = 0; i < positions.length - 1; i += 1) {
    const gap = positions[i + 1].pos - positions[i].pos - 1;
    if (gap > threshold) {
      warnings.push({ fromSceneId: positions[i].sceneId, toSceneId: positions[i + 1].sceneId, gap });
    }
  }
  return warnings;
}

/**
 * Kéo-thả cảnh (N2): chuyển cảnh sang chương đích, đặt trước
 * beforeSceneId (null = cuối chương); đánh lại order trong các chương
 * bị ảnh hưởng. Trả về danh sách cảnh đã cập nhật.
 */
export function reorderScenesForMove(
  allScenes: readonly Scene[],
  sceneId: string,
  targetChapterId: string,
  beforeSceneId: string | null,
): Scene[] {
  const moving = allScenes.find((s) => s.id === sceneId);
  if (!moving) return [...allScenes];
  const rest = allScenes.filter((s) => s.id !== sceneId);
  const target = sortByOrder(rest.filter((s) => s.chapterId === targetChapterId));
  const insertAt = beforeSceneId ? target.findIndex((s) => s.id === beforeSceneId) : -1;
  const withMoved: Scene[] = [...target];
  if (insertAt >= 0) withMoved.splice(insertAt, 0, { ...moving, chapterId: targetChapterId });
  else withMoved.push({ ...moving, chapterId: targetChapterId });
  const reassigned = new Map<string, Scene>();
  for (const chapterId of new Set([moving.chapterId, targetChapterId])) {
    const list = chapterId === targetChapterId
      ? withMoved
      : sortByOrder(rest.filter((s) => s.chapterId === chapterId));
    list.forEach((s, i) => {
      if (s.order !== i) reassigned.set(s.id, { ...s, order: i });
    });
  }
  // Cảnh di chuyển đổi chương nhưng giữ order cũ thì vẫn cần lưu.
  if (!reassigned.has(moving.id) && moving.chapterId !== targetChapterId) {
    reassigned.set(moving.id, { ...moving, chapterId: targetChapterId, order: withMoved.findIndex((s) => s.id === moving.id) });
  }
  if (reassigned.size === 0) return [...allScenes];
  return allScenes.map((s) => reassigned.get(s.id) ?? s);
}

/** Nội dung demo cũ (đang hardcode trong WashiBookPage) → seed lần đầu. */
export const SEED_LEFT =
  "Tôi nhớ buổi chiều ấy, mưa rơi rất khẽ trên mái ngói cong của ngôi đền cũ. Em đứng đó, ô giấy nghiêng nghiêng, ánh mắt lạc giữa những cánh hoa anh đào cuối cùng còn sót lại của mùa xuân.";
export const SEED_RIGHT =
  "“Cậu có tin vào kiếp sau không?” — em hỏi, không nhìn tôi. Tôi chưa kịp đáp. Một cánh hoa rơi xuống bàn tay em, rồi tan thành giọt mực loang trên trang giấy của ký ức.";
