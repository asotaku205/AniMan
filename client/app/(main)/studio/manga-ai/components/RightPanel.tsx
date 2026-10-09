"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Bot,
  Check,
  Eye,
  EyeOff,
  Grid3x3,
  Layers,
  Lock,
  Plus,
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
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/30 text-[10px] uppercase tracking-widest">
              Layers
            </p>
            <button
              onClick={() =>
                s.setLayers((prev) => [
                  ...prev,
                  {
                    id: `l${Date.now()}`,
                    name: `Layer ${prev.length + 1}`,
                    visible: true,
                    locked: false,
                  },
                ])
              }
              className="text-white/30 hover:text-white/70 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-1">
            <AnimatePresence>
              {s.layers.map((layer, li) => (
                <motion.div
                  key={layer.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all"
                >
                  <button
                    onClick={() =>
                      s.setLayers((prev) =>
                        prev.map((l, i) =>
                          i === li ? { ...l, visible: !l.visible } : l,
                        ),
                      )
                    }
                    className="text-white/40 hover:text-white/80 transition-colors"
                  >
                    {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <span className="flex-1 text-white/60 text-xs truncate">
                    {layer.name}
                  </span>
                  <button
                    onClick={() =>
                      s.setLayers((prev) =>
                        prev.map((l, i) =>
                          i === li ? { ...l, locked: !l.locked } : l,
                        ),
                      )
                    }
                    className="text-white/40 hover:text-white/80 transition-colors"
                  >
                    {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
                  </button>
                  {s.layers.length > 1 && (
                    <button
                      onClick={() =>
                        s.setLayers((prev) => prev.filter((_, i) => i !== li))
                      }
                      className="text-white/20 hover:text-red-400 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
