/**
 * SRT (SubRip) — định dạng phụ đề chuẩn cho phòng biên tập video:
 * parse file .srt thành các cue dùng chung model DialogueLine, và xuất
 * ngược lại. Hàm thuần, có test — hỏng định dạng thì bỏ qua block đó
 * thay vì sập cả file.
 */

import { newDialogueId, type DialogueLine } from "./dialogue";

function parseSrtTime(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!m) return null;
  const [, h, min, s, ms] = m;
  return (
    Number(h) * 3600 +
    Number(min) * 60 +
    Number(s) +
    Number(ms.padEnd(3, "0")) / 1000
  );
}

export function formatSrtTime(totalSec: number): string {
  const t = Math.max(0, totalSec);
  const h = Math.floor(t / 3600);
  const min = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t - Math.floor(t)) * 1000);
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${pad(h)}:${pad(min)}:${pad(s)},${pad(ms, 3)}`;
}

/** Parse nội dung .srt → danh sách cue (bỏ qua block lỗi). */
export function parseSrt(content: string): DialogueLine[] {
  const blocks = content.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  const cues: DialogueLine[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trimEnd());
    const timeIdx = lines.findIndex((l) => l.includes("-->"));
    if (timeIdx === -1) continue;
    const [startRaw, endRaw] = lines[timeIdx].split("-->").map((x) => x.trim());
    const start = parseSrtTime(startRaw ?? "");
    const end = parseSrtTime((endRaw ?? "").split(/\s+/)[0]);
    if (start == null || end == null || end <= start) continue;
    const text = lines
      .slice(timeIdx + 1)
      .join("\n")
      .trim();
    if (!text) continue;
    cues.push({
      id: newDialogueId(),
      text,
      startSec: start,
      durationSec: Math.round((end - start) * 1000) / 1000,
    });
  }
  return cues.sort((a, b) => a.startSec - b.startSec);
}

/** Xuất danh sách cue thành nội dung .srt chuẩn. */
export function toSrt(cues: readonly DialogueLine[]): string {
  const sorted = [...cues].sort((a, b) => a.startSec - b.startSec);
  return (
    sorted
      .map((cue, i) => {
        const start = formatSrtTime(cue.startSec);
        const end = formatSrtTime(cue.startSec + cue.durationSec);
        return `${i + 1}\n${start} --> ${end}\n${cue.text.trim()}`;
      })
      .join("\n\n") + "\n"
  );
}
