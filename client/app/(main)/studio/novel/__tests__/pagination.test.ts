import { describe, expect, it } from "vitest";
import {
  joinSceneText,
  paginateTextToFit,
} from "../lib/pagination";

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

describe("paginateTextToFit", () => {
  it("van ban rong tra ve mot trang trong", () => {
    expect(paginateTextToFit("", () => true)).toEqual([""]);
  });

  it("giu nguyen tung ky tu va noi dung lien mach giua cac trang", () => {
    const text = "  Mây  trôi\n\nqua phố.\tMai đến!  ";
    const pages = paginateTextToFit(text, (candidate) => candidate.length <= 12);
    expect(pages.join("")).toBe(text);
    expect(pages.every((page) => page.length <= 12)).toBe(true);
  });

  it("ngat theo tu neu co the va cat tu dai theo code point neu can", () => {
    const words = paginateTextToFit("xin chào thế giới", (candidate) => candidate.length <= 8);
    expect(words.join("")).toBe("xin chào thế giới");
    expect(words).toEqual(["xin chào", " thế ", "giới"]);

    const longWord = paginateTextToFit("maytrang", (candidate) => candidate.length <= 4);
    expect(longWord.join("")).toBe("maytrang");
  });

  it("cat theo ky tu khi mot tu dai hon suc chua trang", () => {
    const pages = paginateTextToFit("abcdefghijkl", (candidate) => candidate.length <= 5);
    expect(pages).toEqual(["abcde", "fghij", "kl"]);
  });
});
