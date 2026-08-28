"use client";

import { subtitleLines } from "../../data";

export function SubTab() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        {[{ k: "Font", v: "Shippori Mincho" }, { k: "Cỡ", v: "24px" }, { k: "Vị trí", v: "Dưới · Giữa" }].map((s) => (
          <div key={s.k} className="rounded-md bg-white/5 border border-white/10 p-2">
            <div className="text-white/40">{s.k}</div>
            <div className="text-white mt-0.5 font-medium">{s.v}</div>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {subtitleLines.map((l: typeof subtitleLines[number], i: number) => (
          <div key={i} className={`flex items-start gap-2 p-2 rounded text-xs ${i === 2 ? "bg-fuchsia-500/15 border border-fuchsia-400/30" : "border border-transparent"}`}>
            <span className="text-fuchsia-300/70 tabular-nums font-mono">{l.t}</span>
            <span className={i === 2 ? "text-white font-medium" : "text-white/60"}>{l.vi}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
