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
  premise: string;
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

export interface Scene {
  id: string;
  chapterId: string;
  order: number;
  title: string;
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

/** Nội dung demo cũ (đang hardcode trong WashiBookPage) → seed lần đầu. */
export const SEED_LEFT =
  "Tôi nhớ buổi chiều ấy, mưa rơi rất khẽ trên mái ngói cong của ngôi đền cũ. Em đứng đó, ô giấy nghiêng nghiêng, ánh mắt lạc giữa những cánh hoa anh đào cuối cùng còn sót lại của mùa xuân.";
export const SEED_RIGHT =
  "“Cậu có tin vào kiếp sau không?” — em hỏi, không nhìn tôi. Tôi chưa kịp đáp. Một cánh hoa rơi xuống bàn tay em, rồi tan thành giọt mực loang trên trang giấy của ký ức.";
