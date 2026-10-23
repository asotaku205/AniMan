// @vitest-environment node
/**
 * Kiểm thử tích hợp libraryStorage trên fake-indexeddb: ghi series →
 * mùa → tập → cue → "mở lại" (đọc từ DB) phải còn nguyên. Đây là ca
 * kiểm tra cho lỗi người dùng báo "F5 là mất hết dữ liệu".
 */
import { indexedDB as fakeIdb } from "fake-indexeddb";
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  // libraryStorage kiểm `typeof window !== "undefined" && "indexedDB" in window`
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("indexedDB", fakeIdb);
});

describe("libraryStorage — ghi/đọc bền vững qua IndexedDB", () => {
  it("series/mùa/tập/cue ghi xong đọc lại còn nguyên, replace cues đúng", async () => {
    const storage = await import("../lib/libraryStorage");
    const { createSeries, createSeason, createEpisode, createCue } =
      await import("../lib/library");

    const series = createSeries("Persist Test");
    const season = createSeason(series.id, 1);
    const episode = createEpisode(season.id, 1);
    await storage.saveSeries(series);
    await storage.saveSeason(season);
    await storage.saveEpisode(episode);

    const cueA = createCue(episode.id, 0, 2.5);
    cueA.text = "Xin chào";
    const cueB = createCue(episode.id, 3, 2);
    cueB.text = "Tạm biệt";
    await storage.saveCues([cueA, cueB]);

    // Đọc lại như sau F5
    const seriesBack = await storage.listSeries();
    expect(seriesBack.map((s) => s.title)).toContain("Persist Test");
    const seasonsBack = await storage.listSeasons(series.id);
    expect(seasonsBack).toHaveLength(1);
    const episodesBack = await storage.listEpisodes(season.id);
    expect(episodesBack).toHaveLength(1);
    const cuesBack = await storage.listCues(episode.id);
    expect(cuesBack.map((c) => c.text)).toEqual(["Xin chào", "Tạm biệt"]);

    // replaceEpisodeCues: xoá cue cũ, thêm cue mới
    const cueC = createCue(episode.id, 6, 2);
    cueC.text = "Cue mới";
    await storage.replaceEpisodeCues(episode.id, [cueC]);
    const after = await storage.listCues(episode.id);
    expect(after.map((c) => c.text)).toEqual(["Cue mới"]);

    // getEpisode + getSeriesOfEpisode
    const epBack = await storage.getEpisode(episode.id);
    expect(epBack?.id).toBe(episode.id);
    const ctx = epBack ? await storage.getSeriesOfEpisode(epBack) : null;
    expect(ctx?.series.id).toBe(series.id);
  });

  it("take blob ghi/đọc/xoá được", async () => {
    const storage = await import("../lib/libraryStorage");
    const blob = new Blob(["audio-bytes"], { type: "audio/webm" });
    await storage.saveTakeBlob("take-x", blob);
    const back = await storage.loadTakeBlob("take-x");
    expect(back).not.toBeNull();
    expect(back!.size).toBe(blob.size);
    await storage.deleteTakeBlob("take-x");
    expect(await storage.loadTakeBlob("take-x")).toBeNull();
  });
});
