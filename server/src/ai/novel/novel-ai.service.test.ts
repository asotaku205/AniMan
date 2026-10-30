import { describe, expect, it, vi } from "vitest";
import { HttpException } from "@nestjs/common";
import {
  buildNovelAiPrompt,
  NovelAiService,
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

  it("tách cảnh: prompt chứa ngữ cảnh + cảnh, yêu cầu JSON pages/panels", () => {
    const { systemInstruction, userPrompt } = buildNovelAiPrompt({
      task: "breakdown",
      text: "Aoi bước vào ga lúc hoàng hôn.",
      context: "Truyện về Aoi rời quê.",
    });
    expect(systemInstruction).toContain("splash-3");
    expect(systemInstruction).toContain("Never put text");
    expect(userPrompt).toContain("Aoi bước vào ga lúc hoàng hôn.");
    expect(userPrompt).toContain("Truyện về Aoi rời quê.");
  });

  it("chấp nhận breakdown hợp lệ, sửa layout theo đúng số khung", () => {
    const result = parseNovelAiResponse(
      {
        pages: [
          {
            layout: "classic-5",
            panels: [
              { prompt: "Ga lúc hoàng hôn.", sceneType: "wide", dialogue: [], note: "Mở đầu rộng." },
              { prompt: "Aoi nhìn bảng giờ.", sceneType: "closeup", dialogue: ["Chuyến cuối..."], note: "" },
              { prompt: "Tay Aoi nắm vé.", sceneType: "closeup", dialogue: [], note: "" },
            ],
          },
        ],
      },
      "breakdown",
    );
    expect(result?.breakdown?.pages[0].layout).toBe("splash-3");
    expect(result?.breakdown?.pages[0].panels).toHaveLength(3);
    expect(result?.breakdown?.pages[0].panels[1].dialogue).toEqual(["Chuyến cuối..."]);
  });

  it("run() ném HttpException kèm nguyên nhân khi mọi model đều lỗi", async () => {
    const service = new NovelAiService("dummy-key");
    const client = (
      service as unknown as {
        client: { models: { generateContent: unknown } };
      }
    ).client;
    client.models.generateContent = vi
      .fn()
      .mockRejectedValue(
        new Error("API key not valid. Please pass a valid API key."),
      );
    const run = service.run({ task: "summarize", text: "Aoi rời ga." });
    await expect(run).rejects.toBeInstanceOf(HttpException);
    await expect(run).rejects.toThrow("API key not valid");
  });

  it("từ chối breakdown thiếu prompt, sai loại cảnh, ít hơn 3 khung", () => {
    expect(
      parseNovelAiResponse(
        { pages: [{ layout: "classic-5", panels: [{ prompt: "  ", sceneType: "wide", dialogue: [], note: "" }] }] },
        "breakdown",
      ),
    ).toBeNull();
    expect(
      parseNovelAiResponse(
        {
          pages: [
            {
              layout: "classic-5",
              panels: [
                { prompt: "Ga.", sceneType: "nope", dialogue: [], note: "" },
                { prompt: "Aoi.", sceneType: "wide", dialogue: [], note: "" },
                { prompt: "Vé.", sceneType: "wide", dialogue: [], note: "" },
              ],
            },
          ],
        },
        "breakdown",
      ),
    ).toBeNull();
    expect(parseNovelAiResponse({ pages: [] }, "breakdown")).toBeNull();
    expect(parseNovelAiResponse({}, "breakdown")).toBeNull();
  });
});
