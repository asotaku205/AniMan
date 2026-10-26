// @vitest-environment node
/**
 * Kiểm thử loader dự án mẫu Manga: parse chặt, build đúng bản ghi dự án
 * và trang vẽ (schema v2, khung classic-5, chữ theo khung), import tạo
 * bản copy mới không đè dự án có sẵn, và file JSON mẫu thật trong
 * public/samples phải qua được parse.
 *
 * Phần IndexedDB chạy trên fake-indexeddb, theo mẫu sample-loader của
 * Novel: stub global trước, rồi mới import động module loader.
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

type FactoryLine = {
  kind: string;
  speaker?: string | null;
  source?: string;
  text: string;
};

function makePanel(panelNumber: number) {
  let lines: FactoryLine[] = [];
  if (panelNumber === 1) {
    lines = [{ kind: "spoken", speaker: "Mai", text: "Lời thoại mẫu." }];
  } else if (panelNumber === 2) {
    lines = [{ kind: "inner", speaker: "Bin", text: "Nghĩ thầm mẫu." }];
  } else if (panelNumber === 3) {
    lines = [
      { kind: "written", source: "Chữ trong sổ", text: "Chữ viết mẫu." },
    ];
  } else if (panelNumber === 4) {
    lines = [{ kind: "sfx", text: "leng keng" }];
  } else {
    lines = [{ kind: "spoken", speaker: null, text: "Lời chưa rõ người nói." }];
  }
  return {
    number: panelNumber,
    shot: "trung",
    visual: "Mô tả khung hình mẫu.",
    lines,
  };
}

function makeSample(overrides: Record<string, unknown> = {}) {
  return {
    format: "animan-manga-sample",
    version: 1,
    title: "Thư Gửi Thành Phố Trên Mây",
    genre: "Phiêu lưu, đời thường",
    description: "Mô tả mẫu.",
    chapters: Array.from({ length: 8 }, (_, ci) => ({
      number: ci + 1,
      title: `Chương mẫu ${ci + 1}`,
      pages: Array.from({ length: 6 }, (_, pi) => ({
        number: pi + 1,
        title: `Trang mẫu ${pi + 1}`,
        panels: [1, 2, 3, 4, 5].map((pn) => makePanel(pn)),
      })),
    })),
    ...overrides,
  };
}

const SAMPLE_JSON_PATH = path.resolve(
  import.meta.dirname,
  "../../../../../public/samples/thu-gui-thanh-pho-tren-may-manga.json",
);

describe("parseMangaSample", () => {
  it("chấp nhận mẫu hợp lệ đủ 8 chương, 48 trang, 240 khung", async () => {
    const { parseMangaSample } = await loadLib();
    const parsed = parseMangaSample(makeSample());
    expect(parsed.chapters).toHaveLength(8);
    expect(parsed.chapters[0].pages).toHaveLength(6);
    expect(parsed.chapters[0].pages[0].panels).toHaveLength(5);
  });

  it("bác bỏ format sai", async () => {
    const { parseMangaSample } = await loadLib();
    expect(() => parseMangaSample(makeSample({ format: "khac" }))).toThrow();
  });

  it("bác bỏ version sai", async () => {
    const { parseMangaSample } = await loadLib();
    expect(() => parseMangaSample(makeSample({ version: 2 }))).toThrow();
  });

  it("bác bỏ khi thiếu chương", async () => {
    const { parseMangaSample } = await loadLib();
    const bad = makeSample();
    bad.chapters = bad.chapters.slice(0, 7);
    expect(() => parseMangaSample(bad)).toThrow();
  });

  it("bác bỏ khi trang thiếu khung", async () => {
    const { parseMangaSample } = await loadLib();
    const bad = makeSample();
    bad.chapters[0].pages[0].panels =
      bad.chapters[0].pages[0].panels.slice(0, 4);
    expect(() => parseMangaSample(bad)).toThrow();
  });

  it("bác bỏ loại dòng sai", async () => {
    const { parseMangaSample } = await loadLib();
    const bad = makeSample();
    bad.chapters[0].pages[0].panels[0].lines[0].kind = "không có loại này";
    expect(() => parseMangaSample(bad)).toThrow();
  });

  it("bác bỏ chữ viết thiếu nguồn", async () => {
    const { parseMangaSample } = await loadLib();
    const bad = makeSample();
    bad.chapters[0].pages[0].panels[2].lines[0].source = "";
    expect(() => parseMangaSample(bad)).toThrow();
  });

  it("bác bỏ đầu vào không phải object", async () => {
    const { parseMangaSample } = await loadLib();
    expect(() => parseMangaSample("không phải json")).toThrow();
    expect(() => parseMangaSample(null)).toThrow();
  });
});

describe("buildMangaRecords", () => {
  it("tạo 1 dự án 48 trang, trang vẽ schema v2, chữ đúng khung và kiểu", async () => {
    const { buildMangaRecords, parseMangaSample } = await loadLib();
    const records = buildMangaRecords(
      parseMangaSample(makeSample()),
      Date.now(),
    );
    expect(records.project.pages).toHaveLength(48);
    expect(records.project.pages[0].layoutId).toBe("classic-5");
    expect(records.pageDrawings).toHaveLength(48);
    const first = records.pageDrawings[0];
    expect(first.id).toBe(`${records.project.id}_p1`);
    expect(first.schemaVersion).toBe(2);
    expect(first.layoutId).toBe("classic-5");
    expect(Object.keys(first.stacks ?? {}).sort()).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
    ]);
    const texts = first.texts ?? {};
    expect(texts.p1[0].text).toBe("Mai: Lời thoại mẫu.");
    expect(texts.p2[0].text).toBe("Bin (nội tâm): Nghĩ thầm mẫu.");
    expect(texts.p2[0].italic).toBe(true);
    expect(texts.p3[0].text).toBe("Chữ trong sổ: Chữ viết mẫu.");
    expect(texts.p4[0].text).toBe("leng keng");
    expect(texts.p4[0].fontWeight).toBe(900);
    expect(texts.p5[0].text).toBe("Lời chưa rõ người nói.");
    const ids = new Set(
      Object.values(texts).flat().map((t) => t.id),
    );
    expect(ids.size).toBe(5);
  });

  it("hai lần build cho id dự án khác nhau", async () => {
    const { buildMangaRecords, parseMangaSample } = await loadLib();
    const sample = parseMangaSample(makeSample());
    const a = buildMangaRecords(sample, Date.now());
    const b = buildMangaRecords(sample, Date.now());
    expect(a.project.id).not.toBe(b.project.id);
  });
});

describe("importMangaSample trên fake-indexeddb", () => {
  it("import xong đọc lại đủ, dự án có sẵn không bị đè", async () => {
    const { importMangaSample, parseMangaSample } = await loadLib();
    const storage = await import("../lib/mangaStorage");

    const existing = {
      id: "proj-da-co",
      title: "Dự án đã có của tôi",
      genre: "Action",
      description: "Mô tả cũ.",
      createdAt: 1,
      updatedAt: 1,
      status: "draft" as const,
      pages: [{ pageNumber: 1, layoutId: "classic-5", panels: {} }],
    };
    await storage.saveProjectToDB(existing);

    const records = await importMangaSample(parseMangaSample(makeSample()));
    const projects = await storage.getAllProjectsFromDB();
    expect(projects.some((p) => p.id === existing.id)).toBe(true);
    expect(projects.some((p) => p.id === records.project.id)).toBe(true);
    expect(projects.find((p) => p.id === existing.id)?.title).toBe(
      "Dự án đã có của tôi",
    );
    const saved = projects.find((p) => p.id === records.project.id);
    expect(saved?.pages).toHaveLength(48);

    const page1 = await storage.getPageDrawingRecordFromDB(
      records.project.id,
      1,
    );
    expect(page1).not.toBeNull();
    expect(page1?.schemaVersion).toBe(2);
    expect(page1?.texts?.p1[0].text).toBe("Mai: Lời thoại mẫu.");
  });

  it("import hai lần tạo hai bản copy khác id", async () => {
    const { importMangaSample, parseMangaSample } = await loadLib();
    const sample = parseMangaSample(makeSample());
    const first = await importMangaSample(sample);
    const second = await importMangaSample(sample);
    expect(first.project.id).not.toBe(second.project.id);
  });
});

describe("file JSON mẫu manga thật trong public/samples", () => {
  it("đọc được, parse được, đủ 8 chương, 48 trang, 240 khung, không ký tự cấm", async () => {
    const { parseMangaSample } = await loadLib();
    const raw = readFileSync(SAMPLE_JSON_PATH, "utf-8");
    expect(raw).not.toContain("—");
    expect(raw).not.toContain("–");
    expect(raw).not.toContain("→");
    expect(raw).not.toContain("×");
    const parsed = parseMangaSample(JSON.parse(raw));
    expect(parsed.chapters).toHaveLength(8);
    let pages = 0;
    let panels = 0;
    let lines = 0;
    const byKind: Record<string, number> = {};
    let unattributed = 0;
    for (const chapter of parsed.chapters) {
      expect(chapter.pages).toHaveLength(6);
      pages += chapter.pages.length;
      for (const page of chapter.pages) {
        expect(page.panels).toHaveLength(5);
        panels += page.panels.length;
        for (const panel of page.panels) {
          lines += panel.lines.length;
          for (const line of panel.lines) {
            expect(line.text.trim().length).toBeGreaterThan(0);
            byKind[line.kind] = (byKind[line.kind] ?? 0) + 1;
            if (
              (line.kind === "spoken" || line.kind === "inner") &&
              !line.speaker
            ) {
              unattributed += 1;
            }
          }
        }
      }
    }
    expect(pages).toBe(48);
    expect(panels).toBe(240);
    expect(lines).toBe(197);
    expect(byKind.sfx).toBe(4);
    expect(byKind.inner).toBe(6);
    expect(byKind.written).toBe(27);
    expect(byKind.spoken).toBe(159);
    expect(byKind.narration).toBe(1);
    expect(unattributed).toBe(21);
  });
});
