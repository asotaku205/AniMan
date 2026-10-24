import { describe, expect, it } from "vitest";
import {
  buildHtml,
  buildMarkdown,
  escapeHtml,
  exportBlocks,
  exportFileName,
} from "../lib/novelExport";
import {
  createBibleEntity,
  createChapter,
  createNovel,
  createScene,
  type NovelExportData,
} from "../lib/novel";

function sampleData(): NovelExportData {
  const novel = { ...createNovel("Truyện mưa"), premise: "Một người đợi mưa.", summary: "Tóm tắt ngắn.", outline: "Dàn ý dài." };
  const c1 = { ...createChapter(novel.id, 0, "Chương 1"), id: "ch1" };
  const c2 = { ...createChapter(novel.id, 1, "Chương 2"), id: "ch2" };
  const s1 = { ...createScene("ch1", 0, "Cảnh 1", "Mưa rơi.", "Aoi đợi."), id: "sc1" };
  const s2 = { ...createScene("ch1", 1, "Cảnh 2", "Nắng lên.\n\nGió nhẹ.", ""), id: "sc2" };
  const s3 = { ...createScene("ch2", 0, "Cảnh 1", "Đêm xuống.", ""), id: "sc3" };
  const e1 = { ...createBibleEntity(novel.id, 0, "character" as const, "Aoi"), description: "Cô gái đợi mưa." };
  return {
    novel,
    chapters: [c2, c1],
    scenes: [s3, s2, s1],
    plotlines: [],
    beats: [],
    arcs: [],
    questions: [],
    entities: [e1],
  };
}

describe("exportBlocks — thứ tự kể + tuỳ chọn", () => {
  it("chương rồi cảnh, trang trái rồi trang phải", () => {
    const blocks = exportBlocks(sampleData(), { includeOutline: false, includeBible: false });
    const texts = blocks.map((b) => b.text);
    expect(texts).toEqual([
      "Truyện mưa",
      "Chương 1",
      "Cảnh 1",
      "Mưa rơi.",
      "Aoi đợi.",
      "Cảnh 2",
      "Nắng lên.",
      "Gió nhẹ.",
      "Chương 2",
      "Cảnh 1",
      "Đêm xuống.",
    ]);
  });

  it("dàn ý + phụ lục sổ tay chỉ khi được tích", () => {
    const withAll = exportBlocks(sampleData(), { includeOutline: true, includeBible: true });
    expect(withAll.map((b) => b.text)).toContain("Dàn ý");
    expect(withAll.map((b) => b.text)).toContain("Aoi: Cô gái đợi mưa.");
    const without = exportBlocks(sampleData(), { includeOutline: false, includeBible: false });
    expect(without.map((b) => b.text)).not.toContain("Dàn ý");
    expect(without.map((b) => b.text)).not.toContain("Aoi: Cô gái đợi mưa.");
  });
});

describe("buildMarkdown / buildHtml / exportFileName", () => {
  it("markdown có heading đúng cấp, html escape ký tự đặc biệt", () => {
    const md = buildMarkdown(sampleData(), { includeOutline: false, includeBible: false });
    expect(md).toContain("# Truyện mưa");
    expect(md).toContain("## Chương 1");
    expect(md).toContain("### Cảnh 1");
    expect(buildHtml(sampleData(), { includeOutline: false, includeBible: false })).toContain("<h1>Truyện mưa</h1>");
    expect(escapeHtml('<a href="x">&amp;</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;amp;&lt;/a&gt;");
  });

  it("tên file slug hoá, bỏ ký tự cấm", () => {
    expect(exportFileName("Truyện Mưa: Chương 1?", "md")).toBe("truyện-mưa-chương-1.md");
    expect(exportFileName("", "docx")).toBe("tieu-thuyet.docx");
  });
});
