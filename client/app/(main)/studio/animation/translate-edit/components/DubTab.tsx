"use client";

import { Mic, Plus } from "lucide-react";

export function DubTab() {
  const voices = [
    { name: "Aoi", voice: "Yume — Nữ, ấm", pitch: 50, speed: 50 },
    { name: "Ren", voice: "Haru — Nam, trầm", pitch: 35, speed: 45 },
  ];
  return (
    <div className="space-y-3">
      {voices.map((v) => (
        <div key={v.name} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/80 flex items-center gap-2 font-medium">
              <Mic className="w-3.5 h-3.5 text-fuchsia-300" /> {v.name}
            </span>
            <button className="text-[10px] text-white/50 hover:text-white transition">Đổi</button>
          </div>
          <div className="text-[11px] text-white/50 mt-1">{v.voice}</div>
          <div className="mt-2 flex items-end gap-0.5 h-8">
            {Array.from({ length: 28 }).map((_, i) => (
              <span key={i} className="flex-1 rounded-sm bg-gradient-to-t from-fuchsia-500 to-pink-300" style={{ height: `${20 + Math.abs(Math.sin(i + v.name.length)) * 80}%` }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <div className="text-white/40 mb-1">Cao độ</div>
              <input type="range" defaultValue={v.pitch} className="w-full accent-fuchsia-500" />
            </div>
            <div>
              <div className="text-white/40 mb-1">Tốc độ</div>
              <input type="range" defaultValue={v.speed} className="w-full accent-fuchsia-500" />
            </div>
          </div>
        </div>
      ))}
      <button className="w-full h-9 rounded-lg bg-white/5 border border-dashed border-white/20 text-xs text-white/60 hover:bg-white/10 flex items-center justify-center gap-1 transition">
        <Plus className="w-3.5 h-3.5" /> Thêm giọng nhân vật
      </button>
    </div>
  );
}
