"use client";

import { Flag, Star } from "lucide-react";
import { characterName, type CueV2, type Series } from "../../lib/library";
import { cueCps } from "./CueTable";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

/**
 * Danh sách cue kiểu "script card" (hướng B — Descript/CapCut): mỗi cue
 * là một thẻ kịch bản — avatar + tên nhân vật, dòng gốc phía trên, bản
 * dịch phía dưới, chip mốc thời gian/CPS/cờ/take. Bấm thẻ = chọn + nhảy
 * video. Đầy đủ thông tin như bảng cue, trình bày kiểu creator.
 */
export function CueScriptList({
  cues,
  series,
  currentTimeSec,
  selectedCueId,
  onSelect,
  qcMaxCps,
}: {
  cues: CueV2[];
  series: Series | null;
  currentTimeSec: number;
  selectedCueId: string | null;
  onSelect: (cue: CueV2) => void;
  /** Ngưỡng CPS của QC — vượt ngưỡng thì chip CPS tô đỏ. */
  qcMaxCps: number;
}) {
  if (cues.length === 0) {
    return (
      <p className="text-[12.5px] text-white/35 leading-relaxed">
        Chưa có cue nào. Thêm cue tại vị trí playhead bằng nút phía trên,
        nhập file .srt, hoặc đánh dấu In/Out (phím I/O) trên thanh thời gian.
      </p>
    );
  }
  return (
    <div className="space-y-2.5">
      {cues.map((cue) => {
        const active =
          currentTimeSec >= cue.startSec &&
          currentTimeSec < cue.startSec + cue.durationSec;
        const selected = cue.id === selectedCueId;
        const cps = cueCps(cue);
        const over = cps > qcMaxCps;
        const speaker = characterName(series, cue.speakerId);
        const color = series?.characters.find(
          (c) => c.id === cue.speakerId,
        )?.color;
        return (
          <button
            key={cue.id}
            onClick={() => onSelect(cue)}
            className={`w-full text-left rounded-2xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 ${
              selected
                ? "border-fuchsia-400/60 bg-fuchsia-500/[0.07] shadow-[0_10px_26px_rgba(217,70,239,0.18)] ring-1 ring-fuchsia-400/40"
                : "border-white/[0.08] bg-white/[0.03] backdrop-blur hover:border-fuchsia-400/30"
            }`}
          >
            <div className="flex gap-3">
              <span
                className="w-9 h-9 rounded-full grid place-items-center text-[12px] font-bold shrink-0 bg-fuchsia-500/15 text-fuchsia-200"
                style={
                  color
                    ? { backgroundColor: `${color}2e`, color }
                    : undefined
                }
              >
                {(speaker ?? "?").slice(0, 1)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold">
                    {speaker ?? "Chưa gán nhân vật"}
                  </span>
                  <span className="text-[10.5px] font-mono tabular-nums text-white/40 bg-black/40 border border-white/[0.07] px-1.5 py-0.5 rounded-md">
                    {fmt(cue.startSec)} → {fmt(cue.startSec + cue.durationSec)}
                  </span>
                  {active && (
                    <span className="flex items-center gap-1 text-[10.5px] font-semibold text-rose-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                      Đang phát
                    </span>
                  )}
                </div>
                {cue.sourceText && (
                  <p className="mt-1 text-[12.5px] text-white/40 leading-relaxed">
                    {cue.sourceText}
                  </p>
                )}
                {cue.text ? (
                  <p className="mt-0.5 text-[13.5px] leading-relaxed">
                    {cue.text}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[13px] italic text-white/30">
                    Chưa có bản dịch…
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span
                    className={`text-[10.5px] font-mono tabular-nums px-1.5 py-0.5 rounded-md border ${
                      over
                        ? "text-rose-300 border-rose-400/40 bg-rose-500/10"
                        : "text-white/45 border-white/[0.08] bg-black/30"
                    }`}
                  >
                    CPS {cps.toFixed(1)}
                  </span>
                  <span className="text-[10.5px] font-mono tabular-nums px-1.5 py-0.5 rounded-md border border-white/[0.08] bg-black/30 text-white/45">
                    {cue.durationSec.toFixed(1)}s
                  </span>
                  {cue.selectedTakeId && (
                    <span className="flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-md border border-amber-300/30 bg-amber-400/10 text-amber-200">
                      <Star className="w-3 h-3" /> Đã có take
                    </span>
                  )}
                  {cue.flag && (
                    <span className="flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-md border border-orange-300/30 bg-orange-400/10 text-orange-200 max-w-full">
                      <Flag className="w-3 h-3 shrink-0" />
                      <span className="truncate">{cue.flag}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
