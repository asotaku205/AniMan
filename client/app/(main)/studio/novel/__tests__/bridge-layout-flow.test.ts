import { describe, expect, it, vi } from "vitest";

vi.mock("../../manga-ai/lib/mangaStorage", () => ({
  saveProjectToDB: vi.fn().mockResolvedValue(undefined),
  savePageDrawingToDB: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../manga-ai/lib/panelPlans", () => ({
  savePanelPlans: vi.fn().mockResolvedValue(undefined),
}));

import { saveProjectToDB, savePageDrawingToDB } from "../../manga-ai/lib/mangaStorage";
import { savePanelPlans } from "../../manga-ai/lib/panelPlans";
import {
  changePlanPageLayout,
  planPagesFromBreakdown,
} from "../lib/novelBridge";
import { createMangaProjectFromPlan } from "../lib/bridgeActions";

function breakdown() {
  return {
    pages: [
      {
        layout: "classic-5" as const,
        panels: [1, 2, 3, 4, 5].map((n) => ({
          prompt: `Khung ${n}`,
          sceneType: "action" as const,
          dialogue: n === 2 ? ["Chuyen cuoi..."] : [],
          note: "",
        })),
      },
    ],
  };
}

describe("bridge layout flow", () => {
  it("layout chon o ke hoach di dung vao du an + ban ve tung trang", async () => {
    const pages = planPagesFromBreakdown(breakdown(), "Canh 1");
    const changed = changePlanPageLayout(pages, 0, "splash-3");
    expect(changed).toHaveLength(2);
    const created = await createMangaProjectFromPlan(
      "Truyen test",
      "",
      "Action",
      changed,
    );
    expect(created.pageCount).toBe(2);
    const savedProject = (saveProjectToDB as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0] as {
      pages: { pageNumber: number; layoutId: string }[];
    };
    expect(savedProject.pages).toEqual([
      { pageNumber: 1, layoutId: "splash-3", panels: {} },
      { pageNumber: 2, layoutId: "splash-3", panels: {} },
    ]);
    const drawingCalls = (savePageDrawingToDB as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(drawingCalls).toHaveLength(2);
    expect(drawingCalls[0][3]).toBe("splash-3");
    expect(drawingCalls[1][3]).toBe("splash-3");
    const planCalls = (savePanelPlans as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(planCalls).toHaveLength(2);
    expect(Object.keys(planCalls[0][2] as object)).toEqual(["p1", "p2", "p3"]);
    expect(Object.keys(planCalls[1][2] as object)).toEqual(["p1", "p2"]);
  });
});
