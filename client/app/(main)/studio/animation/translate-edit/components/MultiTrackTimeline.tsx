"use client";

import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import type { DialogueLine } from "../../lib/dialogue";
import { formatTimecode } from "../../lib/timecode";

/**
 * Timeline chuẩn studio (Slice S3): sóng âm (waveform) vẽ trên canvas,
 * track cue phía trên, thước timecode, zoom theo px/giây, bấm/kéo trên
 * timeline để seek. Thay cho dải khối tỉ lệ của bản đầu.
 * (Tên file giữ MultiTrackTimeline cho khỏi đổi điểm import.)
 */
export function MultiTrackTimeline({
  cues,
  durationSec,
  currentTimeSec,
  selectedCueId,
  peaks,
  fps,
  onSeek,
}: {
  cues: DialogueLine[];
  durationSec: number;
  currentTimeSec: number;
  selectedCueId: string | null;
  peaks?: number[] | null;
  fps?: number;
  onSeek: (sec: number, cueId: string) => void;
}) {
  const total = Math.max(
    durationSec,
    ...cues.map((c) => c.startSec + c.durationSec),
    1,
  );
  const [pxPerSec, setPxPerSec] = useState(14);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const widthPx = Math.max(600, Math.ceil(total * pxPerSec));

  // Vẽ waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks || peaks.length === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = widthPx * dpr;
    canvas.height = 44 * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, widthPx, 44);
    ctx.fillStyle = "rgba(232,121,249,0.45)";
    const step = peaks.length / widthPx;
    for (let x = 0; x < widthPx; x++) {
      const v = peaks[Math.floor(x * step)] ?? 0;
      const h = Math.max(1, v * 40);
      ctx.fillRect(x, (44 - h) / 2, 1, h);
    }
  }, [peaks, widthPx]);

  const seekFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const sec = Math.min(total, Math.max(0, x / pxPerSec));
    const cue = cues.find(
      (c) => sec >= c.startSec && sec < c.startSec + c.durationSec,
    );
    onSeek(sec, cue?.id ?? selectedCueId ?? "");
  };

  // Thước: vạch mỗi giây (thưa hơn khi zoom nhỏ)
  const tickEvery = pxPerSec >= 20 ? 1 : pxPerSec >= 8 ? 5 : 10;
  const ticks: number[] = [];
  for (let t = 0; t <= total; t += tickEvery) ticks.push(t);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur p-3 space-y-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/40 tabular-nums">
          {fps ? formatTimecode(currentTimeSec, fps) : `${currentTimeSec.toFixed(1)}s`}
          {" / "}
          {fps ? formatTimecode(total, fps) : `${total.toFixed(1)}s`}
        </span>
        <span className="flex items-center gap-1">
          <button
            onClick={() => setPxPerSec((v) => Math.max(4, v / 1.5))}
            aria-label="Thu nhỏ timeline"
            className="p-1 rounded bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPxPerSec((v) => Math.min(60, v * 1.5))}
            aria-label="Phóng to timeline"
            className="p-1 rounded bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </span>
      </div>
      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <div
          className="relative cursor-crosshair"
          style={{ width: widthPx }}
          onPointerDown={seekFromPointer}
        >
          {/* thước giây */}
          <div className="relative h-4">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute top-0 text-[9px] text-white/35 tabular-nums border-l border-white/15 pl-0.5"
                style={{ left: t * pxPerSec }}
              >
                {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, "0")}
              </span>
            ))}
          </div>
          {/* track cue */}
          <div className="relative h-9 mt-0.5">
            {cues.map((cue) => {
              const active =
                currentTimeSec >= cue.startSec &&
                currentTimeSec < cue.startSec + cue.durationSec;
              return (
                <span
                  key={cue.id}
                  className={`absolute top-0 h-9 rounded-md border px-1 overflow-hidden text-[9px] leading-tight ${
                    cue.id === selectedCueId
                      ? "border-fuchsia-300 bg-fuchsia-500/40 text-white"
                      : active
                        ? "border-fuchsia-400/60 bg-fuchsia-500/25 text-white/85"
                        : "border-white/15 bg-white/[0.08] text-white/60"
                  }`}
                  style={{
                    left: cue.startSec * pxPerSec,
                    width: Math.max(8, cue.durationSec * pxPerSec),
                  }}
                >
                  {cue.text}
                </span>
              );
            })}
          </div>
          {/* waveform */}
          <div className="relative h-[44px] mt-0.5 rounded bg-white/[0.03]">
            {peaks ? (
              <canvas ref={canvasRef} style={{ width: widthPx, height: 44 }} />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-[10px] text-white/25">
                Chọn file video để hiện sóng âm phục vụ spotting
              </span>
            )}
          </div>
          {/* playhead */}
          <span
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none"
            style={{ left: currentTimeSec * pxPerSec }}
          />
        </div>
      </div>
    </div>
  );
}
