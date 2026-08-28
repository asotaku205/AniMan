"use client";

import { Camera } from "lucide-react";
import { ImageWithFallback } from "@/app/components/ImageWithFallback";
import { cameraMoves } from "../../data";

interface MotionCameraStepProps {
  panels: string[];
  activePanel: number;
  setActivePanel: (i: number) => void;
  panelMoves: string[];
  setPanelMoves: React.Dispatch<React.SetStateAction<string[]>>;
  panelDur: number[];
  setPanelDur: React.Dispatch<React.SetStateAction<number[]>>;
}

export function MotionCameraStep({
  panels, activePanel, setActivePanel,
  panelMoves, setPanelMoves, panelDur, setPanelDur,
}: MotionCameraStepProps) {
  return (
    <div className="p-6">
      <div className="text-lg font-semibold">Tách panel & gán chuyển động camera</div>
      <div className="text-xs text-white/50 mt-1">Click vào một panel để xem trước. Chọn loại chuyển động phù hợp với cảm xúc khung tranh.</div>
      <div className="mt-5 grid grid-cols-4 gap-3">
        {panels.map((src, i) => (
          <button key={i} onClick={() => setActivePanel(i)} className={`relative rounded-lg overflow-hidden border transition ${activePanel === i ? "border-pink-400" : "border-white/10"}`}>
            <div className="aspect-video"><ImageWithFallback src={src} alt={`panel ${i}`} className="w-full h-full object-cover" /></div>
            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[10px]">P{i + 1}</div>
            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-pink-500/80 text-[10px]">{panelMoves[i]}</div>
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="text-xs text-white/50 mb-2">XEM TRƯỚC PANEL {activePanel + 1}</div>
          <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
            <ImageWithFallback src={panels[activePanel]} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/10 via-transparent to-transparent" />
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/70 text-[11px] flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-pink-300" /> {panelMoves[activePanel]} · {panelDur[activePanel]}s
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-4">
          <div>
            <div className="text-xs text-white/50 mb-2">CHUYỂN ĐỘNG CAMERA</div>
            <div className="flex flex-wrap gap-1.5">
              {cameraMoves.map((m) => (
                <button
                  key={m}
                  onClick={() => setPanelMoves((arr) => arr.map((v, i) => (i === activePanel ? m : v)))}
                  className={`px-2.5 h-7 rounded-md text-xs border ${panelMoves[activePanel] === m ? "bg-gradient-to-r from-pink-500 to-rose-400 border-transparent text-white font-medium" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/50 mb-2 flex items-center justify-between">
              <span>THỜI LƯỢNG</span>
              <span className="text-pink-300 font-medium">{panelDur[activePanel]}s</span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              value={panelDur[activePanel]}
              onChange={(e) => setPanelDur((arr) => arr.map((v, i) => (i === activePanel ? Number(e.target.value) : v)))}
              className="w-full accent-pink-500"
            />
          </div>
          <div className="text-[11px] text-white/40 leading-relaxed pt-2 border-t border-white/10">
            Mẹo: panel emotional (close-up) hợp với Ken Burns chậm 4-5s; panel hành động hợp với Pan/Zoom nhanh 1-2s.
          </div>
        </div>
      </div>
    </div>
  );
}
