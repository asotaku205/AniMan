/**
 * Phát thử track tiếng của một cảnh đồng bộ với phát thử hình: các bản thu
 * ĐÃ CHỌN của từng dòng thoại được giải mã và lên lịch theo mốc startSec.
 * Trả về handle để dừng (khi người dùng tạm dừng phát thử hoặc đổi cảnh).
 */

import { loadVoiceBlob } from "./animStorage";
import { selectedDialogueTake, type DialogueLine } from "./dialogue";

export interface VoicePlayback {
  stop: () => void;
}

export async function playSceneVoice(
  lines: readonly DialogueLine[],
  fromSec: number,
): Promise<VoicePlayback | null> {
  if (typeof window === "undefined") return null;
  const jobs = lines
    .map((line) => {
      const take = selectedDialogueTake(line);
      return take ? { line, take } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (jobs.length === 0) return null;

  const ctx = new AudioContext();
  const startedAt = ctx.currentTime + 0.05;
  const sources: AudioBufferSourceNode[] = [];
  await Promise.all(
    jobs.map(async ({ line, take }) => {
      try {
        const blob = await loadVoiceBlob(take.id);
        if (!blob) return;
        const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
        if (line.startSec + buf.duration <= fromSec) return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const gain = ctx.createGain();
        gain.gain.value = take.volume;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(
          startedAt + Math.max(0, line.startSec - fromSec),
          Math.max(0, fromSec - line.startSec),
        );
        sources.push(src);
      } catch {
        // Một bản thu lỗi không chặn cả track tiếng khi phát thử.
      }
    }),
  );
  return {
    stop: () => {
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          /* đã dừng */
        }
      }
      void ctx.close().catch(() => undefined);
    },
  };
}
