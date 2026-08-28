"use client";

import { useState } from "react";

export function VibeDialPanel() {
  const [angle, setAngle] = useState(45);
  const moods = [
    { from: 0, to: 72, name: "Calm", color: "rgb(96,165,250)" },
    { from: 72, to: 144, name: "Tense", color: "rgb(244,114,182)" },
    { from: 144, to: 216, name: "Dramatic", color: "rgb(168,85,247)" },
    { from: 216, to: 288, name: "Playful", color: "rgb(251,191,36)" },
    { from: 288, to: 360, name: "Melancholic", color: "rgb(100,116,139)" },
  ];
  const current = moods.find((m) => angle >= m.from && angle < m.to) ?? moods[0];
  const r = 70, cx = 90, cy = 90;
  const segPath = (from: number, to: number) => {
    const fa = ((from - 90) * Math.PI) / 180, ta = ((to - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(fa), y1 = cy + r * Math.sin(fa);
    const x2 = cx + r * Math.cos(ta), y2 = cy + r * Math.sin(ta);
    const large = to - from > 180 ? 1 : 0;
    return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
  };
  const onDrag = (e: React.MouseEvent<SVGElement>) => {
    const svg = (e.currentTarget as SVGElement).closest("svg")!;
    const move = (ev: MouseEvent) => {
      const rect = svg.getBoundingClientRect();
      const x = ev.clientX - rect.left - 90 * (rect.width / 180);
      const y = ev.clientY - rect.top - 90 * (rect.height / 180);
      let a = (Math.atan2(y, x) * 180) / Math.PI + 90;
      if (a < 0) a += 360;
      setAngle(a);
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };
  const ia = ((angle - 90) * Math.PI) / 180;
  const ix = cx + (r - 10) * Math.cos(ia), iy = cy + (r - 10) * Math.sin(ia);
  return (
    <div className="space-y-2">
      <svg viewBox="0 0 180 180" className="w-full">
        {moods.map((m) => (
          <path key={m.name} d={segPath(m.from, m.to)} fill={m.color} opacity={current.name === m.name ? 0.9 : 0.35} />
        ))}
        <circle cx={cx} cy={cy} r="22" fill="#0d0817" stroke="white" strokeOpacity="0.2" />
        <line x1={cx} y1={cy} x2={ix} y2={iy} stroke="white" strokeWidth="3" strokeLinecap="round" />
        <circle cx={ix} cy={iy} r="7" fill="white" stroke={current.color} strokeWidth="3" onMouseDown={onDrag} className="cursor-grab" />
      </svg>
      <div className="text-center">
        <div className="text-[10px] text-white/40">VIBE HIỆN TẠI</div>
        <div className="text-lg" style={{ color: current.color }}>{current.name}</div>
        <div className="text-[10px] text-white/40">{Math.round(angle)}°</div>
      </div>
    </div>
  );
}
