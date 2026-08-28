"use client";

import { useState } from "react";

export function FoleyPadPanel() {
  const pads = [
    { l: "Bước", c: "from-pink-500 to-rose-400" },
    { l: "Cửa", c: "from-amber-500 to-orange-400" },
    { l: "Mưa", c: "from-sky-500 to-cyan-400" },
    { l: "Sấm", c: "from-indigo-500 to-violet-400" },
    { l: "Vỡ", c: "from-red-500 to-pink-400" },
    { l: "Gió", c: "from-emerald-500 to-teal-400" },
    { l: "Lá", c: "from-lime-500 to-green-400" },
    { l: "Chuông", c: "from-yellow-500 to-amber-400" },
    { l: "Tim", c: "from-rose-500 to-red-400" },
    { l: "Vù", c: "from-fuchsia-500 to-pink-400" },
    { l: "Đập", c: "from-orange-500 to-red-400" },
    { l: "Im", c: "from-slate-500 to-zinc-400" },
  ];
  const [pulse, setPulse] = useState<number | null>(null);
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {pads.map((p, i) => (
        <button
          key={i}
          onClick={() => { setPulse(i); setTimeout(() => setPulse(null), 250); }}
          className={`aspect-square rounded-md bg-gradient-to-br ${p.c} text-white text-[10px] shadow-inner transition ${pulse === i ? "scale-95 brightness-150" : "hover:brightness-110"}`}
        >
          {p.l}
        </button>
      ))}
    </div>
  );
}
