"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  BarChart2,
  BookOpen,
  Bot,
  Brush,
  Check,
  Minimize2,
  X,
} from "lucide-react";
import { GuideOverlay } from "./SvgComponent";
import { AiGhostStrokeOverlay, type AiOverlayLayerView } from "./AiGhostStrokeOverlay";
import {
  PRINCIPLE_LABELS,
  KNOWLEDGE_SOURCE_TITLES,
  type DrawTool,
  type DrawingPlaceholderId,
  type GuideId,
  type LayoutDef,
} from "../data";
import type {
  AiDrawingFinding,
  AiDrawingReviewResponse,
  NormalizedRegion,
} from "@/lib/ai-drawing-api";
import { cleanupCandidates } from "../lib/strokeCleanup";
import { describeFix } from "../lib/compositionFix";
import {
  moveTextItem,
  resizeTextItem,
  TEXT_FONT_OPTIONS,
  TEXT_WEIGHT_OPTIONS,
  textFontCss,
  textItemBox,
  type TextItem,
  type TextFontId,
} from "../lib/textItems";
import {
  BUBBLE_SHAPE_OPTIONS,
  moveBubbleShape,
  resizeBubbleShape,
  type BubbleShape,
  type BubbleShapeKind,
} from "../lib/bubbleShapes";

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
  setGhostOpacity: (v: number) => void;
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
  /** Khối chữ dạng đối tượng của khung đang mở — hình thật do composite vẽ, đây chỉ là tay nắm tương tác */
  texts?: TextItem[];
  onUpdateTextItem?: (id: string, patch: Partial<TextItem>) => void;
  /** Chốt thay đổi chữ (chụp panelData + lưu) khi kết thúc kéo/sửa */
  onCommitTextItems?: () => void;
  onRemoveTextItem?: (id: string) => void;
  /** Hình bóng thoại mẫu của khung đang mở + thao tác (hình thật do composite vẽ) */
  shapes?: BubbleShape[];
  onAddShape?: (kind: BubbleShapeKind) => BubbleShape | null;
  onUpdateShape?: (id: string, patch: Partial<BubbleShape>) => void;
  onCommitShapes?: () => void;
  onRemoveShape?: (id: string) => void;
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
  setGhostOpacity,
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
  texts,
  onUpdateTextItem,
  onCommitTextItems,
  onRemoveTextItem,
  shapes,
  onAddShape,
  onUpdateShape,
  onCommitShapes,
  onRemoveShape,
  enterPanel,
  setPanelFullscreen,
}: Props) {
  // ── Khối chữ dạng đối tượng: tay nắm trong suốt phủ đúng vị trí khối chữ;
  // hình chữ thật do composite canvas vẽ ở dưới. Kéo để dời, nhấp đúp để sửa.
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const textDragRef = useRef<{
    id: string;
    mode: "move" | "width";
    startX: number;
    startY: number;
    orig: TextItem;
  } | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  /** Cờ huỷ sửa: nhấn ra ngoài khi đang sửa chữ thì bỏ thay đổi, không lưu. */
  const cancelEditRef = useRef(false);

  // Nhấn ra ngoài khối chữ/bóng đang chọn → huỷ chỉnh sửa + bỏ chọn (Sơn chốt 23/10)
  useEffect(() => {
    if (!selectedTextId && !selectedShapeId && !editingTextId) return;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("[data-object-ui]")) return;
      if (editingTextId) cancelEditRef.current = true;
      setEditingTextId(null);
      setSelectedTextId(null);
      setSelectedShapeId(null);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [selectedTextId, selectedShapeId, editingTextId]);

  // Bóng vừa thêm từ thanh công cụ → tự chọn luôn để kéo/đổi cỡ ngay
  const prevShapeCountRef = useRef(0);
  useEffect(() => {
    const list = shapes ?? [];
    if (list.length === prevShapeCountRef.current + 1 && list.length > 0) {
      setSelectedShapeId(list[list.length - 1].id);
      setSelectedTextId(null);
    }
    prevShapeCountRef.current = list.length;
  }, [shapes]);

  const shapeDragRef = useRef<{
    id: string;
    mode: "move" | "resize" | "tail";
    startX: number;
    startY: number;
    orig: BubbleShape;
  } | null>(null);
  const measureCanvasRef = useRef<CanvasRenderingContext2D | null>(null);

  /** Hàm đo bề rộng chữ theo đúng font/cỡ của một khối chữ (cho hộp bao). */
  const measureForItem = (item: TextItem) => {
    const hostH = canvasRef.current?.clientHeight ?? 300;
    const fontPx = Math.max(10, item.fontScale * hostH);
    if (!measureCanvasRef.current) {
      measureCanvasRef.current = document
        .createElement("canvas")
        .getContext("2d");
    }
    const mctx = measureCanvasRef.current;
    return (text: string) => {
      if (!mctx) return text.length * fontPx * 0.6;
      mctx.font = textFontCss(item, fontPx);
      return mctx.measureText(text).width;
    };
  };

  /** Hộp bao (normalized) của khối chữ theo kích thước hiển thị hiện tại. */
  const boxForItem = (item: TextItem) => {
    const hostW = canvasRef.current?.clientWidth ?? 400;
    const hostH = canvasRef.current?.clientHeight ?? 300;
    return textItemBox(item, hostW, hostH, measureForItem(item));
  };

  const onTextPointerDown = (
    e: React.PointerEvent,
    item: TextItem,
    mode: "move" | "width" = "move",
  ) => {
    e.stopPropagation();
    setSelectedTextId(item.id);
    setSelectedShapeId(null);
    textDragRef.current = {
      id: item.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: item,
    };
    const onMove = (ev: PointerEvent) => {
      const drag = textDragRef.current;
      const host = canvasRef.current;
      if (!drag || !host || !onUpdateTextItem) return;
      const dx = (ev.clientX - drag.startX) / (host.clientWidth || 1);
      const dy = (ev.clientY - drag.startY) / (host.clientHeight || 1);
      if (drag.mode === "width") {
        const next = resizeTextItem(drag.orig, drag.orig.w + dx);
        onUpdateTextItem(drag.id, { w: next.w });
      } else {
        const next = moveTextItem(drag.orig, dx, dy);
        onUpdateTextItem(drag.id, { x: next.x, y: next.y });
      }
    };
    const onUp = () => {
      textDragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      onCommitTextItems?.();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onShapePointerDown = (
    e: React.PointerEvent,
    shape: BubbleShape,
    mode: "move" | "resize" | "tail",
  ) => {
    e.stopPropagation();
    setSelectedShapeId(shape.id);
    setSelectedTextId(null);
    shapeDragRef.current = {
      id: shape.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: shape,
    };
    const onMove = (ev: PointerEvent) => {
      const drag = shapeDragRef.current;
      const host = canvasRef.current;
      if (!drag || !host || !onUpdateShape) return;
      if (drag.mode === "tail") {
        const rect = host.getBoundingClientRect();
        onUpdateShape(drag.id, {
          tail: {
            x: Math.min(1, Math.max(0, (ev.clientX - rect.left) / (rect.width || 1))),
            y: Math.min(1, Math.max(0, (ev.clientY - rect.top) / (rect.height || 1))),
          },
        });
        return;
      }
      const dx = (ev.clientX - drag.startX) / (host.clientWidth || 1);
      const dy = (ev.clientY - drag.startY) / (host.clientHeight || 1);
      if (drag.mode === "resize") {
        const next = resizeBubbleShape(drag.orig, drag.orig.w + dx, drag.orig.h + dy);
        onUpdateShape(drag.id, { w: next.w, h: next.h });
      } else {
        const next = moveBubbleShape(drag.orig, dx, dy);
        onUpdateShape(drag.id, { x: next.x, y: next.y, tail: next.tail });
      }
    };
    const onUp = () => {
      shapeDragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      onCommitShapes?.();
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

            {/* Lớp tương tác cho hình bóng + khối chữ: tay nắm trong suốt phủ
                đúng vị trí; hình thật nằm ở composite canvas phía dưới. */}
            {activePanel && (texts || shapes) && (
              <div data-object-ui className="absolute inset-0 z-40 pointer-events-none">
                {/* Thanh công cụ chữ (chuẩn tool lớn) — hiện khi đang chọn một khối chữ */}
                {(() => {
                  const sel = texts?.find((t) => t.id === selectedTextId);
                  if (!sel || !onUpdateTextItem) return null;
                  const patchStyle = (patch: Partial<TextItem>, commit = true) => {
                    onUpdateTextItem(sel.id, patch);
                    if (commit) onCommitTextItems?.();
                  };
                  const selectCls =
                    "bg-white/10 border border-white/15 rounded-md text-[10px] text-white/90 px-1 py-0.5 max-w-[104px]";
                  return (
                    <div className="pointer-events-auto absolute left-1/2 top-2 -translate-x-1/3 flex flex-wrap items-center gap-x-2 gap-y-1 bg-black/80 border border-white/10 rounded-xl px-2.5 py-1.5 backdrop-blur-md max-w-[92%]">
                      <select
                        aria-label="Font chữ"
                        className={selectCls}
                        value={sel.fontId}
                        onChange={(e) =>
                          patchStyle({ fontId: e.currentTarget.value as TextFontId })
                        }
                      >
                        {TEXT_FONT_OPTIONS.map((f) => (
                          <option key={f.id} value={f.id} className="text-black">
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Độ đậm"
                        className={selectCls}
                        value={sel.fontWeight}
                        onChange={(e) =>
                          patchStyle({ fontWeight: Number(e.currentTarget.value) })
                        }
                      >
                        {TEXT_WEIGHT_OPTIONS.map((wOpt) => (
                          <option key={wOpt.value} value={wOpt.value} className="text-black">
                            {wOpt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        aria-label="Chữ nghiêng"
                        aria-pressed={sel.italic}
                        onClick={() => patchStyle({ italic: !sel.italic })}
                        className={`w-6 h-6 rounded-md text-[11px] italic font-serif ${
                          sel.italic
                            ? "bg-pink-500/40 text-white"
                            : "bg-white/10 text-white/70 hover:bg-white/20"
                        }`}
                      >
                        I
                      </button>
                      <input
                        type="color"
                        aria-label="Màu chữ"
                        value={sel.color}
                        onChange={(e) => patchStyle({ color: e.currentTarget.value }, false)}
                        onBlur={() => onCommitTextItems?.()}
                        className="w-6 h-6 rounded-md bg-white/10 border border-white/15 p-0.5 cursor-pointer"
                      />
                      <label className="flex items-center gap-1 text-[9px] text-white/60">
                        Mờ
                        <input
                          type="range"
                          min={0.2}
                          max={1}
                          step={0.05}
                          value={sel.opacity}
                          onChange={(e) =>
                            patchStyle({ opacity: Number(e.currentTarget.value) }, false)
                          }
                          onPointerUp={() => onCommitTextItems?.()}
                          className="w-14 accent-pink-500"
                        />
                      </label>
                      <div className="flex rounded-md overflow-hidden border border-white/15">
                        {(["left", "center", "right"] as const).map((a) => (
                          <button
                            key={a}
                            aria-label={`Căn ${a === "left" ? "trái" : a === "center" ? "giữa" : "phải"}`}
                            onClick={() => patchStyle({ align: a })}
                            className={`px-1.5 h-6 text-[9px] ${
                              sel.align === a
                                ? "bg-pink-500/40 text-white"
                                : "bg-white/10 text-white/70 hover:bg-white/20"
                            }`}
                          >
                            {a === "left" ? "Trái" : a === "center" ? "Giữa" : "Phải"}
                          </button>
                        ))}
                      </div>
                      <select
                        aria-label="Giãn dòng"
                        className={selectCls}
                        value={sel.lineHeight}
                        onChange={(e) =>
                          patchStyle({ lineHeight: Number(e.currentTarget.value) })
                        }
                      >
                        <option value={1} className="text-black">Dòng sát</option>
                        <option value={1.25} className="text-black">Dòng vừa</option>
                        <option value={1.6} className="text-black">Dòng thoáng</option>
                      </select>
                      <label className="flex items-center gap-1 text-[9px] text-white/60">
                        Viền
                        <input
                          type="range"
                          min={0}
                          max={0.25}
                          step={0.01}
                          value={sel.strokeScale}
                          onChange={(e) =>
                            patchStyle({ strokeScale: Number(e.currentTarget.value) }, false)
                          }
                          onPointerUp={() => onCommitTextItems?.()}
                          className="w-14 accent-pink-500"
                        />
                      </label>
                      <input
                        type="color"
                        aria-label="Màu viền"
                        value={sel.strokeColor}
                        onChange={(e) =>
                          patchStyle({ strokeColor: e.currentTarget.value }, false)
                        }
                        onBlur={() => onCommitTextItems?.()}
                        className="w-6 h-6 rounded-md bg-white/10 border border-white/15 p-0.5 cursor-pointer"
                      />
                    </div>
                  );
                })()}

                {/* Tay nắm hình bóng */}
                {shapes?.map((shape) => {
                  const isSel = selectedShapeId === shape.id;
                  return (
                    <div
                      key={shape.id}
                      className={`absolute pointer-events-auto ${
                        isSel
                          ? "outline outline-2 outline-dashed outline-sky-400/80"
                          : "outline outline-1 outline-transparent hover:outline-white/30"
                      }`}
                      style={{
                        left: `${shape.x * 100}%`,
                        top: `${shape.y * 100}%`,
                        width: `${shape.w * 100}%`,
                        height: `${shape.h * 100}%`,
                        borderRadius: shape.kind === "rect" ? "8px" : "50%",
                        cursor: "move",
                      }}
                      onPointerDown={(e) => onShapePointerDown(e, shape, "move")}
                      title="Kéo để dời bóng · chấm xanh ở đuôi để kéo đuôi"
                    >
                      {isSel && (
                        <>
                          <button
                            aria-label="Xoá bóng thoại"
                            className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] leading-none flex items-center justify-center shadow z-10"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => {
                              onRemoveShape?.(shape.id);
                              setSelectedShapeId(null);
                            }}
                          >
                            ×
                          </button>
                          <button
                            aria-label={shape.tail ? "Tắt đuôi" : "Bật đuôi"}
                            className="absolute -top-2.5 -left-2.5 h-5 px-1.5 rounded-full bg-black/75 text-white text-[9px] flex items-center justify-center shadow"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => {
                              onUpdateShape?.(shape.id, {
                                tail: shape.tail
                                  ? null
                                  : {
                                      x: shape.x + shape.w / 2,
                                      y: Math.min(1, shape.y + shape.h + 0.18),
                                    },
                              });
                              onCommitShapes?.();
                            }}
                          >
                            đuôi
                          </button>
                          <div
                            aria-label="Đổi kích thước bóng"
                            className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-sky-500 border-2 border-white shadow cursor-nwse-resize"
                            onPointerDown={(e) => onShapePointerDown(e, shape, "resize")}
                          />
                        </>
                      )}
                    </div>
                  );
                })}
                {/* Tay nắm kéo đuôi bóng (điểm neo riêng ngoài thân bóng) */}
                {shapes?.map((shape) =>
                  shape.tail && selectedShapeId === shape.id ? (
                    <div
                      key={`${shape.id}-tail`}
                      aria-label="Kéo đuôi bóng"
                      className="absolute pointer-events-auto w-4 h-4 -ml-2 -mt-2 rounded-full bg-emerald-400 border-2 border-white shadow cursor-crosshair z-10"
                      style={{
                        left: `${shape.tail.x * 100}%`,
                        top: `${shape.tail.y * 100}%`,
                      }}
                      onPointerDown={(e) => onShapePointerDown(e, shape, "tail")}
                      title="Kéo để chỉnh hướng đuôi"
                    />
                  ) : null,
                )}

                {/* Tay nắm khối chữ */}
                {texts?.map((item) => {
                  const isSel = selectedTextId === item.id;
                  const isEditing = editingTextId === item.id;
                  const box = boxForItem(item);
                  return (
                    <div
                      key={item.id}
                      className={`absolute pointer-events-auto ${
                        isSel
                          ? "outline outline-2 outline-dashed outline-pink-400/80"
                          : "outline outline-1 outline-transparent hover:outline-white/40"
                      }`}
                      style={{
                        left: `${item.x * 100}%`,
                        top: `${item.y * 100}%`,
                        width: `${Math.max(box.w * 100, 3)}%`,
                        height: `${Math.max(box.h * 100, 2.5)}%`,
                        cursor: "move",
                      }}
                      onPointerDown={(e) => onTextPointerDown(e, item)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        cancelEditRef.current = false;
                        setEditingTextId(item.id);
                      }}
                      title="Kéo để dời · nhấp đúp để sửa chữ"
                    >
                      {isEditing ? (
                        <textarea
                          autoFocus
                          defaultValue={item.text}
                          className="absolute left-0 top-0 min-w-[160px] min-h-[52px] bg-white text-black text-[12px] p-1.5 rounded-md resize outline-none shadow-xl"
                          onPointerDown={(e) => e.stopPropagation()}
                          onBlur={(e) => {
                            if (cancelEditRef.current) {
                              // Đã huỷ bằng nhấn ra ngoài/Esc — không lưu thay đổi
                              cancelEditRef.current = false;
                              setEditingTextId(null);
                              return;
                            }
                            onUpdateTextItem?.(item.id, {
                              text: e.currentTarget.value,
                            });
                            setEditingTextId(null);
                            onCommitTextItems?.();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              cancelEditRef.current = true;
                              setEditingTextId(null);
                            }
                          }}
                        />
                      ) : (
                        isSel && (
                          <>
                            <button
                              aria-label="Xoá khối chữ"
                              className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] leading-none flex items-center justify-center shadow z-10"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => {
                                onRemoveTextItem?.(item.id);
                                setSelectedTextId(null);
                              }}
                            >
                              ×
                            </button>
                            <div className="absolute -top-2.5 -left-2.5 flex gap-1">
                              <button
                                aria-label="Giảm cỡ chữ"
                                className="h-5 px-1.5 rounded-full bg-black/75 text-white text-[9px] flex items-center justify-center shadow"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => {
                                  onUpdateTextItem?.(item.id, {
                                    fontScale: Math.max(0.012, item.fontScale * 0.9),
                                  });
                                  onCommitTextItems?.();
                                }}
                              >
                                A−
                              </button>
                              <button
                                aria-label="Tăng cỡ chữ"
                                className="h-5 px-1.5 rounded-full bg-black/75 text-white text-[9px] flex items-center justify-center shadow"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => {
                                  onUpdateTextItem?.(item.id, {
                                    fontScale: Math.min(0.3, item.fontScale * 1.1),
                                  });
                                  onCommitTextItems?.();
                                }}
                              >
                                A+
                              </button>
                            </div>
                            <div
                              aria-label="Đổi bề rộng khối chữ"
                              className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3.5 h-8 rounded-full bg-pink-500/85 border border-white/70 shadow cursor-ew-resize"
                              onPointerDown={(e) => onTextPointerDown(e, item, "width")}
                              title="Kéo để đổi bề rộng khối chữ (ngắt dòng/căn lề theo bề rộng này)"
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
