"use client";

import { ChevronRight, Maximize2, Minimize2, Plus, RefreshCw, X } from "lucide-react";
import { GUIDE_CONFIG, GUIDE_DOT, TOOL_NAMES } from "../hooks/useDrawStudio";
import type { DrawTool, GuideId, LayoutDef, PanelDef } from "../data";

type Props = {
  activePanel: string | null;
  exitPanel: () => void;
  tool: DrawTool;
  panelDef: PanelDef | null;
  layout: LayoutDef;
  page: number;
  setPage: (n: number) => void;
  undo: () => void;
  redo: () => void;
  clearCanvas: () => void;
  panelFullscreen: boolean;
  setPanelFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
  activeGuides: GuideId[];
  ghostType: "comp" | "pose" | null;
  ghostId: string | null;
};

export function CanvasTopBar({
  activePanel, exitPanel, tool, panelDef, layout,
  page, setPage, undo, redo, clearCanvas,
  panelFullscreen, setPanelFullscreen,
  activeGuides, ghostType, ghostId,
}: Props) {
  return (
    <div className="h-11 bg-[#0d0817] border-b border-white/5 flex items-center px-3 gap-3 flex-shrink-0">
      {activePanel ? (
        <>
          <button onClick={exitPanel} className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs transition-colors">
            <ChevronRight size={14} className="rotate-180" /> Về trang
          </button>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-white/40 text-xs">{TOOL_NAMES[tool]}</span>
          {panelDef && <span className="text-white/30 text-xs">• Khung {layout.panels.indexOf(panelDef) + 1}</span>}
          <div className="ml-auto flex gap-1">
            <button onClick={undo} title="Hoàn tác" className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:bg-white/5 hover:text-white transition-all">
              <RefreshCw size={13} className="scale-x-[-1]" />
            </button>
            <button onClick={redo} title="Làm lại" className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:bg-white/5 hover:text-white transition-all">
              <RefreshCw size={13} />
            </button>
            <button onClick={clearCanvas} title="Xoá" className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-all">
              <X size={13} />
            </button>
            <div className="w-px h-4 bg-white/10 self-center mx-0.5" />
            <button
              onClick={() => setPanelFullscreen(v => !v)}
              title={panelFullscreen ? "Thu nhỏ (Esc)" : "Phóng to toàn màn hình"}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                panelFullscreen ? "bg-purple-500/30 text-purple-300" : "text-white/40 hover:bg-white/5 hover:text-white"
              }`}
            >
              {panelFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        </>
      ) : (
        <>
          {[1, 2, 3].map(n => (
            <button key={n} onClick={() => setPage(n)}
              className={`px-3 py-1 rounded-lg text-xs transition-all ${page === n ? "bg-white/10 text-white" : "text-white/40 hover:text-white hover:bg-white/5"}`}>
              Trang {n}
            </button>
          ))}
          <button className="w-6 h-6 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 transition-all">
            <Plus size={12} />
          </button>

          {/* Active guide chips */}
          {activeGuides.length > 0 && (
            <div className="ml-2 flex gap-1">
              {activeGuides.map(g => (
                <span key={g} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/5 text-[10px] text-white/50">
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${GUIDE_DOT[g]}`} />
                  {GUIDE_CONFIG.find(x => x.id === g)?.label}
                </span>
              ))}
            </div>
          )}

          {/* Ghost indicator */}
          {ghostType && ghostId && (
            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px]">
              Ghost: {ghostType === "comp" ? "Bố cục" : "Tư thế"}
            </span>
          )}
        </>
      )}
    </div>
  );
}
