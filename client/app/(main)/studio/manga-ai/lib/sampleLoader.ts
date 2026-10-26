/**
 * Loader dự án mẫu cho Manga Studio ("Mở dự án mẫu").
 *
 * Luồng: đọc file JSON mẫu trong public/samples, kiểm tra chặt, rồi tạo
 * BẢN COPY mới (mã mới) vào IndexedDB. Không bao giờ ghi đè, sửa hay xóa
 * dự án có sẵn của người dùng. Chỉ tạo thêm bản ghi mới.
 *
 * Mẫu gồm 1 dự án 48 trang, khung classic-5, lời thoại đã đặt sẵn theo
 * khung (vị trí chữ là vị trí mặc định để bắt đầu, kéo thả trong panel
 * để sắp lại). Tranh vẽ để trống đúng theo quy tắc sản xuất: trang art
 * phải vẽ trong panel của web, không nhập tranh làm sẵn.
 *
 * Mảnh nhấn trong lời kể (loại narration) chỉ ghi trong JSON mẫu, không
 * nhập làm chữ lồng tiếng vì nó không phải chữ trong khung hình.
 *
 * Lưu ý: hàm lưu trang của mangaStorage nuốt lỗi, nên import kiểm tra
 * lại bằng cách đọc lại toàn bộ trang vừa ghi; thiếu trang nào thì báo
 * lỗi để nơi gọi hiển thị trong hộp thoại.
 */

import type {
  MangaProject,
  MangaProjectPage,
} from "../hooks/useMangaProjects";
import { createDefaultPanelStack } from "../data";
import {
  DEFAULT_TEXT_STYLE,
  type PanelTextItems,
  type TextItem,
} from "./textItems";
import {
  getAllProjectsFromDB,
  getPageDrawingRecordFromDB,
  makePageKey,
  PAGE_DRAWING_SCHEMA_VERSION,
  savePageDrawingToDB,
  saveProjectToDB,
  type StoredPageDrawing,
} from "./mangaStorage";

export type MangaSampleLineKind =
  | "spoken"
  | "inner"
  | "written"
  | "sfx"
  | "narration";

export interface MangaSampleLine {
  kind: MangaSampleLineKind;
  /** Người nói; null = chưa rõ người nói, nhập chữ không kèm tên. */
  speaker?: string | null;
  /** Nguồn chữ viết (Chữ trong sổ, mẩu giấy...). */
  source?: string;
  text: string;
}

export interface MangaSamplePanel {
  number: number;
  shot: string;
  visual: string;
  lines: MangaSampleLine[];
}

export interface MangaSamplePage {
  number: number;
  title: string;
  panels: MangaSamplePanel[];
}

export interface MangaSampleChapter {
  number: number;
  title: string;
  pages: MangaSamplePage[];
}

export interface MangaSample {
  format: "animan-manga-sample";
  version: 1;
  title: string;
  genre: string;
  description: string;
  chapters: MangaSampleChapter[];
}

/** Cấu trúc cố định của bản mẫu này (lệch là file mẫu đã hỏng). */
export const SAMPLE_MANGA_CHAPTER_COUNT = 8;
export const SAMPLE_MANGA_PAGES_PER_CHAPTER = 6;
export const SAMPLE_MANGA_PANELS_PER_PAGE = 5;
export const SAMPLE_MANGA_LAYOUT_ID = "classic-5";
const SAMPLE_PANEL_IDS = ["p1", "p2", "p3", "p4", "p5"];

const LINE_KINDS: ReadonlySet<string> = new Set([
  "spoken",
  "inner",
  "written",
  "sfx",
  "narration",
]);

let sampleProjectCounter = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function needText(
  record: Record<string, unknown>,
  field: string,
  where: string,
): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`File mẫu không hợp lệ (thiếu ${field} ở ${where}).`);
  }
  return value;
}

function needSpeaker(
  record: Record<string, unknown>,
  where: string,
): string | null {
  const value = record.speaker;
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() !== "") return value;
  throw new Error(`File mẫu không hợp lệ (người nói sai ở ${where}).`);
}

function parseLine(item: unknown, where: string): MangaSampleLine {
  if (!isRecord(item)) {
    throw new Error(`File mẫu không hợp lệ (dòng thoại ở ${where} sai dạng).`);
  }
  const kind = item.kind;
  if (typeof kind !== "string" || !LINE_KINDS.has(kind)) {
    throw new Error(`File mẫu không hợp lệ (loại dòng sai ở ${where}).`);
  }
  const text = needText(item, "text", where);
  if (kind === "spoken" || kind === "inner") {
    return { kind, speaker: needSpeaker(item, where), text };
  }
  if (kind === "written") {
    return { kind, source: needText(item, "source", where), text };
  }
  return { kind: kind as MangaSampleLineKind, text };
}

function parsePanel(item: unknown, where: string): MangaSamplePanel {
  if (!isRecord(item)) {
    throw new Error(`File mẫu không hợp lệ (khung ở ${where} sai dạng).`);
  }
  const number = item.number;
  if (typeof number !== "number" || !Number.isInteger(number)) {
    throw new Error(`File mẫu không hợp lệ (thiếu số khung ở ${where}).`);
  }
  if (typeof item.visual !== "string") {
    throw new Error(`File mẫu không hợp lệ (thiếu mô tả khung ở ${where}).`);
  }
  if (!Array.isArray(item.lines)) {
    throw new Error(`File mẫu không hợp lệ (thiếu dòng thoại ở ${where}).`);
  }
  return {
    number,
    shot: needText(item, "shot", where),
    visual: item.visual,
    lines: item.lines.map((l, i) => parseLine(l, `${where}, dòng số ${i + 1}`)),
  };
}

function parsePage(item: unknown, where: string): MangaSamplePage {
  if (!isRecord(item)) {
    throw new Error(`File mẫu không hợp lệ (trang ở ${where} sai dạng).`);
  }
  const number = item.number;
  if (typeof number !== "number" || !Number.isInteger(number)) {
    throw new Error(`File mẫu không hợp lệ (thiếu số trang ở ${where}).`);
  }
  if (!Array.isArray(item.panels)) {
    throw new Error(`File mẫu không hợp lệ (thiếu khung ở ${where}).`);
  }
  if (item.panels.length !== SAMPLE_MANGA_PANELS_PER_PAGE) {
    throw new Error(
      `File mẫu không hợp lệ (trang ở ${where} cần đúng ${SAMPLE_MANGA_PANELS_PER_PAGE} khung).`,
    );
  }
  return {
    number,
    title: needText(item, "title", where),
    panels: item.panels.map((p, i) =>
      parsePanel(p, `${where}, khung số ${i + 1}`),
    ),
  };
}

/**
 * Kiểm tra + bóc file JSON mẫu manga. Ném Error tiếng Việt khi sai dạng.
 * Yêu cầu đúng 8 chương, mỗi chương 6 trang, mỗi trang 5 khung.
 */
export function parseMangaSample(raw: unknown): MangaSample {
  if (!isRecord(raw)) {
    throw new Error("File mẫu không phải định dạng manga mẫu.");
  }
  if (raw.format !== "animan-manga-sample") {
    throw new Error("File mẫu không phải định dạng manga mẫu.");
  }
  if (raw.version !== 1) {
    throw new Error(
      `Phiên bản file mẫu (${String(raw.version)}) chưa được hỗ trợ.`,
    );
  }
  const title = needText(raw, "title", "manga mẫu");
  const genre = needText(raw, "genre", "manga mẫu");
  const description = needText(raw, "description", "manga mẫu");
  if (!Array.isArray(raw.chapters)) {
    throw new Error("File mẫu không hợp lệ (thiếu danh sách chương).");
  }
  if (raw.chapters.length !== SAMPLE_MANGA_CHAPTER_COUNT) {
    throw new Error(
      `File mẫu không hợp lệ (cần đúng ${SAMPLE_MANGA_CHAPTER_COUNT} chương, thấy ${raw.chapters.length}).`,
    );
  }
  const chapters: MangaSampleChapter[] = raw.chapters.map((item, ci) => {
    const where = `chương số ${ci + 1}`;
    if (!isRecord(item)) {
      throw new Error(`File mẫu không hợp lệ (chương ở ${where} sai dạng).`);
    }
    if (item.number !== ci + 1) {
      throw new Error(`File mẫu không hợp lệ (số chương sai ở ${where}).`);
    }
    if (!Array.isArray(item.pages)) {
      throw new Error(`File mẫu không hợp lệ (thiếu trang ở ${where}).`);
    }
    if (item.pages.length !== SAMPLE_MANGA_PAGES_PER_CHAPTER) {
      throw new Error(
        `File mẫu không hợp lệ (chương ở ${where} cần đúng ${SAMPLE_MANGA_PAGES_PER_CHAPTER} trang).`,
      );
    }
    return {
      number: ci + 1,
      title: needText(item, "title", where),
      pages: item.pages.map((p, pi) =>
        parsePage(p, `${where}, trang số ${pi + 1}`),
      ),
    };
  });
  return {
    format: "animan-manga-sample",
    version: 1,
    title,
    genre,
    description,
    chapters,
  };
}

/** Chữ hiển thị trong khung từ một dòng kịch bản (kèm tên người nói khi rõ). */
export function lineDisplayText(line: MangaSampleLine): string {
  if (line.kind === "spoken") {
    return line.speaker ? `${line.speaker}: ${line.text}` : line.text;
  }
  if (line.kind === "inner") {
    return line.speaker
      ? `${line.speaker} (nội tâm): ${line.text}`
      : `(nội tâm): ${line.text}`;
  }
  if (line.kind === "written") {
    return `${line.source}: ${line.text}`;
  }
  return line.text;
}

function lineToTextItem(
  line: MangaSampleLine,
  id: string,
  x: number,
  y: number,
): TextItem {
  const base = {
    id,
    x,
    y,
    w: 0.8,
    text: lineDisplayText(line),
    ...DEFAULT_TEXT_STYLE,
  };
  if (line.kind === "sfx") {
    return { ...base, fontScale: 0.085, fontWeight: 900 };
  }
  if (line.kind === "inner") {
    return { ...base, fontScale: 0.055, italic: true };
  }
  if (line.kind === "written") {
    return { ...base, fontScale: 0.055, italic: true, fontWeight: 400 };
  }
  return { ...base, fontScale: 0.055 };
}

export interface MangaSampleRecords {
  project: MangaProject;
  pageDrawings: StoredPageDrawing[];
}

/**
 * Dựng bản ghi dự án + trang vẽ từ mẫu đã kiểm tra. Trang vẽ dùng khung
 * classic-5 với ngăn xếp mặc định (chưa có nét vẽ), chữ đặt sẵn theo
 * khung, vị trí mặc định xếp từ trên xuống trong từng khung.
 */
export function buildMangaRecords(
  sample: MangaSample,
  now: number,
): MangaSampleRecords {
  const projectId = `proj-${now}-${sampleProjectCounter++}`;
  const flatPages: MangaSamplePage[] = sample.chapters.flatMap((c) => c.pages);
  const pages: MangaProjectPage[] = flatPages.map((_, index) => ({
    pageNumber: index + 1,
    layoutId: SAMPLE_MANGA_LAYOUT_ID,
    panels: {},
  }));
  const project: MangaProject = {
    id: projectId,
    title: sample.title,
    genre: sample.genre,
    description: sample.description,
    createdAt: now,
    updatedAt: now,
    status: "draft",
    pages,
  };
  const pageDrawings: StoredPageDrawing[] = flatPages.map((page, index) => {
    const pageNumber = index + 1;
    const stacks: StoredPageDrawing["stacks"] = {};
    for (const panelId of SAMPLE_PANEL_IDS) {
      stacks[panelId] = createDefaultPanelStack(panelId);
    }
    const texts: PanelTextItems = {};
    for (const panel of page.panels) {
      const panelId = `p${panel.number}`;
      const imported = panel.lines.filter((l) => l.kind !== "narration");
      texts[panelId] = imported.map((line, lineIndex) => {
        const y =
          imported.length <= 1
            ? 0.06
            : 0.06 + lineIndex * (0.88 / imported.length);
        return lineToTextItem(
          line,
          `txt-${pageNumber}-${panelId}-${lineIndex}`,
          0.1,
          y,
        );
      });
    }
    return {
      id: makePageKey(projectId, pageNumber),
      schemaVersion: PAGE_DRAWING_SCHEMA_VERSION,
      projectId,
      pageNumber,
      layoutId: SAMPLE_MANGA_LAYOUT_ID,
      stacks,
      panels: {},
      texts,
      updatedAt: now,
    };
  });
  return { project, pageDrawings };
}

/**
 * Nhập mẫu thành bản copy mới trong IndexedDB (mã mới, không đè bản cũ),
 * rồi đọc lại để chắc chắn toàn bộ trang đã ghi được.
 */
export async function importMangaSample(
  sample: MangaSample,
): Promise<MangaSampleRecords> {
  const records = buildMangaRecords(sample, Date.now());
  await saveProjectToDB(records.project);
  for (const drawing of records.pageDrawings) {
    await savePageDrawingToDB(
      drawing.projectId,
      drawing.pageNumber,
      drawing.stacks ?? {},
      drawing.layoutId,
      drawing.panels,
      drawing.texts,
    );
  }
  const projects = await getAllProjectsFromDB();
  if (!projects.some((p) => p.id === records.project.id)) {
    throw new Error("Không lưu được dự án mẫu.");
  }
  for (const drawing of records.pageDrawings) {
    const back = await getPageDrawingRecordFromDB(
      drawing.projectId,
      drawing.pageNumber,
    );
    if (!back) {
      throw new Error(
        `Không lưu được trang mẫu số ${drawing.pageNumber}.`,
      );
    }
  }
  return records;
}
