import { describe, expect, it } from "vitest";
import {
  buildNovelAiPrompt,
  parseNovelAiResponse,
} from "./novel-ai.service.js";

describe("buildNovelAiPrompt", () => {
  it("tóm tắt: prompt chứa nội dung cảnh, yêu cầu JSON summary", () => {
    const { systemInstruction, userPrompt } = buildNovelAiPrompt({
      task: "summarize",
      text: "Aoi bước vào ga lúc hoàng hôn.",
    });
    expect(systemInstruction).toContain("summary");
    expect(userPrompt).toContain("Aoi bước vào ga lúc hoàng hôn.");
  });

  it("kiểm tra: prompt chứa sổ tay + cảnh, cấm viết lại cảnh", () => {
    const { userPrompt, systemInstruction } = buildNovelAiPrompt({
      task: "consistency",
      text: "Aoi có mắt xanh.",
      bible: "Aoi: mắt nâu.",
    });
    expect(userPrompt).toContain("mắt nâu");
    expect(userPrompt).toContain("mắt xanh");
    expect(systemInstruction).toContain("Never rewrite");
  });
});

describe("parseNovelAiResponse", () => {
  it("chấp nhận summary hợp lệ, từ chối rỗng/thiếu", () => {
    expect(parseNovelAiResponse({ summary: "  Aoi rời ga. " }, "summarize")).toEqual({
      summary: "Aoi rời ga.",
    });
    expect(parseNovelAiResponse({ summary: "  " }, "summarize")).toBeNull();
    expect(parseNovelAiResponse({}, "summarize")).toBeNull();
  });

  it("chấp nhận issues, lọc mục rỗng, từ chối sai kiểu", () => {
    expect(
      parseNovelAiResponse({ issues: ["Mắt đổi màu.", "", 42] }, "consistency"),
    ).toEqual({ issues: ["Mắt đổi màu."] });
    expect(parseNovelAiResponse({ issues: "không phải mảng" }, "consistency")).toBeNull();
    expect(parseNovelAiResponse({ issues: [] }, "consistency")).toEqual({ issues: [] });
  });
});
