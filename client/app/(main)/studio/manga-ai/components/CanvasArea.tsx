"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  BarChart2,
  BookOpen,
  Bot,
  Brush,
  Check,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Minimize2,
  X,
} from "lucide-react";
import { GuideOverlay } from "./SvgComponent";
import { CompThumb } from "./SvgComponent";
import { AiGhostStrokeOverlay } from "./AiGhostStrokeOverlay";
import {
  SCENE_TYPE_LABEL,
  COMP_SUGGESTIONS,
  PRINCIPLE_LABELS,
  KNOWLEDGE_SOURCE_TITLES,
  type DrawTool,
  type DrawingPlaceholderId,
  type GuideId,
  type LayoutDef,
} from "../data";
import type { SceneType } from "../data";
import type { AiDrawingReviewResponse, AiStrokePath } from "@/lib/ai-drawing-api";

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
  // Ghost / guides (AI dynamic strokes)
  ghostType: "comp" | "pose" | null;
  ghostId: string | null;
  ghostOpacity: number;
  ghostStrokes?: AiStrokePath[] | null;
  setGhostStrokes?: (v: AiStrokePath[] | null) => void;
  ghostStrokesSummary?: string | null;
  drawingPlaceholder?: DrawingPlaceholderId | null;
  setDrawingPlaceholder?: (v: DrawingPlaceholderId | null) => void;
  setGhostType: (v: "comp" | "pose" | null) => void;
  setGhostId: (v: string | null) => void;
  setGhostOpacity: (v: number) => void;
  setSelectedComp: (v: string | null) => void;
  activeGuides: GuideId[];
  aiConsentEligible: boolean;
  // Text tool inline placement
  showTextInput?: boolean;
  textInputPos?: { x: number; y: number } | null;
  insertText?: (text: string) => void;
  cancelText?: () => void;
  // Analysis & Review
  analyzing: boolean;
  analysisResult?: { items: string[] } | null;
  analysisError?: string | null;
  reviewResult?: AiDrawingReviewResponse | null;
  selectedFindingIndex?: number | null;
  setSelectedFindingIndex?: (v: number | null) => void;
  showAnalysis: boolean;
  dismissAnalysis?: () => void;
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
  ghostStrokes,
  setGhostStrokes,
  ghostStrokesSummary,
  drawingPlaceholder,
  setDrawingPlaceholder,
  setGhostType,
  setGhostId,
  setGhostOpacity,
  setSelectedComp,
  activeGuides,
  aiConsentEligible,
  showTextInput,
  textInputPos,
  insertText,
  cancelText,
  analyzing,
  analysisResult,
  analysisError,
  reviewResult,
  selectedFindingIndex,
  setSelectedFindingIndex,
  showAnalysis,
  dismissAnalysis,
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
                    aiConsentEligible && !hasData
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

            {/* Inline floating text input dialog */}
            {showTextInput && textInputPos && (
              <div
                className="absolute z-40 bg-[#0d0817]/95 border border-pink-500/40 rounded-xl p-2.5 shadow-2xl backdrop-blur-md flex flex-col gap-2"
                style={{
                  left: Math.max(10, Math.min(textInputPos.x, (canvasRef.current?.width ?? 400) - 240)),
                  top: Math.max(10, Math.min(textInputPos.y, (canvasRef.current?.height ?? 300) - 90)),
                  width: 230,
                }}
              >
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span className="font-semibold text-pink-400">Chèn lời thoại / chữ</span>
                  <button
                    onClick={cancelText}
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <input
                  type="text"
                  autoFocus
                  placeholder="Nhập nội dung thoại..."
                  defaultValue=""
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      insertText?.(e.currentTarget.value);
                    } else if (e.key === "Escape") {
                      cancelText?.();
                    }
                  }}
                  className="w-full bg-black/50 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-pink-500 transition-colors"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={cancelText}
                    className="px-2 py-0.5 rounded text-[10px] text-white/50 hover:text-white transition-colors"
                  >
                    Hủy (Esc)
                  </button>
                  <button
                    onClick={(e) => {
                      const input = e.currentTarget.parentElement?.previousElementSibling as HTMLInputElement;
                      if (input) insertText?.(input.value);
                    }}
                    className="px-3 py-1 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-[10px] font-semibold transition-colors"
                  >
                    Chèn (Enter)
                  </button>
                </div>
              </div>
            )}

            {/* Dynamic AI Ghost Stroke Overlay (SVG mờ do AI phân tích bức vẽ sinh ra) */}
            {aiConsentEligible && ghostStrokes && ghostStrokes.length > 0 && (
              <AiGhostStrokeOverlay
                strokes={ghostStrokes}
                canvasWidth={canvasRef.current?.width ?? 400}
                canvasHeight={canvasRef.current?.height ?? 300}
                ghostOpacity={ghostOpacity}
                setGhostOpacity={setGhostOpacity}
                onClear={() => setGhostStrokes?.(null)}
              />
            )}

            {/* AI Review Findings Overlay (chỗ vẽ lệch / cần xem lại) */}
            {aiConsentEligible && showAnalysis && reviewResult && reviewResult.findings.length > 0 && (
              <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 26 }}>
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {reviewResult.findings.map((finding, idx) => {
                    const isSelected = selectedFindingIndex === idx;
                    const rx = finding.region.x * 100;
                    const ry = finding.region.y * 100;
                    const rw = finding.region.width * 100;
                    const rh = finding.region.height * 100;
                    const strokeColor =
                      finding.severity === "high"
                        ? "#f43f5e"
                        : finding.severity === "medium"
                          ? "#fbbf24"
                          : "#a855f7";
                    return (
                      <g key={idx}>
                        <rect
                          x={rx}
                          y={ry}
                          width={rw}
                          height={rh}
                          fill={strokeColor}
                          fillOpacity={isSelected ? 0.18 : 0.08}
                          stroke={strokeColor}
                          strokeWidth={isSelected ? 0.8 : 0.45}
                          strokeDasharray={isSelected ? undefined : "3,2"}
                          rx="1"
                        />
                        <circle cx={rx + 2.5} cy={ry + 2.5} r="2" fill={strokeColor} />
                        <text
                          x={rx + 2.5}
                          y={ry + 3.2}
                          fontSize="1.8"
                          fill="#ffffff"
                          textAnchor="middle"
                          fontWeight="bold"
                        >
                          {idx + 1}
                        </text>
                      </g>
                    );
                  })}
                </svg>
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

            {/* Analysis & Review Result */}
            <AnimatePresence>
              {/* Error card */}
              {aiConsentEligible && showAnalysis && analysisError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-2 right-2 z-50 bg-[#160d26]/95 border border-rose-500/30 rounded-2xl p-3 w-64 shadow-2xl backdrop-blur-md"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-rose-200 text-xs font-semibold">Chưa thể đánh giá</p>
                      <p className="text-white/70 text-[10px] leading-relaxed mt-0.5">{analysisError}</p>
                    </div>
                    {dismissAnalysis && (
                      <button
                        onClick={dismissAnalysis}
                        className="text-white/30 hover:text-white transition-colors"
                        title="Đóng"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <button
                      onClick={runAnalysis}
                      className="flex-1 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 text-[10px] font-medium transition-colors"
                    >
                      Thử lại
                    </button>
                    {dismissAnalysis && (
                      <button
                        onClick={dismissAnalysis}
                        className="flex-1 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 text-[10px] transition-colors"
                      >
                        Đóng
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Review Findings card */}
              {aiConsentEligible && showAnalysis && reviewResult && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute top-2 right-2 z-50 bg-[#0d0817]/95 border border-purple-500/30 rounded-2xl p-3 w-72 shadow-2xl backdrop-blur-md flex flex-col max-h-[calc(100%-16px)] overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Bot size={13} className="text-purple-400" />
                      <p className="text-white text-xs font-semibold">
                        AI Nhận xét bản vẽ
                      </p>
                    </div>
                    {dismissAnalysis && (
                      <button
                        onClick={dismissAnalysis}
                        className="text-white/30 hover:text-white transition-colors"
                        title="Đóng nhận xét"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
                    {/* Summary */}
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-2 text-[10px] text-purple-200 leading-relaxed">
                      {reviewResult.summary}
                    </div>

                    {/* Findings list */}
                    {reviewResult.findings.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-white/40 text-[9px] uppercase tracking-wider font-semibold">
                          Gợi ý chỗ cần xem lại ({reviewResult.findings.length})
                        </p>
                        {reviewResult.findings.map((f, i) => {
                          const isSel = selectedFindingIndex === i;
                          const principleName = PRINCIPLE_LABELS[f.principle] ?? f.principle;
                          const sevColor =
                            f.severity === "high"
                              ? "text-rose-400 bg-rose-500/10 border-rose-500/30"
                              : f.severity === "medium"
                                ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                                : "text-purple-400 bg-purple-500/10 border-purple-500/30";
                          const sevLabel =
                            f.severity === "high"
                              ? "Lệch nhiều"
                              : f.severity === "medium"
                                ? "Lưu ý"
                                : "Góp ý";

                          return (
                            <div
                              key={i}
                              onClick={() => setSelectedFindingIndex?.(isSel ? null : i)}
                              className={`p-2 rounded-xl border text-[10px] transition-all cursor-pointer ${
                                isSel
                                  ? "bg-purple-500/20 border-purple-400 shadow-md ring-1 ring-purple-400/40"
                                  : "bg-white/[0.03] border-white/5 hover:border-white/15 hover:bg-white/5"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-white flex items-center gap-1">
                                  <span className="w-4 h-4 rounded-full bg-purple-600/80 text-white text-[9px] flex items-center justify-center font-bold">
                                    {i + 1}
                                  </span>
                                  {principleName}
                                </span>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full border ${sevColor}`}>
                                  {sevLabel}
                                </span>
                              </div>
                              <p className="text-white/70 leading-relaxed text-[9px] mb-1">
                                <span className="text-white/40">Vấn đề: </span>
                                {f.issue}
                              </p>
                              <p className="text-purple-300 leading-relaxed text-[9px]">
                                <span className="text-white/40">Gợi ý: </span>
                                {f.recommendation}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-white/40 text-[10px] text-center py-2">
                        Bản vẽ hài hòa, không phát hiện điểm lệch lớn.
                      </p>
                    )}

                    {/* Citations */}
                    {reviewResult.sourceIds.length > 0 && (
                      <div className="pt-1 border-t border-white/5 text-[8px] text-white/30 space-y-0.5">
                        <span className="flex items-center gap-1 text-white/40">
                          <BookOpen size={9} /> Nguồn kiến thức tham chiếu:
                        </span>
                        {reviewResult.sourceIds.map((srcId) => (
                          <p key={srcId} className="italic pl-2.5 truncate">
                            • {KNOWLEDGE_SOURCE_TITLES[srcId] ?? srcId}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 mt-2 border-t border-white/10 flex-shrink-0">
                    <button
                      onClick={runAnalysis}
                      className="flex-1 py-1.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/30 text-pink-300 text-[10px] font-medium transition-colors"
                    >
                      Đánh giá lại
                    </button>
                    {dismissAnalysis && (
                      <button
                        onClick={dismissAnalysis}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 text-[10px] transition-colors"
                      >
                        Ẩn
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Legacy fallback if reviewResult is not yet set */}
              {aiConsentEligible && showAnalysis && !reviewResult && !analysisError && analysisResult && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute top-2 right-2 z-50 bg-[#0d0817]/90 border border-white/10 rounded-2xl p-3 w-48 shadow-xl"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white text-[10px] font-semibold">Nhận xét nhanh</p>
                    {dismissAnalysis && (
                      <button onClick={dismissAnalysis} className="text-white/30 hover:text-white">
                        <X size={10} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {analysisResult.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-1">
                        <Check size={8} className="text-green-400 mt-0.5 flex-shrink-0" />
                        <p className="text-white/60 leading-tight text-[9px]">{item}</p>
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
