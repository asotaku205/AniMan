import {
  BIBLE_KIND_LABEL,
  orderScenes,
  sortByOrder,
  type NovelExportData,
} from "./novel";

/**
 * Xuất bản Novel Studio (N4): Markdown / HTML / DOCX từ cùng một mô hình
 * khối chung, để 3 định dạng không lệch nhau.
 *
 * Nội dung chính luôn là toàn bộ truyện theo thứ tự kể (chương rồi cảnh,
 * trang trái rồi trang phải). Dàn ý Snowflake + phụ lục sổ tay là tuỳ chọn.
 * Văn bản trang viết là text thuần (innerText) nên mỗi dòng không rỗng
 * thành một đoạn — giữ nguyên ngắt đoạn của tác giả, bỏ dòng trống thừa.
 */

export type ExportFormat = "md" | "html" | "docx";

export const EXPORT_FORMAT_LABEL: Record<ExportFormat, string> = {
  md: "Markdown",
  html: "HTML",
  docx: "DOCX",
};

export interface ExportOptions {
  includeOutline: boolean;
  includeBible: boolean;
}

export type ExportBlock =
  | { type: "title"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string };

function paragraphs(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function exportBlocks(data: NovelExportData, options: ExportOptions): ExportBlock[] {
  const blocks: ExportBlock[] = [];
  const novel = data.novel;
  blocks.push({ type: "title", text: novel.title || "Tiểu thuyết không tên" });

  if (options.includeOutline) {
    blocks.push({ type: "h2", text: "Dàn ý" });
    if (novel.premise.trim()) blocks.push({ type: "p", text: novel.premise.trim() });
    for (const line of paragraphs(novel.summary)) blocks.push({ type: "p", text: line });
    for (const line of paragraphs(novel.outline)) blocks.push({ type: "p", text: line });
  }

  const chapters = sortByOrder(data.chapters);
  const orderedScenes = orderScenes(chapters, data.scenes);
  for (const chapter of chapters) {
    blocks.push({ type: "h2", text: chapter.title });
    for (const scene of orderedScenes.filter((sc) => sc.chapterId === chapter.id)) {
      blocks.push({ type: "h3", text: scene.title });
      for (const line of paragraphs(`${scene.contentLeft}\n${scene.contentRight}`)) {
        blocks.push({ type: "p", text: line });
      }
    }
  }

  if (options.includeBible && data.entities.length > 0) {
    blocks.push({ type: "h2", text: "Sổ tay" });
    for (const kind of ["character", "place", "item"] as const) {
      const list = data.entities.filter((e) => e.kind === kind);
      if (list.length === 0) continue;
      blocks.push({ type: "h3", text: BIBLE_KIND_LABEL[kind] });
      for (const e of list) {
        const detail = [e.role, e.description, e.traits, e.notes].filter(Boolean).join(" ");
        blocks.push({ type: "p", text: detail ? `${e.name}: ${detail}` : e.name });
      }
    }
  }
  return blocks;
}

export function buildMarkdown(data: NovelExportData, options: ExportOptions): string {
  return exportBlocks(data, options)
    .map((b) => {
      if (b.type === "title") return `# ${b.text}`;
      if (b.type === "h2") return `## ${b.text}`;
      if (b.type === "h3") return `### ${b.text}`;
      return b.text;
    })
    .join("\n\n") + "\n";
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildHtml(data: NovelExportData, options: ExportOptions): string {
  const body = exportBlocks(data, options)
    .map((b) => {
      const text = escapeHtml(b.text);
      if (b.type === "title") return `<h1>${text}</h1>`;
      if (b.type === "h2") return `<h2>${text}</h2>`;
      if (b.type === "h3") return `<h3>${text}</h3>`;
      return `<p>${text}</p>`;
    })
    .join("\n");
  const title = escapeHtml(data.novel.title || "Tiểu thuyết không tên");
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
body { font-family: Georgia, serif; line-height: 1.8; color: #1f130a; background: #f5eedb; margin: 0; padding: 2rem 1rem; }
main { max-width: 720px; margin: 0 auto; }
h1 { text-align: center; }
h2 { margin-top: 2.5rem; }
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
}

/** Tên file an toàn từ tiêu đề truyện. */
export function exportFileName(title: string, format: ExportFormat): string {
  const slug = (title || "tieu-thuyet")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "tieu-thuyet";
  return `${slug}.${format}`;
}
