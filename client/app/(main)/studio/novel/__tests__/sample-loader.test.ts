// @vitest-environment node
/**
 * Kiểm thử loader dự án mẫu Novel: parse chặt, build bản ghi đúng quan hệ,
 * import tạo bản copy mới không đè dự án có sẵn, và file JSON mẫu thật
 * trong public/samples phải qua được parse.
 *
 * Phần IndexedDB chạy trên fake-indexeddb, theo mẫu anim-storage.test.ts:
 * stub global trước, rồi mới import động module loader.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { indexedDB as fakeIdb } from "fake-indexeddb";

beforeAll(() => {
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("indexedDB", fakeIdb);
});

async function loadLib() {
  return import("../lib/sampleLoader");
}

function makeChapter(i: number) {
  return {
    order: i,
    title: `Chương ${i + 1}: Tiêu đề ${i + 1}`,
    synopsis: `Câu tóm tắt chương ${i + 1}.`,
    contentLeft: `Nội dung trái chương ${i + 1}. Đoạn một. Đoạn hai.`,
    contentRight: `Nội dung phải chương ${i + 1}. Đoạn ba.`,
  };
}

function makeSample(overrides: Record<string, unknown> = {}) {
  return {
    format: "animan-novel-sample",
    version: 1,
    title: "Thư Gửi Thành Phố Trên Mây",
    premise: "Tiền đề mẫu.",
    summary: "Tóm tắt mẫu.",
    outline: "Dàn ý mẫu.",
    chapters: Array.from({ length: 20 }, (_, i) => makeChapter(i)),
    plotlines: [
      {
        title: "Tuyến mẫu",
        color: "#f59e0b",
        beats: [{ title: "Beat mẫu", kind: "goal", sceneChapter: 1 }],
      },
    ],
    arcs: [
      {
        characterName: "Mai",
        entityName: "Mai",
        startState: "Đầu truyện.",
        endState: "Cuối truyện.",
        milestones: [{ sceneChapter: 1, note: "Mốc mẫu." }],
      },
    ],
    questions: [
      { question: "Câu hỏi mẫu?", plantedChapter: 1, answeredChapter: 2 },
    ],
    entities: [
      {
        kind: "character",
        name: "Mai",
        role: "Người giao thư.",
        description: "Nhân vật chính.",
        traits: "Giữ lời hứa.",
        notes: "",
      },
    ],
    snapshot: { name: "Bản mẫu hoàn chỉnh", note: "Ghi chú mẫu." },
    ...overrides,
  };
}

const SAMPLE_JSON_PATH = path.resolve(
  import.meta.dirname,
  "../../../../../public/samples/thu-gui-thanh-pho-tren-may-novel.json",
);

describe("parseNovelSample", () => {
  it("chấp nhận mẫu hợp lệ đủ 20 chương", async () => {
    const { parseNovelSample } = await loadLib();
    const parsed = parseNovelSample(makeSample());
    expect(parsed.title).toBe("Thư Gửi Thành Phố Trên Mây");
    expect(parsed.chapters).toHaveLength(20);
  });

  it("bác bỏ format sai", async () => {
    const { parseNovelSample } = await loadLib();
    expect(() => parseNovelSample(makeSample({ format: "khac" }))).toThrow();
  });

  it("bác bỏ version sai", async () => {
    const { parseNovelSample } = await loadLib();
    expect(() => parseNovelSample(makeSample({ version: 2 }))).toThrow();
  });

  it("bác bỏ khi thiếu chương", async () => {
    const { parseNovelSample } = await loadLib();
    const bad = makeSample();
    bad.chapters = bad.chapters.slice(0, 19);
    expect(() => parseNovelSample(bad)).toThrow();
  });

  it("bác bỏ chương thiếu nội dung", async () => {
    const { parseNovelSample } = await loadLib();
    const bad = makeSample();
    bad.chapters[0] = { ...bad.chapters[0], contentLeft: "" };
    expect(() => parseNovelSample(bad)).toThrow();
  });

  it("bác bỏ đầu vào không phải object", async () => {
    const { parseNovelSample } = await loadLib();
    expect(() => parseNovelSample("không phải json")).toThrow();
    expect(() => parseNovelSample(null)).toThrow();
  });

  it("bác bỏ beat sai loại", async () => {
    const { parseNovelSample } = await loadLib();
    const bad = makeSample();
    bad.plotlines[0].beats[0].kind = "không có loại này";
    expect(() => parseNovelSample(bad)).toThrow();
  });

  it("bác bỏ beat gắn chương ngoài 1 đến 20", async () => {
    const { parseNovelSample } = await loadLib();
    const bad = makeSample();
    bad.plotlines[0].beats[0].sceneChapter = 21;
    expect(() => parseNovelSample(bad)).toThrow();
  });

  it("bác bỏ cung gắn nhân vật không có trong sổ tay mẫu", async () => {
    const { parseNovelSample } = await loadLib();
    const bad = makeSample();
    bad.arcs[0].entityName = "Người không có trong truyện";
    expect(() => parseNovelSample(bad)).toThrow();
  });

  it("bác bỏ câu hỏi trả lời trước khi cài cắm", async () => {
    const { parseNovelSample } = await loadLib();
    const bad = makeSample();
    bad.questions[0].plantedChapter = 5;
    bad.questions[0].answeredChapter = 2;
    expect(() => parseNovelSample(bad)).toThrow();
  });
});

describe("buildNovelRecords dàn ý", () => {
  it("tuyến, beat, cung, câu hỏi, sổ tay liên kết đúng cảnh và thực thể", async () => {
    const { buildNovelRecords, parseNovelSample } = await loadLib();
    const records = buildNovelRecords(
      parseNovelSample(makeSample()),
      Date.now(),
    );
    expect(records.plotlines).toHaveLength(1);
    expect(records.beats).toHaveLength(1);
    expect(records.beats[0].plotlineId).toBe(records.plotlines[0].id);
    expect(records.beats[0].sceneId).toBe(records.scenes[0].id);
    expect(records.arcs).toHaveLength(1);
    expect(records.arcs[0].entityId).toBe(records.entities[0].id);
    expect(records.arcs[0].milestones[0].sceneId).toBe(records.scenes[0].id);
    expect(records.questions).toHaveLength(1);
    expect(records.questions[0].plantedSceneId).toBe(records.scenes[0].id);
    expect(records.questions[0].answeredSceneId).toBe(records.scenes[1].id);
    expect(records.snapshot.data.plotlines).toHaveLength(1);
    expect(records.snapshot.data.entities).toHaveLength(1);
    expect(records.snapshot.wordCount).toBeGreaterThan(0);
  });
});

describe("buildNovelRecords", () => {
  it("tạo đúng 1 novel, 20 chương, 20 cảnh, quan hệ đúng", async () => {
    const { buildNovelRecords, parseNovelSample } = await loadLib();
    const records = buildNovelRecords(
      parseNovelSample(makeSample()),
      Date.now(),
    );
    expect(records.chapters).toHaveLength(20);
    expect(records.scenes).toHaveLength(20);
    expect(records.novel.title).toBe("Thư Gửi Thành Phố Trên Mây");
    for (const chapter of records.chapters) {
      expect(chapter.novelId).toBe(records.novel.id);
    }
    for (let i = 0; i < records.scenes.length; i++) {
      expect(records.scenes[i].chapterId).toBe(records.chapters[i].id);
      expect(records.scenes[i].status).toBe("done");
      expect(records.scenes[i].contentLeft.length).toBeGreaterThan(0);
      expect(records.scenes[i].contentRight.length).toBeGreaterThan(0);
    }
    const ids = new Set([
      records.novel.id,
      ...records.chapters.map((c) => c.id),
      ...records.scenes.map((s) => s.id),
    ]);
    expect(ids.size).toBe(41);
  });

  it("hai lần build cho id tiểu thuyết khác nhau", async () => {
    const { buildNovelRecords, parseNovelSample } = await loadLib();
    const sample = parseNovelSample(makeSample());
    const a = buildNovelRecords(sample, Date.now());
    const b = buildNovelRecords(sample, Date.now());
    expect(a.novel.id).not.toBe(b.novel.id);
  });
});

describe("importNovelSample trên fake-indexeddb", () => {
  it("import xong đọc lại đủ, dự án có sẵn không bị đè", async () => {
    const { importNovelSample, parseNovelSample } = await loadLib();
    const storage = await import("../lib/novelStorage");
    const { createNovel, createPlotline } = await import("../lib/novel");

    const existing = createNovel("Tiểu thuyết đã có của tôi");
    await storage.saveNovel(existing);
    const existingPlot = createPlotline(existing.id, 0, "Tuyến đã có");
    await storage.savePlotline(existingPlot);

    const records = await importNovelSample(parseNovelSample(makeSample()));
    const novels = await storage.listNovels();
    expect(novels.some((n) => n.id === existing.id)).toBe(true);
    expect(novels.some((n) => n.id === records.novel.id)).toBe(true);
    expect(
      novels.find((n) => n.id === existing.id)?.title,
    ).toBe("Tiểu thuyết đã có của tôi");

    const chapters = (await storage.listChapters()).filter(
      (c) => c.novelId === records.novel.id,
    );
    expect(chapters).toHaveLength(20);
    const chapterIds = new Set(chapters.map((c) => c.id));
    const scenes = (await storage.listScenes()).filter((s) =>
      chapterIds.has(s.chapterId),
    );
    expect(scenes).toHaveLength(20);

    const oldPlots = (await storage.listPlotlines()).filter(
      (p) => p.novelId === existing.id,
    );
    expect(oldPlots).toHaveLength(1);
    expect(oldPlots[0].title).toBe("Tuyến đã có");
    const newPlots = (await storage.listPlotlines()).filter(
      (p) => p.novelId === records.novel.id,
    );
    expect(newPlots).toHaveLength(1);
    const newPlotIds = new Set(newPlots.map((p) => p.id));
    const beats = (await storage.listBeats()).filter((b) =>
      newPlotIds.has(b.plotlineId),
    );
    expect(beats).toHaveLength(1);
    expect(
      (await storage.listEntities()).filter(
        (e) => e.novelId === records.novel.id,
      ),
    ).toHaveLength(1);
    expect(
      (await storage.listSnapshots()).filter(
        (s) => s.novelId === records.novel.id,
      ),
    ).toHaveLength(1);
  });

  it("import hai lần tạo hai bản copy khác id", async () => {
    const { importNovelSample, parseNovelSample } = await loadLib();
    const sample = parseNovelSample(makeSample());
    const first = await importNovelSample(sample);
    const second = await importNovelSample(sample);
    expect(first.novel.id).not.toBe(second.novel.id);
  });
});

describe("file JSON mẫu novel thật trong public/samples", () => {
  it("đọc được, parse được, đủ 20 chương, đủ dài, không ký tự cấm", async () => {
    const { buildNovelRecords, parseNovelSample } = await loadLib();
    const { arcGapWarnings } = await import("../lib/novel");
    const raw = readFileSync(SAMPLE_JSON_PATH, "utf-8");
    expect(raw).not.toContain("—");
    expect(raw).not.toContain("–");
    expect(raw).not.toContain("→");
    expect(raw).not.toContain("×");
    const parsed = parseNovelSample(JSON.parse(raw));
    expect(parsed.chapters).toHaveLength(20);
    expect(parsed.chapters[0].title.startsWith("Chương 1:")).toBe(true);
    expect(parsed.chapters[19].title.startsWith("Chương 20:")).toBe(true);
    const words = parsed.chapters.reduce((sum, c) => {
      const text = `${c.contentLeft} ${c.contentRight}`.trim();
      return sum + (text === "" ? 0 : text.split(/\s+/).length);
    }, 0);
    expect(words).toBeGreaterThan(37000);

    const records = buildNovelRecords(parsed, Date.now());
    expect(records.plotlines).toHaveLength(4);
    expect(records.beats.length).toBeGreaterThan(0);
    expect(records.beats.every((b) => b.sceneId !== null)).toBe(true);
    expect(records.arcs).toHaveLength(4);
    expect(records.arcs.every((a) => a.entityId !== null)).toBe(true);
    expect(records.questions).toHaveLength(4);
    expect(
      records.questions.every(
        (q) => q.plantedSceneId !== null && q.answeredSceneId !== null,
      ),
    ).toBe(true);
    expect(records.entities).toHaveLength(28);
    expect(records.snapshot.name.length).toBeGreaterThan(0);
    const positions = new Map(records.scenes.map((sc, i) => [sc.id, i]));
    const warnings = new Map(
      records.arcs.map((a) => [a.characterName, arcGapWarnings(a, positions)]),
    );
    expect(warnings.get("Mai")).toHaveLength(0);
    expect(warnings.get("Bin")).toHaveLength(0);
    expect(warnings.get("Khải")).toHaveLength(0);
    expect(warnings.get("Ông Tư")).toHaveLength(1);
  });
});
