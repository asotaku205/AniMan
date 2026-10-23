"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { formatDuration, type AnimScene } from "../lib/animProject";
import {
  animaticTimeline,
  segmentAtTime,
  segmentProgress,
} from "../lib/animatic";

/**
 * Trình phát animatic: chiếu các cảnh theo đúng thời lượng trên một sân
 * khấu 16:9 (số cảnh + tên + ghi chú), thanh tiến trình chia đoạn theo
 * từng cảnh, bấm vào đoạn để nhảy. Mục đích duy nhất: chốt NHỊP phim
 * trước khi tốn công làm chuyển động (khâu sửa rẻ nhất).
 */
export function AnimaticPlayer({ scenes }: { scenes: AnimScene[] }) {
  const segments = useMemo(() => animaticTimeline(scenes), [scenes]);
  const totalSec = segments.length
    ? segments[segments.length - 1].endSec
    : 0;
  const [playing, setPlaying] = useState(false);
  const [timeSec, setTimeSec] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setTimeSec((prev) => {
        const next = prev + dt;
        if (next >= totalSec) {
          setPlaying(false);
          return totalSec;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [playing, totalSec]);

  // Đổi danh sách cảnh (thêm/xoá/đổi thời lượng) → giữ thời gian trong biên
  useEffect(() => {
    setTimeSec((t) => Math.min(t, totalSec));
  }, [totalSec]);

  const current = segmentAtTime(segments, timeSec);
  const currentScene = current ? scenes[current.index] : null;

  const jumpToSegment = (index: number) => {
    const seg = segments[index];
    if (seg) setTimeSec(seg.startSec);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d0817] p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-wide text-white/80">
          PHÁT THỬ ANIMATIC — CHỐT NHỊP PHIM
        </h2>
        <span className="text-[12px] text-white/40 tabular-nums">
          {formatDuration(timeSec)} / {formatDuration(totalSec)}
        </span>
      </div>

      {/* Sân khấu 16:9 */}
      <div className="relative aspect-video rounded-xl bg-black/60 border border-white/10 overflow-hidden flex flex-col items-center justify-center text-center px-8">
        {currentScene ? (
          <>
            <div className="text-[11px] tracking-[0.3em] text-pink-300/70">
              CẢNH {(current?.index ?? 0) + 1} / {scenes.length}
            </div>
            <div className="mt-2 text-2xl font-semibold">{currentScene.name}</div>
            {currentScene.note ? (
              <p className="mt-2 text-sm text-white/55 max-w-lg leading-relaxed">
                {currentScene.note}
              </p>
            ) : (
              <p className="mt-2 text-sm text-white/30">
                (chưa có ghi chú — thêm ghi chú ở bảng phân cảnh để mô tả nội dung cảnh)
              </p>
            )}
            <div className="absolute bottom-0 left-0 h-1 bg-pink-500/80 transition-none"
              style={{
                width: `${(current ? segmentProgress(current, timeSec) : 0) * 100}%`,
              }}
            />
          </>
        ) : (
          <p className="text-sm text-white/35">Chưa có cảnh nào để phát thử.</p>
        )}
      </div>

      {/* Điều khiển */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => {
            setPlaying(false);
            setTimeSec(0);
          }}
          aria-label="Về đầu"
          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={() => current && jumpToSegment(Math.max(0, current.index - 1))}
          aria-label="Cảnh trước"
          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            if (timeSec >= totalSec) setTimeSec(0);
            setPlaying((v) => !v);
          }}
          aria-label={playing ? "Tạm dừng" : "Phát"}
          className="p-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-rose-400 hover:opacity-90 transition"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={() =>
            current && jumpToSegment(Math.min(segments.length - 1, current.index + 1))
          }
          aria-label="Cảnh sau"
          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        {/* Thanh đoạn cảnh theo tỉ lệ thời lượng */}
        <div className="flex-1 flex gap-1 ml-2">
          {segments.map((seg) => {
            const span = totalSec > 0 ? (seg.endSec - seg.startSec) / totalSec : 0;
            const isCurrent = current?.sceneId === seg.sceneId;
            const fill = isCurrent
              ? segmentProgress(seg, timeSec)
              : timeSec >= seg.endSec
                ? 1
                : 0;
            return (
              <button
                key={seg.sceneId}
                onClick={() => jumpToSegment(seg.index)}
                title={`${scenes[seg.index]?.name ?? ""} — ${formatDuration(seg.endSec - seg.startSec)}`}
                className={`relative h-6 rounded-md overflow-hidden border transition ${
                  isCurrent ? "border-pink-400/60" : "border-white/10 hover:border-white/30"
                }`}
                style={{ flexGrow: Math.max(0.2, span * 100) }}
              >
                <span className="absolute inset-0 bg-white/10" />
                <span
                  className="absolute inset-y-0 left-0 bg-pink-500/50"
                  style={{ width: `${fill * 100}%` }}
                />
                <span className="relative text-[10px] text-white/70 leading-6">
                  {seg.index + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
