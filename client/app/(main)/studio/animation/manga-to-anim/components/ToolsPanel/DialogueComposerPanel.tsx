"use client";

import { useState } from "react";

export function DialogueComposerPanel() {
  const types = [
    { k: "round", label: "Tròn" },
    { k: "spiky", label: "Gai" },
    { k: "whisper", label: "Thì thầm" },
    { k: "thought", label: "Suy nghĩ" },
  ] as const;
  const [bt, setBt] = useState<typeof types[number]["k"]>("round");
  const [text, setText] = useState("Cậu là... ai?");
  const [fs, setFs] = useState(13);
  const borderStyle = bt === "whisper" ? "border-dashed" : "border-solid";
  const radius = bt === "thought" ? "rounded-3xl" : bt === "spiky" ? "rounded-sm" : "rounded-2xl";
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1">
        {types.map((t) => (
          <button key={t.k} onClick={() => setBt(t.k)} className={`h-7 rounded text-[10px] ${bt === t.k ? "bg-pink-500 text-white" : "bg-white/5 border border-white/10 text-white/70"}`}>{t.label}</button>
        ))}
      </div>
      <input value={text} onChange={(e) => setText(e.target.value)} className="w-full h-8 px-2 rounded bg-white/5 border border-white/10 text-xs" />
      <div>
        <div className="flex justify-between text-[10px] text-white/50"><span>Cỡ chữ</span><span>{fs}px</span></div>
        <input type="range" min={9} max={22} value={fs} onChange={(e) => setFs(Number(e.target.value))} className="w-full accent-pink-500" />
      </div>
      <div className="relative aspect-video rounded-md bg-gradient-to-br from-slate-700 to-slate-900 grid place-items-center p-3">
        <div className={`bg-white text-black px-3 py-2 border-2 border-black ${borderStyle} ${radius} max-w-[80%]`} style={{ fontSize: fs, fontFamily: "Shippori Mincho, serif" }}>
          {text}
        </div>
      </div>
    </div>
  );
}
