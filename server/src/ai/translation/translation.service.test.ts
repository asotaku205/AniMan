import { describe, expect, it } from "vitest";
import {
  buildTranslationPrompt,
  parseTranslationResponse,
} from "./translation.service.js";

describe("buildTranslationPrompt — ngữ cảnh đầy đủ", () => {
  it("prompt chứa cảnh, ghi chú, glossary và đủ dòng thoại", () => {
    const { systemInstruction, userPrompt } = buildTranslationPrompt({
      targetLang: "en",
      sceneName: "Ga tàu lúc hoàng hôn",
      sceneNote: "Hai người bạn sắp chia tay",
      glossary: "Haru = tên riêng, giữ nguyên",
      lines: [
        { id: "d1", text: "Tớ phải đi rồi.", speaker: "Haru" },
        { id: "d2", text: "Đừng quên tớ nhé." },
      ],
    });
    expect(systemInstruction).toContain("English");
    expect(systemInstruction).toContain("Do NOT add, drop, merge or reorder");
    expect(userPrompt).toContain("Ga tàu lúc hoàng hôn");
    expect(userPrompt).toContain("Haru = tên riêng");
    expect(userPrompt).toContain('"id": "d1"');
    expect(userPrompt).toContain('"id": "d2"');
  });
});

describe("parseTranslationResponse — kiểm tra đáp án model", () => {
  it("chấp nhận đủ id đúng thứ tự kỳ vọng; từ chối thiếu dòng/rỗng", () => {
    const ok = parseTranslationResponse(
      {
        translations: [
          { id: "d2", text: "Don't forget me." },
          { id: "d1", text: "I have to go now." },
        ],
      },
      ["d1", "d2"],
    );
    expect(ok?.map((t) => t.id)).toEqual(["d1", "d2"]);
    expect(
      parseTranslationResponse({ translations: [{ id: "d1", text: "x" }] }, ["d1", "d2"]),
    ).toBeNull();
    expect(
      parseTranslationResponse({ translations: [{ id: "d1", text: " " }] }, ["d1"]),
    ).toBeNull();
    expect(parseTranslationResponse("nope", ["d1"])).toBeNull();
  });
});
