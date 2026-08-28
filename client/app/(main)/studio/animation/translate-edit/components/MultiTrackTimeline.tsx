"use client";

import { Film, Layers, Mic, Music, Subtitles } from "lucide-react";
import { tracks } from "../../data";

interface MultiTrackTimelineProps {
  playhead: number;
  setPlayhead: (p: number) => void;
}

const getTrackIcon = (type: string) => {
  switch (type) {
    case "film": return <Film className="w-3.5 h-3.5" />;
    case "subtitles": return <Subtitles className="w-3.5 h-3.5" />;
    case "mic": return <Mic className="w-3.5 h-3.5" />;
    case "music": return <Music className="w-3.5 h-3.5" />;
    case "layers": return <Layers className="w-3.5 h-3.5" />;
    default: return <Film className="w-3.5 h-3.5" />;
  }
};

export function MultiTrackTimeline({ playhead, setPlayhead }: MultiTrackTimelineProps) {
  return (
    <div className="border-t border-white/10 bg-black/40">
      <div className="flex items-center px-4 h-9 border-b border-white/5 text-[11px] text-white/40 font-mono">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="flex-1 border-l border-white/10 pl-1">00:{String(i * 3).padStart(2, "0")}</div>
        ))}
      </div>
      <div
        className="px-2 py-2 space-y-1 relative cursor-pointer"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const pct = ((e.clientX - rect.left - 184) / (rect.width - 184)) * 100;
          setPlayhead(Math.max(0, Math.min(100, pct)));
        }}
      >
        {tracks.map((tr: typeof tracks[number]) => (
          <div key={tr.name} className="flex items-center gap-2 h-8">
            <div className="w-44 shrink-0 flex items-center gap-2 px-2 text-xs text-white/70">
              <span className="text-fuchsia-300">{getTrackIcon(tr.type)}</span>
              <span className="truncate font-medium">{tr.name}</span>
            </div>
            <div className="relative flex-1 h-6 bg-white/[0.03] rounded">
              {tr.blocks.map((b: { x: number; w: number }, i: number) => (
                <div
                  key={i}
                  className={`absolute top-0 bottom-0 rounded bg-gradient-to-r ${tr.color} shadow-[0_0_12px_rgba(180,120,255,0.25)]`}
                  style={{ left: `${b.x}%`, width: `${b.w}%` }}
                />
              ))}
            </div>
          </div>
        ))}
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-fuchsia-300 shadow-[0_0_8px_rgba(217,70,239,0.8)]"
          style={{ left: `calc(184px + ${playhead}% * (100% - 184px) / 100)` }}
        >
          <span className="absolute -top-1 -left-1.5 w-3 h-3 rotate-45 bg-fuchsia-300" />
        </div>
      </div>
    </div>
  );
}
