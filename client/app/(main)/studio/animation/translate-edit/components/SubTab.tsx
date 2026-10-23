"use client";

import { useRef } from "react";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { newDialogueId, type DialogueLine } from "../../lib/dialogue";
import { parseSrt, toSrt } from "../../lib/srt";

/**
 * Tab PHỤ ĐỀ — sửa cue theo mốc thời gian của video thật: thêm cue tại
 * playhead, sửa nội dung/bắt đầu/độ dài, nhập/xuất file .srt chuẩn.
 */
export function SubTab({
  cues,
  currentTimeSec,
  selectedCueId,
  onCuesChange,
  onSeek,
}: {
  cues: DialogueLine[];
  currentTimeSec: number;
  selectedCueId: string | null;
  onCuesChange: (cues: DialogueLine[]) => void;
  onSeek: (sec: number, cueId: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const patch = (id: string, p: Partial<DialogueLine>) =>
    onCuesChange(cues.map((c) => (c.id === id ? { ...c, ...p } : c)));

  const downloadSrt = () => {
    const blob = new Blob([toSrt(cues)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "phu-de.srt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            onCuesChange(
              [
                ...cues,
                {
                  id: newDialogueId(),
                  text: "",
                  startSec: Math.round(currentTimeSec * 10) / 10,
                  durationSec: 2.5,
                },
              ].sort((a, b) => a.startSec - b.startSec),
            )
          }
          className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-fuchsia-500/25 border border-fuchsia-400/40 text-[12px] font-medium hover:bg-fuchsia-500/35"
        >
          <Plus className="w-3.5 h-3.5" /> Thêm cue tại {currentTimeSec.toFixed(1)}s
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10"
        >
          <Upload className="w-3.5 h-3.5" /> Nhập .srt
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".srt,text/plain"
          className="hidden"
          onChange={async (e) => {
            const file = e.currentTarget.files?.[0];
            if (!file) return;
            const parsed = parseSrt(await file.text());
            if (parsed.length > 0) onCuesChange(parsed);
            e.currentTarget.value = "";
          }}
        />
        <button
          onClick={downloadSrt}
          disabled={cues.length === 0}
          className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10 disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" /> Xuất .srt
        </button>
      </div>

      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
        {cues.map((cue) => (
          <div
            key={cue.id}
            className={`rounded-xl border p-3 space-y-2 ${
              cue.id === selectedCueId
                ? "border-fuchsia-400/50 bg-fuchsia-500/[0.07]"
                : "border-white/10 bg-black/30"
            }`}
          >
            <div className="flex items-center gap-2 text-[11px] text-white/45">
              <button
                onClick={() => onSeek(cue.startSec, cue.id)}
                className="px-2 h-6 rounded bg-white/5 border border-white/10 tabular-nums hover:bg-white/10"
                title="Nhảy video tới cue này"
              >
                ▶ {cue.startSec.toFixed(1)}s
              </button>
              <label className="flex items-center gap-1">
                Bắt đầu
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={cue.startSec}
                  onChange={(e) => patch(cue.id, { startSec: Number(e.currentTarget.value) })}
                  className="w-16 h-7 rounded bg-black/50 border border-white/10 px-1.5 text-white"
                />
              </label>
              <label className="flex items-center gap-1">
                Dài
                <input
                  type="number"
                  min={0.3}
                  step={0.1}
                  value={cue.durationSec}
                  onChange={(e) => patch(cue.id, { durationSec: Number(e.currentTarget.value) })}
                  className="w-16 h-7 rounded bg-black/50 border border-white/10 px-1.5 text-white"
                />
                s
              </label>
              <button
                onClick={() => onCuesChange(cues.filter((c) => c.id !== cue.id))}
                aria-label="Xoá cue"
                className="ml-auto text-white/35 hover:text-rose-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={cue.text}
              onChange={(e) => patch(cue.id, { text: e.currentTarget.value })}
              rows={2}
              placeholder="Nội dung phụ đề…"
              className="w-full rounded-lg bg-black/40 border border-white/10 px-2.5 py-2 text-[13px] outline-none focus:border-fuchsia-400/50 placeholder:text-white/25"
            />
          </div>
        ))}
        {cues.length === 0 && (
          <p className="text-[13px] text-white/35 leading-relaxed">
            Chưa có phụ đề nào. Nhập file .srt có sẵn, hoặc bấm "Thêm cue" tại
            vị trí video đang phát để gõ phụ đề mới.
          </p>
        )}
      </div>
    </div>
  );
}
