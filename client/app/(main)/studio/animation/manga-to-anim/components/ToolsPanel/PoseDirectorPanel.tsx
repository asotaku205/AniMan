"use client";

import { useState } from "react";

export function PoseDirectorPanel() {
  const poses = ["Đứng", "Ngồi", "Chạy", "Quay đầu", "Cúi", "Vẫy tay", "Khóc", "Cười", "Suy tư", "Té ngã", "Nhảy", "Ôm"];
  const [active, setActive] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [shoulder, setShoulder] = useState(0);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1.5">
        {poses.map((p, i) => (
          <button key={p} onClick={() => setActive(i)} title={p} className={`aspect-square rounded-md grid place-items-center border ${active === i ? "border-pink-400 bg-pink-500/20" : "border-white/10 bg-white/5"}`}>
            <svg viewBox="0 0 24 32" className="w-5 h-7">
              <circle cx="12" cy="5" r="3" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-pink-300" />
              <line x1="12" y1="8" x2="12" y2="20" stroke="currentColor" strokeWidth="1.2" className="text-pink-300" />
              <line x1="12" y1="12" x2={6 + (i % 3) * 2} y2={16 + (i % 2) * 4} stroke="currentColor" strokeWidth="1.2" className="text-pink-300" />
              <line x1="12" y1="12" x2={18 - (i % 3)} y2={16 + (i % 2) * 3} stroke="currentColor" strokeWidth="1.2" className="text-pink-300" />
              <line x1="12" y1="20" x2={9 + (i % 2) * 2} y2={28 - (i % 3)} stroke="currentColor" strokeWidth="1.2" className="text-pink-300" />
              <line x1="12" y1="20" x2={15 - (i % 2)} y2={28 - (i % 4)} stroke="currentColor" strokeWidth="1.2" className="text-pink-300" />
            </svg>
          </button>
        ))}
      </div>
      <div className="pt-2 space-y-2">
        <div>
          <div className="flex justify-between text-[10px] text-white/50"><span>Nghiêng đầu</span><span>{tilt}°</span></div>
          <input type="range" min={-45} max={45} value={tilt} onChange={(e) => setTilt(Number(e.target.value))} className="w-full accent-pink-500" />
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-white/50"><span>Góc vai</span><span>{shoulder}°</span></div>
          <input type="range" min={-30} max={30} value={shoulder} onChange={(e) => setShoulder(Number(e.target.value))} className="w-full accent-pink-500" />
        </div>
      </div>
      <button className="w-full h-8 rounded bg-gradient-to-r from-pink-500 to-rose-400 text-[11px]">Gán cho nhân vật</button>
    </div>
  );
}
