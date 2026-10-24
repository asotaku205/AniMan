import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { exportBlocks, type ExportOptions } from "./novelExport";
import type { NovelExportData } from "./novel";

/** Xuất DOCX (N4) từ cùng mô hình khối với Markdown/HTML. */
export async function buildDocxBlob(
  data: NovelExportData,
  options: ExportOptions,
): Promise<Blob> {
  const children = exportBlocks(data, options).map((b) => {
    if (b.type === "title") {
      return new Paragraph({ text: b.text, heading: HeadingLevel.TITLE });
    }
    if (b.type === "h2") {
      return new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_1 });
    }
    if (b.type === "h3") {
      return new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_2 });
    }
    return new Paragraph({ children: [new TextRun(b.text)] });
  });
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}
