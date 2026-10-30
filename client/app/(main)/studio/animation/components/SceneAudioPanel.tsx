"use client";

/**
 * Âm thanh của cảnh (R2 — phòng âm thanh): hiệu ứng tiếng và đoạn nhạc
 * riêng của từng cảnh. Người dùng TỰ TẠO âm thanh bằng cách thu trực
 * tiếp bằng micro (tiếng bước chân, vỗ tay, tiếng mưa tự chế kiểu foley)
 * hoặc nạp file có sẵn, rồi cắt đầu, dời mốc, chỉnh âm lượng và fade.
 * Mọi clip đều trộn vào cả Phát thử toàn phim lẫn bản xuất WebM.
 */

import { useEffect, useRef, useState } from "react";
import { Music, Pause, Play, Sparkles, Square, Trash2, Upload } from "lucide-react";
import type { AnimScene, SceneAudioClip } from "../lib/animProject";
import {
  audioClipBlobKey,
  clampAudioClip,
  createSceneAudioClip,
} from "../lib/audioClips";
import {
  deleteVoiceBlob,
  loadVoiceBlob,
  saveVoiceBlob,
} from "../lib/animStorage";

async function probeDuration(blob: Blob): Promise<number> {
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (AC) {
      const ctx = new AC();
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      void ctx.close().catch(() => undefined);
      return buf.duration;
    }
  } catch {
    /* thử cách dưới */
  }
  return await new Promise<number>((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const d = Number.isFinite(audio.duration) ? audio.duration : 0;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    audio.onerror = () => resolve(0);
    audio.src = url;
  });
}

export function SceneAudioPanel({
  scene,
  onChange,
}: {
  scene: AnimScene;
  onChange: (clips: SceneAudioClip[]) => void;
}) {
  const clips = scene.audioClips ?? [];
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    },
    [],
  );

  const update = (clip: SceneAudioClip) => {
    const clamped = clampAudioClip(clip, scene.durationSec);
    onChange(clips.map((c) => (c.id === clip.id ? clamped : c)));
  };

  const addClipFromBlob = async (
    blob: Blob,
    name: string,
    kind: SceneAudioClip["kind"],
  ) => {
    const duration = await probeDuration(blob);
    if (!duration) {
      setError("Không đọc được file âm thanh này — thử file .mp3/.wav/.webm khác.");
      return;
    }
    const clip = createSceneAudioClip({ name, kind, sourceDurationSec: duration });
    await saveVoiceBlob(audioClipBlobKey(clip.id), blob);
    onChange([...clips, clip]);
    setError(null);
  };

  const toggleRecord = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find((m) =>
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m),
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        void addClipFromBlob(
          blob,
          `Âm thanh thu ${clips.length + 1}`,
          "sfx",
        );
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError("Không mở được micro — kiểm tra quyền micro của trình duyệt rồi thử lại.");
    }
  };

  const togglePlay = async (clip: SceneAudioClip) => {
    if (playingId === clip.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    const blob = await loadVoiceBlob(audioClipBlobKey(clip.id));
    if (!blob) {
      setError("Không tìm thấy file âm thanh của clip này (có thể đã bị xoá).");
      return;
    }
    audioRef.current?.pause();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.currentTime = clip.offsetSec;
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(clip.id);
    void audio.play().catch(() => setPlayingId(null));
    window.setTimeout(() => {
      if (audioRef.current === audio) {
        audio.pause();
        setPlayingId(null);
      }
    }, clip.durationSec * 1000 + 60);
  };

  const remove = async (clip: SceneAudioClip) => {
    await deleteVoiceBlob(audioClipBlobKey(clip.id));
    onChange(clips.filter((c) => c.id !== clip.id));
  };

  return (
    <section className="rounded-xl border border-emerald-300/20 bg-emerald-500/5 p-3 space-y-3">
      <h4 className="text-[12px] font-semibold text-emerald-200/80 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5" /> ÂM THANH CỦA CẢNH (HIỆU ỨNG · NHẠC RIÊNG)
      </h4>
      

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void toggleRecord()}
          className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg border text-[12px] transition ${
            recording
              ? "bg-rose-500/25 border-rose-400/40 text-rose-200"
              : "bg-white/5 border-white/10 hover:bg-white/10"
          }`}
        >
          {recording ? <Square className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          {recording ? "Dừng thu" : "Thu âm thanh mới"}
        </button>
        <label className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10 cursor-pointer">
          <Upload className="w-3.5 h-3.5" /> Nạp file âm thanh
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (f) void addClipFromBlob(f, f.name.replace(/\.[^.]+$/, ""), "sfx");
            }}
          />
        </label>
      </div>
      {error && <p className="text-[11px] text-rose-300">{error}</p>}

      {clips.length === 0 ? (
        <p className="text-[11px] text-white/30">
          Cảnh này chưa có clip âm thanh nào.
        </p>
      ) : (
        <ul className="space-y-3">
          {clips.map((clip) => (
            <li
              key={clip.id}
              className="rounded-lg border border-white/10 bg-black/30 p-2.5 space-y-2"
            >
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => void togglePlay(clip)}
                  aria-label={playingId === clip.id ? "Dừng nghe" : "Nghe thử clip"}
                  className="p-1.5 rounded-md bg-white/5 border border-white/10 hover:bg-white/10"
                >
                  {playingId === clip.id ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                </button>
                <input
                  value={clip.name}
                  onChange={(e) => update({ ...clip, name: e.currentTarget.value })}
                  className="flex-1 min-w-0 h-7 px-2 rounded-md bg-white/5 border border-white/10 text-[12px] outline-none"
                />
                <select
                  value={clip.kind}
                  onChange={(e) =>
                    update({
                      ...clip,
                      kind: e.currentTarget.value as SceneAudioClip["kind"],
                    })
                  }
                  aria-label="Loại clip"
                  className="h-7 rounded-md bg-black/40 border border-white/10 px-1 text-[11px] outline-none"
                >
                  <option value="sfx">Hiệu ứng</option>
                  <option value="music">Nhạc</option>
                </select>
                <button
                  onClick={() => void remove(clip)}
                  aria-label={`Xoá clip ${clip.name}`}
                  className="p-1.5 text-white/35 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-white/50">
                <NumField label="Bắt đầu (s)" value={clip.startSec} min={0} max={scene.durationSec} step={0.1}
                  onChange={(v) => update({ ...clip, startSec: v })} />
                <NumField label="Âm lượng" value={clip.volume} min={0} max={1.5} step={0.05}
                  onChange={(v) => update({ ...clip, volume: v })} />
                <NumField label="Cắt đầu (s)" value={clip.offsetSec} min={0} max={clip.sourceDurationSec} step={0.1}
                  onChange={(v) => update({ ...clip, offsetSec: v })} />
                <NumField label="Độ dài (s)" value={clip.durationSec} min={0.1} max={clip.sourceDurationSec} step={0.1}
                  onChange={(v) => update({ ...clip, durationSec: v })} />
                <NumField label="Mở đầu nhỏ→to (s)" value={clip.fadeInSec} min={0} max={clip.durationSec / 2} step={0.1}
                  onChange={(v) => update({ ...clip, fadeInSec: v })} />
                <NumField label="Cuối nhỏ dần (s)" value={clip.fadeOutSec} min={0} max={clip.durationSec / 2} step={0.1}
                  onChange={(v) => update({ ...clip, fadeOutSec: v })} />
              </div>
              <p className="text-[10.5px] text-white/30 flex items-center gap-1">
                <Music className="w-3 h-3" />
                File gốc dài {clip.sourceDurationSec.toFixed(1)}s · nghe từ{" "}
                {clip.offsetSec.toFixed(1)}s, dài {clip.durationSec.toFixed(1)}s
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.currentTarget.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="w-full h-8 px-2 rounded-md bg-black/40 border border-white/10 text-right text-white/85 outline-none"
      />
    </label>
  );
}
