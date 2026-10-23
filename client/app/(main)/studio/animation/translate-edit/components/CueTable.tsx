"use client";

import { Flag } from "lucide-react";
import { characterName, type CueV2, type Series } from "../../lib/library";

/** CPS = ký tự/giây của bản chính — chỉ số đọc nhanh quan trọng nhất. */
export function cueCps(cue: CueV2): number {
  const chars = cue.text.replace(/\s/g, "").length;
  return cue.durationSec > 0 ? chars / cue.durationSec : 0;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

/**
 * Bảng cue chuẩn studio (kiểu OOONA/Aegisub): cột In | Out | Dur | CPS |
 * Nhân vật | Nội dung. Bấm hàng = chọn + nhảy video; hàng đang phát
 * được highlight. CPS chỉ hiển thị số ở slice này — tô màu cảnh báo
 * theo chuẩn Netflix thuộc Slice S4 (QC).
 */
export function CueTable({
  cues,
  series,
  currentTimeSec,
  selectedCueId,
  onSelect,
}: {
  cues: CueV2[];
  series: Series | null;
  currentTimeSec: number;
  selectedCueId: string | null;
  onSelect: (cue: CueV2) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
      <div className="grid grid-cols-[52px_52px_44px_40px_minmax(0,1fr)] gap-x-2 px-2.5 py-1.5 text-[10px] font-semibold tracking-wide text-white/40 border-b border-white/[0.07]">
        <span>IN</span>
        <span>OUT</span>
        <span>DUR</span>
        <span>CPS</span>
        <span>NỘI DUNG</span>
      </div>
      <div className="max-h-[430px] overflow-y-auto">
        {cues.map((cue, i) => {
          const active =
            currentTimeSec >= cue.startSec &&
            currentTimeSec < cue.startSec + cue.durationSec;
          const speaker = characterName(series, cue.speakerId);
          return (
            <button
              key={cue.id}
              onClick={() => onSelect(cue)}
              className={`w-full grid grid-cols-[52px_52px_44px_40px_minmax(0,1fr)] gap-x-2 px-2.5 py-1.5 text-left text-[11px] border-b border-white/[0.04] transition ${
                cue.id === selectedCueId
                  ? "bg-fuchsia-500/[0.16]"
                  : active
                    ? "bg-fuchsia-500/[0.07]"
                    : "hover:bg-white/[0.04]"
              }`}
            >
              <span className="tabular-nums text-white/60">{fmt(cue.startSec)}</span>
              <span className="tabular-nums text-white/60">
                {fmt(cue.startSec + cue.durationSec)}
              </span>
              <span className="tabular-nums text-white/60">
                {cue.durationSec.toFixed(1)}
              </span>
              <span className="tabular-nums text-white/80">
                {cue.text.trim() ? cueCps(cue).toFixed(0) : "—"}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  {speaker && (
                    <span className="shrink-0 px-1 rounded bg-white/10 text-[9px] font-semibold text-white/70">
                      {speaker}
                    </span>
                  )}
                  {cue.flag && (
                    <Flag className="w-3 h-3 text-amber-300 shrink-0" aria-label={cue.flag} />
                  )}
                  <span className="truncate text-white/85">
                    {cue.text || (
                      <span className="text-white/30">
                        {cue.sourceText ? `(chưa dịch) ${cue.sourceText}` : `Cue ${i + 1} — trống`}
                      </span>
                    )}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
        {cues.length === 0 && (
          <p className="px-3 py-4 text-[12px] text-white/35">
            Chưa có cue nào — thêm cue hoặc nhập .srt ở thanh công cụ phía trên.
          </p>
        )}
      </div>
    </div>
  );
}
