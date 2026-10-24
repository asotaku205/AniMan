import { describe, expect, it } from "vitest";
import {
  applyWordDelta,
  chapterWords,
  countWords,
  createChapter,
  createNovel,
  createScene,
  moveOrdered,
  novelWords,
  sceneWords,
  sortByOrder,
  todayKey,
} from "../lib/novel";

describe("Đếm từ", () => {
  it("rỗng, khoảng trắng, câu tiếng Việt, xuống dòng", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("Tôi nhớ buổi chiều ấy")).toBe(5);
    expect(countWords("mưa\nrơi  rất   khẽ")).toBe(4);
  });

  it("cộng từ 2 trang của cảnh, nhiều cảnh của chương/truyện", () => {
    const s1 = createScene("c1", 0, "Cảnh 1", "một hai ba", "bốn năm");
    const s2 = createScene("c1", 1, "Cảnh 2", "sáu", "");
    expect(sceneWords(s1)).toBe(5);
    expect(chapterWords([s1, s2])).toBe(6);
    expect(novelWords([s1, s2])).toBe(6);
  });
});

describe("Tạo và sắp xếp", () => {
  it("id không trùng, thứ tự giữ nguyên khi tạo", () => {
    const a = createNovel("A");
    const b = createNovel("B");
    expect(a.id).not.toBe(b.id);
    const c1 = createChapter(a.id, 1, "C1");
    const c2 = createChapter(a.id, 0, "C0");
    expect(sortByOrder([c1, c2]).map((c) => c.title)).toEqual(["C0", "C1"]);
  });

  it("lên/xuống đổi chỗ, ở biên thì giữ nguyên", () => {
    const items = [0, 1, 2].map((o) => createChapter("n", o, `C${o}`));
    const up = moveOrdered(items, items[1].id, -1);
    expect(up.map((c) => c.title)).toEqual(["C1", "C0", "C2"]);
    const down = moveOrdered(items, items[1].id, 1);
    expect(down.map((c) => c.title)).toEqual(["C0", "C2", "C1"]);
    expect(moveOrdered(items, items[0].id, -1).map((c) => c.title)).toEqual(["C0", "C1", "C2"]);
    expect(moveOrdered(items, items[2].id, 1).map((c) => c.title)).toEqual(["C0", "C1", "C2"]);
    expect(moveOrdered(items, "không-có", 1).map((c) => c.title)).toEqual(["C0", "C1", "C2"]);
  });
});

describe("Từ theo ngày", () => {
  it("khóa ngày dạng yyyy-m-d", () => {
    expect(todayKey(new Date(2026, 9, 24))).toBe("2026-10-24");
  });

  it("cộng dồn, xoá không cho tổng ngày âm", () => {
    let d = applyWordDelta({}, "2026-10-24", 50);
    d = applyWordDelta(d, "2026-10-24", 30);
    expect(d["2026-10-24"]).toBe(80);
    d = applyWordDelta(d, "2026-10-24", -100);
    expect(d["2026-10-24"]).toBe(0);
    d = applyWordDelta(d, "2026-10-25", 10);
    expect(d["2026-10-24"]).toBe(0);
    expect(d["2026-10-25"]).toBe(10);
  });
});
