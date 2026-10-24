"use client";

import { useState } from "react";
import { Pause, Play, RotateCcw, Target, Timer, Type } from "lucide-react";
import { FONTS, type SideTabKey } from "../data";

// Chỉ giữ các tab thật sự hoạt động: tab Giấy (Washi/Da cũ/Lụa) không
// có handler và tab Âm thanh kéo được nhưng không phát ra tiếng nên đã
// bỏ — chỉnh giao diện giấy dùng chấm theme trên quyển sách.
const SIDE_TABS: { k: SideTabKey; label: string; icon: React.ReactNode }[] = [
  { k: "font", label: "Font", icon: <Type className="w-4 h-4" /> },
  { k: "timer", label: "Pomodoro", icon: <Timer className="w-4 h-4" /> },
  { k: "stats", label: "Thống kê", icon: <Target className="w-4 h-4" /> },
];

interface TabbedSidePanelProps {
  fontId: string;
  setFontId: (id: string) => void;
  phase: "work" | "break";
  progress: number;
  mm: string;
  ss: string;
  running: boolean;
  toggleRun: () => void;
  resetTimer: () => void;
  sceneWords: number;
  chapterWords: number;
  novelWords: number;
  todayWords: number;
  goalWordsPerDay: number;
  setGoal: (n: number) => void;
}

export function TabbedSidePanel({
  fontId, setFontId, phase, progress,
  mm, ss, running, toggleRun, resetTimer,
  sceneWords, chapterWords, novelWords, todayWords, goalWordsPerDay, setGoal,
}: TabbedSidePanelProps) {
  const [tab, setTab] = useState<SideTabKey>("font");
  const current = SIDE_TABS.find((t) => t.k === tab)!;

  return (
    <div className="sticky top-6 rounded-2xl border border-amber-200/15 bg-[#1c1208]/90 backdrop-blur overflow-hidden shadow-2xl">
      <div className="grid grid-cols-3 border-b border-amber-200/10">
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

        {tab === "stats" && (
          <div className="space-y-2.5 text-sm">
            {[
              ["Cảnh đang viết", sceneWords],
              ["Chương này", chapterWords],
              ["Toàn truyện", novelWords],
              ["Hôm nay viết thêm", todayWords],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between text-amber-50/80">
                <span>{label as string}</span>
                <span className="tabular-nums font-mono font-medium">{value as number} từ</span>
              </div>
            ))}
            <label className="block text-amber-50/80 text-xs pt-1">
              Mục tiêu (từ/ngày)
              <input
                type="number"
                min={0}
                step={100}
                value={goalWordsPerDay}
                onChange={(e) => setGoal(Number(e.currentTarget.value) || 0)}
                className="mt-1 w-full h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-sm text-amber-50 outline-none"
              />
            </label>
            <div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-pink-300 rounded-full"
                  style={{ width: `${goalWordsPerDay > 0 ? Math.min(100, (todayWords / goalWordsPerDay) * 100) : 0}%` }}
                />
              </div>
              <p className="text-amber-50/50 text-xs mt-1 tabular-nums">
                {todayWords} / {goalWordsPerDay} từ hôm nay
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
