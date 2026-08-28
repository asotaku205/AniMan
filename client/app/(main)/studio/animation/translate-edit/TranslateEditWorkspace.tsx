"use client";

import { useState } from "react";
import { Download, Languages, Layers, Mic, Music, Pause, Play, Scissors, Subtitles, Upload, Volume2 } from "lucide-react";
import { ImageWithFallback } from "@/app/components/ImageWithFallback";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { MultiTrackTimeline } from "./components/MultiTrackTimeline";
import { TranslateTab } from "./components/TranslateTab";
import { SubTab } from "./components/SubTab";
import { DubTab } from "./components/DubTab";

export function TranslateEditWorkspace() {
  const [tab, setTab] = useState<"sub" | "dub" | "translate">("translate");
  const [playhead, setPlayhead] = useState(32);
  const [targetLang, setTargetLang] = useState("Tiếng Việt");

  return (
    <div className="space-y-4">
      <WorkspaceHeader title="Translate & Edit" subtitle='Dự án: "Cơn mưa rào tháng năm"' accent="violet">
        <button className="flex items-center gap-2 px-3 h-9 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition">
          <Upload className="w-3.5 h-3.5" /> Import video
        </button>
        <button className="flex items-center gap-2 px-3 h-9 rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-400 text-xs font-medium hover:opacity-90 transition">
          <Download className="w-3.5 h-3.5" /> Xuất bản
        </button>
      </WorkspaceHeader>

      <div className="rounded-2xl border border-white/10 bg-[#0d0817] overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_360px]">
          {/* Left: scenes & assets */}
          <div className="border-r border-white/10 p-3 space-y-3 bg-black/20">
            <div>
              <div className="text-[11px] text-white/50 px-1 mb-2 font-medium">CẢNH</div>
              <div className="space-y-2">
                {[
                  "https://images.unsplash.com/photo-1554072675-66db59dba46f?w=400",
                  "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=400",
                  "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=400",
                  "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400",
                ].map((s, i) => (
                  <button key={s} className={`relative w-full rounded-lg overflow-hidden aspect-video border transition ${i === 1 ? "border-fuchsia-400" : "border-white/10 hover:border-white/20"}`}>
                    <ImageWithFallback src={s} alt="" className="w-full h-full object-cover" />
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[10px]">S{i + 1}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-white/10">
              <div className="text-[11px] text-white/50 px-1 mb-2 font-medium">THƯ VIỆN</div>
              <div className="space-y-1.5">
                {[
                  { i: <Music className="w-3.5 h-3.5" />, t: "BGM Lo-fi" },
                  { i: <Volume2 className="w-3.5 h-3.5" />, t: "SFX Mưa" },
                  { i: <Subtitles className="w-3.5 h-3.5" />, t: "Style phụ đề" },
                ].map((it) => (
                  <button key={it.t} className="w-full flex items-center gap-2 px-2.5 h-8 rounded-md bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition">
                    <span className="text-fuchsia-300">{it.i}</span> {it.t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Center: preview */}
          <div className="bg-black">
            <div className="relative aspect-video">
              <ImageWithFallback src="https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1400" alt="preview" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
              <div className="absolute bottom-6 inset-x-0 text-center px-6">
                <div className="inline-block px-4 py-2 rounded bg-black/70 backdrop-blur text-lg" style={{ fontFamily: "Shippori Mincho, serif" }}>
                  "Nếu có thể gặp lại em một lần nữa..."
                </div>
                <div className="mt-1 text-fuchsia-200 text-xs">Phụ đề · {targetLang}</div>
              </div>
              <div className="absolute top-4 left-4 px-2 py-1 rounded bg-fuchsia-500/90 text-[10px] tracking-widest font-medium animate-pulse">LIVE · 00:14</div>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <button className="w-10 h-10 rounded-full bg-white text-black grid place-items-center hover:scale-105 transition"><Play className="w-4 h-4 fill-black" /></button>
                <button className="w-9 h-9 rounded-full bg-white/10 backdrop-blur grid place-items-center border border-white/20 hover:bg-white/20 transition"><Pause className="w-4 h-4" /></button>
                <button className="w-9 h-9 rounded-full bg-white/10 backdrop-blur grid place-items-center border border-white/20 hover:bg-white/20 transition"><Scissors className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          {/* Right: tabs */}
          <div className="border-l border-white/10 bg-black/20 flex flex-col">
            <div className="flex border-b border-white/10">
              {([
                { k: "translate", label: "Bản dịch", icon: <Languages className="w-3.5 h-3.5" /> },
                { k: "sub", label: "Phụ đề", icon: <Subtitles className="w-3.5 h-3.5" /> },
                { k: "dub", label: "Lồng tiếng", icon: <Mic className="w-3.5 h-3.5" /> },
              ] as const).map((t) => (
                <button key={t.k} onClick={() => setTab(t.k)} className={`flex-1 h-11 text-xs flex items-center justify-center gap-1.5 transition ${tab === t.k ? "bg-gradient-to-b from-fuchsia-500/20 to-transparent text-white border-b-2 border-fuchsia-400 font-medium" : "text-white/60 hover:text-white"}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <div className="flex-1 p-3 overflow-y-auto max-h-[420px]">
              {tab === "translate" && <TranslateTab targetLang={targetLang} setTargetLang={setTargetLang} />}
              {tab === "sub" && <SubTab />}
              {tab === "dub" && <DubTab />}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <MultiTrackTimeline playhead={playhead} setPlayhead={setPlayhead} />
      </div>
    </div>
  );
}
