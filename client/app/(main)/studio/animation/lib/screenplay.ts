/**
 * Tách kịch bản text thành cảnh phim (giai đoạn D).
 *
 * Định dạng chấp nhận (bao dung, không crash với dòng lạ):
 * - Đầu cảnh: `INT. ...` / `EXT. ...` (cả `NỘI.` / `NGOẠI.`).
 * - Tên nhân vật: dòng VIẾT HOA (≤ 30 ký tự) đứng trước thoại.
 * - Thoại: các dòng ngay sau tên nhân vật (tới dòng trống).
 * - Mô tả: dòng văn xuôi ngoài thoại.
 * - Dòng lạ (chuyển cảnh, chú thích trong ngoặc...) không bị vứt:
 *   giữ trong ghi chú của cảnh.
 */

import { createAnimScene, type AnimScene } from "./animProject";
import {
  estimateLineDurationSec,
  newDialogueId,
  type DialogueLine,
} from "./dialogue";

export interface ParsedDialogue {
  speaker: string;
  text: string;
}

export interface ParsedScene {
  /** Tên cảnh (đầu cảnh bỏ tiền tố INT./EXT., hoặc tên mặc định). */
  name: string;
  description: string[];
  dialogue: ParsedDialogue[];
  /** Mọi dòng không xếp được vào đâu — giữ lại, không vứt. */
  notes: string[];
}

const HEADING_RE = /^(INT|EXT|NỘI|NGOẠI)[\.\s\-–—]+(.+)$/i;

function stripHeading(line: string): string | null {
  const m = line.match(HEADING_RE);
  if (!m) return null;
  const rest = m[2].trim();
  return rest || line.trim();
}

/**
 * Dòng tên nhân vật: viết hoa, ngắn, không kết thúc bằng dấu câu.
 * So sánh hoa/thường bằng toUpperCase (đúng với tiếng Việt) thay vì
 * range regex — range `à-ỹ` nuốt cả chữ hoa có dấu như Ắ.
 */
function speakerOf(line: string): string | null {
  const base = line.replace(/\s*\(.*\)\s*$/, "").trim();
  if (base.length === 0 || base.length > 30) return null;
  if (/[.:,]$/.test(base)) return null;
  if (!/^[\p{L}0-9 .'\-]+$/u.test(base)) return null;
  if (base !== base.toUpperCase() || base === base.toLowerCase()) return null;
  return base;
}

export function parseScreenplay(text: string): ParsedScene[] {
  const scenes: ParsedScene[] = [];
  let current: ParsedScene | null = null;
  let currentSpeaker: string | null = null;
  let inDialogue = false;

  const ensureScene = () => {
    if (!current) {
      current = {
        name: "Cảnh từ kịch bản",
        description: [],
        dialogue: [],
        notes: [],
      };
      scenes.push(current);
    }
    return current;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      // Dòng trống kết thúc khối thoại đang mở.
      inDialogue = false;
      currentSpeaker = null;
      continue;
    }
    const heading = stripHeading(line);
    if (heading) {
      current = {
        name: heading,
        description: [],
        dialogue: [],
        notes: [],
      };
      scenes.push(current);
      currentSpeaker = null;
      inDialogue = false;
      continue;
    }
    const speaker = speakerOf(line);
    if (speaker) {
      const scene = ensureScene();
      currentSpeaker = speaker;
      inDialogue = true;
      scene.dialogue.push({ speaker, text: "" });
      continue;
    }
    if (line.startsWith("(") && line.endsWith(")")) {
      // Chú thích diễn xuất — giữ trong ghi chú, không làm thoại.
      ensureScene().notes.push(line);
      continue;
    }
    if (line.endsWith(":") && line === line.toUpperCase()) {
      // Dấu chuyển cảnh kiểu "CẮT SANG:" — giữ trong ghi chú.
      ensureScene().notes.push(line);
      continue;
    }
    if (inDialogue && currentSpeaker && current) {
      const last = current.dialogue[current.dialogue.length - 1];
      last.text = last.text ? `${last.text} ${line}` : line;
      continue;
    }
    // Văn xuôi ngoài thoại = mô tả cảnh.
    ensureScene().description.push(line);
  }

  // Dọn thoại rỗng (tên nhân vật không kèm câu nào).
  for (const s of scenes) {
    s.dialogue = s.dialogue.filter((d) => d.text.trim().length > 0);
  }
  return scenes.filter(
    (s) =>
      s.description.length > 0 || s.dialogue.length > 0 || s.notes.length > 0,
  );
}

/** Chuyển cảnh đã tách thành cảnh phim thật (thoại có mốc + thời lượng). */
export function screenplayToAnimScenes(
  parsed: readonly ParsedScene[],
): AnimScene[] {
  return parsed.map((p, i) => {
    const scene = createAnimScene(p.name || `Cảnh ${i + 1}`);
    let t = 0.3;
    const lines: DialogueLine[] = [];
    for (const d of p.dialogue) {
      const dur = estimateLineDurationSec(d.text);
      lines.push({
        id: newDialogueId(),
        text: d.text,
        startSec: Math.round(t * 100) / 100,
        durationSec: dur,
        speaker: d.speaker,
      });
      t += dur + 0.15;
    }
    const descSec = p.description.length > 0 ? 1 : 0;
    const total = Math.max(t + descSec, 2);
    scene.durationSec = Math.min(120, Math.max(0.5, total));
    scene.dialogue = lines;
    const noteParts = [...p.description, ...p.notes];
    if (noteParts.length > 0) scene.note = noteParts.join(" ");
    return scene;
  });
}
