"use client";

/**
 * Điều khiển giọng cho MỘT dòng thoại (Slice B2): thu giọng trực tiếp
 * (thu thường + thu theo nhịp có bíp dẫn), nghe lại, chọn bản dùng khi
 * xuất phim (★), chỉnh âm lượng, xoá bản thu. File tiếng lưu vào kho
 * Blob của Animation Studio; metadata nằm trên chính dòng thoại.
 */

import { useEffect, useRef, useState } from "react";
import { Mic, Play, Square, Star, Trash2 } from "lucide-react";
import {
  addDialogueTake,
  newTakeId,
  removeDialogueTake,
  selectDialogueTake,
  setDialogueTakeVolume,
  type DialogueLine,
} from "../lib/dialogue";
import {
  deleteVoiceBlob,
  loadVoiceBlob,
  saveVoiceBlob,
} from "../lib/animStorage";

function beep(ctx: AudioContext, at: number, freq = 880) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.15, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.12);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.13);
}

function probeDuration(blob: Blob, fallback: number): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) && d > 0 ? d : fallback);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(fallback);
    };
    audio.src = url;
  });
}

export default function DialogueVoice({
  line,
  onChange,
}: {
  line: DialogueLine;
  onChange: (next: DialogueLine) => void;
}) {
  const [recording, setRecording] = useState<"normal" | "loop" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playingTakeId, setPlayingTakeId] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioRef.current?.pause();
    },
    [],
  );

  const startRecording = async (mode: "normal" | "loop") => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        void finishRecording();
      };
      if (mode === "loop") {
        // 3 bíp dẫn nhịp (bíp cuối cao hơn) rồi mới bắt đầu thu, tự dừng
        // sau thời lượng của dòng + 0.6s đệm.
        const ctx = new AudioContext();
        const t0 = ctx.currentTime + 0.05;
        beep(ctx, t0);
        beep(ctx, t0 + 0.35);
        beep(ctx, t0 + 0.7, 1320);
        window.setTimeout(() => {
          void ctx.close().catch(() => undefined);
          startedAtRef.current = performance.now();
          recorder.start();
          setRecording("loop");
          autoStopRef.current = setTimeout(
            () => stopRecording(),
            (line.durationSec + 0.6) * 1000,
          );
        }, 900);
        setRecording("loop");
      } else {
        startedAtRef.current = performance.now();
        recorder.start();
        setRecording("normal");
      }
    } catch {
      setError(
        "Không truy cập được mic — hãy kiểm tra quyền mic của trình duyệt rồi thử lại.",
      );
      setRecording(null);
    }
  };

  const stopRecording = () => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    } else {
      setRecording(null);
    }
  };

  const finishRecording = async () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecording(null);
    const blob = new Blob(chunksRef.current, {
      type: recorderRef.current?.mimeType || "audio/webm",
    });
    if (blob.size === 0) return;
    const elapsed = (performance.now() - startedAtRef.current) / 1000;
    const durationSec = await probeDuration(blob, elapsed);
    const takeId = newTakeId();
    try {
      await saveVoiceBlob(takeId, blob);
    } catch {
      setError("Không lưu được bản thu — hãy thử lại.");
      return;
    }
    onChange(
      addDialogueTake(line, {
        id: takeId,
        durationSec: Math.round(durationSec * 10) / 10,
        volume: 1,
        createdAt: Date.now(),
      }),
    );
  };

  const playTake = async (takeId: string) => {
    audioRef.current?.pause();
    if (playingTakeId === takeId) {
      setPlayingTakeId(null);
      return;
    }
    const blob = await loadVoiceBlob(takeId);
    if (!blob) {
      setError("Không tìm thấy file của bản thu này.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => {
      setPlayingTakeId(null);
      URL.revokeObjectURL(url);
    };
    setPlayingTakeId(takeId);
    await audio.play().catch(() => setPlayingTakeId(null));
  };

  const removeTake = async (takeId: string) => {
    await deleteVoiceBlob(takeId).catch(() => undefined);
    onChange(removeDialogueTake(line, takeId));
  };

  const takes = line.takes ?? [];

  return (
    <div className="rounded-lg border border-fuchsia-300/15 bg-fuchsia-500/[0.04] p-2 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {recording ? (
          <button
            onClick={stopRecording}
            className="flex items-center gap-1 px-2 h-7 rounded-lg bg-rose-500/80 text-[11px] font-medium animate-pulse"
          >
            <Square className="w-3 h-3" /> Đang thu… bấm để dừng
          </button>
        ) : (
          <>
            <button
              onClick={() => void startRecording("normal")}
              className="flex items-center gap-1 px-2 h-7 rounded-lg bg-fuchsia-500/25 border border-fuchsia-300/30 text-[11px] hover:bg-fuchsia-500/40"
            >
              <Mic className="w-3 h-3" /> Thu giọng
            </button>
            <button
              onClick={() => void startRecording("loop")}
              title="Phát 3 tiếng bíp dẫn nhịp rồi thu đúng thời lượng của dòng thoại"
              className="flex items-center gap-1 px-2 h-7 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
            >
              <Mic className="w-3 h-3" /> Thu theo nhịp
            </button>
          </>
        )}
        {takes.length === 0 && (
          <span className="text-[11px] text-white/35">
            Chưa có bản thu — dòng này sẽ chỉ hiện phụ đề khi xuất phim.
          </span>
        )}
      </div>

      {takes.map((take, i) => {
        const selected = line.selectedTakeId === take.id;
        return (
          <div
            key={take.id}
            className="flex flex-wrap items-center gap-2 text-[11px]"
          >
            <button
              onClick={() => void playTake(take.id)}
              aria-label={playingTakeId === take.id ? "Dừng nghe" : "Nghe bản thu"}
              className="flex items-center gap-1 px-2 h-7 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
            >
              {playingTakeId === take.id ? (
                <Square className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              Bản {i + 1} · {take.durationSec.toFixed(1)}s
            </button>
            <button
              onClick={() => onChange(selectDialogueTake(line, take.id))}
              title="Dùng bản này khi xuất phim"
              className={`flex items-center gap-1 px-2 h-7 rounded-lg border ${
                selected
                  ? "bg-amber-400/20 border-amber-300/40 text-amber-200"
                  : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
              }`}
            >
              <Star className={`w-3 h-3 ${selected ? "fill-amber-300" : ""}`} />
              {selected ? "Đang dùng" : "Chọn dùng"}
            </button>
            <label className="flex items-center gap-1 text-white/40">
              Âm lượng
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={take.volume}
                onChange={(e) =>
                  onChange(
                    setDialogueTakeVolume(
                      line,
                      take.id,
                      Number(e.currentTarget.value),
                    ),
                  )
                }
                className="w-16 accent-fuchsia-400"
              />
            </label>
            <button
              onClick={() => void removeTake(take.id)}
              aria-label="Xoá bản thu"
              className="text-white/35 hover:text-rose-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      {error && <p className="text-[11px] text-rose-300">{error}</p>}
    </div>
  );
}
