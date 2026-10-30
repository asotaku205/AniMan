import { describe, expect, it } from "vitest";
import type { AnimProject } from "../../animation/lib/animProject";
import {
  changePlanPageLayout,
  cuesForAnimProject,
  mangaPageTexts,
  mangaPlanPageTexts,
  pagesForAnimProject,
  pagesForPanels,
  panelDraftForAnimScene,
  panelDraftsForText,
  planPagesFromBreakdown,
} from "../lib/novelBridge";

describe("novelBridge — panel nháp từ văn bản", () => {
  it("tách thoại khỏi phần kể, panel thuần thoại vẫn giữ", () => {
    const text = [
      "Haru đứng ở sân ga, nhìn đoàn tàu xa dần. “Tớ phải đi rồi.”",
      "“Đừng quên tớ nhé.”",
    ].join("\n\n");
    const panels = panelDraftsForText(text);
    expect(panels).toHaveLength(2);
    expect(panels[0].narration).toContain("sân ga");
    expect(panels[0].narration).not.toContain("Tớ phải đi rồi");
    expect(panels[0].dialogues).toEqual(["Tớ phải đi rồi."]);
    expect(panels[1].narration).toBe("");
    expect(panels[1].dialogues).toEqual(["Đừng quên tớ nhé."]);
  });

  it("gom tối đa 5 panel/trang", () => {
    const panels = Array.from({ length: 6 }, (_, i) => ({
      narration: `Kể ${i}`,
      dialogues: [],
    }));
    const pages = pagesForPanels(panels);
    expect(pages).toHaveLength(2);
    expect(pages[0].panels).toHaveLength(5);
    expect(pages[1].panels).toHaveLength(1);
  });

  it("khối chữ trang: phần kể trên, thoại dưới, đúng panel", () => {
    const texts = mangaPageTexts(
      {
        panels: [
          { narration: "Mưa rơi.", dialogues: ["Đi thôi."] },
          { narration: "", dialogues: ["Ừ."] },
        ],
      },
      1,
    );
    expect(texts.p1).toHaveLength(2);
    expect(texts.p1[0].text).toBe("Mưa rơi.");
    expect(texts.p1[1].text).toBe("Đi thôi.");
    expect(texts.p2).toHaveLength(1);
    expect(texts.p2[0].text).toBe("Ừ.");
  });
});

describe("novelBridge — cầu nối từ dự án Animation", () => {
  it("cảnh trống bị bỏ, cảnh có thoại thành 1 panel", () => {
    const project = {
      scenes: [
        { note: "Sáng sớm. “Chào cậu.”", dialogue: [{ text: "Chào cậu." }] },
        { note: "", dialogue: [] },
      ],
    } as unknown as AnimProject;
    const pages = pagesForAnimProject(project);
    expect(pages).toHaveLength(1);
    expect(pages[0].panels).toHaveLength(1);
    expect(pages[0].panels[0].narration).toBe("Sáng sớm.");
    expect(pages[0].panels[0].dialogues).toEqual(["Chào cậu."]);
    expect(panelDraftForAnimScene({ note: "", dialogue: [] })).toBeNull();
  });

  it("cue dịch nối tiếp theo thứ tự cảnh → thoại", () => {
    const project = {
      scenes: [
        {
          dialogue: [
            { text: "Một.", durationSec: 2 },
            { text: "Hai.", durationSec: 2 },
          ],
        },
        { dialogue: [{ text: "Ba.", durationSec: 3 }] },
      ],
    } as unknown as AnimProject;
    const cues = cuesForAnimProject(project, "ep-1");
    expect(cues).toHaveLength(3);
    expect(cues[0].startSec).toBe(0);
    expect(cues[0].sourceText).toBe("Một.");
    expect(cues[0].text).toBe("Một.");
    expect(cues[1].startSec).toBeGreaterThan(cues[0].startSec);
    expect(cues[2].startSec).toBeGreaterThan(cues[1].startSec);
    expect(cues.every((c) => c.episodeId === "ep-1")).toBe(true);
  });
});

describe("novelBridge  -  kế hoạch từ AI phân tích (cầu nối Novel -> Manga)", () => {
  function breakdown() {
    return {
      pages: [
        {
          layout: "classic-5" as const,
          panels: [
            { prompt: "Ga lúc hoàng hôn.", sceneType: "wide" as const, dialogue: [], note: "Mở đầu rộng." },
            { prompt: "Aoi nhìn bảng giờ.", sceneType: "closeup" as const, dialogue: ["Chuyến cuối..."], note: "" },
            { prompt: "Tay Aoi nắm vé.", sceneType: "closeup" as const, dialogue: [], note: "" },
            { prompt: "Tàu vào ga.", sceneType: "action" as const, dialogue: [], note: "" },
            { prompt: "Aoi lên tàu.", sceneType: "action" as const, dialogue: ["Đi thôi."], note: "" },
          ],
        },
      ],
    };
  }

  it("giữ layout AI gợi ý, gắn tên cảnh nguồn cho từng khung", () => {
    const pages = planPagesFromBreakdown(breakdown(), "Cảnh 1: Buổi sáng");
    expect(pages).toHaveLength(1);
    expect(pages[0].layoutId).toBe("classic-5");
    expect(pages[0].plans).toHaveLength(5);
    expect(pages[0].plans[1].sourceSceneTitle).toBe("Cảnh 1: Buổi sáng");
    expect(pages[0].plans[1].dialogue).toEqual(["Chuyến cuối..."]);
  });

  it("đổi layout nhỏ hơn thì khung thừa dồn sang trang mới, không mất khung", () => {
    const pages = planPagesFromBreakdown(breakdown(), "Cảnh 1");
    const next = changePlanPageLayout(pages, 0, "splash-3");
    expect(next).toHaveLength(2);
    expect(next[0].plans).toHaveLength(3);
    expect(next[0].layoutId).toBe("splash-3");
    expect(next[1].plans).toHaveLength(2);
    expect(next[1].sourceSceneTitle).toBe("Cảnh 1");
    expect(next.flatMap((pg) => pg.plans)).toHaveLength(5);
  });

  it("khối chữ trang kế hoạch chỉ có thoại, không có phần kể hay ghi chú", () => {
    const pages = planPagesFromBreakdown(breakdown(), "Cảnh 1");
    const texts = mangaPlanPageTexts(pages[0], 1);
    expect(texts.p1).toBeUndefined();
    expect(texts.p2).toHaveLength(1);
    expect(texts.p2[0].text).toBe("Chuyến cuối...");
    expect(texts.p5).toHaveLength(1);
    expect(texts.p5[0].text).toBe("Đi thôi.");
  });
});
