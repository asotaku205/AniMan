"use client";

import { useState } from "react";
import { Mic, Play } from "lucide-react";

export function VoiceBoothPanel() {
  const [rec, setRec] = useState(false);
  const [pitch, setPitch] = useState(50);
  const [speed, setSpeed] = useState(50);
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-black/40 border border-white/10 p-3 flex flex-col items-center gap-2">
        <button onClick={() => setRec((r) => !r)} className={`w-14 h-14 rounded-full grid place-items-center transition ${rec ? "bg-red-500 animate-pulse" : "bg-gradient-to-br from-pink-500 to-rose-400"}`}>
          <Mic className="w-6 h-6" />
        </button>
        <div className="text-[11px] text-white/60">{rec ? "Đang ghi…" : "Nhấn để ghi"}</div>
        <div className="flex items-end gap-0.5 h-8 w-full">
          {Array.from({ length: 32 }).map((_, i) => (
            <span key={i} className="flex-1 rounded-sm bg-gradient-to-t from-pink-500/70 to-rose-300/70 transition-all" style={{ height: rec ? `${20 + Math.abs(Math.sin(Date.now() / 200 + i)) * 70}%` : `${15 + Math.abs(Math.sin(i)) * 30}%` }} />
          ))}
        </div>
      </div>
      <div>
        <div className="flex justify-between text-[10px] text-white/50"><span>Cao độ</span><span>{pitch}</span></div>
        <input type="range" value={pitch} onChange={(e) => setPitch(Number(e.target.value))} className="w-full accent-pink-500" />
      </div>
      <div>
        <div className="flex justify-between text-[10px] text-white/50"><span>Tốc độ</span><span>{speed}</span></div>
        <input type="range" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full accent-pink-500" />
      </div>
      <button className="w-full h-8 rounded bg-white/5 border border-white/10 text-[11px] flex items-center justify-center gap-1"><Play className="w-3 h-3" /> Phát lại</button>
    </div>
  );
}
