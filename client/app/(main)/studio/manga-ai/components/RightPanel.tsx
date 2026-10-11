"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Edit2,
  Eye,
  EyeOff,
  Grid3x3,
  Layers,
  Lock,
  Plus,
  Sliders,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { AiTab } from "./AiTab";
import {
  LAYOUTS,
  type LayerItem,
  type LayoutDef,
  type RightTab,
} from "../data";
import type { DrawStudioState } from "../hooks/useDrawStudio";

type Props = {
  s: DrawStudioState;
};

export function RightPanel({ s }: Props) {
  return (
    <div className="w-[340px] bg-[#120a1f] border-l border-white/5 flex flex-col flex-shrink-0">
      {/* Tab bar */}
      <div className="flex border-b border-white/5 flex-shrink-0">
        {(
          [
            ["ai", <Bot size={13} />, "AI Gợi ý"],
            ["layout", <Grid3x3 size={13} />, "Bố cục trang"],
            ["layers", <Layers size={13} />, "Layers"],
          ] as [RightTab, React.ReactNode, string][]
        ).map(([tab, icon, label]) => (
          <button
            key={tab}
            onClick={() => s.setRightTab(tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-medium transition-colors ${
              s.rightTab === tab
                ? "text-pink-400 border-b-2 border-pink-500"
                : "text-white/30 hover:text-white/60"
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* AI Tab */}
      {s.rightTab === "ai" && (
        <AiTab
          sceneType={s.sceneType}
          setSceneType={s.setSceneType}
          setCompletionReady={s.setCompletionReady}
          setAppliedCompletion={s.setAppliedCompletion}
          runCompletion={s.runCompletion}
          strokeCount={s.strokeCount}
          completionLoading={s.completionLoading}
          completionReady={s.completionReady}
          completions={s.completions}
          layout={s.layout}
          activePanel={s.activePanel}
          appliedCompletion={s.appliedCompletion}
          applyCompletion={s.applyCompletion}
          runAnalysis={s.runAnalysis}
          processingTool={s.processingTool}
          analyzing={s.analyzing}
          runTool={s.runTool}
          showCompSection={s.showCompSection}
          setShowCompSection={s.setShowCompSection}
          applyComp={s.applyComp}
          selectedComp={s.selectedComp}
          showPoseSection={s.showPoseSection}
          setShowPoseSection={s.setShowPoseSection}
          poseCategory={s.poseCategory}
          setPoseCategory={s.setPoseCategory}
          applyPose={s.applyPose}
          ghostType={s.ghostType}
          ghostId={s.ghostId}
          ghostOpacity={s.ghostOpacity}
          setGhostOpacity={s.setGhostOpacity}
          ghostStrokes={s.ghostStrokes}
          setGhostStrokes={s.setGhostStrokes}
          ghostStrokesSummary={s.ghostStrokesSummary}
          userDrawingPrompt={s.userDrawingPrompt}
          setUserDrawingPrompt={s.setUserDrawingPrompt}
          showGuideSection={s.showGuideSection}
          setShowGuideSection={s.setShowGuideSection}
          toggleGuide={s.toggleGuide}
          activeGuides={s.activeGuides}
        />
      )}

      {/* Layout Tab */}
      {s.rightTab === "layout" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <p className="text-white/30 text-[10px] uppercase tracking-widest mb-3">
            Chọn bố cục
          </p>
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                s.setLayout(l);
                s.exitPanel();
              }}
              className={`w-full flex items-center gap-3 p-2.5 rounded-2xl border transition-all ${
                s.layout.id === l.id
                  ? "border-pink-500/50 bg-pink-500/5"
                  : "border-white/5 hover:border-white/10 hover:bg-white/[0.03]"
              }`}
            >
              <div className="w-12 h-16 bg-white rounded-lg overflow-hidden flex-shrink-0 relative border border-gray-200">
                {l.panels.map((p) => (
                  <div
                    key={p.id}
                    className="absolute border border-gray-300"
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      width: `${p.w}%`,
                      height: `${p.h}%`,
                    }}
                  />
                ))}
              </div>
              <div className="flex-1 text-left">
                <p
                  className={`text-sm font-medium ${s.layout.id === l.id ? "text-pink-400" : "text-white/70"}`}
                >
                  {l.label}
                </p>
                <p className="text-white/30 text-[10px]">
                  {l.panels.length} khung
                </p>
              </div>
              {s.layout.id === l.id && (
                <Check size={14} className="text-pink-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Layers Tab */}
      {s.rightTab === "layers" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} className="text-pink-400" /> Quản Lý Layer
              </p>
              <p className="text-[10px] text-white/40">
                Layer đang chọn:{" "}
                <span className="text-pink-300 font-semibold">
                  {s.layers.find((l) => l.id === s.activeLayerId)?.name ?? "Chưa chọn"}
                </span>
              </p>
            </div>
            <button
              onClick={() => s.addLayer()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 text-[10px] font-semibold transition-all border border-pink-500/30"
            >
              <Plus size={12} /> Thêm Layer
            </button>
          </div>

          {/* Quick preset layer chips */}
          <div className="flex flex-wrap gap-1 bg-white/[0.02] p-1.5 rounded-xl border border-white/5">
            {[
              { label: "+ Phác thảo", name: "Sketch" },
              { label: "+ Đi nét", name: "Ink" },
              { label: "+ Đổ bóng", name: "Tone" },
              { label: "+ Thoại", name: "Text" },
            ].map((p) => (
              <button
                key={p.name}
                onClick={() => s.addLayer(p.name)}
                className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[9px] transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Layer List */}
          <div className="space-y-1.5">
            <AnimatePresence>
              {s.layers.map((layer, li) => {
                const isActive = s.activeLayerId === layer.id;
                const opacity = layer.opacity ?? 100;
                return (
                  <motion.div
                    key={layer.id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    onClick={() => s.setActiveLayerId(layer.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all space-y-1.5 ${
                      isActive
                        ? "bg-purple-950/30 border-pink-500/50 shadow-md ring-1 ring-pink-500/30"
                        : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Active radio indicator */}
                      <div
                        className={`w-2.5 h-2.5 rounded-full border transition-all ${
                          isActive
                            ? "border-pink-400 bg-pink-500 ring-2 ring-pink-500/20"
                            : "border-white/20 bg-transparent"
                        }`}
                        title={isActive ? "Layer đang vẽ" : "Nhấn để chọn layer này"}
                      />

                      {/* Visibility button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          s.toggleLayerVisibility(layer.id);
                        }}
                        className={`p-1 rounded-lg transition-colors ${
                          layer.visible
                            ? "text-white/60 hover:text-white"
                            : "text-white/20 hover:text-white/40"
                        }`}
                        title={layer.visible ? "Ẩn layer" : "Hiện layer"}
                      >
                        {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>

                      {/* Layer name */}
                      <span
                        className={`flex-1 text-xs font-medium truncate ${
                          isActive ? "text-white font-bold" : "text-white/60"
                        }`}
                      >
                        {layer.name}
                      </span>

                      {/* Lock button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          s.toggleLayerLock(layer.id);
                        }}
                        className={`p-1 rounded-lg transition-colors ${
                          layer.locked
                            ? "text-amber-400"
                            : "text-white/30 hover:text-white/60"
                        }`}
                        title={layer.locked ? "Mở khóa layer" : "Khóa layer"}
                      >
                        {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>

                      {/* Reorder up/down */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          disabled={li === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            s.reorderLayer(layer.id, "up");
                          }}
                          className="text-white/20 hover:text-white disabled:opacity-10 transition-colors"
                          title="Di chuyển lên trên"
                        >
                          <ChevronUp size={10} />
                        </button>
                        <button
                          disabled={li === s.layers.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            s.reorderLayer(layer.id, "down");
                          }}
                          className="text-white/20 hover:text-white disabled:opacity-10 transition-colors"
                          title="Di chuyển xuống dưới"
                        >
                          <ChevronDown size={10} />
                        </button>
                      </div>

                      {/* Delete layer button */}
                      {s.layers.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            s.removeLayer(layer.id);
                          }}
                          className="p-1 rounded-lg text-white/20 hover:text-rose-400 transition-colors"
                          title="Xóa layer"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>

                    {/* Opacity slider for active layer */}
                    {isActive && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 pt-1.5 border-t border-white/5"
                      >
                        <Sliders size={10} className="text-pink-400 flex-shrink-0" />
                        <span className="text-[9px] text-white/40 flex-shrink-0">
                          Độ mờ:
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={opacity}
                          onChange={(e) =>
                            s.setLayerOpacity(layer.id, Number(e.target.value))
                          }
                          className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-pink-500"
                        />
                        <span className="text-[9px] font-mono text-white/60 w-6 text-right">
                          {opacity}%
                        </span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Quick tips */}
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-[10px] leading-relaxed">
            💡 <strong>Mẹo Manga Artist:</strong> Bạn có thể giảm độ mờ của layer{" "}
            <strong>Sketch (Phác thảo)</strong> xuống 30-40% để dễ dàng đi nét mực trên layer{" "}
            <strong>Ink</strong> mà không bị rối mắt.
          </div>
        </div>
      )}
    </div>
  );
}
