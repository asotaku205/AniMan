import { describe, expect, it } from "vitest";
import {
  applyWordDelta,
  chapterWords,
  countWords,
  arcGapWarnings,
  createArc,
  createBeat,
  createBibleEntity,
  extractMentionTokens,
  mentionSceneIds,
  sceneMentionsEntity,
  unknownMentions,
  createChapter,
  createNovel,
  createPlotline,
  createQuestion,
  createScene,
  orderScenes,
  reorderScenesForMove,
  sortBeatsByScene,
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

describe("N2: dàn ý", () => {
  it("tạo mới có tóm tắt/trạng thái cảnh và trường Snowflake trống", () => {
    const n = createNovel("X");
    expect(n.summary).toBe("");
    expect(n.outline).toBe("");
    const sc = createScene("c1", 0, "Cảnh 1", "", "");
    expect(sc.synopsis).toBe("");
    expect(sc.status).toBe("draft");
    expect(createPlotline(n.id, 0, "Tuyến A").color).toBe("#f59e0b");
    expect(createBeat("p1", 0, "B1", "turn").sceneId).toBeNull();
    expect(createArc(n.id, 0, "Aoi").milestones).toEqual([]);
    expect(createQuestion(n.id, "Ai mở cửa?").answeredSceneId).toBeNull();
  });

  it("xếp cảnh theo thứ tự kể (chương rồi cảnh)", () => {
    const c1 = { ...createChapter("n1", 1, "C2"), id: "ch2" };
    const c0 = { ...createChapter("n1", 0, "C1"), id: "ch1" };
    const mk = (chapterId: string, order: number, title: string) => ({ ...createScene(chapterId, order, title, "", ""), id: `s-${title}` });
    const ordered = orderScenes([c1, c0], [mk("ch2", 0, "B"), mk("ch1", 1, "A2"), mk("ch1", 0, "A1")]);
    expect(ordered.map((x) => x.title)).toEqual(["A1", "A2", "B"]);
  });

  it("beat đã gắn cảnh xếp theo vị trí cảnh, beat chưa gắn xếp cuối", () => {
    const pos = new Map([["s1", 0], ["s2", 1], ["s3", 2]]);
    const b1 = createBeat("p", 0, "Cuối", "result", "s3");
    const b2 = createBeat("p", 1, "Đầu", "goal", "s1");
    const b3 = createBeat("p", 2, "Chưa gắn", "turn", null);
    expect(sortBeatsByScene([b1, b2, b3], pos).map((b) => b.title)).toEqual(["Đầu", "Cuối", "Chưa gắn"]);
  });

  it("cảnh báo cung khi vắng mặt quá 5 cảnh, đúng 5 thì không", () => {
    const pos = new Map([["s1", 0], ["s2", 7], ["s3", 12]]);
    const arc = { ...createArc("n1", 0, "Aoi"), milestones: [
      { id: "m1", sceneId: "s1", note: "" },
      { id: "m2", sceneId: "s2", note: "" },
      { id: "m3", sceneId: "s3", note: "" },
    ] };
    const warnings = arcGapWarnings(arc, pos);
    expect(warnings).toEqual([{ fromSceneId: "s1", toSceneId: "s2", gap: 6 }]);
  });

  it("kéo-thả cảnh đổi chương và đánh lại order", () => {
    const mk = (id: string, chapterId: string, order: number) => ({ ...createScene(chapterId, order, id, "", ""), id });
    const all = [mk("a", "ch1", 0), mk("b", "ch1", 1), mk("c", "ch2", 0)];
    const moved = reorderScenesForMove(all, "b", "ch2", "c");
    const byId = new Map(moved.map((x) => [x.id, x]));
    expect(byId.get("b")!.chapterId).toBe("ch2");
    expect(byId.get("b")!.order).toBe(0);
    expect(byId.get("c")!.order).toBe(1);
    expect(byId.get("a")!.order).toBe(0);
    // Cảnh không tồn tại → giữ nguyên.
    expect(reorderScenesForMove(all, "zzz", "ch2", null)).toEqual(all);
    // Kéo trong cùng chương về cuối.
    const same = reorderScenesForMove(all, "a", "ch1", null);
    expect(new Map(same.map((x) => [x.id, x.order])).get("a")).toBe(1);
  });
});

describe("N3: sổ tay + nhắc tới", () => {
  it("tạo thực thể mặc định rỗng, chưa gắn sa bàn", () => {
    const e = createBibleEntity("n1", 0, "character", "Aoi");
    expect(e.worldRef).toBeNull();
    expect(e.role).toBe("");
  });

  it("tách token @: tên nhiều từ hoa, dừng ở từ thường/dấu câu", () => {
    expect(extractMentionTokens("Gặp @Nguyễn Văn A ở ga, rồi @Aoi đi tới.")).toEqual([
      "Nguyễn Văn A",
      "Aoi",
    ]);
    expect(extractMentionTokens("Không có nhắc tới.")).toEqual([]);
    expect(extractMentionTokens("Email a@b không tính vì @ thiếu tên.")).toEqual([]);
  });

  it("nhắc tới khớp biên sau tên (@Aoi không khớp @AoiX)", () => {
    const mk = (left: string) => ({ ...createScene("c1", 0, "C", left, ""), id: "s1" });
    expect(sceneMentionsEntity(mk("Chào @Aoi nhé"), "Aoi")).toBe(true);
    expect(sceneMentionsEntity(mk("Chào @AoiX nhé"), "Aoi")).toBe(false);
    expect(sceneMentionsEntity(mk("Không nhắc ai"), "Aoi")).toBe(false);
  });

  it("map nhắc tới theo cảnh; nhắc lạ gom theo token, tiền tố tên không tính lạ", () => {
    const e1 = createBibleEntity("n1", 0, "character", "Nguyễn Văn A");
    const e2 = createBibleEntity("n1", 1, "place", "Ga tàu");
    const mk = (id: string, left: string) => ({ ...createScene("c1", 0, id, left, ""), id });
    const scenes = [mk("s1", "@Nguyễn Văn A đợi @Ga tàu"), mk("s2", "@Kẻ Lạ xuất hiện")];
    const map = mentionSceneIds([e1, e2], scenes);
    expect(map.get(e1.id)).toEqual(["s1"]);
    expect(map.get(e2.id)).toEqual(["s1"]);
    const unknown = unknownMentions(scenes, [e1, e2]);
    expect(unknown.map((u) => u.token)).toEqual(["Kẻ Lạ"]);
    expect(unknown[0].sceneIds).toEqual(["s2"]);
    // "@Nguyễn Văn" là tiền tố theo từ của tên đầy đủ → không tính lạ.
    expect(unknownMentions([mk("s3", "@Nguyễn Văn đi qua")], [e1])).toEqual([]);
  });
});
