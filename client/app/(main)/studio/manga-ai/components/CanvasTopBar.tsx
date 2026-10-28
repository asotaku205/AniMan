"use client";

import React from "react";
import {
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCw,
  Save,
  Check,
  X,
} from "lucide-react";
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
  pages?: number[];
  addPage?: () => void;
  undo: () => void;
  redo: () => void;
  clearCanvas: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isSaved?: boolean;
  saveDraft?: () => void;
  exportCurrentPanel?: () => void;
  exportFullPage?: () => void;
  /** Xuất toàn bộ dự án thành PDF nhiều trang (Slice 6) */
  exportProjectPdf?: () => void;
  panelFullscreen: boolean;
  setPanelFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
  activeGuides: GuideId[];
};

export function CanvasTopBar({
  activePanel,
  exitPanel,
  tool,
  panelDef,
  layout,
  page,
  setPage,
  pages = [1, 2, 3],
  addPage,
  undo,
  redo,
  clearCanvas,
  canUndo = false,
  canRedo = false,
  isSaved = true,
  saveDraft,
  exportCurrentPanel,
  exportFullPage,
  exportProjectPdf,
  panelFullscreen,
  setPanelFullscreen,
  activeGuides,
}: Props) {
  return (
    <div className="h-11 bg-[#0d0817] border-b border-white/5 flex items-center px-3 gap-3 flex-shrink-0">
      {activePanel ? (
        <>
          <button
            onClick={exitPanel}
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs transition-colors"
          >
            <ChevronRight size={14} className="rotate-180" /> Về trang
          </button>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-white/40 text-xs">{TOOL_NAMES[tool]}</span>
          {panelDef && (
            <span className="text-white/30 text-xs">
              • Khung {layout.panels.indexOf(panelDef) + 1}
            </span>
          )}

          <div className="ml-auto flex items-center gap-1">
            {/* Nút lưu tiến độ khung tranh */}
            {saveDraft && (
              <button
                onClick={saveDraft}
                title="Lưu khung tranh (Ctrl+S)"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all ${
                  isSaved
                    ? "text-green-400 bg-green-500/10 hover:bg-green-500/20"
                    : "text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 ring-1 ring-amber-500/30"
                }`}
              >
                {isSaved ? <Check size={12} /> : <Save size={12} />}
                <span>{isSaved ? "Đã lưu" : "Chưa lưu"}</span>
              </button>
            )}

            {/* Nút xuất ảnh PNG của khung */}
            {exportCurrentPanel && (
              <button
                onClick={exportCurrentPanel}
                title="Xuất ảnh khung tranh (PNG)"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:bg-white/5 hover:text-white transition-all"
              >
                <Download size={14} />
              </button>
            )}

            <div className="w-px h-4 bg-white/10 self-center mx-0.5" />

            {/* Hoàn tác (Undo) */}
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Hoàn tác (Ctrl+Z)"
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                canUndo
                  ? "text-white/70 hover:bg-white/5 hover:text-white"
                  : "text-white/20 cursor-not-allowed"
              }`}
            >
              <RefreshCw size={14} className="scale-x-[-1]" />
            </button>

            {/* Làm lại (Redo) */}
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Làm lại (Ctrl+Y)"
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                canRedo
                  ? "text-white/70 hover:bg-white/5 hover:text-white"
                  : "text-white/20 cursor-not-allowed"
              }`}
            >
              <RefreshCw size={14} />
            </button>

            {/* Xóa sạch canvas */}
            <button
              onClick={clearCanvas}
              title="Xoá sạch canvas"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-all"
            >
              <X size={14} />
            </button>

            <div className="w-px h-4 bg-white/10 self-center mx-0.5" />

            {/* Toàn màn hình */}
            <button
              onClick={() => setPanelFullscreen((v) => !v)}
              title={
                panelFullscreen ? "Thu nhỏ (Esc)" : "Phóng to toàn màn hình"
              }
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                panelFullscreen
                  ? "bg-purple-500/30 text-purple-300"
                  : "text-white/40 hover:bg-white/5 hover:text-white"
              }`}
            >
              {panelFullscreen ? (
                <Minimize2 size={14} />
              ) : (
                <Maximize2 size={14} />
              )}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Danh sách trang với chức năng thêm trang */}
          {pages.map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`px-3 py-1 rounded-lg text-xs transition-all ${
                page === n
                  ? "bg-white/10 text-white font-medium"
                  : "text-white/40 hover:text-white hover:bg-white/5"
              }`}
            >
              Trang {n}
            </button>
          ))}
          {addPage && (
            <button
              onClick={addPage}
              title="Thêm trang mới"
              className="w-6 h-6 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
            >
              <Plus size={12} />
            </button>
          )}

          {/* Nút xuất toàn bộ trang truyện thành file PNG */}
          {exportFullPage && (
            <button
              onClick={exportFullPage}
              className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 text-purple-200 text-xs font-medium transition-all"
              title="Xuất toàn bộ trang thành ảnh PNG chất lượng cao"
            >
              <Download size={12} />
              <span>Xuất trang PNG</span>
            </button>
          )}

          {/* Nút xuất toàn bộ dự án thành PDF nhiều trang (Slice 6) */}
          {exportProjectPdf && (
            <button
              onClick={exportProjectPdf}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/30 text-rose-200 text-xs font-medium transition-all"
              title="Xuất toàn bộ dự án thành một file PDF (mỗi trang truyện một trang PDF)"
            >
              <Download size={12} />
              <span>Xuất PDF</span>
            </button>
          )}

          {/* Active guide chips */}
          {activeGuides.length > 0 && (
            <div className="ml-2 flex gap-1">
              {activeGuides.map((g) => (
                <span
                  key={g}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/5 text-[10px] text-white/50"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full inline-block ${GUIDE_DOT[g]}`}
                  />
                  {GUIDE_CONFIG.find((x) => x.id === g)?.label}
                </span>
              ))}
            </div>
          )}

        </>
      )}
    </div>
  );
}
