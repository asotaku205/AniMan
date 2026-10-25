/**
 * Phát thử toàn phim ĐỒNG BỘ (S1): một đồng hồ chủ duy nhất cho hình +
 * tiếng + phụ đề. Khi phim có tiếng, đồng hồ chủ là AudioContext (chuẩn
 * của mọi trình dựng phim: hình bám theo tiếng, không trôi). Các clip
 * thoại + nhạc nền được LÊN LỊCH trên trục thời gian của ngữ cảnh âm
 * thanh theo đúng `buildFilmAudioPlan` — cùng mốc với bản xuất nên phát
 * thử nghe/thấy đúng như phim xuất ra.
 */

import type { AnimProject } from "./animProject";
import { dialogueLineAt, type DialogueLine } from "./dialogue";
import { applyFadeEnvelope, buildFilmAudioPlan } from "./filmAudio";
import { contentTimeInSegment, filmTimeline, segmentAtWallTime } from "./animatic";
import { bgmBlobKey, loadVoiceBlob } from "./animStorage";

/** Dòng thoại đang vang tại mốc thời gian tuyệt đối của phim. */
export function dialogueAtFilmTime(
  project: AnimProject,
  tSec: number,
): { sceneIndex: number; line: DialogueLine } | null {
  let offset = 0;
  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i];
    if (tSec < offset + scene.durationSec) {
      const line = dialogueLineAt(scene.dialogue ?? [], tSec - offset);
      return line ? { sceneIndex: i, line } : null;
    }
    offset += scene.durationSec;
  }
  return null;
}

/**
 * Dòng thoại đang vang tại thời điểm XEM (đã cộng cửa sổ tiêu đề đầu
 * phim và tốc độ từng cảnh) — dùng cho phụ đề phủ trong phát thử.
 */
export function dialogueAtWallTime(
  project: AnimProject,
  tSec: number,
  titleSec: number,
): { sceneIndex: number; line: DialogueLine } | null {
  const tWall = tSec - titleSec;
  if (tWall < 0) return null;
  const segs = filmTimeline(project.scenes);
  const seg = segmentAtWallTime(segs, tWall);
  if (!seg) return null;
  const scene = project.scenes[seg.index];
  if (!scene) return null;
  const line = dialogueLineAt(
    scene.dialogue ?? [],
    contentTimeInSegment(seg, tWall),
  );
  return line ? { sceneIndex: seg.index, line } : null;
}

export interface FilmPreviewAudio {
  /** true khi phim có ít nhất thoại hoặc nhạc nền để phát. */
  hasAudio: boolean;
  /** Nạp + giải mã toàn bộ tiếng (gọi 1 lần trước khi phát). */
  prepare: () => Promise<void>;
  /** Bắt đầu/phát tiếp từ mốc tuyệt đối fromSec. */
  play: (fromSec: number) => void;
  /** Tạm dừng — trả về mốc tuyệt đối hiện tại. */
  pause: () => number;
  stop: () => void;
  /** Mốc tuyệt đối hiện tại khi đang phát (đồng hồ chủ). */
  now: () => number;
  dispose: () => void;
}

export function createFilmPreviewAudio(
  project: AnimProject,
  /** Độ dời thời gian xem (cửa sổ tiêu đề đầu phim): tiếng bắt đầu sau khoảng này. */
  offsetSec = 0,
): FilmPreviewAudio {
  const plan = buildFilmAudioPlan(project);
  const bgm = project.bgm ?? null;
  let ctx: AudioContext | null = null;
  const buffers = new Map<string, AudioBuffer>();
  let bgmBuffer: AudioBuffer | null = null;
  let sources: AudioBufferSourceNode[] = [];
  let startedAtCtx = 0;
  let startedFromSec = 0;
  let playing = false;

  const stopSources = () => {
    for (const src of sources) {
      try {
        src.stop();
      } catch {
        /* đã dừng */
      }
      try {
        src.disconnect();
      } catch {
        /* đã ngắt */
      }
    }
    sources = [];
  };

  return {
    hasAudio: plan.clips.length > 0 || !!bgm,

    async prepare() {
      if (typeof window === "undefined") return;
      if (!ctx) ctx = new AudioContext();
      const keys = new Set(plan.clips.map((c) => c.takeId));
      await Promise.all(
        [...keys].map(async (key) => {
          if (buffers.has(key)) return;
          const blob = await loadVoiceBlob(key).catch(() => null);
          if (!blob || !ctx) return;
          try {
            buffers.set(key, await ctx.decodeAudioData(await blob.arrayBuffer()));
          } catch {
            /* bản thu hỏng — bỏ qua clip này */
          }
        }),
      );
      if (bgm && !bgmBuffer) {
        const blob = await loadVoiceBlob(bgmBlobKey(project.id)).catch(
          () => null,
        );
        if (blob && ctx) {
          try {
            bgmBuffer = await ctx.decodeAudioData(await blob.arrayBuffer());
          } catch {
            bgmBuffer = null;
          }
        }
      }
    },

    play(fromSec: number) {
      if (!ctx) return;
      void ctx.resume().catch(() => undefined);
      stopSources();
      startedAtCtx = ctx.currentTime + 0.06;
      startedFromSec = fromSec;
      playing = true;
      // Thoại: lên lịch từng clip còn lại trên trục thời gian XEM
      // (mốc kế hoạch + độ dời tiêu đề); clip phát đúng tốc độ cảnh.
      for (const clip of plan.clips) {
        const buf = buffers.get(clip.takeId);
        if (!buf) continue;
        const rate = clip.playbackRate ?? 1;
        const playDur = clip.playDurationSec ?? buf.duration;
        const clipEndWall = clip.atSec + playDur / rate;
        if (clipEndWall + offsetSec <= fromSec) continue;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = rate;
        const gain = ctx.createGain();
        src.connect(gain);
        gain.connect(ctx.destination);
        const when = startedAtCtx + Math.max(0, clip.atSec + offsetSec - fromSec);
        const offsetInClip = Math.max(0, fromSec - offsetSec - clip.atSec) * rate;
        applyFadeEnvelope(gain.gain, {
          startCtx: when,
          durationSec: playDur,
          volume: clip.volume,
          fadeInSec: clip.fadeInSec ?? 0,
          fadeOutSec: clip.fadeOutSec ?? 0,
          fromOffsetSec: offsetInClip,
        });
        try {
          src.start(
            when,
            (clip.sourceOffsetSec ?? 0) + offsetInClip,
            playDur - offsetInClip,
          );
          sources.push(src);
        } catch {
          /* clip không hợp lệ — bỏ qua */
        }
      }
      // Nhạc nền: giữ tốc độ gốc (nhạc nền không bám theo từng cảnh),
      // bắt đầu sau cửa sổ tiêu đề.
      if (bgm && bgmBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = bgmBuffer;
        src.loop = bgm.loop;
        const gain = ctx.createGain();
        gain.gain.value = bgm.volume;
        src.connect(gain);
        gain.connect(ctx.destination);
        try {
          const intoFilm = Math.max(0, fromSec - offsetSec);
          src.start(
            startedAtCtx + Math.max(0, offsetSec - fromSec),
            bgm.loop ? intoFilm % bgmBuffer.duration : intoFilm,
          );
          sources.push(src);
        } catch {
          /* nhạc nền không phát được — phim vẫn chạy */
        }
      }
    },

    pause() {
      const t = this.now();
      stopSources();
      playing = false;
      return t;
    },

    stop() {
      stopSources();
      playing = false;
    },

    now() {
      if (!playing || !ctx) return startedFromSec;
      return startedFromSec + Math.max(0, ctx.currentTime - startedAtCtx);
    },

    dispose() {
      stopSources();
      if (ctx) void ctx.close().catch(() => undefined);
      ctx = null;
    },
  };
}
