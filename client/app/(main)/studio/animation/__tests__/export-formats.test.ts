import { describe, expect, it } from "vitest";
import { toAss, toCueSheetCsv, toVtt } from "../lib/exportFormats";
import { dubWindows } from "../lib/dubMix";
import { createCue, createSeries } from "../lib/library";

describe("exportFormats — VTT/ASS/cue sheet", () => {
  const lines = [
    { id: "1", startSec: 1.5, durationSec: 2, text: "Xin chào\nmọi người" },
    { id: "2", startSec: 65.25, durationSec: 1.5, text: "Câu {hai}" },
  ];

  it("VTT có header WEBVTT và mốc giờ dạng HH:MM:SS.mmm", () => {
    const vtt = toVtt(lines);
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("00:00:01.500 --> 00:00:03.500");
    expect(vtt).toContain("00:01:05.250 --> 00:01:06.750");
  });

  it("ASS có sự kiện Dialogue, xuống dòng thành \\N, bỏ ngoặc điều khiển", () => {
    const ass = toAss(lines, "Tập 1");
    expect(ass).toContain("Title: Tập 1");
    expect(ass).toContain("Dialogue: 0,0:00:01.50,0:00:03.50");
    expect(ass).toContain("Xin chào\\Nmọi người");
    expect(ass).toContain("Câu hai");
    expect(ass).not.toContain("{hai}");
  });

  it("cue sheet CSV có nhân vật, lời gốc/dịch và trạng thái take", () => {
    const series = createSeries("S");
    series.characters = [
      { id: "c1", name: "Haru", voiceNote: "", color: "#fff" },
    ];
    const cue = createCue("ep", 2, 3);
    cue.speakerId = "c1";
    cue.sourceText = "こんにちは";
    cue.text = "Xin chào, mọi người";
    const csv = toCueSheetCsv([cue], series);
    expect(csv).toContain("Haru");
    expect(csv).toContain("こんにちは");
    expect(csv).toContain('"Xin chào, mọi người"');
    expect(csv).toContain("Chưa");
  });
});

describe("dubMix — cửa sổ ducking", () => {
  it("chỉ lấy cue có take chọn và gộp cửa sổ chồng lấp", () => {
    const a = createCue("ep", 1, 2);
    a.selectedTakeId = "t1";
    const b = createCue("ep", 2.9, 2);
    b.selectedTakeId = "t2";
    const c = createCue("ep", 10, 2); // không có take
    const windows = dubWindows([a, b, c]);
    expect(windows).toHaveLength(1);
    expect(windows[0].startSec).toBeCloseTo(0.9);
    expect(windows[0].endSec).toBeCloseTo(5.0);
  });
});
