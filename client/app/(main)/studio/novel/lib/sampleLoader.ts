/**
 * Loader dự án mẫu cho Novel Studio ("Mở dự án mẫu").
 *
 * Luồng: đọc file JSON mẫu trong public/samples, kiểm tra chặt, rồi tạo
 * BẢN COPY mới (mã mới) vào IndexedDB. Không bao giờ ghi đè, sửa hay xóa
 * tiểu thuyết có sẵn của người dùng. Chỉ tạo thêm bản ghi mới.
 *
 * Mẫu gồm 2 lớp: lớp truyện (20 chương chép từ file production thật) và
 * lớp dàn ý (tuyến truyện, beat, cung nhân vật, câu hỏi, sổ tay, phiên bản)
 * dựng theo cốt truyện, để mở mẫu lên là thấy ngay cách dùng tính năng
 * dàn ý và tính năng viết. Beat, mốc cung và câu hỏi gắn cảnh bằng số
 * chương (1 là chương đầu tiên), cung gắn sổ tay bằng tên thực thể.
 *
 * Phần thuần (parse, build) không đụng storage nên test được trực tiếp.
 * Phần ghi (import) dùng đúng hàm lưu hiện có của novelStorage.
 */

import type {
  Beat,
  BeatKind,
  BibleEntity,
  BibleEntityKind,
  Chapter,
  CharacterArc,
  Novel,
  NovelExportData,
  NovelSnapshot,
  OpenQuestion,
  Plotline,
  Scene,
} from "./novel";
import {
  createArc,
  createBeat,
  createBibleEntity,
  createPlotline,
  createQuestion,
  createSnapshot,
  newNovelId,
  sceneWords,
} from "./novel";
import {
  saveArc,
  saveBeat,
  saveChapter,
  saveEntity,
  saveNovel,
  savePlotline,
  saveQuestion,
  saveScene,
  saveSnapshot,
} from "./novelStorage";

export interface NovelSampleChapter {
  order: number;
  title: string;
  synopsis: string;
  contentLeft: string;
  contentRight: string;
}

export interface NovelSampleBeat {
  title: string;
  kind: BeatKind;
  /** Số chương gắn beat (1 là chương đầu tiên). */
  sceneChapter: number;
}

export interface NovelSamplePlotline {
  title: string;
  color: string;
  beats: NovelSampleBeat[];
}

export interface NovelSampleMilestone {
  sceneChapter: number;
  note: string;
}

export interface NovelSampleArc {
  characterName: string;
  /** Tên thực thể sổ tay tương ứng, phải có trong mục entities của mẫu. */
  entityName: string;
  startState: string;
  endState: string;
  milestones: NovelSampleMilestone[];
}

export interface NovelSampleQuestion {
  question: string;
  plantedChapter: number;
  answeredChapter: number;
}

export interface NovelSampleEntity {
  kind: BibleEntityKind;
  name: string;
  role: string;
  description: string;
  traits: string;
  notes: string;
}

export interface NovelSampleSnapshot {
  name: string;
  note: string;
}

export interface NovelSample {
  format: "animan-novel-sample";
  version: 1;
  title: string;
  premise: string;
  summary: string;
  outline: string;
  chapters: NovelSampleChapter[];
  plotlines: NovelSamplePlotline[];
  arcs: NovelSampleArc[];
  questions: NovelSampleQuestion[];
  entities: NovelSampleEntity[];
  snapshot: NovelSampleSnapshot;
}

/** Số chương cố định của bản mẫu này (lệch là file mẫu đã hỏng). */
export const SAMPLE_NOVEL_CHAPTER_COUNT = 20;

const BEAT_KINDS: ReadonlySet<string> = new Set([
  "goal",
  "conflict",
  "turn",
  "result",
]);

const ENTITY_KINDS: ReadonlySet<string> = new Set([
  "character",
  "place",
  "item",
]);

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

function needChapterNumber(
  record: Record<string, unknown>,
  field: string,
  where: string,
): number {
  const value = record[field];
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > SAMPLE_NOVEL_CHAPTER_COUNT
  ) {
    throw new Error(
      `File mẫu không hợp lệ (${field} ở ${where} phải là chương từ 1 đến ${SAMPLE_NOVEL_CHAPTER_COUNT}).`,
    );
  }
  return value;
}

function needList(
  record: Record<string, unknown>,
  field: string,
  where: string,
): unknown[] {
  const value = record[field];
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`File mẫu không hợp lệ (thiếu ${field} ở ${where}).`);
  }
  return value;
}

function parseBeat(item: unknown, where: string): NovelSampleBeat {
  if (!isRecord(item)) {
    throw new Error(`File mẫu không hợp lệ (beat ở ${where} sai dạng).`);
  }
  const kind = item.kind;
  if (typeof kind !== "string" || !BEAT_KINDS.has(kind)) {
    throw new Error(`File mẫu không hợp lệ (loại beat sai ở ${where}).`);
  }
  return {
    title: needText(item, "title", where),
    kind: kind as BeatKind,
    sceneChapter: needChapterNumber(item, "sceneChapter", where),
  };
}

function parsePlotline(item: unknown, where: string): NovelSamplePlotline {
  if (!isRecord(item)) {
    throw new Error(`File mẫu không hợp lệ (tuyến truyện ở ${where} sai dạng).`);
  }
  const color = needText(item, "color", where);
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new Error(`File mẫu không hợp lệ (màu tuyến sai ở ${where}).`);
  }
  const beatsRaw = needList(item, "beats", where);
  return {
    title: needText(item, "title", where),
    color,
    beats: beatsRaw.map((b, i) => parseBeat(b, `${where}, beat số ${i + 1}`)),
  };
}

function parseArc(item: unknown, where: string): NovelSampleArc {
  if (!isRecord(item)) {
    throw new Error(`File mẫu không hợp lệ (cung nhân vật ở ${where} sai dạng).`);
  }
  const milestonesRaw = needList(item, "milestones", where);
  return {
    characterName: needText(item, "characterName", where),
    entityName: needText(item, "entityName", where),
    startState: needText(item, "startState", where),
    endState: needText(item, "endState", where),
    milestones: milestonesRaw.map((m, i) => {
      const at = `${where}, mốc số ${i + 1}`;
      if (!isRecord(m)) {
        throw new Error(`File mẫu không hợp lệ (mốc ở ${at} sai dạng).`);
      }
      return {
        sceneChapter: needChapterNumber(m, "sceneChapter", at),
        note: needText(m, "note", at),
      };
    }),
  };
}

function parseQuestion(item: unknown, where: string): NovelSampleQuestion {
  if (!isRecord(item)) {
    throw new Error(`File mẫu không hợp lệ (câu hỏi ở ${where} sai dạng).`);
  }
  const plantedChapter = needChapterNumber(item, "plantedChapter", where);
  const answeredChapter = needChapterNumber(item, "answeredChapter", where);
  if (answeredChapter <= plantedChapter) {
    throw new Error(
      `File mẫu không hợp lệ (câu hỏi ở ${where} trả lời trước khi cài cắm).`,
    );
  }
  return {
    question: needText(item, "question", where),
    plantedChapter,
    answeredChapter,
  };
}

function parseEntity(item: unknown, where: string): NovelSampleEntity {
  if (!isRecord(item)) {
    throw new Error(`File mẫu không hợp lệ (thực thể ở ${where} sai dạng).`);
  }
  const kind = item.kind;
  if (typeof kind !== "string" || !ENTITY_KINDS.has(kind)) {
    throw new Error(`File mẫu không hợp lệ (loại thực thể sai ở ${where}).`);
  }
  const textOrEmpty = (field: string): string => {
    const value = item[field];
    if (typeof value !== "string") {
      throw new Error(`File mẫu không hợp lệ (thiếu ${field} ở ${where}).`);
    }
    return value;
  };
  return {
    kind: kind as BibleEntityKind,
    name: needText(item, "name", where),
    role: textOrEmpty("role"),
    description: textOrEmpty("description"),
    traits: textOrEmpty("traits"),
    notes: textOrEmpty("notes"),
  };
}

/**
 * Kiểm tra + bóc file JSON mẫu novel. Ném Error tiếng Việt khi sai dạng.
 * Yêu cầu đúng 20 chương theo thứ tự, mọi beat, mốc, câu hỏi đều gắn
 * chương hợp lệ, mọi cung đều gắn thực thể có trong sổ tay mẫu.
 */
export function parseNovelSample(raw: unknown): NovelSample {
  if (!isRecord(raw)) {
    throw new Error("File mẫu không phải định dạng tiểu thuyết mẫu.");
  }
  if (raw.format !== "animan-novel-sample") {
    throw new Error("File mẫu không phải định dạng tiểu thuyết mẫu.");
  }
  if (raw.version !== 1) {
    throw new Error(
      `Phiên bản file mẫu (${String(raw.version)}) chưa được hỗ trợ.`,
    );
  }
  const title = needText(raw, "title", "tiểu thuyết mẫu");
  const premise = needText(raw, "premise", "tiểu thuyết mẫu");
  const summary = needText(raw, "summary", "tiểu thuyết mẫu");
  const outline = needText(raw, "outline", "tiểu thuyết mẫu");
  if (!Array.isArray(raw.chapters)) {
    throw new Error("File mẫu không hợp lệ (thiếu danh sách chương).");
  }
  if (raw.chapters.length !== SAMPLE_NOVEL_CHAPTER_COUNT) {
    throw new Error(
      `File mẫu không hợp lệ (cần đúng ${SAMPLE_NOVEL_CHAPTER_COUNT} chương, thấy ${raw.chapters.length}).`,
    );
  }
  const chapters: NovelSampleChapter[] = raw.chapters.map((item, index) => {
    const where = `chương số ${index + 1}`;
    if (!isRecord(item)) {
      throw new Error(`File mẫu không hợp lệ (chương ở ${where} sai dạng).`);
    }
    if (item.order !== index) {
      throw new Error(`File mẫu không hợp lệ (thứ tự chương sai ở ${where}).`);
    }
    return {
      order: index,
      title: needText(item, "title", where),
      synopsis: needText(item, "synopsis", where),
      contentLeft: needText(item, "contentLeft", where),
      contentRight: needText(item, "contentRight", where),
    };
  });
  const plotlines = needList(raw, "plotlines", "tiểu thuyết mẫu").map((p, i) =>
    parsePlotline(p, `tuyến truyện số ${i + 1}`),
  );
  const arcs = needList(raw, "arcs", "tiểu thuyết mẫu").map((a, i) =>
    parseArc(a, `cung nhân vật số ${i + 1}`),
  );
  const questions = needList(raw, "questions", "tiểu thuyết mẫu").map((q, i) =>
    parseQuestion(q, `câu hỏi số ${i + 1}`),
  );
  const entities = needList(raw, "entities", "tiểu thuyết mẫu").map((e, i) =>
    parseEntity(e, `thực thể số ${i + 1}`),
  );
  const entityNames = new Set(entities.map((e) => e.name));
  for (const arc of arcs) {
    if (!entityNames.has(arc.entityName)) {
      throw new Error(
        `File mẫu không hợp lệ (cung ${arc.characterName} gắn thực thể không có trong sổ tay mẫu).`,
      );
    }
  }
  if (!isRecord(raw.snapshot)) {
    throw new Error("File mẫu không hợp lệ (thiếu phiên bản mẫu).");
  }
  const snapshot: NovelSampleSnapshot = {
    name: needText(raw.snapshot, "name", "phiên bản mẫu"),
    note: needText(raw.snapshot, "note", "phiên bản mẫu"),
  };
  return {
    format: "animan-novel-sample",
    version: 1,
    title,
    premise,
    summary,
    outline,
    chapters,
    plotlines,
    arcs,
    questions,
    entities,
    snapshot,
  };
}

export interface NovelSampleRecords {
  novel: Novel;
  chapters: Chapter[];
  scenes: Scene[];
  plotlines: Plotline[];
  beats: Beat[];
  arcs: CharacterArc[];
  questions: OpenQuestion[];
  entities: BibleEntity[];
  snapshot: NovelSnapshot;
}

/**
 * Dựng bản ghi novel, chương, cảnh, dàn ý từ mẫu đã kiểm tra. Mỗi chương
 * thành đúng 1 cảnh (trải giấy 2 trang: nửa đầu bên trái, nửa sau bên
 * phải), trạng thái "done" vì bản mẫu đã viết xong. Phiên bản mẫu chụp
 * đúng dữ liệu vừa dựng để người dùng xem và khôi phục được ngay.
 */
export function buildNovelRecords(
  sample: NovelSample,
  now: number,
): NovelSampleRecords {
  const novel: Novel = {
    id: newNovelId("novel"),
    title: sample.title,
    premise: sample.premise,
    summary: sample.summary,
    outline: sample.outline,
    goalWordsPerDay: 500,
    dailyWords: {},
    createdAt: now,
    updatedAt: now,
  };
  const chapters: Chapter[] = sample.chapters.map((c) => ({
    id: newNovelId("chap"),
    novelId: novel.id,
    order: c.order,
    title: c.title,
    createdAt: now,
  }));
  const scenes: Scene[] = sample.chapters.map((c, index) => ({
    id: newNovelId("scene"),
    chapterId: chapters[index].id,
    order: 0,
    title: "Cảnh 1",
    synopsis: c.synopsis,
    aiSummary: "",
    status: "done",
    contentLeft: c.contentLeft,
    contentRight: c.contentRight,
    createdAt: now,
    updatedAt: now,
  }));
  const sceneByChapter = (chapterNumber: number): string =>
    scenes[chapterNumber - 1].id;
  const entities: BibleEntity[] = sample.entities.map((e, index) => {
    const entity = createBibleEntity(novel.id, index, e.kind, e.name);
    entity.role = e.role;
    entity.description = e.description;
    entity.traits = e.traits;
    entity.notes = e.notes;
    return entity;
  });
  const entityByName = new Map(entities.map((e) => [e.name, e.id]));
  const plotlines: Plotline[] = [];
  const beats: Beat[] = [];
  sample.plotlines.forEach((pl, plIndex) => {
    const plotline = createPlotline(novel.id, plIndex, pl.title, pl.color);
    plotlines.push(plotline);
    pl.beats.forEach((b, beatIndex) => {
      beats.push(
        createBeat(
          plotline.id,
          beatIndex,
          b.title,
          b.kind,
          sceneByChapter(b.sceneChapter),
        ),
      );
    });
  });
  const arcs: CharacterArc[] = sample.arcs.map((a, arcIndex) => {
    const arc = createArc(novel.id, arcIndex, a.characterName);
    arc.entityId = entityByName.get(a.entityName) ?? null;
    arc.startState = a.startState;
    arc.endState = a.endState;
    arc.milestones = a.milestones.map((m) => ({
      id: newNovelId("ms"),
      sceneId: sceneByChapter(m.sceneChapter),
      note: m.note,
    }));
    return arc;
  });
  const questions: OpenQuestion[] = sample.questions.map((q) => {
    const question = createQuestion(novel.id, q.question);
    question.plantedSceneId = sceneByChapter(q.plantedChapter);
    question.answeredSceneId = sceneByChapter(q.answeredChapter);
    return question;
  });
  const data: NovelExportData = {
    novel,
    chapters,
    scenes,
    plotlines,
    beats,
    arcs,
    questions,
    entities,
  };
  const wordCount = scenes.reduce((sum, sc) => sum + sceneWords(sc), 0);
  const snapshot = createSnapshot(
    novel.id,
    sample.snapshot.name,
    sample.snapshot.note,
    data,
    wordCount,
  );
  return {
    novel,
    chapters,
    scenes,
    plotlines,
    beats,
    arcs,
    questions,
    entities,
    snapshot,
  };
}

/**
 * Nhập mẫu thành bản copy mới trong IndexedDB (mã mới, không đè bản cũ).
 * Trả về toàn bộ bản ghi đã lưu để nơi gọi cập nhật state và mở bản đó.
 */
export async function importNovelSample(
  sample: NovelSample,
): Promise<NovelSampleRecords> {
  const records = buildNovelRecords(sample, Date.now());
  await saveNovel(records.novel);
  for (const chapter of records.chapters) {
    await saveChapter(chapter);
  }
  for (const scene of records.scenes) {
    await saveScene(scene);
  }
  for (const entity of records.entities) {
    await saveEntity(entity);
  }
  for (const plotline of records.plotlines) {
    await savePlotline(plotline);
  }
  for (const beat of records.beats) {
    await saveBeat(beat);
  }
  for (const arc of records.arcs) {
    await saveArc(arc);
  }
  for (const question of records.questions) {
    await saveQuestion(question);
  }
  await saveSnapshot(records.snapshot);
  return records;
}
