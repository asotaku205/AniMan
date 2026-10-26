/**
 * Phan trang che do Quyen sach (Novel Studio).
 *
 * Khung trang co dinh: trai giay rong 576px (nua trai max-w-6xl), padding
 * p-10 hai ben nen vung chu rong 496px; ti le 3/4 nen khung cao 768px,
 * vung chu cao 688px. So dong va so chu moi trang duoc tinh tu khung nay
 * voi co chu va gian dong hien tai, chu khong ghi cung mot con so.
 */

export const PAGE_CONTENT_WIDTH = 496;
export const PAGE_CONTENT_HEIGHT = 688;

const FONT_PX = { sm: 16, md: 18, lg: 20, xl: 24 } as const;
const LINE_H = { normal: 1.6, relaxed: 1.8, loose: 2.1 } as const;
/** Be rong trung binh cua mot ky tu tieng Viet o font ti le (~0.5em). */
const AVG_CHAR_EM = 0.5;

export type NovelFontSize = keyof typeof FONT_PX;
export type NovelLineHeight = keyof typeof LINE_H;

export interface PageMetrics {
  charsPerLine: number;
  linesPerPage: number;
  charsPerPage: number;
}

export function pageMetrics(
  fontSize: NovelFontSize,
  lineHeight: NovelLineHeight,
): PageMetrics {
  const px = FONT_PX[fontSize];
  const lhPx = px * LINE_H[lineHeight];
  const charsPerLine = Math.max(
    10,
    Math.floor(PAGE_CONTENT_WIDTH / (AVG_CHAR_EM * px)),
  );
  const linesPerPage = Math.max(
    1,
    Math.floor(PAGE_CONTENT_HEIGHT / lhPx),
  );
  return { charsPerLine, linesPerPage, charsPerPage: charsPerLine * linesPerPage };
}

/**
 * Ghep chu cua mot canh (truong trai + truong phai) thanh van ban doc lien
 * mach. Moi noi chi them mot khoang trang khi ca hai phia deu khong co
 * khoang trang, de khong dinh hai tu lai voi nhau.
 */
export function joinSceneText(left: string, right: string): string {
  if (!left) return right;
  if (!right) return left;
  const needsSpace = !/\s$/.test(left) && !/^\s/.test(right);
  return left + (needsSpace ? " " : "") + right;
}

/**
 * Chia van ban thanh cac trang. Moi dong khong vuot qua charsPerLine ky tu
 * (ngat theo tu, tu qua dai thi cat cung theo ky tu); moi trang khong vuot
 * qua linesPerPage dong; doan van (xuống dong) duoc giu nguyen thanh dong
 * trong. Van ban rong tra ve mot trang trong.
 */
export function paginateText(
  text: string,
  charsPerLine: number,
  linesPerPage: number,
): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    if (para === "") {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/).filter(Boolean);
    let cur = "";
    for (const word of words) {
      let rest = word;
      while (rest.length > 0) {
        if (cur === "") {
          if (rest.length <= charsPerLine) {
            cur = rest;
            rest = "";
          } else {
            lines.push(rest.slice(0, charsPerLine));
            rest = rest.slice(charsPerLine);
          }
        } else if (cur.length + 1 + rest.length <= charsPerLine) {
          cur += ` ${rest}`;
          rest = "";
        } else {
          lines.push(cur);
          cur = "";
        }
      }
    }
    if (cur !== "") lines.push(cur);
  }
  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage).join("\n"));
  }
  return pages.length > 0 ? pages : [""];
}
