import { describe, expect, it } from "vitest";
import {
  joinSceneText,
  pageMetrics,
  paginateText,
} from "../lib/pagination";

describe("pageMetrics", () => {
  it("mac dinh xl/relaxed: 41 chu mot dong, 15 dong mot trang, 615 chu mot trang", () => {
    expect(pageMetrics("xl", "relaxed")).toEqual({
      charsPerLine: 41,
      linesPerPage: 15,
      charsPerPage: 615,
    });
  });

  it("chu nho sm/normal chua duoc nhieu nhat", () => {
    expect(pageMetrics("sm", "normal")).toEqual({
      charsPerLine: 62,
      linesPerPage: 26,
      charsPerPage: 1612,
    });
  });

  it("chu lon nhat xl/loose chua duoc it nhat", () => {
    expect(pageMetrics("xl", "loose")).toEqual({
      charsPerLine: 41,
      linesPerPage: 13,
      charsPerPage: 533,
    });
  });
});

describe("joinSceneText", () => {
  it("ghep hai phia, them khoang trang khi moi noi khong co khoang trang", () => {
    expect(joinSceneText("Mai di", "ve nha")).toBe("Mai di ve nha");
  });

  it("khong them khoang trang thua khi phia trai da co khoang trang", () => {
    expect(joinSceneText("Mai di ", "ve nha")).toBe("Mai di ve nha");
  });

  it("mot phia trong thi tra ve phia con lai", () => {
    expect(joinSceneText("", "abc")).toBe("abc");
    expect(joinSceneText("abc", "")).toBe("abc");
  });
});

describe("paginateText", () => {
  it("van ban rong tra ve mot trang trong", () => {
    expect(paginateText("", 10, 5)).toEqual([""]);
  });

  it("khong dong nao vuot qua gioi han chu, khong trang nao vuot qua gioi han dong", () => {
    const text = Array.from({ length: 40 }, (_, i) => `tu${i} abcdef`).join(" ");
    const pages = paginateText(text, 20, 4);
    for (const page of pages) {
      const lines = page.split("\n");
      expect(lines.length).toBeLessThanOrEqual(4);
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(20);
      }
    }
    expect(pages.join("\n")).toContain("tu0");
    expect(pages.join("\n")).toContain("tu39");
  });

  it("giu doan van thanh dong trong", () => {
    const pages = paginateText("doan mot\n\ndoann hai", 50, 10);
    expect(pages).toEqual(["doan mot\n\ndoann hai"]);
  });

  it("tu dai hon dong bi cat cung theo ky tu, khong lam vo trang", () => {
    const pages = paginateText("a".repeat(25), 10, 5);
    expect(pages).toEqual(["aaaaaaaaaa\naaaaaaaaaa\naaaaa"]);
  });

  it("chia dung so trang theo so dong", () => {
    const text = Array.from({ length: 12 }, (_, i) => `dong${i}`).join("\n");
    const pages = paginateText(text, 50, 5);
    expect(pages).toHaveLength(3);
    expect(pages[2]).toBe("dong10\ndong11");
  });
});
