"use client";

import { useState } from "react";
import { BookMarked, Feather, Pause, Play, RotateCcw, Timer, Type, Volume2 } from "lucide-react";
import { FONTS, type SideTabKey, type Track } from "../data";

const SIDE_TABS: { k: SideTabKey; label: string; icon: React.ReactNode }[] = [
  { k: "font", label: "Font", icon: <Type className="w-4 h-4" /> },
  { k: "audio", label: "Âm thanh", icon: <Volume2 className="w-4 h-4" /> },
  { k: "timer", label: "Pomodoro", icon: <Timer className="w-4 h-4" /> },
  { k: "chapters", label: "Chương", icon: <BookMarked className="w-4 h-4" /> },
  { k: "paper", label: "Giấy", icon: <Feather className="w-4 h-4" /> },
];

interface TabbedSidePanelProps {
  fontId: string;
  setFontId: (id: string) => void;
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  phase: "work" | "break";
  progress: number;
  mm: string;
  ss: string;
  running: boolean;
  toggleRun: () => void;
  resetTimer: () => void;
}

export function TabbedSidePanel({
  fontId, setFontId, tracks, setTracks, phase, progress,
  mm, ss, running, toggleRun, resetTimer,
}: TabbedSidePanelProps) {
  const [tab, setTab] = useState<SideTabKey>("font");
  const current = SIDE_TABS.find((t) => t.k === tab)!;

  return (
    <div className="sticky top-6 rounded-2xl border border-amber-200/15 bg-[#1c1208]/90 backdrop-blur overflow-hidden shadow-2xl">
      <div className="grid grid-cols-5 border-b border-amber-200/10">
        {SIDE_TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            title={t.label}
            className={`h-12 grid place-items-center transition relative ${
              tab === t.k ? "text-amber-100 bg-amber-200/10" : "text-amber-100/40 hover:text-amber-100/80 hover:bg-white/5"
            }`}
          >
            {t.icon}
            {tab === t.k && <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-amber-400 to-pink-300 rounded-full" />}
          </button>
        ))}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 text-amber-100/90 mb-3">
          <span className="text-pink-300">{current.icon}</span>
          <span style={{ fontFamily: "Shippori Mincho, serif" }} className="font-medium">{current.label}</span>
        </div>

        {tab === "font" && (
          <div className="space-y-1.5">
            {FONTS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFontId(f.id)}
                style={{ fontFamily: f.family }}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${
                  fontId === f.id ? "bg-amber-100/20 border-amber-200/40 text-amber-50 font-medium" : "border-white/10 text-amber-50/70 hover:bg-white/5"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {tab === "audio" && (
          <div className="space-y-3">
            {tracks.map((t) => (
              <div key={t.id}>
                <div className="flex justify-between text-amber-50/80 text-xs mb-1">
                  <span>{t.name}</span>
                  <span className="tabular-nums font-mono">{t.vol}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={t.vol}
                  onChange={(e) => setTracks((arr) => arr.map((x) => (x.id === t.id ? { ...x, vol: Number(e.target.value) } : x)))}
                  className="w-full accent-amber-400"
                />
              </div>
            ))}
          </div>
        )}

        {tab === "timer" && (
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="none" />
                <circle
                  cx="50" cy="50" r="42"
                  stroke={phase === "work" ? "#f59e0b" : "#34d399"}
                  strokeWidth="6" fill="none"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={2 * Math.PI * 42 * (1 - progress)}
                  strokeLinecap="round"
                  className="transition-all"
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center text-amber-50 tabular-nums text-lg font-mono font-bold">
                {mm}:{ss}
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <div className="text-xs text-amber-100/80 font-medium">{phase === "work" ? "Tập trung viết" : "Nghỉ ngơi"}</div>
              <div className="flex gap-1.5">
                <button onClick={toggleRun} className="flex-1 h-8 rounded-md bg-amber-400 text-amber-950 text-xs font-semibold flex items-center justify-center gap-1 hover:bg-amber-300 transition">
                  {running ? <><Pause className="w-3 h-3" /> Tạm dừng</> : <><Play className="w-3 h-3" /> Bắt đầu</>}
                </button>
                <button onClick={resetTimer} className="w-8 h-8 rounded-md bg-white/5 border border-white/10 grid place-items-center hover:bg-white/10 transition">
                  <RotateCcw className="w-3 h-3 text-amber-100" />
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "chapters" && (
          <div className="space-y-1 text-sm">
            {["1 · Mưa xuân", "2 · Tiếng chuông gió", "3 · Cánh hoa cuối cùng", "+ Chương mới"].map((c, i) => (
              <div key={c} className={`px-2.5 py-2 rounded cursor-pointer transition ${i === 0 ? "bg-amber-100/15 text-amber-50 font-medium" : "text-amber-50/60 hover:bg-white/5"}`}>
                {c}
              </div>
            ))}
          </div>
        )}

        {tab === "paper" && (
          <div className="grid grid-cols-3 gap-2">
            {["Washi", "Da cũ", "Lụa"].map((t, i) => (
              <button key={t} className={`text-xs py-2 rounded-lg border transition ${i === 0 ? "bg-amber-100/20 border-amber-200/40 text-amber-50 font-medium" : "border-white/10 text-white/60 hover:bg-white/5"}`}>
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
