"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart2,
  Bot,
  Brush,
  Check,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Minimize2,
  X,
} from "lucide-react";
import { DrawingPlaceholderOverlay, GhostComp, GhostPose, GuideOverlay } from "./SvgComponent";
import { CompThumb } from "./SvgComponent";
import {
  SCENE_TYPE_LABEL,
  COMP_SUGGESTIONS,
  type DrawTool,
  type DrawingPlaceholderId,
  type GuideId,
  type LayoutDef,
} from "../data";
import type { SceneType } from "../data";

type Props = {
  // Layout / panel state
  activePanel: string | null;
  layout: LayoutDef;
  panelData: Record<string, string>;
  panelHints: Record<string, string>;
  panelFullscreen: boolean;
  panelAspect: number;
  // Canvas
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  tool: DrawTool;
  down: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  move: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  up: () => void;
  // Ghost / guides
  ghostType: "comp" | "pose" | null;
  ghostId: string | null;
  ghostOpacity: number;
  drawingPlaceholder: DrawingPlaceholderId | null;
  setDrawingPlaceholder: (v: DrawingPlaceholderId | null) => void;
  setGhostType: (v: "comp" | "pose" | null) => void;
  setGhostId: (v: string | null) => void;
  setGhostOpacity: (v: number) => void;
  setSelectedComp: (v: string | null) => void;
  activeGuides: GuideId[];
  aiConsentEligible: boolean;
  // Analysis
  analyzing: boolean;
  analysisResult: { score: number; items: string[] } | null;
  showAnalysis: boolean;
  runAnalysis: () => void;
  // Suggestion widget
  sceneType: SceneType;
  selectedComp: string | null;
  showPanelSuggestions: boolean;
  setShowPanelSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
  panelSuggestPulse: boolean;
  showSuggestBtn: boolean;
  setShowSuggestBtn: (v: boolean) => void;
  applyComp: (id: string) => void;
  // Panel interactions
  enterPanel: (id: string) => void;
  setPanelFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function CanvasArea({
  activePanel,
  layout,
  panelData,
  panelHints,
  panelFullscreen,
  panelAspect,
  canvasRef,
  tool,
  down,
  move,
  up,
  ghostType,
  ghostId,
  ghostOpacity,
  drawingPlaceholder,
  setDrawingPlaceholder,
  setGhostType,
  setGhostId,
  setGhostOpacity,
  setSelectedComp,
  activeGuides,
  aiConsentEligible,
  analyzing,
  analysisResult,
  showAnalysis,
  runAnalysis,
  sceneType,
  selectedComp,
  showPanelSuggestions,
  setShowPanelSuggestions,
  panelSuggestPulse,
  showSuggestBtn,
  setShowSuggestBtn,
  applyComp,
  enterPanel,
  setPanelFullscreen,
}: Props) {
  return (
    <div
      className={`flex-1 bg-[#1a1226] flex items-center justify-center transition-all ${
        !activePanel
          ? "overflow-auto p-6"
          : panelFullscreen
            ? "overflow-hidden"
            : "overflow-hidden p-2"
      }`}
    >
      <div
        className="shadow-2xl shadow-black/60 transition-all duration-300"
        style={
          !activePanel
            ? {
                width: "min(480px, 100%)",
                aspectRatio: "3/4",
                position: "relative",
              }
            : panelFullscreen
              ? {
                  position: "fixed",
                  inset: 0,
                  zIndex: 100,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#0b0612",
                  padding: "12px",
                }
              : {
                  height: "calc(100% - 8px)",
                  aspectRatio: String(panelAspect),
                  maxWidth: "100%",
                  position: "relative",
                  flexShrink: 0,
                }
        }
      >
        {/* ── PAGE VIEW (no active panel) */}
        {!activePanel && (
          <div className="absolute inset-0 bg-white rounded-xl overflow-hidden">
            {layout.panels.map((p) => {
              const hasData = !!panelData[p.id];
              const hint = aiConsentEligible ? panelHints[p.id] : undefined;
              const idx = layout.panels.indexOf(p);
              return (
                <div
                  key={p.id}
                  onClick={() => enterPanel(p.id)}
                  className={`absolute border cursor-pointer hover:border-pink-300 transition-colors group overflow-hidden ${
                    aiConsentEligible && ghostType && ghostId && !hasData
                      ? "border-purple-300/60"
                      : "border-gray-200"
                  }`}
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    width: `${p.w}%`,
                    height: `${p.h}%`,
                  }}
                >
                  {hasData ? (
                    <img
                      src={panelData[p.id]}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : hint ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-purple-50">
                      {aiConsentEligible && ghostType === "comp" && ghostId && (
                        <GhostComp id={ghostId} opacity={0.18} />
                      )}
                      <Bot
                        size={10}
                        className="text-purple-400 relative z-10"
                      />
                      <p
                        className="text-purple-500 text-center px-1 leading-tight relative z-10"
                        style={{ fontSize: "6px" }}
                      >
                        {hint}
                      </p>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 group-hover:bg-pink-50/30 transition-colors">
                      {aiConsentEligible && ghostType === "comp" && ghostId && (
                        <GhostComp id={ghostId} opacity={0.18} />
                      )}
                      {aiConsentEligible && ghostType === "pose" && ghostId && (
                        <GhostPose id={ghostId} opacity={0.18} />
                      )}
                      <Brush
                        size={10}
                        className="text-gray-300 group-hover:text-pink-400 transition-colors relative z-10"
                      />
                      <p
                        className="text-gray-300 group-hover:text-pink-400 transition-colors relative z-10"
                        style={{ fontSize: "7px" }}
                      >
                        Khung {idx + 1}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── PANEL EDIT VIEW */}
        {activePanel && (
          <div
            className="bg-white overflow-hidden"
            style={
              panelFullscreen
                ? {
                    position: "relative",
                    height: "calc(100vh - 24px)",
                    aspectRatio: String(panelAspect),
                    maxWidth: "calc(100vw - 24px)",
                    borderRadius: "12px",
                    boxShadow: "0 25px 60px rgba(0,0,0,0.9)",
                  }
                : { position: "absolute", inset: 0, borderRadius: "0.75rem" }
            }
          >
            {/* Drawing canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full z-30"
              style={{
                cursor:
                  tool === "pan"
                    ? "grab"
                    : tool === "eraser"
                      ? "cell"
                      : "crosshair",
                touchAction: "none",
              }}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerLeave={up}
            />

            {/* Ghost overlays */}
            {aiConsentEligible && ghostType === "comp" && ghostId && (
              <div className="absolute inset-0 z-20 pointer-events-none">
                <GhostComp id={ghostId} opacity={ghostOpacity / 100} />
              </div>
            )}
            {aiConsentEligible && ghostType === "pose" && ghostId && (
              <div className="absolute inset-0 z-20 pointer-events-none">
                <GhostPose id={ghostId} opacity={ghostOpacity / 100} />
              </div>
            )}

            {/* Drawing placeholder overlay */}
            {aiConsentEligible && drawingPlaceholder && (
              <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 25 }}>
                <DrawingPlaceholderOverlay
                  id={drawingPlaceholder}
                  opacity={ghostOpacity / 100}
                />
              </div>
            )}

            {/* Guide overlay */}
            {aiConsentEligible && activeGuides.length > 0 && (
              <div className="absolute inset-0 z-10 pointer-events-none">
                <GuideOverlay guides={activeGuides} />
              </div>
            )}

            {/* In-panel suggestion widget */}
            {aiConsentEligible && showSuggestBtn && (
              <div className="absolute top-2 left-2" style={{ zIndex: 45 }}>
                <button
                  onClick={() => setShowPanelSuggestions((v) => !v)}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-medium transition-all shadow-lg backdrop-blur-sm ${
                    showPanelSuggestions
                      ? "bg-purple-600 text-white shadow-purple-500/30"
                      : panelSuggestPulse
                        ? "bg-purple-500/25 text-purple-300 ring-1 ring-purple-400/70 animate-pulse"
                        : "bg-black/40 text-purple-300/80 border border-purple-500/25 hover:border-purple-400/60 hover:text-purple-200"
                  }`}
                >
                  <Lightbulb size={10} />
                  <span>Gợi ý vẽ</span>
                  {showPanelSuggestions ? (
                    <ChevronDown size={9} />
                  ) : (
                    <ChevronRight size={9} />
                  )}
                </button>

                <AnimatePresence>
                  {showPanelSuggestions && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      transition={{ duration: 0.14 }}
                      className="mt-1.5 bg-[#0d0817]/96 backdrop-blur-md border border-purple-500/25 rounded-2xl p-3 shadow-2xl"
                      style={{ width: 228 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Bot size={10} className="text-purple-400" />
                          <span className="text-purple-300 text-[10px] font-medium">
                            Gợi ý cho cảnh {SCENE_TYPE_LABEL[sceneType]}
                          </span>
                        </div>
                        <button
                          onClick={() => setShowPanelSuggestions(false)}
                          className="text-white/20 hover:text-white/60 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </div>

                      {/* Comp thumbnails */}
                      <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                        {COMP_SUGGESTIONS[sceneType].slice(0, 3).map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              applyComp(c.id);
                              setShowPanelSuggestions(false);
                            }}
                            className={`rounded-xl overflow-hidden border-2 transition-all group ${
                              selectedComp === c.id
                                ? "border-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                                : "border-white/10 hover:border-purple-400/60"
                            }`}
                          >
                            <div className="h-14 bg-white flex items-center justify-center p-1">
                              <CompThumb id={c.id} />
                            </div>
                            <div
                              className={`py-1 px-1 transition-colors ${selectedComp === c.id ? "bg-purple-700" : "bg-[#1a1226] group-hover:bg-purple-900/40"}`}
                            >
                              <p className="text-[8px] text-white leading-tight text-center truncate">
                                {c.name}
                              </p>
                              <p className="text-[7px] text-white/40 leading-tight text-center truncate">
                                {c.desc}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Bottom actions */}
                      <div className="mt-2 flex items-center gap-2">
                        {aiConsentEligible && ghostType && ghostId && (
                          <button
                            onClick={() => {
                              setGhostType(null);
                              setGhostId(null);
                              setSelectedComp(null);
                            }}
                            className="flex-1 text-center text-[9px] text-white/25 hover:text-white/50 transition-colors"
                          >
                            Tắt gợi ý mờ ✕
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setShowPanelSuggestions(false);
                            setShowSuggestBtn(false);
                          }}
                          className="flex-1 text-center text-[9px] text-white/20 hover:text-red-400/60 transition-colors"
                        >
                          Ẩn nút này
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Analyzing overlay */}
            {aiConsentEligible && analyzing && (
              <div className="absolute inset-0 z-40 bg-black/50 flex flex-col items-center justify-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                >
                  <BarChart2 size={28} className="text-pink-400" />
                </motion.div>
                <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-pink-500 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2 }}
                  />
                </div>
                <p className="text-white/60 text-xs">Đang phân tích...</p>
              </div>
            )}

            {/* Analysis result */}
            <AnimatePresence>
              {aiConsentEligible && showAnalysis && analysisResult && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute top-2 right-2 z-50 bg-[#0d0817]/90 border border-white/10 rounded-2xl p-3 w-40 shadow-xl"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative w-10 h-10 flex-shrink-0">
                      <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke="rgba(255,255,255,0.1)"
                          strokeWidth="3"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke="#ec4899"
                          strokeWidth="3"
                          strokeDasharray={`${analysisResult.score * 0.942} 94.2`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold rotate-90">
                        {analysisResult.score}
                      </span>
                    </div>
                    <p className="text-white text-[10px] font-semibold">
                      Điểm AI
                    </p>
                  </div>
                  <div className="space-y-1">
                    {analysisResult.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-1">
                        <Check
                          size={8}
                          className="text-green-400 mt-0.5 flex-shrink-0"
                        />
                        <p
                          className="text-white/60 leading-tight"
                          style={{ fontSize: "8px" }}
                        >
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={runAnalysis}
                    className="mt-2 w-full text-[9px] text-pink-400 hover:text-pink-300 transition-colors"
                  >
                    Phân tích lại
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Placeholder control bar */}
            {aiConsentEligible && drawingPlaceholder && !(ghostType && ghostId) && (
              <div className="absolute bottom-2 left-2 right-2 z-40 bg-[#0d0817]/90 border border-amber-400/30 rounded-xl px-3 py-2 flex items-center gap-2">
                <span className="text-amber-300 text-[10px] flex-shrink-0">
                  Nét gợi ý
                </span>
                <input
                  type="range"
                  min={8}
                  max={60}
                  value={ghostOpacity}
                  onChange={(e) => setGhostOpacity(+e.target.value)}
                  className="flex-1 h-1 accent-amber-400"
                />
                <span className="text-amber-300 text-[9px] w-6">
                  {ghostOpacity}%
                </span>
                <button
                  onClick={() => setDrawingPlaceholder(null)}
                  className="text-white/40 hover:text-white transition-colors"
                  title="Tắt nét gợi ý"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Ghost control bar */}
            {aiConsentEligible && ghostType && ghostId && (
              <div className="absolute bottom-2 left-2 right-2 z-40 bg-[#0d0817]/90 border border-purple-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
                <span className="text-purple-300 text-[10px] flex-shrink-0">
                  {ghostType === "comp"
                    ? (Object.values(COMP_SUGGESTIONS)
                        .flat()
                        .find((c) => c.id === ghostId)?.name ?? ghostId)
                    : ghostId}
                </span>
                <input
                  type="range"
                  min={8}
                  max={60}
                  value={ghostOpacity}
                  onChange={(e) => setGhostOpacity(+e.target.value)}
                  className="flex-1 h-1 accent-purple-500"
                />
                <span className="text-purple-400 text-[9px] w-6">
                  {ghostOpacity}%
                </span>
                <button
                  onClick={() => {
                    setGhostType(null);
                    setGhostId(null);
                  }}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Fullscreen exit button */}
            {panelFullscreen && (
              <button
                onClick={() => setPanelFullscreen(false)}
                className="absolute top-3 right-3 z-50 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur text-white/70 hover:text-white transition-all flex items-center justify-center shadow-lg"
                title="Thu nhỏ (Esc)"
              >
                <Minimize2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
