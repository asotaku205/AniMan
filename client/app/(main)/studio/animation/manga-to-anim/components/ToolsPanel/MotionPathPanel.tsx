"use client";

import { useState } from "react";

export function MotionPathPanel({ panel }: { panel: number }) {
  const presets = ["S-curve", "Arc", "Linear", "Bounce"] as const;
  const [preset, setPreset] = useState<typeof presets[number]>("Arc");
  const [a, setA] = useState({ x: 30, y: 140 });
  const [b, setB] = useState({ x: 200, y: 60 });
  const paths: Record<typeof presets[number], string> = {
    "S-curve": `M${a.x},${a.y} C${a.x + 60},${a.y - 100} ${b.x - 60},${b.y + 100} ${b.x},${b.y}`,
    "Arc": `M${a.x},${a.y} Q${(a.x + b.x) / 2},${Math.min(a.y, b.y) - 60} ${b.x},${b.y}`,
    "Linear": `M${a.x},${a.y} L${b.x},${b.y}`,
    "Bounce": `M${a.x},${a.y} Q${a.x + 40},${a.y + 40} ${(a.x + b.x) / 2},${a.y} T${b.x},${b.y}`,
  };
  const drag = (which: "a" | "b") => (e: React.MouseEvent<SVGCircleElement>) => {
    const svg = (e.target as SVGCircleElement).ownerSVGElement!;
    const onMove = (ev: MouseEvent) => {
      const rect = svg.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 240;
      const y = ((ev.clientY - rect.top) / rect.height) * 180;
      (which === "a" ? setA : setB)({ x: Math.max(10, Math.min(230, x)), y: Math.max(10, Math.min(170, y)) });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };
  return (
    <div className="space-y-2">
      <div className="text-[10px] text-white/40">Panel {panel + 1} · Kéo 2 chấm để vẽ đường camera</div>
      <svg viewBox="0 0 240 180" className="w-full rounded-lg bg-black/40 border border-white/10">
        <path d={paths[preset]} stroke="rgb(244,114,182)" strokeWidth="2" fill="none" strokeDasharray="4 3" />
        <circle cx={a.x} cy={a.y} r="6" fill="#fff" stroke="rgb(244,114,182)" strokeWidth="2" onMouseDown={drag("a")} className="cursor-grab" />
        <circle cx={b.x} cy={b.y} r="6" fill="rgb(244,114,182)" stroke="#fff" strokeWidth="2" onMouseDown={drag("b")} className="cursor-grab" />
      </svg>
      <div className="grid grid-cols-2 gap-1">
        {presets.map((p) => (
          <button key={p} onClick={() => setPreset(p)} className={`h-7 rounded text-[11px] ${preset === p ? "bg-pink-500 text-white" : "bg-white/5 border border-white/10 text-white/70"}`}>{p}</button>
        ))}
      </div>
    </div>
  );
}
