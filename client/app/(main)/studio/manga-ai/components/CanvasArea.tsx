"use client";

import React, { useRef, useState } from "react";
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
import { AiGhostStrokeOverlay, type AiOverlayLayerView } from "./AiGhostStrokeOverlay";
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
import type {
  AiDrawingFinding,
  AiDrawingReviewResponse,
  NormalizedRegion,
} from "@/lib/ai-drawing-api";
import { cleanupCandidates } from "../lib/strokeCleanup";
import { describeFix } from "../lib/compositionFix";
import {
  moveBubble,
  resizeBubble,
  type SpeechBubble,
} from "../lib/bubbles";

type Props = {
  // Layout / panel state
  activePanel: string | null;
  layout: LayoutDef;
  panelData: Record<string, string>;
  panelHints: Record<string, string>;
  panelFullscreen: boolean;
  panelAspect: number;
  // Canvas
  /** Canvas hiển thị (chỉ đọc — RC-2): luôn chứa bản composite các layer */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Canvas input mờ phủ trên: nhận toàn bộ sự kiện vẽ (RC-2) */
  inputRef: React.RefObject<HTMLCanvasElement | null>;
  /** Lớp phủ vẽ đường "marching ants" của vùng chọn (3C) — không vào ảnh xuất */
  selectionOverlayRef: React.RefObject<HTMLCanvasElement | null>;
  tool: DrawTool;
  down: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  move: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  up: () => void;
  /** Khung nhìn (3A): hệ số zoom tương đối (1 = khung vừa khít) + điều khiển */
  zoom: number;
  zoomBy: (factor: number) => void;
  resetView: () => void;
  /** Cỡ pixel thật của panel khi xuất PNG (null khi chưa mở khung) */
  panelBackingSize: { w: number; h: number } | null;
  // Ghost / guides (AI dynamic strokes)
  ghostType: "comp" | "pose" | null;
  ghostId: string | null;
  ghostOpacity: number;
  /** Các lớp AI đang hiện của khung — nét AI là vector, không bấm được (5C.1/5C.3) */
  aiStrokeLayers?: readonly AiOverlayLayerView[];
  /** Đè nét AI lên trên nét người dùng (mặc định tắt — bất biến §1.2) */
  aiOverlayAbove?: boolean;
  setAiOverlayAbove?: (v: boolean) => void;
  /** Xoá nét AI + lớp AI của khung đang mở */
  clearPanelAiOverlay?: () => void;
  /** Áp nét AI vào lớp người dùng đang chọn = một bước hoàn tác (5C.2) */
  applyAiToActiveLayer?: () => void;
  canApplyAiToLayer?: boolean;
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
  /** Tẩy một vùng nét thừa AI khoanh (Slice 3 — dọn nét thừa) */
  onEraseStrokeRegion?: (region: NormalizedRegion) => void;
  /** Chuyển sang công cụ tẩy để tự tẩy tay theo vùng khoanh (Slice 3) */
  onStartManualCleanup?: () => void;
  /** Áp phép chỉnh bố cục AI đề xuất cho một finding (Slice 4) */
  onApplyCompositionFix?: (finding: AiDrawingFinding) => void;
  /** Bong bóng thoại của khung đang mở (Slice 5) — hình thật do composite vẽ, đây chỉ là tay nắm tương tác */
  bubbles?: SpeechBubble[];
  onAddBubble?: () => SpeechBubble | null;
  onUpdateBubble?: (id: string, patch: Partial<SpeechBubble>) => void;
  onRemoveBubble?: (id: string) => void;
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
  inputRef,
  selectionOverlayRef,
  tool,
  down,
  move,
  up,
  zoom,
  zoomBy,
  resetView,
  panelBackingSize,
  ghostType,
  ghostId,
  ghostOpacity,
  aiStrokeLayers,
  aiOverlayAbove,
  setAiOverlayAbove,
  clearPanelAiOverlay,
  applyAiToActiveLayer,
  canApplyAiToLayer,
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
  onEraseStrokeRegion,
  onStartManualCleanup,
  onApplyCompositionFix,
  bubbles,
  onAddBubble,
  onUpdateBubble,
  onRemoveBubble,
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
  // ── Bong bóng thoại (Slice 5): tay nắm tương tác trong suốt phủ đúng vị trí
  // bong bóng; hình bong bóng thật do composite canvas vẽ ở dưới.
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);
  const [editingBubbleId, setEditingBubbleId] = useState<string | null>(null);
  const bubbleDragRef = useRef<{
    id: string;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    orig: SpeechBubble;
  } | null>(null);

  const onBubblePointerDown = (
    e: React.PointerEvent,
    bubble: SpeechBubble,
    mode: "move" | "resize",
  ) => {
    e.stopPropagation();
    setSelectedBubbleId(bubble.id);
    bubbleDragRef.current = {
      id: bubble.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: bubble,
    };
    const onMove = (ev: PointerEvent) => {
      const drag = bubbleDragRef.current;
      const host = canvasRef.current;
      if (!drag || !host || !onUpdateBubble) return;
      const dx = (ev.clientX - drag.startX) / (host.clientWidth || 1);
      const dy = (ev.clientY - drag.startY) / (host.clientHeight || 1);
      if (drag.mode === "move") {
        const next = moveBubble(drag.orig, dx, dy);
        onUpdateBubble(drag.id, { x: next.x, y: next.y });
      } else {
        const next = resizeBubble(drag.orig, drag.orig.w + dx, drag.orig.h + dy);
        onUpdateBubble(drag.id, { w: next.w, h: next.h });
      }
    };
    const onUp = () => {
      bubbleDragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

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
            {/* Canvas hiển thị — CHỈ ĐỌC, không nhận sự kiện (RC-2) */}
            <canvas
              ref={canvasRef}
              aria-hidden
              className="absolute inset-0 w-full h-full z-30 pointer-events-none"
              style={{ touchAction: "none" }}
            />

            {/* Lớp phủ vùng chọn — chỉ vẽ "marching ants", không nhận sự kiện (3C) */}
            <canvas
              ref={selectionOverlayRef}
              aria-hidden
              className="absolute inset-0 w-full h-full z-30 pointer-events-none"
              style={{ touchAction: "none" }}
            />

            {/* Canvas input mờ phủ trên — nhận toàn bộ sự kiện vẽ (RC-2) */}
            <canvas
              ref={inputRef}
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

            {/* Bong bóng thoại (Slice 5) — tay nắm trong suốt: kéo để dời, góc
                dưới-phải để đổi cỡ, nhấp đúp để sửa chữ. Hình bong bóng thật
                nằm ở composite canvas phía dưới. */}
            {activePanel && bubbles && (
              <div className="absolute inset-0 z-40 pointer-events-none">
                {onAddBubble && (
                  <button
                    onClick={() => {
                      const created = onAddBubble();
                      if (created) setSelectedBubbleId(created.id);
                    }}
                    className="pointer-events-auto absolute left-2 top-2 px-2.5 py-1 rounded-full bg-black/70 hover:bg-black/85 border border-white/15 text-white/85 text-[10px] font-medium backdrop-blur-md transition-colors"
                  >
                    + Bong bóng thoại
                  </button>
                )}
                {bubbles.map((bubble) => {
                  const isSel = selectedBubbleId === bubble.id;
                  const isEditing = editingBubbleId === bubble.id;
                  return (
                    <div
                      key={bubble.id}
                      className={`absolute pointer-events-auto ${
                        isSel
                          ? "outline outline-2 outline-dashed outline-pink-400/80"
                          : "outline outline-1 outline-transparent hover:outline-white/30"
                      }`}
                      style={{
                        left: `${bubble.x * 100}%`,
                        top: `${bubble.y * 100}%`,
                        width: `${bubble.w * 100}%`,
                        height: `${bubble.h * 100}%`,
                        borderRadius: "50%",
                        cursor: "move",
                      }}
                      onPointerDown={(e) => onBubblePointerDown(e, bubble, "move")}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingBubbleId(bubble.id);
                      }}
                    >
                      {isEditing ? (
                        <textarea
                          autoFocus
                          defaultValue={bubble.text}
                          className="absolute inset-0 w-full h-full bg-white text-black text-[11px] rounded-[50%] text-center p-3 resize-none outline-none overflow-hidden"
                          onPointerDown={(e) => e.stopPropagation()}
                          onBlur={(e) => {
                            onUpdateBubble?.(bubble.id, {
                              text: e.currentTarget.value,
                            });
                            setEditingBubbleId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              onUpdateBubble?.(bubble.id, {
                                text: e.currentTarget.value,
                              });
                              setEditingBubbleId(null);
                            } else if (e.key === "Escape") {
                              setEditingBubbleId(null);
                            }
                          }}
                        />
                      ) : (
                        isSel && (
                          <>
                            <button
                              aria-label="Xoá bong bóng"
                              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] leading-none flex items-center justify-center shadow"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => {
                                onRemoveBubble?.(bubble.id);
                                setSelectedBubbleId(null);
                              }}
                            >
                              ×
                            </button>
                            <button
                              aria-label={bubble.tail ? "Tắt đuôi thoại" : "Bật đuôi thoại"}
                              title={bubble.tail ? "Tắt đuôi thoại" : "Bật đuôi thoại"}
                              className="absolute -top-2 -left-2 h-5 px-1.5 rounded-full bg-black/75 text-white text-[9px] flex items-center justify-center shadow"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() =>
                                onUpdateBubble?.(bubble.id, {
                                  tail: bubble.tail
                                    ? null
                                    : {
                                        x: bubble.x + bubble.w / 2,
                                        y: Math.min(1, bubble.y + bubble.h + 0.18),
                                      },
                                })
                              }
                            >
                              đuôi
                            </button>
                            <div
                              aria-label="Đổi kích thước bong bóng"
                              className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-pink-500 border-2 border-white shadow cursor-nwse-resize"
                              onPointerDown={(e) =>
                                onBubblePointerDown(e, bubble, "resize")
                              }
                            />
                          </>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Chip điều khiển khung nhìn (3A — pan/zoom, BR-T06) */}
            <div className="absolute right-2 top-2 z-40 flex items-center gap-0.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 px-1.5 py-1 text-[10px] text-white/80">
              <button
                onClick={() => zoomBy(1 / 1.25)}
                disabled={zoom <= 1}
                className="px-1.5 py-0.5 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Thu nhỏ (nhỏ nhất = khung vừa khít, 100%)"
              >
                −
              </button>
              <span
                className="w-10 text-center font-mono"
                title="100% = khung vừa khít (cỡ tương đối, không phải px thật)"
              >
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => zoomBy(1.25)}
                className="px-1.5 py-0.5 rounded-lg hover:bg-white/10"
                title="Phóng to (800%)"
              >
                +
              </button>
              <button
                onClick={resetView}
                className="px-1.5 py-0.5 rounded-lg hover:bg-white/10"
                title="Về khung vừa khít"
              >
                ⤢
              </button>
              {panelBackingSize && (
                <span
                  className="ml-1 pl-1.5 border-l border-white/15 font-mono text-white/50"
                  title="Cỡ pixel thật của panel khi xuất PNG"
                >
                  {panelBackingSize.w}×{panelBackingSize.h}px
                </span>
              )}
            </div>

            {/* Inline floating text input dialog */}
            {showTextInput && textInputPos && (
              <div
                className="absolute z-40 bg-[#0d0817]/95 border border-pink-500/40 rounded-xl p-2.5 shadow-2xl backdrop-blur-md flex flex-col gap-2"
                style={{
                  left: Math.max(10, Math.min(textInputPos.x, (canvasRef.current?.clientWidth ?? 400) - 240)),
                  top: Math.max(10, Math.min(textInputPos.y, (canvasRef.current?.clientHeight ?? 300) - 90)),
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

            {/* Nét AI (vector) — nằm dưới nét người dùng, không nhận sự kiện (5C.3) */}
            {aiConsentEligible && aiStrokeLayers && aiStrokeLayers.length > 0 && (
              <AiGhostStrokeOverlay
                layers={aiStrokeLayers}
                canvasWidth={canvasRef.current?.width ?? 400}
                canvasHeight={canvasRef.current?.height ?? 300}
                ghostOpacity={ghostOpacity}
                setGhostOpacity={setGhostOpacity}
                above={aiOverlayAbove === true}
                setAbove={(v) => setAiOverlayAbove?.(v)}
                onClear={() => clearPanelAiOverlay?.()}
                onApplyToLayer={applyAiToActiveLayer}
                canApplyToLayer={canApplyAiToLayer}
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
                              {f.fix && (
                                <div
                                  className="mt-1.5 pt-1.5 border-t border-white/5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[8px] px-1.5 py-0.5 rounded-full border text-amber-300 bg-amber-500/10 border-amber-500/30 font-semibold">
                                      Chỉnh bố cục
                                    </span>
                                    {onApplyCompositionFix && (
                                      <button
                                        onClick={() => onApplyCompositionFix(f)}
                                        className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-amber-200 font-medium transition-colors"
                                      >
                                        Áp dụng chỉnh
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-white/50 leading-relaxed text-[9px] mt-1">
                                    Đề xuất: {describeFix(f.fix)} — chỉ áp lên lớp đang chọn, hoàn tác được.
                                  </p>
                                </div>
                              )}
                              {f.cleanup && (
                                <div
                                  className="mt-1.5 pt-1.5 border-t border-white/5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[8px] px-1.5 py-0.5 rounded-full border text-rose-300 bg-rose-500/10 border-rose-500/30 font-semibold">
                                      Nét thừa
                                    </span>
                                    {onEraseStrokeRegion && (
                                      <button
                                        onClick={() => onEraseStrokeRegion(f.region)}
                                        className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/40 text-rose-200 font-medium transition-colors"
                                      >
                                        Tẩy vùng này
                                      </button>
                                    )}
                                  </div>
                                  {f.cleanup.overlapRisk && (
                                    <p className="text-amber-300/90 leading-relaxed text-[9px] mt-1">
                                      ⚠ Vùng này có thể chồng nét quan trọng — cân nhắc tự tẩy tay thay vì tẩy cả vùng.
                                    </p>
                                  )}
                                </div>
                              )}
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
                    {onStartManualCleanup &&
                      cleanupCandidates(reviewResult.findings).length > 0 && (
                        <button
                          onClick={onStartManualCleanup}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[10px] font-medium transition-colors"
                          title="Chuyển sang công cụ Tẩy để tự tẩy theo vùng đã khoanh"
                        >
                          Tự tẩy tay
                        </button>
                      )}
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
