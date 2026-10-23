/**
 * Gợi ý phân cảnh từ đoạn novel — TOOL heuristic thuần, KHÔNG gọi
 * AI: tách văn bản thành các cảnh nháp theo đoạn văn/cụm câu, trích thoại
 * trong dấu ngoặc kép thành track thoại, ước lượng thời lượng theo số
 * chữ + thoại. Kết quả là BẢN NHÁP để người dùng sửa ở bảng phân cảnh —
 * đúng triết lý: tự động hoá khâu cơ học, quyết định nghệ thuật ở người.
 */

import { buildDialogueTrack, estimateLineDurationSec } from "./dialogue";
import type { AnimScene } from "./animProject";

const DIALOGUE_RE = /[«“"]([^«»“”"]{1,300})[»”"]/g;

/** Trích các câu thoại trong dấu ngoặc kép của một đoạn văn. */
export function extractDialogue(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(DIALOGUE_RE)) {
    const line = match[1].trim();
    if (line) out.push(line);
  }
  return out;
}

/** Tên cảnh nháp từ câu đầu của đoạn (tối đa ~6 từ). */
function sceneNameFrom(text: string, index: number): string {
  const clean = text.replace(/[«»“”"]/g, "").trim();
  const firstSentence = clean.split(/[.!?…]/)[0]?.trim() ?? "";
  const words = firstSentence.split(/\s+/).slice(0, 6).join(" ");
  return words ? `Cảnh ${index + 1}: ${words}…` : `Cảnh ${index + 1}`;
}

export interface SceneDraft {
  name: string;
  note: string;
  durationSec: number;
  dialogueTexts: string[];
}

/**
 * Tách văn bản novel thành cảnh nháp:
 * - Mỗi đoạn văn (xuống dòng đôi) là hạt nhân một cảnh.
 * - Đoạn quá dài (> ~700 ký tự) tách tiếp theo cụm 3-4 câu.
 * - Thời lượng gợi ý: đọc thầm ~14 ký tự/giây cho phần kể + tổng thoại,
 *   kẹp trong [3, 30] giây.
 */
export function suggestScenesFromText(text: string): SceneDraft[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= 700) {
      chunks.push(para);
      continue;
    }
    const sentences = para.match(/[^.!?…]+[.!?…]+["”»]?\s*/g) ?? [para];
    let bucket = "";
    for (const sentence of sentences) {
      if (bucket.length + sentence.length > 700 && bucket) {
        chunks.push(bucket.trim());
        bucket = "";
      }
      bucket += sentence;
    }
    if (bucket.trim()) chunks.push(bucket.trim());
  }

  return chunks.map((chunk, i) => {
    const dialogueTexts = extractDialogue(chunk);
    const narrationChars = Math.max(0, chunk.length - dialogueTexts.join("").length);
    const narrationSec = narrationChars / 14;
    const dialogueSec = dialogueTexts.reduce(
      (sum, line) => sum + estimateLineDurationSec(line) + 0.15,
      0,
    );
    const durationSec = Math.min(
      30,
      Math.max(3, Math.ceil((narrationSec + dialogueSec) * 2) / 2),
    );
    return {
      name: sceneNameFrom(chunk, i),
      note: chunk.slice(0, 400),
      durationSec,
      dialogueTexts,
    };
  });
}

/** Biến cảnh nháp thành AnimScene thật (thoại dựng sẵn track). */
export function sceneDraftToAnimScene(
  draft: SceneDraft,
  idSuffix: string,
): AnimScene {
  const { lines } = buildDialogueTrack(draft.dialogueTexts);
  return {
    id: `scene-draft-${idSuffix}`,
    name: draft.name,
    durationSec: draft.durationSec,
    source: null,
    note: draft.note,
    dialogue: lines,
  };
}
