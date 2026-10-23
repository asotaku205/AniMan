"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Play, Square, Trash2, Volume2 } from "lucide-react";
import type { DialogueLine } from "../../lib/dialogue";
import { deleteTake, loadTake, saveTake } from "../../lib/videoEditorStorage";

const TTS_LANGS = [
  { id: "vi-VN", label: "Tiếng Việt" },
  { id: "en-US", label: "English" },
  { id: "ja-JP", label: "Tiếng Nhật" },
  { id: "ko-KR", label: "Tiếng Hàn" },
];

/**
 * Tab LỒNG TIẾNG — cho từng cue:
 * - Nghe thử bằng giọng máy (Web Speech, miễn phí, chạy ngay trên máy).
 * - Tự thu giọng của bạn qua micro (MediaRecorder); bản thu lưu bền
 *   trong IndexedDB để mở lại vẫn còn.
 * Ghép bản thu thành track hoàn chỉnh là bước xuất bản sau; ở đây nghe
 * lại từng câu và so với đoạn video tương ứng.
 */
export function DubTab({
  cues,
  onSeek,
}: {
  cues: DialogueLine[];
  onSeek: (sec: number, cueId: string) => void;
}) {
  const [ttsLang, setTtsLang] = useState("vi-VN");
  const [takeUrls, setTakeUrls] = useState<Record<string, string>>({});
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Nạp các bản thu đã lưu
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const urls: Record<string, string> = {};
      for (const cue of cues) {
        const blob = await loadTake(cue.id);
        if (blob) urls[cue.id] = URL.createObjectURL(blob);
      }
      if (!cancelled) setTakeUrls(urls);
    })();
    return () => {
      cancelled = true;
    };
    // chỉ nạp khi danh sách cue đổi id (không chạy lại theo nội dung chữ)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cues.map((c) => c.id).join(",")]);

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = ttsLang;
    window.speechSynthesis.speak(utter);
  };

  const toggleRecord = async (cue: DialogueLine) => {
    if (recordingId === cue.id) {
      recorderRef.current?.stop();
      setRecordingId(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        await saveTake(cue.id, blob);
        setTakeUrls((prev) => ({
          ...prev,
          [cue.id]: URL.createObjectURL(blob),
        }));
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecordingId(cue.id);
    } catch {
      setRecordingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-white/50">Giọng máy nghe thử:</span>
        <select
          value={ttsLang}
          onChange={(e) => setTtsLang(e.currentTarget.value)}
          className="h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] outline-none"
        >
          {TTS_LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
        {cues.map((cue) => (
          <div
            key={cue.id}
            className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2"
          >
            <div className="flex items-start gap-2">
              <button
                onClick={() => onSeek(cue.startSec, cue.id)}
                className="px-2 h-6 rounded bg-white/5 border border-white/10 text-[11px] tabular-nums hover:bg-white/10 shrink-0"
              >
                ▶ {cue.startSec.toFixed(1)}s
              </button>
              <p className="text-[13px] leading-relaxed flex-1">
                {cue.text || <span className="text-white/30">(cue trống)</span>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => speak(cue.text)}
                disabled={!cue.text.trim()}
                className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10 disabled:opacity-40"
              >
                <Volume2 className="w-3.5 h-3.5" /> Nghe giọng máy
              </button>
              <button
                onClick={() => void toggleRecord(cue)}
                className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg border text-[11px] font-medium ${
                  recordingId === cue.id
                    ? "bg-rose-500/30 border-rose-400/50 text-rose-100"
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                {recordingId === cue.id ? (
                  <>
                    <Square className="w-3.5 h-3.5" /> Dừng thu
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5" /> Thu giọng của bạn
                  </>
                )}
              </button>
              {takeUrls[cue.id] && (
                <>
                  <audio src={takeUrls[cue.id]} controls className="h-8 max-w-[220px]" />
                  <button
                    onClick={async () => {
                      await deleteTake(cue.id);
                      setTakeUrls((prev) => {
                        const next = { ...prev };
                        delete next[cue.id];
                        return next;
                      });
                    }}
                    aria-label="Xoá bản thu"
                    className="text-white/35 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
              {!takeUrls[cue.id] && recordingId !== cue.id && (
                <span className="text-[11px] text-white/30 flex items-center gap-1">
                  <Play className="w-3 h-3" /> Chưa có bản thu
                </span>
              )}
            </div>
          </div>
        ))}
        {cues.length === 0 && (
          <p className="text-[13px] text-white/35">
            Chưa có cue nào — thêm phụ đề ở tab Phụ đề trước, rồi quay lại đây
            để lồng tiếng theo từng câu.
          </p>
        )}
      </div>
    </div>
  );
}
