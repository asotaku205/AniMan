"use client";

import { useRef } from "react";
import { Download, FileUp, Plus } from "lucide-react";
import { newDialogueId, type DialogueLine } from "../../lib/dialogue";
import { parseSrt, toSrt } from "../../lib/srt";

/**
 * Thanh công cụ phụ đề (Slice S2): thêm cue tại playhead, nhập/xuất
 * .srt. Việc sửa từng cue chuyển sang bảng cue + Inspector (bố cục
 * studio 3 vùng); component này chỉ còn các thao tác cấp danh sách.
 * Tên giữ là SubTab để khỏi đổi các điểm import — nội dung đã khác bản cũ.
 */
export function SubTab({
  cues,
  currentTimeSec,
  onCuesChange,
}: {
  cues: DialogueLine[];
  currentTimeSec: number;
  selectedCueId?: string | null;
  onCuesChange: (cues: DialogueLine[]) => void;
  onSeek?: (sec: number, cueId: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

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
        <Plus className="w-3.5 h-3.5" /> Cue tại {currentTimeSec.toFixed(1)}s
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10"
      >
        <FileUp className="w-3.5 h-3.5" /> Nhập .srt
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
  );
}
