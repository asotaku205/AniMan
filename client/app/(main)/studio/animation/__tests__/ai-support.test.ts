import { describe, expect, it } from "vitest";
import { suggestMotionPresets } from "../lib/motionPrompt";
import {
  extractDialogue,
  sceneDraftToAnimScene,
  suggestScenesFromText,
} from "../lib/sceneSuggest";

describe("motionPrompt — gợi ý preset theo mô tả", () => {
  it("đoán đúng họ preset cho các mô tả thường gặp", () => {
    expect(suggestMotionPresets("phóng to dần vào mặt nhân vật")[0]?.presetId).toBe(
      "ken-burns-in",
    );
    expect(suggestMotionPresets("khung hình rung nhẹ vì chấn động")[0]?.presetId).toBe(
      "shake-light",
    );
    expect(suggestMotionPresets("nhân vật bước vào từ trái")[0]?.presetId).toBe(
      "slide-in-left",
    );
    expect(suggestMotionPresets("")[0]).toBeUndefined();
    expect(suggestMotionPresets("một câu không liên quan gì cả")).toHaveLength(0);
  });
});

describe("sceneSuggest — tách novel thành cảnh nháp", () => {
  it("trích thoại trong ngoặc kép và tách theo đoạn văn", () => {
    const text = [
      "Haru đứng ở sân ga, nhìn đoàn tàu xa dần. “Tớ phải đi rồi.” Cô siết chặt chiếc khăn.",
      "“Đừng quên tớ nhé.” Tiếng còi tàu vang lên át cả lời tạm biệt.",
    ].join("\n\n");
    expect(extractDialogue(text)).toEqual(["Tớ phải đi rồi.", "Đừng quên tớ nhé."]);
    const drafts = suggestScenesFromText(text);
    expect(drafts).toHaveLength(2);
    expect(drafts[0].dialogueTexts).toEqual(["Tớ phải đi rồi."]);
    expect(drafts[0].durationSec).toBeGreaterThanOrEqual(3);
    const scene = sceneDraftToAnimScene(drafts[0], "x1");
    expect(scene.dialogue?.[0].text).toBe("Tớ phải đi rồi.");
    expect(scene.name).toContain("Cảnh 1");
  });

  it("đoạn rất dài bị tách thành nhiều cảnh", () => {
    const sentence = "Trời đổ mưa trên mái tôn kêu lộp độp suốt cả buổi chiều dài. ";
    const drafts = suggestScenesFromText(sentence.repeat(40));
    expect(drafts.length).toBeGreaterThan(1);
  });
});

import { parseSrt, toSrt, formatSrtTime } from "../lib/srt";

describe("srt — parse/xuất phụ đề chuẩn", () => {
  it("parse đúng mốc thời gian + nội dung; block lỗi bị bỏ qua", () => {
    const content = [
      "1",
      "00:00:01,000 --> 00:00:03,500",
      "Xin chào mọi người",
      "",
      "2",
      "00:00:04,000 --> 00:00:06,000",
      "Dòng hai",
      "kéo dài hai hàng",
      "",
      "3",
      "thời gian hỏng --> bỏ qua",
      "Không được tính",
    ].join("\n");
    const cues = parseSrt(content);
    expect(cues).toHaveLength(2);
    expect(cues[0].startSec).toBeCloseTo(1);
    expect(cues[0].durationSec).toBeCloseTo(2.5);
    expect(cues[1].text).toContain("Dòng hai");
  });

  it("xuất SRT rồi parse lại giữ nguyên mốc và nội dung (round-trip)", () => {
    const cues = parseSrt("1\n00:01:02,250 --> 00:01:05,000\nNội dung mẫu\n");
    const again = parseSrt(toSrt(cues));
    expect(again[0].startSec).toBeCloseTo(62.25);
    expect(again[0].durationSec).toBeCloseTo(2.75);
    expect(again[0].text).toBe("Nội dung mẫu");
    expect(formatSrtTime(3661.5)).toBe("01:01:01,500");
  });
});
