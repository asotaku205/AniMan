"use client";

import { useState } from "react";
import { Compass, Drum, MessageSquare, Mic, PencilLine, PersonStanding, Route } from "lucide-react";
import { FrameDrawerPanel } from "./FrameDrawerPanel";
import { MotionPathPanel } from "./MotionPathPanel";
import { PoseDirectorPanel } from "./PoseDirectorPanel";
import { VoiceBoothPanel } from "./VoiceBoothPanel";
import { FoleyPadPanel } from "./FoleyPadPanel";
import { DialogueComposerPanel } from "./DialogueComposerPanel";
import { VibeDialPanel } from "./VibeDialPanel";
import type { ToolKey } from "../../../data";

const TOOLS_TABS: { k: ToolKey; label: string; icon: React.ReactNode; desc: string }[] = [
  { k: "frame", label: "Vẽ Frame", icon: <PencilLine className="w-4 h-4" />, desc: "Tự vẽ thêm frame chèn vào timeline" },
  { k: "motion", label: "Motion Path", icon: <Route className="w-4 h-4" />, desc: "Đường đi camera" },
  { k: "pose", label: "Pose Director", icon: <PersonStanding className="w-4 h-4" />, desc: "Tư thế nhân vật" },
  { k: "voice", label: "Voice Booth", icon: <Mic className="w-4 h-4" />, desc: "Phòng thu giọng" },
  { k: "foley", label: "Foley Pad", icon: <Drum className="w-4 h-4" />, desc: "Pad hiệu ứng âm thanh" },
  { k: "dialogue", label: "Dialogue", icon: <MessageSquare className="w-4 h-4" />, desc: "Speech bubble" },
  { k: "vibe", label: "Vibe Dial", icon: <Compass className="w-4 h-4" />, desc: "Cảm xúc cảnh" },
];

export function ToolsPanelContainer({ activePanel }: { activePanel: number }) {
  const [tool, setTool] = useState<ToolKey>("frame");
  const current = TOOLS_TABS.find((t) => t.k === tool)!;
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0d0817] overflow-hidden">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-white/10 bg-gradient-to-r from-pink-500/10 to-transparent">
        <span className="text-[11px] tracking-[0.3em] text-pink-300/70">CÔNG CỤ SÁNG TÁC</span>
        <span className="w-px h-4 bg-white/20" />
        <span className="text-sm font-medium">{current.label}</span>
        <span className="text-xs text-white/40">— {current.desc}</span>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="border-r border-white/10 p-2 space-y-1 bg-black/20">
          {TOOLS_TABS.map((t) => (
            <button
              key={t.k}
              onClick={() => setTool(t.k)}
              className={`w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-sm transition ${tool === t.k ? "bg-gradient-to-r from-pink-500/25 to-transparent border border-pink-400/30 text-white font-medium" : "text-white/60 hover:bg-white/5 border border-transparent"}`}
            >
              <span className={tool === t.k ? "text-pink-300" : "text-white/50"}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="p-5 min-h-[360px]">
          {tool === "frame" && <FrameDrawerPanel />}
          {tool === "motion" && <MotionPathPanel panel={activePanel} />}
          {tool === "pose" && <PoseDirectorPanel />}
          {tool === "voice" && <VoiceBoothPanel />}
          {tool === "foley" && <FoleyPadPanel />}
          {tool === "dialogue" && <DialogueComposerPanel />}
          {tool === "vibe" && <VibeDialPanel />}
        </div>
      </div>
    </section>
  );
}
