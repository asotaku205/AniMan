/**
 * Tiếng của toàn phim (Slice B4): bản thu đã chọn của mọi dòng thoại được
 * đặt theo MỐC TUYỆT ĐỐI (tổng thời lượng các cảnh trước + mốc trong cảnh),
 * cộng nhạc nền của dự án. `buildFilmAudioPlan` là logic thuần (test được);
 * `renderFilmAudioMix` render bằng OfflineAudioContext thành 1 file WAV.
 */

import { projectDurationSec, type AnimProject } from "./animProject";
import { selectedDialogueTake } from "./dialogue";
import { loadVoiceBlob } from "./animStorage";

export interface FilmVoiceClip {
  takeId: string;
  /** Mốc tuyệt đối trong phim (giây). */
  atSec: number;
  volume: number;
  sceneName: string;
}

export interface MissingVoiceLine {
  sceneName: string;
  text: string;
}

export function buildFilmAudioPlan(project: AnimProject): {
  clips: FilmVoiceClip[];
  missing: MissingVoiceLine[];
  totalSec: number;
} {
  const clips: FilmVoiceClip[] = [];
  const missing: MissingVoiceLine[] = [];
  let offset = 0;
  for (const scene of project.scenes) {
    for (const line of scene.dialogue ?? []) {
      if (!line.text.trim()) continue;
      const take = selectedDialogueTake(line);
      if (take) {
        clips.push({
          takeId: take.id,
          atSec: offset + line.startSec,
          volume: take.volume,
          sceneName: scene.name,
        });
      } else {
        missing.push({ sceneName: scene.name, text: line.text });
      }
    }
    offset += scene.durationSec;
  }
  return { clips, missing, totalSec: projectDurationSec(project) };
}

/** Mã hoá AudioBuffer thành WAV 16-bit (đủ cho bản trộn đưa vào WebM). */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const channels = Math.min(2, buffer.numberOfChannels);
  const length = buffer.length * channels;
  const pcm = new Int16Array(length);
  const chans: Float32Array[] = [];
  for (let c = 0; c < channels; c++) chans.push(buffer.getChannelData(c));
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < channels; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]));
      pcm[i * channels + c] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
  }
  const bytesPerSample = 2;
  const dataSize = length * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  new Int16Array(ab, 44).set(pcm);
  return new Blob([ab], { type: "audio/wav" });
}

/**
 * Render bản trộn tiếng của phim (thoại + nhạc nền, nhạc tự nhỏ dần 2s
 * cuối). Trả về null khi phim không có bất kỳ tiếng nào.
 */
export async function renderFilmAudioMix(
  project: AnimProject,
  /** Đẩy toàn bộ tiếng lùi lại (khi phim có màn hình tiêu đề đầu phim). */
  offsetSec = 0,
): Promise<Blob | null> {
  if (typeof window === "undefined") return null;
  const plan = buildFilmAudioPlan(project);
  const bgm = project.bgm ?? null;
  if (plan.clips.length === 0 && !bgm) return null;
  const total = Math.max(1, plan.totalSec + offsetSec);
  const sampleRate = 44100;
  const ctx = new OfflineAudioContext(
    2,
    Math.ceil(total * sampleRate),
    sampleRate,
  );

  const decode = async (key: string): Promise<AudioBuffer | null> => {
    const blob = await loadVoiceBlob(key);
    if (!blob) return null;
    try {
      return await ctx.decodeAudioData(await blob.arrayBuffer());
    } catch {
      return null;
    }
  };

  for (const clip of plan.clips) {
    const buf = await decode(clip.takeId);
    if (!buf) continue;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = clip.volume;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(clip.atSec + offsetSec);
  }

  if (bgm) {
    const buf = await decode(bgm.blobKey);
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = bgm.loop;
      const gain = ctx.createGain();
      const fadeStart = Math.max(0, total - 2);
      gain.gain.setValueAtTime(bgm.volume, 0);
      gain.gain.setValueAtTime(bgm.volume, fadeStart);
      gain.gain.linearRampToValueAtTime(0.0001, total);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(offsetSec);
      if (!bgm.loop && buf.duration < total) {
        // Không lặp: nhạc kết thúc tự nhiên trước khi hết phim.
      } else {
        src.stop(total);
      }
    }
  }

  const rendered = await ctx.startRendering();
  return audioBufferToWavBlob(rendered);
}
