"use client";

import { useState } from "react";
import { Mic, Music, Play, Volume2 } from "lucide-react";

export function VoiceSfxStep() {
  const characters = [
    { name: "Aoi", role: "Nữ chính", voice: "Yume — Nữ, ấm" },
    { name: "Ren", role: "Nam chính", voice: "Haru — Nam, trầm" },
    { name: "Sensei", role: "Thầy giáo", voice: "Akira — Nam, già" },
  ];
  const bgms = ["Lo-fi Tokyo Rain", "Piano Sakura", "Synth Nostalgia", "Acoustic Sunrise"];
  const [bgm, setBgm] = useState(bgms[0]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="text-lg font-semibold">Gán giọng AI cho nhân vật</div>
        <div className="text-xs text-white/50 mt-1">Mỗi nhân vật một chất giọng riêng — AI nhận diện bóng thoại và đọc tự động.</div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {characters.map((c) => (
          <div key={c.name} className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-400 grid place-items-center text-white font-bold">{c.name[0]}</div>
              <div>
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-[11px] text-white/40">{c.role}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-white/60 flex items-center gap-2"><Mic className="w-3.5 h-3.5 text-pink-300" /> {c.voice}</div>
            <div className="mt-2 flex items-end gap-0.5 h-8">
              {Array.from({ length: 24 }).map((_, i) => (
                <span key={i} className="flex-1 rounded-sm bg-gradient-to-t from-pink-500/80 to-rose-300/80" style={{ height: `${20 + Math.abs(Math.sin(i + c.name.length)) * 80}%` }} />
              ))}
            </div>
            <button className="mt-3 w-full h-8 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition">Đổi giọng</button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="text-xs text-white/50 mb-3 flex items-center gap-1"><Music className="w-3.5 h-3.5" /> NHẠC NỀN</div>
          <div className="space-y-1.5">
            {bgms.map((b) => (
              <button key={b} onClick={() => setBgm(b)} className={`w-full flex items-center justify-between px-3 h-10 rounded-lg text-sm ${bgm === b ? "bg-gradient-to-r from-pink-500/30 to-transparent border border-pink-400/40 text-white font-medium" : "bg-white/5 border border-white/10 hover:bg-white/10 text-white/70"}`}>
                <span className="flex items-center gap-2"><Play className="w-3.5 h-3.5" /> {b}</span>
                <span className="text-[11px] text-white/40">2:40</span>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="text-xs text-white/50 mb-3 flex items-center gap-1"><Volume2 className="w-3.5 h-3.5" /> HIỆU ỨNG ÂM THANH</div>
          <div className="grid grid-cols-2 gap-2">
            {["Mưa rơi", "Sấm xa", "Tiếng bước", "Cửa mở", "Lá rơi", "Tim đập"].map((s) => (
              <label key={s} className="flex items-center gap-2 px-2.5 h-9 rounded-lg bg-white/5 border border-white/10 text-xs cursor-pointer hover:bg-white/10">
                <input type="checkbox" defaultChecked={["Mưa rơi", "Tim đập"].includes(s)} className="accent-pink-500" /> {s}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
