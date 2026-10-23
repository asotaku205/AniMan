/**
 * Định dạng xuất phụ đề & cue sheet (Slice S6): WebVTT, ASS (cho
 * player/phần mềm dựng phim), và cue sheet CSV cho buổi thu lồng tiếng.
 * Hàm thuần trên CueV2/DialogueLine — SRT đã có ở `lib/srt.ts`.
 */

import type { DialogueLine } from "./dialogue";
import { characterName, type CueV2, type Series } from "./library";

function fmtVttTime(sec: number): string {
  const t = Math.max(0, sec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ms = Math.round((t - Math.floor(t)) * 1000);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(h)}:${p(m)}:${p(s)}.${p(ms, 3)}`;
}

/** WebVTT — chuẩn web, YouTube/trình phát HTML5 đọc trực tiếp. */
export function toVtt(cues: readonly DialogueLine[]): string {
  const body = [...cues]
    .sort((a, b) => a.startSec - b.startSec)
    .map(
      (c) =>
        `${fmtVttTime(c.startSec)} --> ${fmtVttTime(c.startSec + c.durationSec)}\n${c.text}`,
    )
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

function fmtAssTime(sec: number): string {
  const t = Math.max(0, sec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

/** ASS/SSA — giữ xuống dòng bằng \N, bỏ ký tự điều khiển của định dạng. */
export function toAss(
  cues: readonly DialogueLine[],
  title = "AniMan",
): string {
  const header = `[Script Info]
Title: ${title}
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,28,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,2,1,2,20,20,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const events = [...cues]
    .sort((a, b) => a.startSec - b.startSec)
    .map((c) => {
      const text = c.text
        .replace(/[{}]/g, "")
        .replace(/\n/g, "\\N");
      return `Dialogue: 0,${fmtAssTime(c.startSec)},${fmtAssTime(c.startSec + c.durationSec)},Default,,0,0,0,,${text}`;
    })
    .join("\n");
  return header + events + "\n";
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

/**
 * Cue sheet CSV cho buổi thu ADR: mỗi dòng 1 câu với timecode, nhân
 * vật, lời gốc, bản dịch và trạng thái take đã chọn — in ra hoặc mở
 * bằng Excel khi thu.
 */
export function toCueSheetCsv(
  cues: readonly CueV2[],
  series: Series | null,
): string {
  const rows = [
    ["STT", "In", "Out", "Nhân vật", "Lời gốc", "Bản dịch", "Đã có take chọn"],
    ...[...cues]
      .sort((a, b) => a.startSec - b.startSec)
      .map((cue, i) => [
        String(i + 1),
        fmtClock(cue.startSec),
        fmtClock(cue.startSec + cue.durationSec),
        characterName(series, cue.speakerId) ?? "",
        cue.sourceText,
        cue.text,
        cue.selectedTakeId ? "Có" : "Chưa",
      ]),
  ];
  // BOM để Excel đọc đúng tiếng Việt
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
