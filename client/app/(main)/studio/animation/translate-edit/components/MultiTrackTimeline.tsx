"use client";

import type { DialogueLine } from "../../lib/dialogue";

/**
 * Dải timeline của phòng biên tập: mỗi cue là một khối theo tỉ lệ thời
 * gian thật của video, bấm để nhảy tới, vạch đỏ là playhead. Thay cho
 * bản mock cũ (dải trang trí không gắn dữ liệu).
 */
export function MultiTrackTimeline({
  cues,
  durationSec,
  currentTimeSec,
  selectedCueId,
  onSeek,
}: {
  cues: DialogueLine[];
  durationSec: number;
  currentTimeSec: number;
  selectedCueId: string | null;
  onSeek: (sec: number, cueId: string) => void;
}) {
  const total = Math.max(durationSec, ...cues.map((c) => c.startSec + c.durationSec), 1);
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-3">
      <div className="relative h-12">
        {cues.map((cue) => {
          const left = (cue.startSec / total) * 100;
          const width = Math.max(1.5, (cue.durationSec / total) * 100);
          const active = currentTimeSec >= cue.startSec && currentTimeSec < cue.startSec + cue.durationSec;
          return (
            <button
              key={cue.id}
              onClick={() => onSeek(cue.startSec, cue.id)}
              title={`${cue.startSec.toFixed(1)}s — ${cue.text.slice(0, 40)}`}
              className={`absolute top-1 h-10 rounded-md border px-1.5 text-left overflow-hidden transition ${
                cue.id === selectedCueId
                  ? "border-fuchsia-400/70 bg-fuchsia-500/30"
                  : active
                    ? "border-fuchsia-400/40 bg-fuchsia-500/20"
                    : "border-white/10 bg-white/[0.06] hover:bg-white/[0.12]"
              }`}
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              <span className="block text-[10px] leading-tight text-white/75 line-clamp-2">
                {cue.text}
              </span>
            </button>
          );
        })}
        <span
          className="absolute top-0 h-12 w-0.5 bg-rose-500 pointer-events-none"
          style={{ left: `${Math.min(100, (currentTimeSec / total) * 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-white/35 mt-1 tabular-nums">
        <span>0:00</span>
        <span>{Math.floor(total / 60)}:{String(Math.floor(total % 60)).padStart(2, "0")}</span>
      </div>
    </div>
  );
}
