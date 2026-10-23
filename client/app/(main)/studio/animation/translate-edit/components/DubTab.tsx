"use client";

import { useEffect, useRef, useState } from "react";
import {
  Circle,
  Play,
  Square,
  Star,
  Trash2,
  Volume2,
} from "lucide-react";
import {
  newLibraryId,
  type CueV2,
  type Series,
  type TakeMeta,
} from "../../lib/library";
import {
  deleteTakeBlob,
  loadTakeBlob,
  saveTakeBlob,
} from "../../lib/libraryStorage";

const TTS_LANGS = [
  { id: "vi-VN", label: "Tiếng Việt" },
  { id: "en-US", label: "English" },
  { id: "ja-JP", label: "Tiếng Nhật" },
  { id: "ko-KR", label: "Tiếng Hàn" },
];

/** 3 tiếng beep cách nhau 1s bằng oscillator; nhịp thứ 4 câm = điểm vào câu (chuẩn ADR). */
function playCountInBeeps(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = new AudioContext();
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.15;
        osc.connect(gain).connect(ctx.destination);
        const at = ctx.currentTime + i;
        osc.start(at);
        osc.stop(at + 0.12);
      }
      setTimeout(() => {
        void ctx.close();
        resolve();
      }, 3000);
    } catch {
      resolve();
    }
  });
}

/**
 * Panel LỒNG TIẾNG chuẩn ADR (Slice S5) trên dữ liệu takes v2: mỗi cue
 * thu NHIỀU takes, ★ chọn bản tốt nhất, chỉnh âm lượng từng take, thu
 * theo loop có beep dẫn nhịp, nghe thử TTS và nghe thử kèm video với
 * tiếng gốc bị hạ (ducking) — do workspace điều khiển qua callback.
 * Blob bản thu nằm ở store takeBlobs của thư viện (không còn store cũ).
 */
export function DubTab({
  cues,
  series,
  onPatchCue,
  onSeek,
  playSegment,
  previewDub,
}: {
  cues: CueV2[];
  series: Series | null;
  onPatchCue: (cueId: string, patch: Partial<CueV2>) => void;
  onSeek: (sec: number, cueId: string) => void;
  /** Phát đoạn video [start, end] — workspace sở hữu thẻ video. */
  playSegment: (startSec: number, endSec: number) => void;
  /** Nghe thử take đã chọn kèm video, tiếng gốc bị hạ (ducking). */
  previewDub: (cue: CueV2) => void;
}) {
  const [ttsLang, setTtsLang] = useState(
    series?.targetLang === "en"
      ? "en-US"
      : series?.targetLang === "ja"
        ? "ja-JP"
        : series?.targetLang === "ko"
          ? "ko-KR"
          : "vi-VN",
  );
  const [recordingCueId, setRecordingCueId] = useState<string | null>(null);
  const [countInCueId, setCountInCueId] = useState<string | null>(null);
  const [takeUrls, setTakeUrls] = useState<Record<string, string>>({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef(0);

  // Nạp URL phát cho mọi take hiện có
  const takeIdsKey = cues
    .flatMap((c) => c.takes.map((t) => t.id))
    .join(",");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ids = takeIdsKey ? takeIdsKey.split(",") : [];
      const urls: Record<string, string> = {};
      for (const id of ids) {
        const blob = await loadTakeBlob(id);
        if (blob) urls[id] = URL.createObjectURL(blob);
      }
      if (!cancelled) {
        setTakeUrls((prev) => {
          for (const url of Object.values(prev)) URL.revokeObjectURL(url);
          return urls;
        });
      } else {
        for (const url of Object.values(urls)) URL.revokeObjectURL(url);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [takeIdsKey]);

  const speak = (text: string) => {
    if (!text.trim() || typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = ttsLang;
    window.speechSynthesis.speak(utter);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecordingCueId(null);
  };

  const startRecording = async (cue: CueV2, withCountIn: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (withCountIn) {
        setCountInCueId(cue.id);
        playSegment(cue.startSec, cue.startSec + cue.durationSec);
        await playCountInBeeps();
        setCountInCueId(null);
      } else {
        onSeek(cue.startSec, cue.id);
      }
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const durationSec = (Date.now() - recordStartRef.current) / 1000;
        const take: TakeMeta = {
          id: newLibraryId("take"),
          durationSec,
          volume: 1,
          createdAt: Date.now(),
        };
        await saveTakeBlob(take.id, blob);
        onPatchCue(cue.id, {
          takes: [...cue.takes, take],
          selectedTakeId: take.id,
        });
      };
      recorderRef.current = recorder;
      recordStartRef.current = Date.now();
      recorder.start(200);
      setRecordingCueId(cue.id);
      // Tự dừng sau thời lượng cue + 1s đệm
      setTimeout(() => {
        if (recorderRef.current === recorder && recorder.state !== "inactive") {
          stopRecording();
        }
      }, (cue.durationSec + 1) * 1000);
    } catch {
      setRecordingCueId(null);
      setCountInCueId(null);
    }
  };

  const removeTake = async (cue: CueV2, takeId: string) => {
    await deleteTakeBlob(takeId);
    const takes = cue.takes.filter((t) => t.id !== takeId);
    onPatchCue(cue.id, {
      takes,
      selectedTakeId:
        cue.selectedTakeId === takeId ? takes[0]?.id : cue.selectedTakeId,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12px] text-white/50 leading-relaxed flex-1 min-w-[180px]">
          Thu nhiều bản cho mỗi câu — bản ★ sẽ được dùng khi xuất. "Thu
          theo vòng lặp" phát đoạn phim kèm 3 tiếng bíp dẫn nhịp như trong
          phòng thu.
        </p>
        <select
          value={ttsLang}
          onChange={(e) => setTtsLang(e.currentTarget.value)}
          aria-label="Ngôn ngữ giọng đọc thử"
          className="h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] outline-none"
        >
          {TTS_LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              Giọng đọc: {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-0.5">
        {cues.map((cue, i) => {
          const recording = recordingCueId === cue.id;
          const counting = countInCueId === cue.id;
          return (
            <div
              key={cue.id}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur p-3 space-y-2 transition-all duration-200 hover:border-fuchsia-400/30"
            >
              <button
                onClick={() => onSeek(cue.startSec, cue.id)}
                className="text-left w-full"
              >
                <span className="text-[10px] text-white/35 tabular-nums">
                  #{i + 1} · {cue.startSec.toFixed(1)}s · {cue.durationSec.toFixed(1)}s
                  {cue.takes.length > 0 ? ` · ${cue.takes.length} takes` : ""}
                </span>
                <span className="block text-[13px] text-white/85 leading-snug">
                  {cue.text || <span className="text-white/30">(chưa có lời thoại)</span>}
                </span>
              </button>

              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => speak(cue.text)}
                  className="flex items-center gap-1 px-2.5 h-7 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Nghe giọng đọc thử
                </button>
                {recording ? (
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-1 px-2.5 h-7 rounded-lg bg-rose-500/30 border border-rose-400/50 text-[11px] font-medium animate-pulse"
                  >
                    <Square className="w-3.5 h-3.5" /> Dừng thu
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => void startRecording(cue, false)}
                      disabled={counting}
                      className="flex items-center gap-1 px-2.5 h-7 rounded-lg bg-rose-500/20 border border-rose-400/40 text-[11px] hover:bg-rose-500/30 disabled:opacity-40"
                    >
                      <Circle className="w-3.5 h-3.5" /> Thu giọng
                    </button>
                    <button
                      onClick={() => void startRecording(cue, true)}
                      disabled={counting}
                      className="flex items-center gap-1 px-2.5 h-7 rounded-lg bg-fuchsia-500/20 border border-fuchsia-400/40 text-[11px] hover:bg-fuchsia-500/30 disabled:opacity-40"
                    >
                      <Play className="w-3.5 h-3.5" />
                      {counting ? "Đang beep dẫn nhịp…" : "Thu theo loop"}
                    </button>
                  </>
                )}
                {cue.selectedTakeId && (
                  <button
                    onClick={() => previewDub(cue)}
                    className="flex items-center gap-1 px-2.5 h-7 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-[11px] hover:bg-emerald-500/25"
                  >
                    <Play className="w-3.5 h-3.5" /> Nghe kèm video (tiếng gốc nhỏ lại)
                  </button>
                )}
              </div>

              {cue.takes.length > 0 && (
                <div className="space-y-1.5">
                  {cue.takes.map((take, ti) => (
                    <div
                      key={take.id}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                        cue.selectedTakeId === take.id
                          ? "border-amber-300/40 bg-amber-400/[0.06]"
                          : "border-white/[0.07] bg-white/[0.02]"
                      }`}
                    >
                      <button
                        onClick={() =>
                          onPatchCue(cue.id, { selectedTakeId: take.id })
                        }
                        aria-label="Chọn take này để xuất bản"
                        className={
                          cue.selectedTakeId === take.id
                            ? "text-amber-300"
                            : "text-white/30 hover:text-amber-200"
                        }
                      >
                        <Star
                          className="w-4 h-4"
                          fill={cue.selectedTakeId === take.id ? "currentColor" : "none"}
                        />
                      </button>
                      <span className="text-[11px] text-white/60 w-14">
                        Take {ti + 1}
                        {take.durationSec > 0
                          ? ` · ${take.durationSec.toFixed(1)}s`
                          : ""}
                      </span>
                      {takeUrls[take.id] ? (
                        <audio
                          src={takeUrls[take.id]}
                          controls
                          className="h-7 flex-1 min-w-[90px]"
                          ref={(el) => {
                            if (el) el.volume = take.volume;
                          }}
                        />
                      ) : (
                        <span className="flex-1 text-[11px] text-white/30">Đang tải bản thu…</span>
                      )}
                      <input
                        type="range"
                        min={0}
                        max={1.5}
                        step={0.05}
                        value={take.volume}
                        onChange={(e) =>
                          onPatchCue(cue.id, {
                            takes: cue.takes.map((t) =>
                              t.id === take.id
                                ? { ...t, volume: Number(e.currentTarget.value) }
                                : t,
                            ),
                          })
                        }
                        aria-label="Âm lượng take"
                        className="w-16 accent-fuchsia-400"
                      />
                      <button
                        onClick={() => void removeTake(cue, take.id)}
                        aria-label="Xoá take"
                        className="text-white/35 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {cues.length === 0 && (
          <p className="text-[12px] text-white/35">
            Chưa có cue nào — tạo cue ở mode Phụ đề trước rồi quay lại đây thu.
          </p>
        )}
      </div>
    </div>
  );
}
