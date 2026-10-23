import { describe, expect, it } from "vitest";
import {
  buildSeriesContext,
  createCue,
  createEpisode,
  createSeason,
  createSeries,
  episodeProgress,
} from "../lib/library";

describe("library — mô hình Series → Season → Episode", () => {
  it("tạo cây với tuỳ chọn mặc định: dùng mùa, 1 bản dịch, đích vi", () => {
    const series = createSeries("  BokuYaba lồng tiếng  ");
    expect(series.title).toBe("BokuYaba lồng tiếng");
    expect(series.useSeasons).toBe(true);
    expect(series.languageMode).toBe("single");
    expect(series.targetLangs).toEqual(["vi"]);
    const season = createSeason(series.id, 2);
    expect(season.seriesId).toBe(series.id);
    const ep = createEpisode(season.id, 5);
    expect(ep.status).toBe("not-started");
    expect(ep.number).toBe(5);
  });

  it("tiến độ tập tính theo cue đã có bản dịch / đã chọn take", () => {
    const ep = createEpisode("s1", 1);
    const a = createCue(ep.id, 0);
    a.text = "Xin chào";
    const b = createCue(ep.id, 3);
    const c = createCue(ep.id, 6);
    c.text = "Tạm biệt";
    c.takes = [{ id: "t1", durationSec: 2, volume: 1, createdAt: 0 }];
    c.selectedTakeId = "t1";
    const p = episodeProgress([a, b, c]);
    expect(p.totalCues).toBe(3);
    expect(p.translated).toBe(2);
    expect(p.dubbed).toBe(1);
    expect(p.percent).toBe(67);
    expect(episodeProgress([]).percent).toBe(0);
  });

  it("ngữ cảnh series gộp glossary + nhân vật + phong cách cho lượt dịch", () => {
    const series = createSeries("X");
    series.glossary = "Haru = giữ nguyên";
    series.styleNote = "Giọng trẻ trung";
    series.characters = [
      { id: "c1", name: "Haru", voiceNote: "nữ, xưng 'tớ'", color: "#fff" },
    ];
    const ctx = buildSeriesContext(series);
    expect(ctx).toContain("Haru = giữ nguyên");
    expect(ctx).toContain("Haru");
    expect(ctx).toContain("xưng 'tớ'");
    expect(ctx).toContain("Giọng trẻ trung");
  });
});
