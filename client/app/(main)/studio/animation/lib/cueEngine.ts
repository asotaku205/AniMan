/**
 * Cue Engine — thao tác spotting/biên tập cue thuần (Slice S3):
 * tách cue tại playhead, gộp cue kề, nudge, snap vào biên lân cận,
 * đặt In/Out. Mọi hàm trả mảng MỚI đã sắp xếp, không sửa đầu vào —
 * UI chỉ gọi vào, undo/redo nằm ở tầng workspace.
 */

import { createCue, newLibraryId, type CueV2 } from "./library";

const sortByStart = (cues: CueV2[]): CueV2[] =>
  [...cues].sort((a, b) => a.startSec - b.startSec);

/** Tách cue tại thời điểm atSec (phải nằm trong cue, chừa 2 đầu ≥0,2s). */
export function splitCue(
  cues: readonly CueV2[],
  cueId: string,
  atSec: number,
): CueV2[] {
  const list = sortByStart([...cues]);
  const idx = list.findIndex((c) => c.id === cueId);
  if (idx === -1) return list;
  const cue = list[idx];
  const end = cue.startSec + cue.durationSec;
  if (atSec <= cue.startSec + 0.2 || atSec >= end - 0.2) return list;
  const first: CueV2 = { ...cue, durationSec: atSec - cue.startSec };
  const second: CueV2 = {
    ...createCue(cue.episodeId, atSec, end - atSec),
    sourceText: "",
    text: "",
    speakerId: cue.speakerId,
    takes: [],
    selectedTakeId: undefined,
  };
  void newLibraryId;
  list.splice(idx, 1, first, second);
  return sortByStart(list);
}

/** Gộp cue với cue NGAY SAU nó (nội dung nối bằng khoảng trắng). */
export function mergeCueWithNext(
  cues: readonly CueV2[],
  cueId: string,
): CueV2[] {
  const list = sortByStart([...cues]);
  const idx = list.findIndex((c) => c.id === cueId);
  if (idx === -1 || idx >= list.length - 1) return list;
  const a = list[idx];
  const b = list[idx + 1];
  const merged: CueV2 = {
    ...a,
    durationSec: b.startSec + b.durationSec - a.startSec,
    sourceText: [a.sourceText, b.sourceText].filter(Boolean).join(" "),
    text: [a.text, b.text].filter(Boolean).join(" "),
  };
  list.splice(idx, 2, merged);
  return sortByStart(list);
}

/** Dịch chuyển cue theo delta (không âm). */
export function nudgeCue(
  cues: readonly CueV2[],
  cueId: string,
  deltaSec: number,
): CueV2[] {
  return sortByStart(
    cues.map((c) =>
      c.id === cueId
        ? { ...c, startSec: Math.max(0, c.startSec + deltaSec) }
        : c,
    ),
  );
}

/**
 * Snap mốc bắt đầu của cue vào điểm đích gần nhất trong ngưỡng
 * (biên cue kề, 0, mốc playhead…) — trả về startSec đã snap hoặc giữ nguyên.
 */
export function snapCueStart(
  startSec: number,
  targets: readonly number[],
  thresholdSec = 0.15,
): number {
  let best = startSec;
  let bestDist = thresholdSec;
  for (const t of targets) {
    const d = Math.abs(t - startSec);
    if (d <= bestDist) {
      best = t;
      bestDist = d;
    }
  }
  return best;
}

/** Các điểm snap khả dụng cho 1 cue: biên của mọi cue khác + 0. */
export function snapTargetsFor(
  cues: readonly CueV2[],
  exceptCueId: string,
): number[] {
  const targets = [0];
  for (const c of cues) {
    if (c.id === exceptCueId) continue;
    targets.push(c.startSec, c.startSec + c.durationSec);
  }
  return targets;
}

/** Đặt In/Out cho cue, kẹp độ dài tối thiểu 0,3s. */
export function setCueInOut(
  cues: readonly CueV2[],
  cueId: string,
  inSec: number,
  outSec: number,
): CueV2[] {
  return sortByStart(
    cues.map((c) => {
      if (c.id !== cueId) return c;
      const start = Math.max(0, Math.min(inSec, outSec - 0.3));
      return { ...c, startSec: start, durationSec: Math.max(0.3, outSec - start) };
    }),
  );
}
