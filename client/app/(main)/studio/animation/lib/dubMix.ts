/**
 * Trộn bản lồng tiếng khi xuất bản (Slice S6). Phần thuần:
 * `dubWindows` tính các khoảng cần hạ tiếng gốc (ducking) từ các cue
 * đã có take chọn. Phần trình duyệt: `renderDubMix` dùng
 * OfflineAudioContext render tiếng gốc (có ducking) + các take đúng
 * mốc thời gian thành 1 AudioBuffer để ghi vào bản xuất WebM.
 */

import type { CueV2 } from "./library";

export interface DubWindow {
  startSec: number;
  endSec: number;
}

/** Các khoảng ducking: cue có take chọn, nới 0,1s mỗi đầu, gộp chồng lấp. */
export function dubWindows(cues: readonly CueV2[]): DubWindow[] {
  const raw = cues
    .filter((c) => c.selectedTakeId)
    .map((c) => ({
      startSec: Math.max(0, c.startSec - 0.1),
      endSec: c.startSec + c.durationSec + 0.1,
    }))
    .sort((a, b) => a.startSec - b.startSec);
  const merged: DubWindow[] = [];
  for (const w of raw) {
    const last = merged[merged.length - 1];
    if (last && w.startSec <= last.endSec) {
      last.endSec = Math.max(last.endSec, w.endSec);
    } else {
      merged.push({ ...w });
    }
  }
  return merged;
}

export interface DubTakeInput {
  buffer: AudioBuffer;
  startSec: number;
  volume: number;
}

/**
 * Render bản trộn: tiếng gốc qua gain có automation ducking theo các
 * cửa sổ lồng tiếng, các take phát đúng mốc với âm lượng riêng.
 */
export async function renderDubMix(options: {
  original: AudioBuffer | null;
  takes: DubTakeInput[];
  durationSec: number;
  duckLevel?: number;
  sampleRate?: number;
}): Promise<AudioBuffer> {
  const sampleRate = options.sampleRate ?? 44100;
  const ctx = new OfflineAudioContext(
    2,
    Math.max(1, Math.ceil(options.durationSec * sampleRate)),
    sampleRate,
  );
  const duckLevel = options.duckLevel ?? 0.15;

  if (options.original) {
    const src = ctx.createBufferSource();
    src.buffer = options.original;
    const gain = ctx.createGain();
    gain.gain.value = 1;
    // Automation: hạ tiếng gốc trong các cửa sổ có thoại lồng
    const windows = options.takes
      .map((t) => ({
        startSec: Math.max(0, t.startSec - 0.1),
        endSec: t.startSec + t.buffer.duration + 0.1,
      }))
      .sort((a, b) => a.startSec - b.startSec);
    for (const w of windows) {
      gain.gain.setValueAtTime(1, Math.max(0, w.startSec - 0.05));
      gain.gain.linearRampToValueAtTime(duckLevel, w.startSec + 0.05);
      gain.gain.setValueAtTime(duckLevel, Math.max(w.startSec + 0.05, w.endSec - 0.05));
      gain.gain.linearRampToValueAtTime(1, w.endSec + 0.05);
    }
    src.connect(gain).connect(ctx.destination);
    src.start(0);
  }
  for (const take of options.takes) {
    const src = ctx.createBufferSource();
    src.buffer = take.buffer;
    const gain = ctx.createGain();
    gain.gain.value = Math.min(1.5, Math.max(0, take.volume));
    src.connect(gain).connect(ctx.destination);
    src.start(take.startSec);
  }
  return ctx.startRendering();
}
