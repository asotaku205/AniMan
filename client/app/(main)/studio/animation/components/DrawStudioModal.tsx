"use client";

/**
 * Khung vẽ trong Animation Studio: toàn bộ công cụ vẽ port từ Manga
 * Studio (bút, cọ, phun, tẩy, đổ màu, chuyển sắc, lấy màu, hình, đường,
 * cong, chọn, hiệu ứng, đối xứng, chữ, bóng thoại) trên nền TRONG SUỐT
 * (lưu PNG giữ độ trong suốt để xếp lớp trong cảnh).
 *
 * Cách port: các lib toán/vẽ thuần của manga được import trực tiếp
 * (shape, bubbleShapes, textItems, floodFill, gradient, curve, symmetry,
 * effects, stroke, selection, toolSettings); riêng component vẽ của manga
 * gắn chặt state khung/layer/AI nên hộp thoại tự quản lý tương tác theo
 * model op ở lib/drawTools. Hợp đồng không đổi: onSave nhận dataUrl PNG
 * nền trong suốt của canvas chính, onClose đóng khung. Lớp phủ xem trước
 * và đường dẫn chọn vùng vẽ trên canvas riêng nên không dính vào ảnh xuất.
 * Pan (di chuyển khung nhìn) không port vì canvas modal cố định và hiện
 * toàn bộ, không có viewport để di chuyển.
 */

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  Brush,
  Check,
  Cloud,
  Eraser,
  MessageCircle,
  MessageSquare,
  MousePointer2,
  Paintbrush,
  PaintBucket,
  Blend,
  Pipette,
  Redo2,
  Save,
  Spline,
  SprayCan,
  Square,
  Circle,
  Minus,
  MoveUpRight,
  Pentagon,
  Star,
  Trash2,
  Type as TypeIcon,
  Undo2,
  Waves,
  FlipHorizontal2,
  X,
  Zap,
} from "lucide-react";
import {
  ANIM_SHORTCUT_TO_TOOL,
  ANIM_TOOL_GROUPS,
  ANIM_TOOL_LABELS,
  animToolDefaults,
  commitBubbleOp,
  commitCurveOp,
  commitEffectOp,
  commitEraseOp,
  commitFillOp,
  commitFreeOp,
  commitGradientOp,
  commitMoveOp,
  commitShapeOp,
  commitTextOp,
  createDrawOpHistory,
  exportPngDataUrl,
  moveSelectionBy,
  paintDrawOp,
  paintFillOp,
  pushDrawOp,
  redoDrawOp,
  renderDrawOps,
  rgbaToHex,
  selectionFromDrag,
  undoDrawOp,
  type AnimDrawTool,
  type DrawOp,
  type DrawOpHistory,
  type DrawPoint,
} from "../lib/drawTools";
import { DRAW_PALETTE } from "../lib/drawStrokes";
import {
  BUBBLE_SHAPE_OPTIONS,
  drawBubbleShapes,
  type BubbleShapeKind,
} from "../../manga-ai/lib/bubbleShapes";
import {
  GRADIENT_ENDS,
  GRADIENT_SHAPES,
  gradientEndLabel,
  gradientShapeLabel,
  type GradientEnd,
  type GradientShape,
} from "../../manga-ai/lib/gradient";
import {
  LINE_KINDS,
  SHAPE_KINDS,
  buildShapePath,
  clampSides,
  kindLetsFill,
  shapeLabel,
  snapToAngle,
  type ShapeKind,
} from "../../manga-ai/lib/shape";
import {
  CURVE_BOW_MAX,
  CURVE_BOW_MIN,
  curveControlPoints,
} from "../../manga-ai/lib/curve";
import {
  SYMMETRY_MODES,
  symmetryGuides,
  symmetryLabel,
  type SymmetryMode,
} from "../../manga-ai/lib/symmetry";
import {
  EFFECT_MODES,
  effectModeLabel,
  type EffectMode,
} from "../../manga-ai/lib/toolSettings";
import {
  TEXT_FONT_OPTIONS,
  TEXT_WEIGHT_OPTIONS,
  type TextStyle,
} from "../../manga-ai/lib/textItems";
import {
  airbrushDabRadius,
  airbrushDabsPerTick,
  sprayDabs,
} from "../../manga-ai/lib/stroke";
import {
  pointInSelection,
  polygonBounds,
  type Selection,
} from "../../manga-ai/lib/selection";

interface Props {
  title: string;
  /** Hình hiện có để vẽ tiếp ,  null là trang giấy trắng trong suốt. */
  initialDataUrl?: string | null;
  canvasWidth: number;
  canvasHeight: number;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

const TOOL_ICONS: Record<AnimDrawTool, ReactNode> = {
  pen: <Paintbrush className="w-3.5 h-3.5" />,
  brush: <Brush className="w-3.5 h-3.5" />,
  airbrush: <SprayCan className="w-3.5 h-3.5" />,
  eraser: <Eraser className="w-3.5 h-3.5" />,
  fill: <PaintBucket className="w-3.5 h-3.5" />,
  gradient: <Blend className="w-3.5 h-3.5" />,
  eyedropper: <Pipette className="w-3.5 h-3.5" />,
  shape: <Square className="w-3.5 h-3.5" />,
  line: <Minus className="w-3.5 h-3.5" />,
  curve: <Spline className="w-3.5 h-3.5" />,
  select: <MousePointer2 className="w-3.5 h-3.5" />,
  effect: <Waves className="w-3.5 h-3.5" />,
  symmetry: <FlipHorizontal2 className="w-3.5 h-3.5" />,
  text: <TypeIcon className="w-3.5 h-3.5" />,
  bubble: <MessageCircle className="w-3.5 h-3.5" />,
};

const SHAPE_ICONS: Record<ShapeKind, ReactNode> = {
  rect: <Square size={13} />,
  circle: <Circle size={13} />,
  line: <Minus size={13} />,
  arrow: <MoveUpRight size={13} />,
  polygon: <Pentagon size={13} />,
  star: <Star size={13} />,
};

const BUBBLE_ICONS: Record<BubbleShapeKind, ReactNode> = {
  ellipse: <MessageCircle size={14} />,
  rect: <MessageSquare size={14} />,
  thought: <Cloud size={14} />,
  shout: <Zap size={14} />,
};

type DragState =
  | { kind: "free"; points: DrawPoint[]; stamps: DrawPoint[] }
  | { kind: "drag"; start: DrawPoint; points: DrawPoint[] }
  | {
      kind: "move";
      start: DrawPoint;
      origin: Selection;
    }
  | null;

export default function DrawStudioModal({
  title,
  initialDataUrl,
  canvasWidth,
  canvasHeight,
  onSave,
  onClose,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const historyRef = useRef<DrawOpHistory>(createDrawOpHistory());
  const dragRef = useRef<DragState>(null);
  const [history, setHistory] = useState<DrawOpHistory>(historyRef.current);
  const [tool, setTool] = useState<AnimDrawTool>("pen");  const [color, setColor] = useState("#171717");
  const [size, setSize] = useState(6);
  const [opacity, setOpacity] = useState(100);
  const [flow, setFlow] = useState(100);
  const [hardness, setHardness] = useState(100);
  const [smoothing, setSmoothing] = useState(35);
  const [symmetry, setSymmetry] = useState<SymmetryMode>("off");
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rect");
  const [shapeFill, setShapeFill] = useState(false);
  const [shapeSides, setShapeSides] = useState(5);
  const [gradientEnd, setGradientEnd] = useState<GradientEnd>("transparent");
  const [gradientShape, setGradientShape] = useState<GradientShape>("linear");
  const [curveBow, setCurveBow] = useState(40);
  const [effectMode, setEffectMode] = useState<EffectMode>("blur");
  const [effectStrength, setEffectStrength] = useState(55);
  const [textFont, setTextFont] =
    useState<(typeof TEXT_FONT_OPTIONS)[number]["id"]>("comic");
  const [textWeight, setTextWeight] = useState(600);
  const [textItalic, setTextItalic] = useState(false);
  const [textSizePx, setTextSizePx] = useState(36);
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">(
    "center",
  );
  const [bubbleKind, setBubbleKind] = useState<BubbleShapeKind>("ellipse");
  const [selectMode, setSelectMode] = useState<"rect" | "lasso">("rect");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [textDraft, setTextDraft] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [textValue, setTextValue] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [bgPreview, setBgPreview] = useState<"checker" | "white" | "dark">(
    "checker",
  );

  const applyHistory = (h: DrawOpHistory) => {
    historyRef.current = h;
    setHistory(h);
  };

  const redrawAll = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    renderDrawOps(
      ctx,
      baseImageRef.current,
      historyRef.current.ops,
      canvasWidth,
      canvasHeight,
    );
    paintOverlay();
  };

  const paintOverlay = () => {
    const overlay = overlayRef.current;
    const ctx = overlay?.getContext("2d");
    if (!overlay || !ctx) return;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    if (selection) {
      ctx.save();
      ctx.strokeStyle = "rgba(236, 72, 153, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      // Vùng chọn lưu theo px khung (đúng không gian của lib manga).
      selection.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    if (symmetry !== "off") {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (const g of symmetryGuides(symmetry, canvasWidth, canvasHeight)) {
        ctx.beginPath();
        ctx.moveTo(g.x1, g.y1);
        ctx.lineTo(g.x2, g.y2);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  // Nạp hình gốc (nếu có) rồi vẽ lại
  useEffect(() => {
    if (!initialDataUrl) {
      redrawAll();
      return;
    }
    const img = new Image();
    img.onload = () => {
      baseImageRef.current = img;
      redrawAll();
    };
    img.src = initialDataUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDataUrl]);

  // Vẽ lại lớp phủ khi vùng chọn hoặc trục đối xứng đổi
  useEffect(() => {
    paintOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, symmetry]);

  const changeTool = (t: AnimDrawTool) => {
    setTool(t);
    const d = animToolDefaults(t);
    setSize(Math.min(40, Math.max(2, d.size)));
    setOpacity(d.opacity);
    setFlow(d.flow);
    setHardness(d.hardness);
    setSmoothing(d.smoothing);
    if (t === "symmetry" && symmetry === "off") setSymmetry("vertical");
    if (t === "line" && shapeKind !== "line" && shapeKind !== "arrow") {
      setShapeKind("line");
    }
    setTextDraft(null);
  };

  // Phím tắt theo manga (bỏ qua khi đang gõ trong ô nhập)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }
      const t = ANIM_SHORTCUT_TO_TOOL[e.key.toLowerCase()];
      if (t) {
        e.preventDefault();
        changeTool(t);
      } else if (e.key === "Escape") {
        setTextDraft(null);
        setSelection(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symmetry, shapeKind]);

  const pointOf = (e: PointerEvent): DrawPoint => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const commitOp = (op: DrawOp | null) => {
    if (!op) return;
    // pushDrawOp bỏ op rỗng và xoá redo; chỉ vẽ lại khi thật sự có op mới.
    const next = pushDrawOp(historyRef.current, op);
    if (next === historyRef.current) return;
    applyHistory(next);
    redrawAll();
  };

  const previewDrag = (start: DrawPoint, current: DrawPoint) => {
    const overlay = overlayRef.current;
    const ctx = overlay?.getContext("2d");
    if (!overlay || !ctx) return;
    paintOverlay();
    const sx = start.x * canvasWidth;
    const sy = start.y * canvasHeight;
    const cx = current.x * canvasWidth;
    const cy = current.y * canvasHeight;
    ctx.save();
    ctx.strokeStyle = "rgba(236, 72, 153, 0.9)";
    ctx.fillStyle = "rgba(236, 72, 153, 0.15)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    if (tool === "shape" || tool === "line") {
      const kind = tool === "line" ? activeLineKind : shapeKind;
      buildShapePath(ctx, kind, { x: sx, y: sy }, { x: cx, y: cy }, shapeSides, size);
      if (tool === "shape" && shapeFill) ctx.fill();
      ctx.stroke();
    } else if (tool === "curve") {
      const [c1, c2] = curveControlPoints(
        { x: sx, y: sy },
        { x: cx, y: cy },
        curveBow,
      );
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, cx, cy);
      ctx.stroke();
    } else if (tool === "gradient") {
      ctx.setLineDash([]);
      ctx.strokeRect(
        Math.min(sx, cx),
        Math.min(sy, cy),
        Math.abs(cx - sx),
        Math.abs(cy - sy),
      );
    } else if (tool === "bubble") {
      const bx = Math.min(start.x, current.x);
      const by = Math.min(start.y, current.y);
      const bw = Math.abs(current.x - start.x);
      const bh = Math.abs(current.y - start.y);
      drawBubbleShapes(
        ctx,
        [
          {
            id: "preview",
            kind: bubbleKind,
            x: bx,
            y: by,
            w: bw,
            h: bh,
            tail:
              bubbleKind === "rect"
                ? null
                : { x: bx + bw / 2, y: Math.min(1, by + bh + 0.12) },
            fill: "#ffffff",
            strokeColor: color,
            strokeScale: 0.004,
          },
        ],
        canvasWidth,
        canvasHeight,
      );
    }
    ctx.restore();
  };

  // Kiểu đường đang vẽ của công cụ Đường (dùng chung state với công cụ Hình)
  const activeLineKind: ShapeKind =
    shapeKind === "arrow" ? "arrow" : "line";
  const activeShapeKind: ShapeKind =
    tool === "line" ? activeLineKind : shapeKind;
  const showFillToggle =
    tool === "shape" && kindLetsFill(shapeKind);
  const showSides = shapeKind === "polygon" || shapeKind === "star";

  const startAction = (e: PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = pointOf(e);
    if (tool === "text") {
      setTextDraft(p);
      setTextValue("");
      return;
    }
    if (tool === "eyedropper") {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const px = Math.floor(p.x * canvasWidth);
      const py = Math.floor(p.y * canvasHeight);
      const img = ctx.getImageData(px, py, 1, 1);
      const hex = rgbaToHex(img.data[0], img.data[1], img.data[2], img.data[3]);
      if (hex) {
        setColor(hex);
        changeTool("pen");
      }
      return;
    }
    if (tool === "fill") {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const op = commitFillOp(p, color, opacity);
      const painted = paintFillOp(ctx, op, canvasWidth, canvasHeight);
      if (painted > 0) {
        applyHistory(pushDrawOp(historyRef.current, op));
      }
      return;
    }
    if (tool === "select") {
      // Vùng chọn lưu theo px khung; điểm bấm cũng đổi sang px để kiểm tra.
      const pPx = { x: p.x * canvasWidth, y: p.y * canvasHeight };
      if (selection && pointInSelection(selection, pPx)) {
        dragRef.current = { kind: "move", start: pPx, origin: selection };
      } else {
        dragRef.current = { kind: "drag", start: pPx, points: [pPx] };
      }
      return;
    }
    if (tool === "effect") {
      dragRef.current = { kind: "drag", start: p, points: [p] };
      return;
    }
    if (
      tool === "shape" ||
      tool === "line" ||
      tool === "curve" ||
      tool === "gradient" ||
      tool === "bubble"
    ) {
      dragRef.current = { kind: "drag", start: p, points: [p] };
      return;
    }
    // Công cụ vẽ nét tự do
    const stamps = tool === "airbrush" ? stampAt(p) : [];
    dragRef.current = { kind: "free", points: [p], stamps };
    if (tool === "airbrush") {
      paintStampsLive(stamps);
    } else {
      paintFreeTail([p, p]);
    }
  };

  const stampAt = (p: DrawPoint): DrawPoint[] => {
    const out: DrawPoint[] = [];
    for (const d of sprayDabs(
      airbrushDabsPerTick(flow),
      Math.max(0, size / 2),
    )) {
      // sprayDabs trả toạ độ px tương đối theo tâm cọ; đổi sang tương đối khung
      out.push({
        x: p.x + d.x / canvasWidth,
        y: p.y + d.y / canvasHeight,
      });
    }
    return out;
  };

  const paintStampsLive = (stamps: DrawPoint[]) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.globalAlpha = opacity / 100;
    ctx.fillStyle = color;
    for (const s of stamps) {
      ctx.beginPath();
      ctx.arc(
        s.x * canvasWidth,
        s.y * canvasHeight,
        airbrushDabRadius(size),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  };

  const paintFreeTail = (points: DrawPoint[]) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || points.length === 0) return;
    const effectiveTool =
      tool === "symmetry" ? "brush" : tool === "airbrush" ? "brush" : tool;
    if (effectiveTool !== "pen" && effectiveTool !== "brush" && effectiveTool !== "eraser") {
      return;
    }
    const op = {
      kind: "free" as const,
      tool: effectiveTool,
      color,
      widthPx: size,
      opacity,
      flow,
      hardness,
      symmetry,
      points,
    };
    paintDrawOp(ctx, op, canvasWidth, canvasHeight);
  };

  const moveAction = (e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = pointOf(e);
    const pPx = { x: p.x * canvasWidth, y: p.y * canvasHeight };
    if (drag.kind === "free") {
      drag.points.push(p);
      if (tool === "airbrush") {
        const stamps = stampAt(p);
        drag.stamps.push(...stamps);
        paintStampsLive(stamps);
      } else {
        const tail = drag.points.slice(-2);
        paintFreeTail(tail.length === 2 ? tail : [p, p]);
      }
      return;
    }
    if (drag.kind === "move") {
      const overlay = overlayRef.current;
      const ctx = overlay?.getContext("2d");
      if (!overlay || !ctx) return;
      paintOverlay();
      ctx.save();
      ctx.strokeStyle = "rgba(236, 72, 153, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      drag.origin.points.forEach((pt, i) => {
        const x = pt.x + (pPx.x - drag.start.x);
        const y = pt.y + (pPx.y - drag.start.y);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      return;
    }
    // Kéo xem trước (hình, đường, cong, chuyển sắc, bóng, hiệu ứng, chọn).
    // Điểm của select lưu theo px, các công cụ khác lưu tương đối 0..1.
    drag.points.push(tool === "select" ? pPx : p);
    if (tool === "select") {
      const overlay = overlayRef.current;
      const ctx = overlay?.getContext("2d");
      if (!overlay || !ctx) return;
      paintOverlay();
      ctx.save();
      ctx.strokeStyle = "rgba(236, 72, 153, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      if (selectMode === "rect" && drag.points.length >= 2) {
        const s = drag.points[0];
        ctx.strokeRect(
          Math.min(s.x, pPx.x),
          Math.min(s.y, pPx.y),
          Math.abs(pPx.x - s.x),
          Math.abs(pPx.y - s.y),
        );
      } else {
        drag.points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    if (tool === "effect") {
      const overlay = overlayRef.current;
      const ctx = overlay?.getContext("2d");
      if (!overlay || !ctx) return;
      paintOverlay();
      ctx.save();
      ctx.strokeStyle = "rgba(236, 72, 153, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      const s = drag.points[0];
      const r = Math.max(
        size,
        Math.hypot(
          (p.x - s.x) * canvasWidth,
          (p.y - s.y) * canvasHeight,
        ),
      );
      ctx.arc(s.x * canvasWidth, s.y * canvasHeight, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    previewDrag(drag.points[0], p);
  };

  const endAction = (e: PointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const p = pointOf(e);
    const pPx = { x: p.x * canvasWidth, y: p.y * canvasHeight };
    if (drag.kind === "free") {
      const pts = drag.points;
      if (tool === "airbrush") {
        const op = {
          kind: "airbrush" as const,
          color,
          dabRadius: airbrushDabRadius(size),
          opacity,
          stamps: drag.stamps,
        };
        commitOp(op);
      } else {
        const effectiveTool =
          tool === "symmetry"
            ? "brush"
            : tool === "pen" || tool === "brush" || tool === "eraser"
              ? tool
              : "pen";
        commitOp(
          commitFreeOp(
            effectiveTool,
            color,
            size,
            opacity,
            flow,
            hardness,
            symmetry,
            pts,
            smoothing,
          ),
        );
      }
      return;
    }
    if (drag.kind === "move") {
      const dxPx = pPx.x - drag.start.x;
      const dyPx = pPx.y - drag.start.y;
      const boundsPx = polygonBounds(drag.origin.points);
      // Op lưu tương đối 0..1, vùng chọn hiển thị vẫn giữ theo px.
      commitOp(
        commitMoveOp(
          {
            x: boundsPx.x / canvasWidth,
            y: boundsPx.y / canvasHeight,
            w: boundsPx.w / canvasWidth,
            h: boundsPx.h / canvasHeight,
          },
          dxPx / canvasWidth,
          dyPx / canvasHeight,
        ),
      );
      setSelection(moveSelectionBy(drag.origin, dxPx, dyPx));
      return;
    }
    // Kết thúc kéo: hình, đường, cong, chuyển sắc, bóng, hiệu ứng, chọn
    const start = drag.points[0];
    const end = p;
    const shift = e.shiftKey;
    if (tool === "select") {
      const startPx = drag.points[0];
      const sel = selectionFromDrag(
        selectMode,
        selectMode === "rect" ? [startPx, pPx] : drag.points,
      );
      if (selectMode === "rect") {
        const wPx = Math.abs(pPx.x - startPx.x);
        const hPx = Math.abs(pPx.y - startPx.y);
        setSelection(wPx >= 4 && hPx >= 4 ? sel : null);
      } else {
        setSelection(sel);
      }
      return;
    }
    if (tool === "effect") {
      const r = Math.max(
        size,
        Math.hypot(
          (end.x - start.x) * canvasWidth,
          (end.y - start.y) * canvasHeight,
        ),
      );
      commitOp(commitEffectOp(effectMode, effectStrength, start, r));
      return;
    }
    if (tool === "shape" || tool === "line") {
      const to = shift
        ? snapToAngle(
            { x: start.x * canvasWidth, y: start.y * canvasHeight },
            { x: end.x * canvasWidth, y: end.y * canvasHeight },
          )
        : { x: end.x * canvasWidth, y: end.y * canvasHeight };
      const toRel = { x: to.x / canvasWidth, y: to.y / canvasHeight };
      commitOp(
        commitShapeOp(
          activeShapeKind,
          start,
          toRel,
          shapeSides,
          shapeFill,
          color,
          size,
          opacity,
        ),
      );
      return;
    }
    if (tool === "curve") {
      commitOp(commitCurveOp(start, end, curveBow, color, size, opacity));
      return;
    }
    if (tool === "gradient") {
      commitOp(
        commitGradientOp(gradientShape, start, end, color, gradientEnd, opacity),
      );
      return;
    }
    if (tool === "bubble") {
      commitOp(commitBubbleOp(bubbleKind, start, end, color));
      return;
    }
  };

  const cancelAction = () => {
    dragRef.current = null;
    paintOverlay();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(exportPngDataUrl(canvas));
  };

  const commitText = () => {
    if (!textDraft) return;
    const style: TextStyle = {
      fontId: textFont,
      fontWeight: textWeight,
      italic: textItalic,
      color,
      opacity: opacity / 100,
      align: textAlign,
      lineHeight: 1.25,
      strokeScale: 0,
      strokeColor: "#ffffff",
    };
    commitOp(
      commitTextOp(
        textValue,
        textDraft.x,
        textDraft.y,
        0.45,
        Math.max(10, textSizePx) / canvasHeight,
        style,
      ),
    );
    setTextDraft(null);
    setTextValue("");
  };

  const bgClass =
    bgPreview === "checker"
      ? "[background:repeating-conic-gradient(#2a2a2e_0%_25%,#1c1c1f_0%_50%)_0_0/16px_16px]"
      : bgPreview === "white"
        ? "bg-white"
        : "bg-neutral-900";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#141216] p-4 space-y-3 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 text-[14px] font-semibold text-white/85">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Đóng khung vẽ"
            className="p-1.5 text-white/40 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hàng công cụ theo nhóm như manga */}
        <div className="flex flex-wrap items-center gap-1 text-[12px]">
          {ANIM_TOOL_GROUPS.map((group) => (
            <span key={group.label} className="flex items-center gap-1 mr-1">
              <span className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">
                {group.label}
              </span>
              {group.tools.map((t) => (
                <button
                  key={t}
                  onClick={() => changeTool(t)}
                  title={`${ANIM_TOOL_LABELS[t]}`}
                  aria-label={ANIM_TOOL_LABELS[t]}
                  className={`flex items-center gap-1 px-2 h-8 rounded-lg border ${tool === t ? "bg-pink-500/25 border-pink-300/40 text-pink-100" : "bg-white/5 border-white/10 text-white/60"}`}
                >
                  {TOOL_ICONS[t]}
                  <span className="hidden sm:inline">
                    {ANIM_TOOL_LABELS[t]}
                  </span>
                </button>
              ))}
            </span>
          ))}
        </div>

        {/* Hàng thuộc tính chung */}
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="flex items-center gap-1">
            {DRAW_PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Màu ${c}`}
                className={`w-5 h-5 rounded-full border ${color === c ? "border-white ring-2 ring-pink-400/60" : "border-white/25"}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.currentTarget.value)}
              aria-label="Màu tuỳ chọn"
              className="w-7 h-7 rounded bg-transparent cursor-pointer"
            />
          </span>
          <label className="flex items-center gap-1.5 text-white/55 ml-1">
            Cỡ nét
            <input
              type="range"
              min={2}
              max={40}
              value={size}
              onChange={(e) => setSize(Number(e.currentTarget.value))}
              className="w-24 accent-pink-400"
            />
            <span className="w-6 text-white/75">{size}</span>
          </label>
          <label className="flex items-center gap-1.5 text-white/55">
            Mờ
            <input
              type="range"
              min={1}
              max={100}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.currentTarget.value))}
              className="w-20 accent-pink-400"
            />
            <span className="w-7 text-white/75">{opacity}%</span>
          </label>
          {(tool === "brush" ||
            tool === "airbrush" ||
            tool === "eraser" ||
            tool === "symmetry") && (
            <label className="flex items-center gap-1.5 text-white/55">
              Lượng mực
              <input
                type="range"
                min={1}
                max={100}
                value={flow}
                onChange={(e) => setFlow(Number(e.currentTarget.value))}
                className="w-20 accent-pink-400"
              />
              <span className="w-7 text-white/75">{flow}%</span>
            </label>
          )}
          {(tool === "brush" || tool === "airbrush") && (
            <label className="flex items-center gap-1.5 text-white/55">
              Độ cứng
              <input
                type="range"
                min={0}
                max={100}
                value={hardness}
                onChange={(e) => setHardness(Number(e.currentTarget.value))}
                className="w-20 accent-pink-400"
              />
              <span className="w-7 text-white/75">{hardness}%</span>
            </label>
          )}
          {(tool === "pen" ||
            tool === "brush" ||
            tool === "airbrush" ||
            tool === "eraser" ||
            tool === "symmetry") && (
            <label className="flex items-center gap-1.5 text-white/55">
              Làm mượt
              <input
                type="range"
                min={0}
                max={100}
                value={smoothing}
                onChange={(e) => setSmoothing(Number(e.currentTarget.value))}
                className="w-20 accent-pink-400"
              />
              <span className="w-7 text-white/75">{smoothing}%</span>
            </label>
          )}
          <span className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => {
                applyHistory(undoDrawOp(historyRef.current));
                redrawAll();
              }}
              disabled={history.ops.length === 0}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/70 disabled:opacity-35"
              aria-label="Hoàn tác"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                applyHistory(redoDrawOp(historyRef.current));
                redrawAll();
              }}
              disabled={history.undone.length === 0}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/70 disabled:opacity-35"
              aria-label="Làm lại"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            {confirmClear ? (
              <button
                onClick={() => {
                  applyHistory({ ops: [], undone: [] });
                  baseImageRef.current = null;
                  setConfirmClear(false);
                  redrawAll();
                }}
                className="px-2.5 h-8 rounded-lg bg-rose-500/25 border border-rose-300/40 text-rose-100"
              >
                Xoá hết thật?
              </button>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/70"
                aria-label="Xoá toàn bộ hình"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </span>
        </div>

        {/* Hàng tuỳ chọn riêng từng công cụ */}
        {(tool === "shape" || tool === "line") && (
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-white/45">
              {tool === "line" ? "Kiểu đường" : "Loại hình"}
            </span>
            {(tool === "line" ? LINE_KINDS : SHAPE_KINDS).map((kind) => (
              <button
                key={kind}
                onClick={() => setShapeKind(kind)}
                title={shapeLabel(kind)}
                aria-label={shapeLabel(kind)}
                className={`h-8 px-2 rounded-lg flex items-center justify-center gap-1 border ${activeShapeKind === kind ? "bg-purple-600 text-white border-purple-400" : "bg-white/5 border-white/10 text-white/55"}`}
              >
                {SHAPE_ICONS[kind]}
                {shapeLabel(kind)}
              </button>
            ))}
            {showFillToggle && (
              <button
                onClick={() => setShapeFill(!shapeFill)}
                className={`flex items-center gap-1 px-2.5 h-8 rounded-lg border ${shapeFill ? "bg-purple-500/20 text-purple-300 border-purple-500/30" : "bg-white/5 border-white/10 text-white/55"}`}
              >
                {shapeFill && <Check size={12} />} Đổ đặc nền
              </button>
            )}
            {showSides && (
              <label className="flex items-center gap-1.5 text-white/55">
                {shapeKind === "star" ? "Số cánh" : "Số cạnh"}
                <input
                  type="range"
                  min={3}
                  max={12}
                  value={shapeSides}
                  onChange={(e) =>
                    setShapeSides(clampSides(Number(e.currentTarget.value)))
                  }
                  className="w-20 accent-purple-500"
                />
                <span className="w-4 text-white/75">{shapeSides}</span>
              </label>
            )}
            <span className="text-white/35">
              Giữ Shift khi kéo để khoá góc 45 độ.
            </span>
          </div>
        )}
        {tool === "gradient" && (
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-white/45">Đầu thứ hai</span>
            {GRADIENT_ENDS.map((end) => (
              <button
                key={end}
                onClick={() => setGradientEnd(end)}
                className={`px-2.5 h-8 rounded-lg border ${gradientEnd === end ? "bg-purple-600 text-white border-purple-400" : "bg-white/5 border-white/10 text-white/55"}`}
              >
                {gradientEndLabel(end)}
              </button>
            ))}
            <span className="text-white/45 ml-2">Cách trải màu</span>
            {GRADIENT_SHAPES.map((shape) => (
              <button
                key={shape}
                onClick={() => setGradientShape(shape)}
                className={`px-2.5 h-8 rounded-lg border ${gradientShape === shape ? "bg-purple-600 text-white border-purple-400" : "bg-white/5 border-white/10 text-white/55"}`}
              >
                {gradientShapeLabel(shape)}
              </button>
            ))}
          </div>
        )}
        {tool === "curve" && (
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <label className="flex items-center gap-1.5 text-white/55">
              Độ cong
              <input
                type="range"
                min={CURVE_BOW_MIN}
                max={CURVE_BOW_MAX}
                value={curveBow}
                onChange={(e) => setCurveBow(Number(e.currentTarget.value))}
                className="w-32 accent-pink-400"
              />
              <span className="w-8 text-white/75">{curveBow}</span>
            </label>
          </div>
        )}
        {tool === "effect" && (
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            {EFFECT_MODES.map((mode) => (
              <button
                key={mode}
                onClick={() => setEffectMode(mode)}
                className={`px-2.5 h-8 rounded-lg border ${effectMode === mode ? "bg-purple-600 text-white border-purple-400" : "bg-white/5 border-white/10 text-white/55"}`}
              >
                {effectModeLabel(mode)}
              </button>
            ))}
            <label className="flex items-center gap-1.5 text-white/55">
              Độ mạnh
              <input
                type="range"
                min={1}
                max={100}
                value={effectStrength}
                onChange={(e) => setEffectStrength(Number(e.currentTarget.value))}
                className="w-24 accent-pink-400"
              />
              <span className="w-7 text-white/75">{effectStrength}%</span>
            </label>
            <span className="text-white/35">
              Kéo một vùng để áp hiệu ứng lên vùng đó.
            </span>
          </div>
        )}
        {(tool === "pen" ||
          tool === "brush" ||
          tool === "airbrush" ||
          tool === "eraser" ||
          tool === "symmetry") && (
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-white/45">Đối xứng</span>
            {SYMMETRY_MODES.map((mode) => (
              <button
                key={mode}
                onClick={() => setSymmetry(mode)}
                className={`px-2.5 h-8 rounded-lg border ${symmetry === mode ? "bg-purple-600 text-white border-purple-400" : "bg-white/5 border-white/10 text-white/55"}`}
              >
                {symmetryLabel(mode)}
              </button>
            ))}
          </div>
        )}
        {tool === "text" && (
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <select
              value={textFont}
              onChange={(e) =>
                setTextFont(
                  e.currentTarget.value as (typeof TEXT_FONT_OPTIONS)[number]["id"],
                )
              }
              className="h-8 rounded-lg bg-white/5 border border-white/10 text-white/75 px-2"
              aria-label="Font chữ"
            >
              {TEXT_FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              value={textWeight}
              onChange={(e) => setTextWeight(Number(e.currentTarget.value))}
              className="h-8 rounded-lg bg-white/5 border border-white/10 text-white/75 px-2"
              aria-label="Độ đậm chữ"
            >
              {TEXT_WEIGHT_OPTIONS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-white/55">
              Cỡ chữ
              <input
                type="range"
                min={10}
                max={120}
                value={textSizePx}
                onChange={(e) => setTextSizePx(Number(e.currentTarget.value))}
                className="w-20 accent-pink-400"
              />
              <span className="w-7 text-white/75">{textSizePx}</span>
            </label>
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setTextAlign(a)}
                className={`px-2.5 h-8 rounded-lg border ${textAlign === a ? "bg-purple-600 text-white border-purple-400" : "bg-white/5 border-white/10 text-white/55"}`}
              >
                {a === "left" ? "Trái" : a === "center" ? "Giữa" : "Phải"}
              </button>
            ))}
            <button
              onClick={() => setTextItalic(!textItalic)}
              className={`px-2.5 h-8 rounded-lg border ${textItalic ? "bg-purple-600 text-white border-purple-400" : "bg-white/5 border-white/10 text-white/55"}`}
            >
              Nghiêng
            </button>
            <span className="text-white/35">
              Bấm lên tranh để đặt chữ.
            </span>
          </div>
        )}
        {tool === "bubble" && (
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            {BUBBLE_SHAPE_OPTIONS.map((opt) => (
              <button
                key={opt.kind}
                onClick={() => setBubbleKind(opt.kind)}
                className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg border ${bubbleKind === opt.kind ? "bg-purple-600 text-white border-purple-400" : "bg-white/5 border-white/10 text-white/55"}`}
              >
                {BUBBLE_ICONS[opt.kind]}
                {opt.label}
              </button>
            ))}
            <span className="text-white/35">
              Kéo một hộp trên tranh để đặt bóng, đuôi trỏ xuống dưới.
            </span>
          </div>
        )}
        {tool === "select" && (
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <button
              onClick={() => setSelectMode("rect")}
              className={`px-2.5 h-8 rounded-lg border ${selectMode === "rect" ? "bg-purple-600 text-white border-purple-400" : "bg-white/5 border-white/10 text-white/55"}`}
            >
              Hộp chữ nhật
            </button>
            <button
              onClick={() => setSelectMode("lasso")}
              className={`px-2.5 h-8 rounded-lg border ${selectMode === "lasso" ? "bg-purple-600 text-white border-purple-400" : "bg-white/5 border-white/10 text-white/55"}`}
            >
              Vòng tự do
            </button>
            {selection && (
              <>
                <button
                  onClick={() => {
                    // Op tẩy vùng lưu tương đối, vùng chọn hiển thị lưu theo px.
                    commitOp(
                      commitEraseOp(
                        selection.points.map((pt) => ({
                          x: pt.x / canvasWidth,
                          y: pt.y / canvasHeight,
                        })),
                      ),
                    );
                    setSelection(null);
                  }}
                  className="px-2.5 h-8 rounded-lg bg-white/5 border border-white/10 text-white/70"
                >
                  Xoá vùng
                </button>
                <button
                  onClick={() =>
                    setSelection((s) =>
                      s ? { ...s, inverted: !s.inverted } : s,
                    )
                  }
                  className="px-2.5 h-8 rounded-lg bg-white/5 border border-white/10 text-white/70"
                >
                  {selection.inverted ? "Bỏ đảo vùng" : "Đảo vùng"}
                </button>
                <button
                  onClick={() => setSelection(null)}
                  className="px-2.5 h-8 rounded-lg bg-white/5 border border-white/10 text-white/70"
                >
                  Huỷ chọn
                </button>
              </>
            )}
            <span className="text-white/35">
              Kéo trong vùng đã chọn để dời vùng đó.
            </span>
          </div>
        )}

        <div className={`relative rounded-xl overflow-hidden ${bgClass}`}>
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="block w-full touch-none cursor-crosshair"
            onPointerDown={startAction}
            onPointerMove={moveAction}
            onPointerUp={endAction}
            onPointerLeave={(e) => {
              // Rời khỏi tranh giữa nét tự do thì chốt nét như cũ;
              // xem trước kéo thì chỉ huỷ xem trước.
              if (dragRef.current?.kind === "free") endAction(e);
              else cancelAction();
            }}
          />
          <canvas
            ref={overlayRef}
            width={canvasWidth}
            height={canvasHeight}
            className="pointer-events-none absolute inset-0 block w-full"
          />
          {textDraft && (
            <div
              className="absolute z-10 flex flex-col gap-1"
              style={{
                left: `${textDraft.x * 100}%`,
                top: `${textDraft.y * 100}%`,
                width: "45%",
              }}
            >
              <textarea
                autoFocus
                value={textValue}
                onChange={(e) => setTextValue(e.currentTarget.value)}
                rows={3}
                placeholder="Nhập chữ rồi bấm Chèn chữ"
                className="w-full rounded-lg border border-pink-300/50 bg-[#141216]/95 p-2 text-[13px] text-white outline-none"
              />
              <span className="flex gap-1.5">
                <button
                  onClick={commitText}
                  className="px-3 h-8 rounded-lg bg-pink-500/80 text-white text-[12px] font-medium"
                >
                  Chèn chữ
                </button>
                <button
                  onClick={() => {
                    setTextDraft(null);
                    setTextValue("");
                  }}
                  className="px-3 h-8 rounded-lg bg-white/10 border border-white/10 text-white/70 text-[12px]"
                >
                  Huỷ
                </button>
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-white/45">Xem trên nền:</span>
          {(
            [
              ["checker", "Trong suốt"],
              ["white", "Trắng"],
              ["dark", "Tối"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setBgPreview(v)}
              className={`px-2.5 h-7 rounded-lg border ${bgPreview === v ? "bg-white/15 border-white/30 text-white" : "bg-white/5 border-white/10 text-white/55"}`}
            >
              {label}
            </button>
          ))}
          <span className="text-white/35 ml-1">
            Hình lưu dạng nền trong suốt để xếp lớp trong cảnh.
          </span>
          <span className="ml-auto flex gap-2">
            <button
              onClick={onClose}
              className="px-3.5 h-9 rounded-lg bg-white/5 border border-white/10 text-white/70"
            >
              Huỷ
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 h-9 rounded-lg bg-pink-500/80 hover:bg-pink-500 text-white font-medium"
            >
              <Save className="w-4 h-4" /> Lưu hình
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
