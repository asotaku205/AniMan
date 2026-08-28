"use client";

import { useMemo, useState } from "react";
import { BookOpen, Camera, Check, Mic, Sparkles, Zap } from "lucide-react";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { MangaSelectStep } from "./components/MangaSelectStep";
import { MotionCameraStep } from "./components/MotionCameraStep";
import { VoiceSfxStep } from "./components/VoiceSfxStep";
import { RenderStep } from "./components/RenderStep";
import { ToolsPanelContainer } from "./components/ToolsPanel/ToolsPanelContainer";
import { mangaList, type Manga } from "@/app/components/data/mangas";

const stepsM2A = [
  { n: 1, title: "Chọn manga nguồn", icon: <BookOpen className="w-4 h-4" /> },
  { n: 2, title: "Gán chuyển động", icon: <Camera className="w-4 h-4" /> },
  { n: 3, title: "Voice & SFX", icon: <Mic className="w-4 h-4" /> },
  { n: 4, title: "Render & xuất bản", icon: <Sparkles className="w-4 h-4" /> },
];

export function MangaToAnimWorkspace() {
  const [step, setStep] = useState(1);
  const [selectedManga, setSelectedManga] = useState(mangaList[0]?.slug ?? "");
  const manga = useMemo(() => mangaList.find((m: Manga) => m.slug === selectedManga) ?? mangaList[0], [selectedManga]);
  const panels = useMemo(() => (manga?.pagesPreview ?? []).concat(manga?.pagesPreview ?? []).slice(0, 8), [manga]);
  const [activePanel, setActivePanel] = useState(0);
  const [panelMoves, setPanelMoves] = useState<string[]>(() => Array(8).fill("Ken Burns"));
  const [panelDur, setPanelDur] = useState<number[]>(() => Array(8).fill(3));

  return (
    <div className="space-y-6">
      <WorkspaceHeader title="Manga → Animation" subtitle={`Dự án: ${manga?.t ?? ""}`} accent="pink" />

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_300px] gap-6">
        {/* Stepper */}
        <aside className="rounded-2xl border border-white/10 bg-[#0d0817] p-3">
          <div className="text-[11px] tracking-[0.25em] text-white/40 px-2 py-2 font-medium">QUY TRÌNH</div>
          <div className="space-y-1">
            {stepsM2A.map((s) => {
              const active = step === s.n;
              const done = step > s.n;
              return (
                <button
                  key={s.n}
                  onClick={() => setStep(s.n)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition ${active ? "bg-gradient-to-r from-pink-500/20 to-rose-400/10 border border-pink-400/30" : "hover:bg-white/5 border border-transparent"}`}
                >
                  <span className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold ${active ? "bg-gradient-to-br from-pink-500 to-rose-400 text-white" : done ? "bg-emerald-500/80 text-white" : "bg-white/10 text-white/60"}`}>
                    {done ? <Check className="w-3.5 h-3.5" /> : s.n}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{s.title}</div>
                    <div className="text-[10px] text-white/40 flex items-center gap-1 mt-0.5">{s.icon} Bước {s.n}/4</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 p-3 rounded-xl bg-gradient-to-br from-pink-500/10 to-transparent border border-pink-400/20">
            <div className="text-[11px] text-pink-300 flex items-center gap-1 font-semibold"><Zap className="w-3.5 h-3.5" /> AI ASSIST</div>
            <p className="text-xs text-white/60 mt-1 leading-relaxed">Hệ thống đề xuất chuyển động dựa trên bố cục panel và hướng nhìn nhân vật.</p>
          </div>
        </aside>

        {/* Canvas */}
        <main className="rounded-2xl border border-white/10 bg-[#0d0817] overflow-hidden">
          {step === 1 && <MangaSelectStep selectedManga={selectedManga} onSelect={setSelectedManga} />}
          {step === 2 && (
            <MotionCameraStep
              panels={panels}
              activePanel={activePanel}
              setActivePanel={setActivePanel}
              panelMoves={panelMoves}
              setPanelMoves={setPanelMoves}
              panelDur={panelDur}
              setPanelDur={setPanelDur}
            />
          )}
          {step === 3 && <VoiceSfxStep />}
          {step === 4 && <RenderStep manga={manga?.t ?? ""} totalSec={panelDur.reduce((a, b) => a + b, 0)} />}
        </main>

        {/* Inspector */}
        <aside className="rounded-2xl border border-white/10 bg-[#0d0817] p-4 space-y-4">
          <div>
            <div className="text-[11px] tracking-[0.25em] text-white/40 font-medium">TÓM TẮT DỰ ÁN</div>
            <div className="mt-2 rounded-xl overflow-hidden border border-white/10">
              <div className="aspect-video"><img src={manga?.banner ?? ""} alt="" className="w-full h-full object-cover" /></div>
              <div className="p-3 space-y-1">
                <div className="text-sm font-medium">{manga?.t}</div>
                <div className="text-[11px] text-white/40">{panels.length} panel · ~{panelDur.reduce((a, b) => a + b, 0)}s</div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
            <div className="text-[11px] text-white/40 font-medium">TRẠNG THÁI BƯỚC</div>
            {stepsM2A.map((s) => (
              <div key={s.n} className="flex items-center justify-between text-xs">
                <span className="text-white/70">{s.title}</span>
                <span className={step > s.n ? "text-emerald-400" : step === s.n ? "text-pink-300 font-medium" : "text-white/30"}>
                  {step > s.n ? "Xong" : step === s.n ? "Đang làm" : "Chờ"}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep((s) => Math.max(1, s - 1))} className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition">Quay lại</button>
            <button onClick={() => setStep((s) => Math.min(4, s + 1))} className="flex-1 h-10 rounded-xl bg-gradient-to-r from-pink-500 to-rose-400 text-sm font-medium hover:opacity-90 transition">Tiếp tục</button>
          </div>
        </aside>
      </div>

      <ToolsPanelContainer activePanel={activePanel} />
    </div>
  );
}
