"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AI_TOOLS,
  COMP_SUGGESTIONS,
  LAYOUTS,
  PAGE_COMPLETIONS,
  createUserLayer,
  createDefaultPanelStack,
  type DrawTool,
  type GuideId,
  type LayoutDef,
  type LayerItem,
  type PageCompletion,
  type PanelLayerStack,
  type PanelStacks,
  type PoseCategory,
  type SceneType,
} from "../data";
import { useAuth } from "@/app/auth/AuthProvider";
import {
  createCanvasSnapshot,
  requestAiDrawingReview,
  requestAiGhostStrokes,
  type AiDrawingReviewResponse,
  type AiStrokePath,
  type AiDrawingToolHint,
} from "@/lib/ai-drawing-api";
import { getPageStacksFromDB, savePageDrawingToDB } from "../lib/mangaStorage";
import { FLOOD_TOLERANCE, floodFillPixels, maskFromAlpha } from "../lib/floodFill";
import { curveControlPoints } from "../lib/curve";
import {
  blurRadiusForSize,
  boxBlurRGBA,
  sharpenAmountForStrength,
  sharpenRGBA,
} from "../lib/effects";
import { buildGradient } from "../lib/gradient";
import {
  buildShapePath,
  constrainSquare,
  kindLetsFill,
  snapToAngle,
  type ShapeKind,
} from "../lib/shape";
import {
  drawWithSymmetry,
  symmetryGuides,
  symmetryTransforms,
  transformSymmetryPoint,
} from "../lib/symmetry";
import {
  airbrushDabRadius,
  airbrushDabsPerTick,
  dabAlpha,
  hardnessBlurRadius,
  smoothPoint,
  sprayDabs,
} from "../lib/stroke";
import {
  buildCompositePlan,
  blendToComposite,
  compositeTo,
  effectiveStrokeAlpha,
  getPanelBackingSize,
  layerAlpha,
} from "../lib/layerEngine";
import {
  canRemoveLayerInList,
  duplicateLayerInList,
  isLayerLimitReached,
  MAX_LAYERS_PER_PANEL,
  mergeDownInList,
  moveLayerInList,
  moveLayerToIndex,
} from "../lib/layerOps";
import {
  appendLassoPoint,
  composeTransform,
  IDENTITY_TRANSFORM,
  invertSelection as toggleSelectionInvert,
  isSelectionUsable,
  pointInSelection,
  ROTATE_STEP,
  rectSelection,
  selectionCenter,
  transformSelection,
  translateSelection,
  type Selection,
  type SelectionTransform,
  type SelectMode,
} from "../lib/selection";
import { blitSelectionMask } from "../lib/selectionBlit";
import {
  adjustSize,
  clampSize,
  defaultSettingsFor,
  DEFAULT_SETTINGS,
  type ToolSettings,
} from "../lib/toolSettings";
import {
  clampPan,
  clampScale,
  fitView,
  MAX_ZOOM,
  MIN_ZOOM,
  screenToArtwork,
  zoomAt,
  type ViewportView,
} from "../lib/viewport";

// ─── Derived constants (stable — defined outside hook) ────────────────────────

/** Debounce ghi IndexedDB sau mỗi thao tác — gộp các lần ghi liên tiếp (AC-L4.4). */
const SAVE_DEBOUNCE_MS = 800;

/** Lệch mỗi lần dán vùng chọn, px artwork — để thấy ngay là đã dán (AC-T3.3). */
const PASTE_OFFSET = 24;

export const TOOL_NAMES: Record<DrawTool, string> = {
  pen: "Bút vẽ",
  brush: "Cọ",
  airbrush: "Cọ phun (airbrush)",
  eraser: "Tẩy",
  fill: "Đổ màu",
  gradient: "Chuyển sắc",
  eyedropper: "Bút lấy màu",
  shape: "Hình",
  line: "Đường / Mũi tên",
  curve: "Đường cong",
  select: "Chọn",
  effect: "Mờ / Sắc nét",
  symmetry: "Đối xứng",
  text: "Chữ",
  pan: "Di chuyển",
};

/**
 * Phím tắt của từng công cụ (AC-T1.1: mỗi công cụ có phím tắt riêng).
 * `1`–`9` theo đúng bảng công cụ của BRD (Phụ lục A); các công cụ thêm ở Phase 3
 * dùng chữ cái để không phải đánh số lại 9 công cụ cũ.
 */
export const TOOL_SHORTCUTS: Record<DrawTool, string> = {
  pen: "1",
  brush: "2",
  eraser: "3",
  fill: "4",
  select: "5",
  shape: "6",
  text: "7",
  pan: "8",
  eyedropper: "9",
  line: "L",
  gradient: "G",
  airbrush: "A",
  symmetry: "Y",
  curve: "C",
  effect: "U",
};

/** Tra ngược phím tắt → công cụ (đã hạ chữ thường). */
const SHORTCUT_TO_TOOL: Record<string, DrawTool> = Object.fromEntries(
  (Object.entries(TOOL_SHORTCUTS) as [DrawTool, string][]).map(([tool, key]) => [
    key.toLowerCase(),
    tool,
  ]),
);

/** Công cụ nào thuộc nhóm vẽ nét tự do (tích vào bộ đệm rồi hợp nhất một lần). */
const FREEHAND_TOOLS: readonly DrawTool[] = ["pen", "brush", "eraser", "airbrush", "symmetry"];

/** Công cụ nào vẽ bằng cú kéo có xem trước (hình / đường / cong / chuyển sắc). */
const DRAG_PREVIEW_TOOLS: readonly DrawTool[] = ["shape", "line", "curve", "gradient"];

export const GUIDE_CONFIG = [
  { id: "thirds" as GuideId, label: "Quy tắc 1/3", color: "text-amber-400" },
  {
    id: "horizon" as GuideId,
    label: "Đường chân trời",
    color: "text-blue-400",
  },
  {
    id: "proportions" as GuideId,
    label: "Tỷ lệ nhân vật",
    color: "text-pink-400",
  },
  { id: "vanishing" as GuideId, label: "Điểm tụ", color: "text-green-400" },
] as const;

export const GUIDE_DOT: Record<GuideId, string> = {
  thirds: "bg-amber-400",
  horizon: "bg-blue-400",
  proportions: "bg-pink-400",
  vanishing: "bg-green-400",
};

/** Map toolId → task AI tương ứng cho ghost stroke */
const TOOL_TASK_MAP: Record<string, "stroke_guidance" | "composition_overlay" | "pose_guidance"> = {
  "clean-lines": "stroke_guidance",
  "screentone": "stroke_guidance",
  "speech-bubble": "stroke_guidance",
  "speed-lines": "stroke_guidance",
  "fix-comp": "composition_overlay",
  "composition-overlay": "composition_overlay",
  "pose-guidance": "pose_guidance",
};

/** Map toolId → AiDrawingToolHint để server biết context */
const TOOL_HINT_MAP: Record<string, AiDrawingToolHint> = {
  "clean-lines": "clean-lines",
  "screentone": "screentone",
  "speech-bubble": "speech-bubble",
  "speed-lines": "speed-lines",
  "composition-overlay": "composition-overlay",
  "fix-comp": "composition-overlay",
  "pose-guidance": "pose-guidance",
};

/** Chuyển đổi mã màu hex (#111111 hoặc #fff) sang mảng RGBA [r, g, b, a] */
function hexToRgba(hex: string): [number, number, number, number] {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const num = parseInt(c, 16);
  if (Number.isNaN(num)) return [0, 0, 0, 255];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
}

/**
 * Đường bao vùng chọn thành `Path2D`. Vùng đã đảo → thêm cả khung vào cùng path;
 * chỗ gọi phải tô/stroke bằng luật `evenodd` để ra phần **ngoài** đa giác.
 */
function buildSelectionPath(sel: Selection, w: number, h: number): Path2D {
  const path = new Path2D();
  const pts = sel.points;
  if (pts.length === 0) return path;
  path.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) path.lineTo(pts[i].x, pts[i].y);
  path.closePath();
  if (sel.inverted) path.rect(0, 0, w, h);
  return path;
}

/** Luật tô/stroke tương ứng với một vùng chọn. */
function selectionFillRule(sel: Selection): CanvasFillRule {
  return sel.inverted ? "evenodd" : "nonzero";
}

// ─── Hook return type ──────────────────────────────────────────────────────────

export interface UseDrawStudioOptions {
  projectId?: string;
  initialPage?: number;
  activeProjectPages?: number[];
  currentLayoutId?: string;
  onSavePageData?: (
    pageNumber: number,
    layoutId: string,
    panels: Record<string, string>,
    stacks: PanelStacks,
  ) => void;
  onAddPageToProject?: () => void;
}

export type DrawStudioState = ReturnType<typeof useDrawStudio>;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDrawStudio(options: UseDrawStudioOptions = {}) {
  const {
    projectId,
    initialPage = 1,
    activeProjectPages,
    currentLayoutId,
    onSavePageData,
    onAddPageToProject,
  } = options;

  // Canvas refs
  /** Canvas hiển thị (chỉ đọc — RC-2): luôn giữ bản composite của các layer */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Canvas input mờ phủ trên cùng: nhận toàn bộ pointer event (RC-2) */
  const inputRef = useRef<HTMLCanvasElement>(null);
  /** Bitmap offscreen của từng layer, key = `${panelId}::${layerId}` */
  const layerCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  /**
   * Lịch sử undo theo **từng layer** (BR-T08): mỗi entry ghi lại bitmap của
   * đúng layer sắp bị thay đổi, nên undo không kéo theo layer khác.
   */
  const historyRef = useRef<{ layerId: string; data: ImageData }[]>([]);
  const futureRef = useRef<{ layerId: string; data: ImageData }[]>([]);
  const isDrawing = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const previewSnapshotRef = useRef<ImageData | null>(null);
  /**
   * Bộ đệm của nét **đang vẽ** (AC-T2.6): cả nét tích vào đây ở alpha đầy, rồi
   * hợp nhất vào layer **một lần** với `opacity` nét → chỗ nét đè nhau không bị
   * đậm thêm (đậm dần khi chồng là việc của `flow`).
   */
  const strokeBufferRef = useRef<HTMLCanvasElement | null>(null);
  /** Bitmap layer ngay trước khi bắt đầu nét — để mỗi lần di chuột vẽ lại sạch. */
  const strokeBaseImageRef = useRef<ImageData | null>(null);
  /** Điểm cuối đã làm mượt của nét đang vẽ (BR-T03). */
  const strokeLastPointRef = useRef<{ x: number; y: number } | null>(null);
  /** Nhịp phun của airbrush khi giữ chuột (BRD T-1 #12) — phun cả khi đứng yên. */
  const sprayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Điểm đang phun (cập nhật mỗi lần di chuột, nhịp phun đọc lại). */
  const sprayPointRef = useRef<{ x: number; y: number } | null>(null);
  /** Canvas tạm cho công cụ Mờ/Sắc nét: xử lý pixel rồi gộp theo mặt nạ tròn. */
  const effectTmpRef = useRef<HTMLCanvasElement | null>(null);
  /** Trục đối xứng đang bật (cho lớp phủ vẽ đường trục mà không phải tạo lại callback). */
  const symmetryRef = useRef<ToolSettings["symmetry"]>("off");

  // ── Vùng chọn (3C) ──────────────────────────────────────────────────────────
  /** Canvas lớp phủ vẽ "marching ants" — tách khỏi canvas hiển thị để kiến không
   *  lọt vào ảnh xuất/AI snapshot và không phải composite lại mỗi khung hình. */
  const selectionOverlayRef = useRef<HTMLCanvasElement>(null);
  /** Bản sao vùng chọn cho handler con trỏ (state chỉ để render UI). */
  const selectionRef = useRef<Selection | null>(null);
  /** Vùng chọn đang kéo (chỉ để vẽ kiến, chưa phải vùng chọn thật). */
  const selectionDraftRef = useRef<Selection | null>(null);
  /** Điểm bắt đầu khoanh vùng chọn mới. */
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  /** Đang kéo để **dời** vùng chọn / vật đang bay (AC-T3.1). */
  const floatStartRef = useRef<{ x: number; y: number } | null>(null);
  /**
   * Vật đang bay là gì: `cut` = vùng chọn vừa bị khoét khỏi layer (một cử chỉ),
   * `paste` = bản dán **chưa chốt** (kéo tiếp được, nội dung gốc không bị đụng),
   * `null` = không có gì đang bay.
   */
  const floatKindRef = useRef<"cut" | "paste" | null>(null);
  /** Vật đang bay thuộc layer nào (đổi layer thì chốt, tránh ghi đè layer khác). */
  const floatLayerRef = useRef<string | null>(null);
  /** Pixel "đang bay" của vùng chọn khi dời/biến đổi. */
  const floatCanvasRef = useRef<HTMLCanvasElement | null>(null);
  /** Layer sau khi khoét vùng chọn — mỗi lần di chuột vẽ lại từ nền này. */
  const floatBaseRef = useRef<ImageData | null>(null);
  /** Vùng chọn gốc của lần biến đổi → điểm neo không trôi khi xoay nhiều lần. */
  const floatBaseSelectionRef = useRef<Selection | null>(null);
  /** Phép biến đổi đang áp cho vùng chọn đang bay (cộng dồn qua nhiều cử chỉ). */
  const transformRef = useRef<SelectionTransform>(IDENTITY_TRANSFORM);
  /**
   * Phép biến đổi lúc **bắt đầu** cử chỉ kéo đang diễn ra; mỗi lần di chuột lấy
   * nó cộng với độ dời từ điểm bấm, nên kéo nhiều lần không trôi vị trí.
   */
  const floatBaseTransformRef = useRef<SelectionTransform>(IDENTITY_TRANSFORM);
  /**
   * Chốt vật đang bay: pixel đã nằm trong layer (mỗi lần vẽ lại đều ghi vào
   * layer), nên "chốt" chỉ là quên các tham chiếu đi. Gọi trước **mọi** thao tác
   * khác sửa layer, nếu không lần vẽ lại sau sẽ ghi đè nền cũ lên thay đổi mới.
   *
   * Khai báo sớm (chỉ đụng tới ref) vì `snapshot` bên dưới đã cần tới nó.
   */
  const endFloat = useCallback(() => {
    floatCanvasRef.current = null;
    floatBaseRef.current = null;
    floatBaseSelectionRef.current = null;
    floatStartRef.current = null;
    floatBaseTransformRef.current = IDENTITY_TRANSFORM;
    floatLayerRef.current = null;
    floatKindRef.current = null;
    transformRef.current = IDENTITY_TRANSFORM;
  }, []);
  /** Clipboard nội bộ cho Ctrl+C / Ctrl+V trong cùng khung (AC-T3.3). */
  const clipboardRef = useRef<{
    canvas: HTMLCanvasElement;
    selection: Selection;
  } | null>(null);
  /** Pha lệch của đường kiến (chạy để thấy nó "bò"). */
  const antsOffsetRef = useRef(0);
  /** DPR đang dùng cho lớp phủ (đổi khi cửa sổ đổi màn hình). */
  const overlayDprRef = useRef(1);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Khung nhìn pan/zoom (3A, BR-T06). `viewZoom` là hệ số **tương đối** so với
   * khung vừa khít (1 = 100%), `viewPan` là độ lệch tâm theo screen px.
   * `viewportRef` giữ ma trận hiện tại cho handler con trỏ, `fitRef` giữ khung
   * vừa khít để quy đổi zoom tương đối.
   */
  const [viewZoom, setViewZoom] = useState(1);
  const [viewPan, setViewPan] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<ViewportView>({ scale: 1, tx: 0, ty: 0 });
  const fitRef = useRef<ViewportView>({ scale: 1, tx: 0, ty: 0 });
  /** Hình học khung/ảnh hiện tại — để kẹp pan mà không phải đọc lại DOM. */
  const frameRef = useRef({ frameW: 0, frameH: 0, artW: 0, artH: 0 });
  const viewZoomRef = useRef(1);
  const viewPanRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const spaceHeldRef = useRef(false);

  // Drawing state
  const [tool, setToolState] = useState<DrawTool>("pen");
  /**
   * Thuộc tính nét theo **từng công cụ** (BR-T01): đổi công cụ giữ nguyên màu,
   * nhưng nét trở về mặc định riêng của công cụ đó.
   */
  const [settingsByTool, setSettingsByTool] = useState<
    Record<DrawTool, ToolSettings>
  >(() => {
    const initial = {} as Record<DrawTool, ToolSettings>;
    (Object.keys(DEFAULT_SETTINGS) as DrawTool[]).forEach((t) => {
      initial[t] = defaultSettingsFor(t);
    });
    return initial;
  });
  const settings = settingsByTool[tool] ?? defaultSettingsFor(tool);
  const size = settings.size;
  const [color, setColor] = useState("#111111");

  /** Cập nhật một phần thuộc tính nét của công cụ đang chọn (đã kẹp biên). */
  const updateSettings = useCallback(
    (patch: Partial<ToolSettings>) => {
      setSettingsByTool((prev) => {
        const current = prev[tool] ?? defaultSettingsFor(tool);
        const merged: ToolSettings = { ...current, ...patch };
        if (patch.size !== undefined) merged.size = clampSize(merged.size);
        return { ...prev, [tool]: merged };
      });
      // Thuộc tính nét là trạng thái phiên, không phải pixel → không vào undo.
    },
    [tool],
  );

  /** Đổi công cụ (BR-T01). */
  const setTool = useCallback((next: DrawTool) => {
    setToolState(next);
    setSettingsByTool((prev) => ({ ...prev, [next]: defaultSettingsFor(next) }));
  }, []);

  const setSize = useCallback(
    (value: number) => updateSettings({ size: clampSize(value) }),
    [updateSettings],
  );

  /** `[` / `]` đổi size ±2, `Shift` ±10 (AC-T2.4) — tính từ size hiện tại. */
  const nudgeSize = useCallback(
    (delta: number) => {
      setSettingsByTool((prev) => {
        const current = prev[tool] ?? defaultSettingsFor(tool);
        return {
          ...prev,
          [tool]: { ...current, size: adjustSize(current.size, delta) },
        };
      });
    },
    [tool],
  );

  // Shape tool config
  const [shapeType, setShapeType] = useState<ShapeKind>("rect");
  const [shapeFill, setShapeFill] = useState(false);
  /** Số cạnh đa giác / số cánh sao của công cụ Hình (BRD T-1 #6). */
  const [shapeSides, setShapeSides] = useState(5);

  // Vùng chọn (3C — BR-T05)
  /** Kiểu khoanh vùng của công cụ `select`: chữ nhật hay tự do (lasso). */
  const [selectMode, setSelectMode] = useState<SelectMode>("rect");
  /** Vùng chọn đang có; `null` = không chọn gì. Đổi state để UI biết mà bật nút. */
  const [selection, setSelection] = useState<Selection | null>(null);

  // Text tool inline placement
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number } | null>(null);

  // Undo / Redo tracking
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Auto-save & Local persistence state
  const [isSaved, setIsSaved] = useState(true);

  // Pages / panels
  const [page, setPage] = useState(initialPage);
  const [pages, setPages] = useState<number[]>(() => {
    return activeProjectPages && activeProjectPages.length > 0
      ? activeProjectPages
      : [1];
  });
  const [layout, setLayout] = useState<LayoutDef>(() => {
    if (currentLayoutId) {
      return LAYOUTS.find((l) => l.id === currentLayoutId) || LAYOUTS[0];
    }
    return LAYOUTS[0];
  });
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [panelData, setPanelData] = useState<Record<string, string>>({});

  // Right panel
  const [rightTab, setRightTab] = useState<"ai" | "layout" | "layers">("ai");
  /**
   * Ngăn xếp layer theo **khung** — spec 02 §2.2: mỗi panel có bộ layer riêng.
   * `layers` / `activeLayerId` bên dưới là dẫn xuất của khung đang mở,
   * mọi thao tác layer đi qua `updateActiveLayers` / `setActiveLayerId`.
   */
  const [stacks, setStacks] = useState<PanelStacks>({});
  /** Bộ layer mặc định hiển thị khi chưa mở khung nào */
  const defaultLayers = useMemo(
    () => [
      createUserLayer("Sketch (Phác thảo)", { id: "l1" }),
      createUserLayer("Ink (Đi nét)", { id: "l2" }),
      createUserLayer("Tone (Đổ bóng)", { id: "l3" }),
      createUserLayer("Text (Thoại)", { id: "l4" }),
    ],
    [],
  );
  const activeStack = activePanel ? stacks[activePanel] ?? null : null;
  const layers = activeStack?.layers ?? defaultLayers;
  const activeLayerId = activeStack?.activeLayerId ?? defaultLayers[0].id;
  /** Mirror `activePanel` để callback đọc giá trị hiện tại không cần đưa vào deps */
  const activePanelRef = useRef<string | null>(activePanel);
  useEffect(() => {
    activePanelRef.current = activePanel;
  }, [activePanel]);
  /** Chọn layer cho khung đang mở (spec 02 §7) */
  const setActiveLayerId = useCallback((id: string) => {
    setStacks((prev) => {
      const pid = activePanelRef.current;
      const stack = pid ? prev[pid] : undefined;
      if (!pid || !stack || stack.activeLayerId === id) return prev;
      return { ...prev, [pid]: { ...stack, activeLayerId: id } };
    });
  }, []);
  /** Sửa mảng layer của khung đang mở — mọi thao tác layer đi qua đây */
  const updateActiveLayers = useCallback(
    (updater: (prev: LayerItem[]) => LayerItem[]) => {
      setStacks((prev) => {
        const pid = activePanelRef.current;
        const stack = pid ? prev[pid] : undefined;
        if (!pid || !stack) return prev;
        const nextLayers = updater(stack.layers);
        if (nextLayers === stack.layers) return prev;
        return { ...prev, [pid]: { ...stack, layers: nextLayers } };
      });
    },
    [],
  );

  // AI / scene
  const [sceneType, setSceneType] = useState<SceneType>("auto");
  const [activeGuides, setActiveGuides] = useState<GuideId[]>([]);
  const [selectedComp, setSelectedComp] = useState<string | null>(null);
  const [poseCategory, setPoseCategory] = useState<PoseCategory>("stand");

  // Collapsibles
  const [showCompSection, setShowCompSection] = useState(true);
  const [showPoseSection, setShowPoseSection] = useState(false);
  const [showGuideSection, setShowGuideSection] = useState(false);

  // Ghost overlay — AI ghost strokes (thay thế static SVG placeholders)
  const [ghostType, setGhostType] = useState<"comp" | "pose" | null>(null);
  const [ghostId, setGhostId] = useState<string | null>(null);
  const [ghostOpacity, setGhostOpacity] = useState(28);
  /** Nét gợi ý mờ do AI sinh ra — thay thế drawingPlaceholder tĩnh */
  const [ghostStrokes, setGhostStrokes] = useState<AiStrokePath[] | null>(null);
  /** Tóm tắt từ AI về ghost strokes hiện tại */
  const [ghostStrokesSummary, setGhostStrokesSummary] = useState<string | null>(null);
  /**
   * Mô tả ý tưởng của người dùng (user prompt).
   * Khi hình vẽ chưa rõ ràng, người dùng nhập mô tả để AI
   * hiểu hướng và đưa ra gợi ý phù hợp hơn.
   */
  const [userDrawingPrompt, setUserDrawingPrompt] = useState<string>("");

  // Completion
  const [completionLoading, setCompletionLoading] = useState(false);
  const [completionReady, setCompletionReady] = useState(false);
  const [completions, setCompletions] = useState<PageCompletion[]>([]);
  const [appliedCompletion, setAppliedCompletion] = useState<string | null>(
    null,
  );
  const [panelHints, setPanelHints] = useState<Record<string, string>>({});
  const [panelAutoComp, setPanelAutoComp] = useState<
    Record<string, string | null>
  >({});

  // Stroke / analysis
  const { authenticatedFetch } = useAuth();
  const reviewAbortRef = useRef<AbortController | null>(null);
  /** AbortController riêng cho ghost stroke calls */
  const ghostAbortRef = useRef<AbortController | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [reviewResult, setReviewResult] =
    useState<AiDrawingReviewResponse | null>(null);
  const [selectedFindingIndex, setSelectedFindingIndex] = useState<
    number | null
  >(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  /** BR-A12: chỉ giữ nhận xét (finding), KHÔNG tính điểm số chủ quan */
  const analysisResult = reviewResult
    ? { items: reviewResult.findings.map((f) => f.issue) }
    : null;

  // Processing & toast
  const [processingTool, setProcessingTool] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // In-panel suggestion widget
  const [showPanelSuggestions, setShowPanelSuggestions] = useState(false);
  const [panelSuggestPulse, setPanelSuggestPulse] = useState(false);
  const [showSuggestBtn, setShowSuggestBtn] = useState(true);

  // Panel fullscreen
  const [panelFullscreen, setPanelFullscreen] = useState(false);

  // ── Side-effects ─────────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // ── Layer management ──────────────────────────────────────────────────────────

  const toggleLayerVisibility = useCallback(
    (id: string) => {
      updateActiveLayers((prev) =>
        prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
      );
    },
    [updateActiveLayers],
  );

  const toggleLayerLock = useCallback(
    (id: string) => {
      updateActiveLayers((prev) =>
        prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)),
      );
    },
    [updateActiveLayers],
  );

  const setLayerOpacity = useCallback(
    (id: string, opacity: number) => {
      updateActiveLayers((prev) =>
        prev.map((l) =>
          l.id === id
            ? { ...l, opacity: Math.max(0, Math.min(100, Math.round(opacity))) }
            : l,
        ),
      );
    },
    [updateActiveLayers],
  );

  /** Mirror `layers` để `addLayer` lấy được số lượng hiện tại mà không cần updater hàm */
  const layersRef = useRef<LayerItem[]>(layers);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);
  /** Mirror `stacks` cho đường lưu/nạp (callback đọc giá trị hiện tại) */
  const stacksRef = useRef<PanelStacks>(stacks);
  useEffect(() => {
    stacksRef.current = stacks;
  }, [stacks]);
  /** Mirror `panelData` cho effect resize/nạp ảnh (tránh dependency vòng) */
  const panelDataRef = useRef(panelData);
  useEffect(() => {
    panelDataRef.current = panelData;
  }, [panelData]);

  const addLayer = useCallback(
    (name?: string) => {
      if (!activePanelRef.current) {
        showToast("Hãy mở một khung trước để thêm layer cho khung đó!");
        return;
      }
      // BR-L13 / AC-L2.8: trần 12 layer mỗi khung (đếm cả layer AI).
      if (isLayerLimitReached(layersRef.current)) {
        showToast(
          `Khung này đã đủ ${MAX_LAYERS_PER_PANEL} layer — hãy xóa hoặc gộp bớt rồi thêm!`,
        );
        return;
      }
      const layer = createUserLayer(
        name?.trim() || `Layer ${layersRef.current.length + 1}`,
      );
      updateActiveLayers((prev) => [layer, ...prev]);
      setActiveLayerId(layer.id);
      showToast("Đã tạo layer mới!");
    },
    [showToast, updateActiveLayers, setActiveLayerId],
  );

  const removeLayer = useCallback(
    (id: string) => {
      if (!activePanelRef.current) {
        showToast("Hãy mở một khung trước để quản lý layer!");
        return;
      }
      const prev = layersRef.current;
      if (!canRemoveLayerInList(prev, id)) {
        showToast("Phải giữ lại ít nhất 1 layer để vẽ!");
        return;
      }
      const next = prev.filter((l) => l.id !== id);
      updateActiveLayers(() => next);
      if (activeLayerId === id && next[0]) {
        setActiveLayerId(next[0].id);
      }
      // Giải phóng bitmap của layer vừa xóa (mọi panel)
      for (const key of [...layerCanvasesRef.current.keys()]) {
        if (key.endsWith(`::${id}`)) layerCanvasesRef.current.delete(key);
      }
      showToast("Đã xóa layer!");
    },
    [activeLayerId, updateActiveLayers, setActiveLayerId, showToast],
  );

  const reorderLayer = useCallback(
    (id: string, direction: "up" | "down") => {
      updateActiveLayers((prev) => moveLayerInList(prev, id, direction));
    },
    [updateActiveLayers],
  );

  const renameLayer = useCallback(
    (id: string, newName: string) => {
      if (!newName.trim()) return;
      updateActiveLayers((prev) =>
        prev.map((l) => (l.id === id ? { ...l, name: newName.trim() } : l)),
      );
    },
    [updateActiveLayers],
  );

  /** Kéo-thả layer tới index đích (index 0 = trên cùng). */
  const moveLayerTo = useCallback(
    (id: string, toIndex: number) => {
      updateActiveLayers((prev) => moveLayerToIndex(prev, id, toIndex));
    },
    [updateActiveLayers],
  );

  /**
   * Nhân bản một layer người dùng: clone meta đứng ngay trên bản gốc +
   * copy bitmap. Render/lưu do RC-4 effect đảm nhiệm sau khi `layers` đổi.
   */
  const duplicateLayer = useCallback(
    (id: string) => {
      const pid = activePanelRef.current;
      if (!pid) {
        showToast("Hãy mở một khung trước để quản lý layer!");
        return;
      }
      const target = layersRef.current.find((l) => l.id === id);
      if (!target || target.kind === "ai") return;
      // BR-L13: nhân bản cũng là tạo layer mới nên phải tôn trọng trần 12.
      if (isLayerLimitReached(layersRef.current)) {
        showToast(
          `Khung này đã đủ ${MAX_LAYERS_PER_PANEL} layer — hãy xóa hoặc gộp bớt rồi nhân bản!`,
        );
        return;
      }
      const clone = createUserLayer(`${target.name} (bản sao)`, {
        visible: target.visible,
        locked: false,
        opacity: target.opacity,
        blend: target.blend,
      });
      // Copy bitmap (nếu layer gốc chưa có nét vẽ thì bỏ qua — bitmap tạo lười)
      const src = layerCanvasesRef.current.get(`${pid}::${id}`);
      if (src) {
        const dst = document.createElement("canvas");
        dst.width = src.width;
        dst.height = src.height;
        dst.getContext("2d")?.drawImage(src, 0, 0);
        layerCanvasesRef.current.set(`${pid}::${clone.id}`, dst);
      }
      updateActiveLayers((prev) => duplicateLayerInList(prev, id, clone));
      setActiveLayerId(clone.id);
      showToast("Đã nhân bản layer!");
    },
    [updateActiveLayers, setActiveLayerId, showToast],
  );

  /**
   * Gộp một layer vào layer ngay dưới nó: vẽ bitmap gốc lên bitmap đích
   * (tôn trọng opacity/blend lúc hiển thị) rồi loại gốc khỏi danh sách.
   */
  const mergeLayerDown = useCallback(
    (id: string) => {
      const pid = activePanelRef.current;
      if (!pid) {
        showToast("Hãy mở một khung trước để quản lý layer!");
        return;
      }
      const merged = mergeDownInList(layersRef.current, id);
      if (!merged) {
        showToast("Không gộp được: cần một layer thường nằm bên dưới!");
        return;
      }
      // Gộp là thao tác ghi pixel → chốt bản dán đang bay trước, nếu không lần
      // vẽ lại sau sẽ ghi đè nền cũ lên phần vừa gộp.
      endFloat();
      const source = layersRef.current.find((l) => l.id === id);
      const srcCanvas = layerCanvasesRef.current.get(`${pid}::${id}`);
      const dstCanvas = layerCanvasesRef.current.get(
        `${pid}::${merged.targetId}`,
      );
      if (source && srcCanvas && dstCanvas) {
        const dstCtx = dstCanvas.getContext("2d");
        if (dstCtx) {
          dstCtx.save();
          dstCtx.globalAlpha = layerAlpha(source.opacity);
          dstCtx.globalCompositeOperation = blendToComposite(source.blend);
          dstCtx.drawImage(srcCanvas, 0, 0);
          dstCtx.restore();
        }
      }
      layerCanvasesRef.current.delete(`${pid}::${id}`);
      updateActiveLayers(() => merged.layers);
      if (activeLayerId === id) {
        setActiveLayerId(merged.targetId);
      }
      showToast("Đã gộp layer xuống dưới!");
    },
    [activeLayerId, endFloat, updateActiveLayers, setActiveLayerId, showToast],
  );

  /** DataURL bitmap của một layer (thumbnail tab Layers) — null nếu chưa vẽ. */
  const getLayerThumbnail = useCallback(
    (layerId: string): string | null => {
      const pid = activePanelRef.current;
      if (!pid) return null;
      const canvas = layerCanvasesRef.current.get(`${pid}::${layerId}`);
      if (!canvas) return null;
      try {
        return canvas.toDataURL("image/png");
      } catch {
        return null;
      }
    },
    [],
  );


  // ESC exits fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Canvas helpers ────────────────────────────────────────────────────────────

  // ── Đồng bộ trang & bố cục khi thuộc tính project thay đổi ──────────────────

  useEffect(() => {
    if (initialPage) {
      setPage((prev) => (prev !== initialPage ? initialPage : prev));
    }
  }, [initialPage]);

  useEffect(() => {
    if (activeProjectPages && activeProjectPages.length > 0) {
      setPages((prev) => {
        if (
          prev.length === activeProjectPages.length &&
          prev.every((p, i) => p === activeProjectPages[i])
        ) {
          return prev;
        }
        return activeProjectPages;
      });
    }
  }, [activeProjectPages]);

  useEffect(() => {
    if (currentLayoutId) {
      setLayout((prev) => {
        if (prev.id === currentLayoutId) return prev;
        const match = LAYOUTS.find((l) => l.id === currentLayoutId);
        return match || prev;
      });
    }
  }, [currentLayoutId]);

  // ── Auto-save & Local persistence (IndexedDB tách biệt theo projectId & page) ──
  // (Effect nạp dữ liệu trang nằm sau phần canvas helpers — nó gọi
  //  `resyncLayersWithData`, nên phải được khai báo trước.)

  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<{
    data: Record<string, string>;
    targetPage: number;
  } | null>(null);

  /**
   * Gộp pixel để lưu (spec 02 §3.2): bitmap layer trong phiên (nếu có) ghi đè
   * dataURL đã lưu; pixel của layer đã xóa bị loại bỏ; layer AI không có pixel.
   */
  const encodeStacksPixels = useCallback((source: PanelStacks): PanelStacks => {
    const out: PanelStacks = {};
    for (const [pid, stack] of Object.entries(source)) {
      const pixels: Record<string, string> = {};
      for (const [lid, url] of Object.entries(stack.pixels)) {
        if (stack.layers.some((l) => l.id === lid)) pixels[lid] = url;
      }
      for (const layer of stack.layers) {
        if (layer.kind === "ai") continue;
        const canvas = layerCanvasesRef.current.get(`${pid}::${layer.id}`);
        if (canvas) pixels[layer.id] = canvas.toDataURL("image/png");
      }
      out[pid] = { ...stack, pixels };
    }
    return out;
  }, []);

  /** Ghi ngay: `stacks` đã mã hoá pixel + composite `panels` (đọc ngược v1). */
  const commitSave = useCallback(
    (data: Record<string, string>, targetPage: number) => {
      if (!projectId) return;
      const stacksToSave = encodeStacksPixels(stacksRef.current);
      savePageDrawingToDB(projectId, targetPage, stacksToSave, layout.id, data);
      setIsSaved(true);
      if (onSavePageData) {
        onSavePageData(targetPage, layout.id, data, stacksToSave);
      }
    },
    [projectId, layout.id, onSavePageData, encodeStacksPixels],
  );

  /** Debounce 800ms: lên lịch ghi và đánh dấu "Chưa lưu" (AC-L4.4). */
  const scheduleSave = useCallback(
    (data: Record<string, string>, targetPage: number) => {
      if (!projectId) return;
      pendingSaveRef.current = { data, targetPage };
      setIsSaved(false);
      if (saveTimerRef.current !== null)
        window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        const pending = pendingSaveRef.current;
        pendingSaveRef.current = null;
        if (pending) commitSave(pending.data, pending.targetPage);
      }, SAVE_DEBOUNCE_MS);
    },
    [projectId, commitSave],
  );

  /** Ghi ngay mọi lần lưu đang hoãn (Ctrl+S, đổi trang, unmount). */
  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (pending) commitSave(pending.data, pending.targetPage);
  }, [commitSave]);

  const saveDraft = useCallback(() => {
    if (!projectId) return;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    pendingSaveRef.current = null;
    commitSave(panelDataRef.current, page);
    showToast("Đã lưu tiến độ tranh vào IndexedDB!");
  }, [projectId, page, commitSave, showToast]);

  /** Flush khi unmount — đọc qua ref để không phụ thuộc identity callback */
  const flushRef = useRef(flushPendingSave);
  useEffect(() => {
    flushRef.current = flushPendingSave;
  }, [flushPendingSave]);
  useEffect(() => () => flushRef.current(), []);

  const addPage = useCallback(() => {
    if (onAddPageToProject) {
      onAddPageToProject();
    } else {
      setPages((prev) => {
        const next = prev.length > 0 ? Math.max(...prev) + 1 : 1;
        setPage(next);
        showToast(`Đã thêm Trang ${next}`);
        return [...prev, next];
      });
    }
  }, [onAddPageToProject, showToast]);

  // ── Canvas helpers ────────────────────────────────────────────────────────────

  /** Lấy (tự tạo nếu chưa có) bitmap offscreen của một layer — RC-1.
   * Backing bám theo canvas hiển thị (đã cố định theo khung); chỉ đổi kích
   * thước khi đổi bố cục và **giữ lại nội dung** cũ (co giãn 1 lần, mượt cao).
   */
  const getLayerCanvas = useCallback(
    (layerId: string): HTMLCanvasElement | null => {
      const display = canvasRef.current;
      if (!display || !layerId) return null;
      const key = `${activePanel ?? "_"}::${layerId}`;
      let layerCanvas = layerCanvasesRef.current.get(key);
      if (
        !layerCanvas ||
        layerCanvas.width !== display.width ||
        layerCanvas.height !== display.height
      ) {
        const next = document.createElement("canvas");
        next.width = display.width;
        next.height = display.height;
        // `willReadFrequently`: ta hay đọc lại pixel (undo/preview shape),
        // đặt ngay lúc tạo vì option chỉ có hiệu lực ở lần getContext đầu tiên.
        const nextCtx = next.getContext("2d", { willReadFrequently: true });
        if (layerCanvas && nextCtx) {
          nextCtx.imageSmoothingEnabled = true;
          nextCtx.imageSmoothingQuality = "high";
          nextCtx.drawImage(layerCanvas, 0, 0, next.width, next.height);
        }
        layerCanvas = next;
        layerCanvasesRef.current.set(key, layerCanvas);
      }
      return layerCanvas;
    },
    [activePanel],
  );

  /**
   * Chỉ render các layer lên canvas hiển thị — dùng khi **đang vẽ** (mỗi lần
   * di chuột), không encode PNG, không ghi IndexedDB.
   */
  const renderComposite = useCallback(() => {
    const display = canvasRef.current;
    if (!display || !activePanel) return;
    // Bitmap được lưu theo key `panelId::layerId` → truyền hàm tra theo panel
    compositeTo(
      display,
      buildCompositePlan(
        layers,
        (layerId) => layerCanvasesRef.current.get(`${activePanel}::${layerId}`),
      ),
      {
        background: "#ffffff",
        width: display.width,
        height: display.height,
      },
    );
  }, [layers, activePanel]);

  /**
   * Render + lưu bitmap phẳng của panel (`panelData[panelId]`) — trang xem trước
   * và xuất file dùng bản này. Nét AI không nằm trong đây (C2: xuất không kèm
   * nét AI). Gọi khi **kết thúc** một thao tác, không gọi khi đang kéo chuột
   * (mỗi lần gọi là một lần encode PNG + ghi IndexedDB).
   */
  const compositeNow = useCallback(() => {
    renderComposite();
    const display = canvasRef.current;
    if (!display || !activePanel) return;
    const dataUrl = display.toDataURL();
    setPanelData((prev) => {
      const next = { ...prev, [activePanel]: dataUrl };
      scheduleSave(next, page);
      return next;
    });
  }, [renderComposite, activePanel, page, scheduleSave]);

  /**
   * Nạp `pixels` (dataURL từng layer) của một stack vào bitmap layer — chỉ gọi
   * khi `stack.panelId` chính là khung đang mở. Layer đã có bitmap trong phiên
   * thì bỏ qua (không ghi đè nét mới vẽ).
   * @returns true nếu có ít nhất 1 layer đang được nạp (async).
   */
  const seedStackPixels = useCallback(
    (stack: PanelLayerStack): boolean => {
      if (!activePanelRef.current || stack.panelId !== activePanelRef.current)
        return false;
      let seeded = false;
      for (const [layerId, dataUrl] of Object.entries(stack.pixels)) {
        if (!dataUrl) continue;
        if (layerCanvasesRef.current.has(`${stack.panelId}::${layerId}`))
          continue;
        if (!getLayerCanvas(layerId)) continue;
        seeded = true;
        const key = `${stack.panelId}::${layerId}`;
        const img = new Image();
        img.onload = () => {
          // Lấy lại canvas hiện tại theo key — canvas có thể đã được tạo lại do resize
          const current = layerCanvasesRef.current.get(key);
          if (!current) return;
          const c2d = current.getContext("2d");
          if (!c2d) return;
          // Ảnh cũ khác cỡ → co giãn MỘT LẦN về backing cố định (RC-1) với
          // làm mượt chất lượng cao; các lần mở sau vẽ 1:1, không mờ thêm.
          c2d.imageSmoothingEnabled = true;
          c2d.imageSmoothingQuality = "high";
          c2d.drawImage(img, 0, 0, current.width, current.height);
          compositeNow();
        };
        img.src = dataUrl;
      }
      return seeded;
    },
    [getLayerCanvas, compositeNow],
  );

  /**
   * Nạp dữ liệu trang mới xong → dọn bitmap layer của trang cũ, đồng bộ ngăn
   * xếp theo khung từ DB và (nếu khung đang mở) nạp pixel từng layer rồi
   * render lại. Gọi từ callback async của effect nạp dữ liệu.
   */
  const resyncLayersWithData = useCallback(
    (loadedStacks: PanelStacks) => {
      layerCanvasesRef.current.clear();
      historyRef.current = [];
      futureRef.current = [];
      const pid = activePanelRef.current;
      setStacks((prev) => {
        // DB không có stack cho khung đang mở (vừa tạo trong phiên) → giữ meta
        // của nó, bỏ pixel cũ để không trộn dữ liệu trang khác.
        if (!pid || !prev[pid] || loadedStacks[pid]) return loadedStacks;
        return { ...loadedStacks, [pid]: { ...prev[pid], pixels: {} } };
      });
      const stack = pid ? loadedStacks[pid] : undefined;
      if (stack && seedStackPixels(stack)) return;
      // Khung này chưa có pixel nào đã lưu → xóa trắng canvas hiển thị
      const display = canvasRef.current;
      const ctx = display?.getContext("2d");
      if (display && ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, display.width, display.height);
      }
    },
    [seedStackPixels],
  );

  // RC-4: đổi bất kỳ thuộc tính nào của layer (ẩn/độ mờ/blend/thứ tự/xóa)
  // → render lại composite ngay lập tức.
  // Bỏ qua khi panel chưa từng có bitmap nào (tránh ghi đè dữ liệu chưa nạp).
  useEffect(() => {
    if (!activePanel) return;
    const hasBitmap = layers.some((l) =>
      layerCanvasesRef.current.has(`${activePanel}::${l.id}`),
    );
    if (!hasBitmap) return;
    compositeNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, activePanel]);

  /** Context của **layer đang chọn** — mọi nét vẽ ghi vào đây, không ghi vào display */
  const getCtx = useCallback(() => {
    if (!activePanel || !activeLayerId) return null;
    return getLayerCanvas(activeLayerId)?.getContext("2d") ?? null;
  }, [activePanel, activeLayerId, getLayerCanvas]);

  // ── Nét vẽ: bộ đệm + hợp nhất một lần (AC-T2.6) ───────────────────────────────

  /** Bộ đệm nét, luôn cùng cỡ backing với layer (tạo mới khi đổi cỡ khung). */
  const getStrokeBuffer = useCallback((): HTMLCanvasElement | null => {
    const display = canvasRef.current;
    if (!display) return null;
    let buffer = strokeBufferRef.current;
    if (
      !buffer ||
      buffer.width !== display.width ||
      buffer.height !== display.height
    ) {
      buffer = document.createElement("canvas");
      buffer.width = display.width;
      buffer.height = display.height;
      strokeBufferRef.current = buffer;
    }
    return buffer;
  }, []);

  /** Opacity (0–100) của layer đang chọn — vế thứ hai của AC-T2.6. */
  const activeLayerOpacity = useCallback(
    () => layers.find((l) => l.id === activeLayerId)?.opacity ?? 100,
    [layers, activeLayerId],
  );

  /** Alpha hợp nhất nét xuống layer = opacity nét × opacity layer (AC-T2.6). */
  const strokeCompositeAlpha = useCallback(
    () => effectiveStrokeAlpha(settings.opacity, activeLayerOpacity()),
    [settings.opacity, activeLayerOpacity],
  );

  /**
   * Vẽ lại layer đang chọn = bitmap gốc (chụp lúc bắt đầu nét) + bộ đệm nét ở
   * `opacity` nét, rồi composite lên canvas hiển thị. Chạy mỗi lần di chuột nên
   * kết quả không phụ thuộc số lần vẽ lại (không cộng dồn độ mờ).
   */
  const paintStrokeBuffer = useCallback(() => {
    const ctx = getCtx();
    const buffer = strokeBufferRef.current;
    const base = strokeBaseImageRef.current;
    if (!ctx || !buffer || !base) return;

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.putImageData(base, 0, 0);

    const eraser = tool === "eraser";
    ctx.globalCompositeOperation = eraser ? "destination-out" : "source-over";
    ctx.globalAlpha = eraser
      ? settings.eraserMode === "alpha"
        ? strokeCompositeAlpha() // tẩy theo độ mờ (BR-T04)
        : 1 // tẩy sạch pixel
      : strokeCompositeAlpha();
    // Độ cứng đầu cọ → làm mờ viền nét (một lần, ngay lúc hợp nhất)
    const blur = hardnessBlurRadius(settings.hardness, settings.size);
    if (blur > 0.1) ctx.filter = `blur(${blur.toFixed(2)}px)`;
    // Đối xứng (BRD T-1 #13): hợp nhất bộ đệm lặp lại theo từng trục gương
    drawWithSymmetry(ctx, settings.symmetry, buffer.width, buffer.height, () => {
      ctx.drawImage(buffer, 0, 0);
    });

    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    renderComposite();
  }, [getCtx, tool, settings, strokeCompositeAlpha, renderComposite]);

  /** Dọn bộ đệm nét sau khi kết thúc một nét. */
  const clearStrokeBuffer = useCallback(() => {
    const buffer = strokeBufferRef.current;
    buffer?.getContext("2d")?.clearRect(0, 0, buffer.width, buffer.height);
    strokeBaseImageRef.current = null;
    strokeLastPointRef.current = null;
  }, []);

  /**
   * Đẩy một bitmap **trước khi sửa** vào lịch sử undo (giữ 20 bước, BR-T08).
   * Tách riêng để chỗ gọi đã có sẵn `ImageData` (vd. đổ màu) khỏi đọc lại canvas.
   */
  const pushHistory = useCallback(
    (data: ImageData) => {
      if (!activeLayerId) return;
      historyRef.current = [
        ...historyRef.current.slice(-19),
        { layerId: activeLayerId, data },
      ];
      futureRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
      setIsSaved(false);
    },
    [activeLayerId],
  );

  /**
   * Ghi lại bitmap của layer đang chọn **trước khi thay đổi nó**
   * (gọi ở đầu mỗi thao tác) → 1 lần Ctrl+Z hoàn nguyên đúng 1 thao tác,
   * không ảnh hưởng layer khác (BR-T08).
   *
   * Đây cũng là chỗ chốt **bản dán đang bay**: mọi thao tác sửa layer đều đi qua
   * đây trước, mà bản dán thì phải nằm hẳn trong layer trước khi có thay đổi mới.
   */
  const snapshot = useCallback(() => {
    endFloat();
    const layerCanvas = activeLayerId ? getLayerCanvas(activeLayerId) : null;
    if (!layerCanvas) return;
    const ctx = layerCanvas.getContext("2d");
    if (!ctx) return;
    pushHistory(
      ctx.getImageData(0, 0, layerCanvas.width, layerCanvas.height),
    );
  }, [activeLayerId, endFloat, getLayerCanvas, pushHistory]);

  // ── Vùng chọn: khoanh / dời / biến đổi / xoá / copy-paste (3C) ───────────────

  /**
   * Lý do **không được sửa** layer đang chọn (layer AI chỉ đọc / bị khoá / đang
   * ẩn). `null` = sửa được. Dùng chung mọi thao tác để toast luôn nêu lý do
   * (AC-T3.5) thay vì thất bại im lặng.
   */
  const activeLayerBlockReason = useCallback((): string | null => {
    const layer = layers.find((l) => l.id === activeLayerId);
    if (!layer) return null;
    if (layer.kind === "ai" || layer.readOnly) {
      return `Layer "${layer.name}" là layer AI — chỉ đọc, hãy chọn layer khác để vẽ!`;
    }
    if (layer.locked) {
      return `Layer "${layer.name}" đang bị khóa, hãy mở khóa để vẽ!`;
    }
    if (!layer.visible) return `Layer "${layer.name}" đang bị ẩn!`;
    return null;
  }, [layers, activeLayerId]);

  /** Chốt vùng chọn (bỏ luôn nếu quá nhỏ — AC-T3.5). */
  const commitSelection = useCallback((sel: Selection | null) => {
    const next = isSelectionUsable(sel) ? sel : null;
    selectionRef.current = next;
    setSelection(next);
  }, []);

  /** Bỏ chọn (Esc, hoặc kéo một vùng quá nhỏ — AC-T3.4). Bỏ chọn = chốt bản dán. */
  const clearSelection = useCallback(() => {
    selectionDraftRef.current = null;
    selectionStartRef.current = null;
    endFloat();
    commitSelection(null);
  }, [commitSelection, endFloat]);

  /**
   * Vẽ "marching ants" lên **lớp phủ riêng** (không phải canvas hiển thị) → ảnh
   * xuất và ảnh gửi AI không dính đường kiến, và mỗi khung hình chỉ phải stroke
   * một đường thay vì composite lại cả chồng layer.
   */
  const drawSelectionOverlay = useCallback(() => {
    const overlay = selectionOverlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    const dpr = overlayDprRef.current || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const scale = viewportRef.current.scale;
    if (!(scale > 0)) return;

    const { artW, artH } = frameRef.current;
    // Toạ độ artwork → pixel lớp phủ (lớp phủ dùng cùng khung nhìn với canvas hiển thị)
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Trục đối xứng của công cụ đang dùng (BRD T-1 #13). Vẽ ở lớp phủ nên đường
    // trục không lọt vào ảnh xuất hay ảnh gửi AI.
    const guides = symmetryGuides(symmetryRef.current, artW, artH);
    if (guides.length > 0) {
      ctx.strokeStyle = "rgba(236,72,153,0.55)";
      ctx.lineWidth = 1.2 / scale;
      ctx.setLineDash([10 / scale, 6 / scale]);
      ctx.lineDashOffset = 0;
      ctx.beginPath();
      for (const g of guides) {
        ctx.moveTo(g.x1, g.y1);
        ctx.lineTo(g.x2, g.y2);
      }
      ctx.stroke();
    }

    const sel = selectionDraftRef.current ?? selectionRef.current;
    if (!sel || sel.points.length < 3) return;

    const path = buildSelectionPath(sel, artW, artH);
    // Nền trắng đặc + nét đen đứt quãng → thấy được trên cả vùng trắng lẫn vùng đen
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 3 / scale;
    ctx.stroke(path);
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 1.6 / scale;
    ctx.setLineDash([6 / scale, 5 / scale]);
    ctx.lineDashOffset = -antsOffsetRef.current / scale;
    ctx.stroke(path);
    ctx.setLineDash([]);
  }, []);

  // Kiến bò: chỉ chạy khi đang có vùng chọn, dịch pha ~16 lần/giây cho đỡ tốn
  useEffect(() => {
    drawSelectionOverlay();
    if (!selection) return;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 60) {
        last = t;
        antsOffsetRef.current = (antsOffsetRef.current + 1) % 11;
        drawSelectionOverlay();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selection, drawSelectionOverlay]);

  // Đổi trục đối xứng (hoặc đổi công cụ) thì vẽ lại lớp phủ để đường trục đúng ngay
  useEffect(() => {
    symmetryRef.current = settings.symmetry;
    drawSelectionOverlay();
  }, [settings.symmetry, drawSelectionOverlay]);

  /** Mặt nạ vùng chọn (1 = trong vùng chọn) cho thùng sơn (BR-T10). */
  const buildSelectionMask = useCallback(
    (w: number, h: number): Uint8Array | null => {
      const sel = selectionRef.current;
      if (!sel || !isSelectionUsable(sel)) return null;
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = w;
      maskCanvas.height = h;
      const mctx = maskCanvas.getContext("2d", { willReadFrequently: true });
      if (!mctx) return null;
      mctx.fillStyle = "#ffffff";
      mctx.fill(buildSelectionPath(sel, w, h), selectionFillRule(sel));
      return maskFromAlpha(mctx.getImageData(0, 0, w, h).data, w * h);
    },
    [],
  );

  /**
   * Nhấc pixel trong vùng chọn khỏi layer vào bộ đệm "đang bay" (AC-T3.1):
   * 1) chép phần layer nằm trong vùng chọn, 2) **khoét** vùng đó khỏi layer (nên
   * dời là dời thật, không nhân bản), 3) giữ bitmap sau khi khoét làm nền để mỗi
   * lần di chuột vẽ lại sạch (viền không nhoè dần).
   */
  const beginFloat = useCallback(
    (sel: Selection): boolean => {
      const ctx = getCtx();
      if (!ctx) return false;
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const float = document.createElement("canvas");
      float.width = w;
      float.height = h;
      const fctx = float.getContext("2d");
      if (!fctx) return false;
      const path = buildSelectionPath(sel, w, h);
      const rule = selectionFillRule(sel);
      // Vẽ nguồn trước rồi mới đóng mặt nạ: `destination-in` giữ **màu đích**
      // (xem `lib/selectionBlit.ts`), đảo thứ tự là nét vẽ thành bóng trắng.
      blitSelectionMask(fctx, ctx.canvas, path, rule);

      snapshot();
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      ctx.clip(path, rule);
      ctx.clearRect(0, 0, w, h);
      ctx.restore();

      floatCanvasRef.current = float;
      floatBaseRef.current = ctx.getImageData(0, 0, w, h);
      floatBaseSelectionRef.current = sel;
      floatBaseTransformRef.current = IDENTITY_TRANSFORM;
      transformRef.current = IDENTITY_TRANSFORM;
      floatLayerRef.current = activeLayerId;
      floatKindRef.current = "cut";
      return true;
    },
    [activeLayerId, getCtx, snapshot],
  );

  /** Vẽ lại layer = nền đã khoét + pixel đang bay, theo phép biến đổi hiện tại. */
  const renderFloat = useCallback(
    (t: SelectionTransform) => {
      const float = floatCanvasRef.current;
      const base = floatBaseRef.current;
      const baseSel = floatBaseSelectionRef.current;
      if (!float || !base || !baseSel) return;
      // Đổi layer giữa chừng thì chốt vật đang bay: nếu không, nền của layer cũ
      // sẽ bị ghi đè lên layer mới (mất nét của layer mới).
      if (!activeLayerId || floatLayerRef.current !== activeLayerId) {
        endFloat();
        return;
      }
      const ctx = getCtx();
      if (!ctx) return;
      const c = selectionCenter(baseSel);
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      ctx.putImageData(base, 0, 0);
      // Cùng thứ tự với `transformPoint`: scale/lật → xoay → dời, neo ở trọng tâm gốc
      ctx.translate(c.x + t.dx, c.y + t.dy);
      ctx.rotate((t.rotate * Math.PI) / 180);
      ctx.scale(t.scale * (t.flipH ? -1 : 1), t.scale * (t.flipV ? -1 : 1));
      ctx.translate(-c.x, -c.y);
      ctx.drawImage(float, 0, 0);
      ctx.restore();
      renderComposite();
    },
    [activeLayerId, endFloat, getCtx, renderComposite],
  );

  /**
   * Biến đổi vùng chọn **kèm pixel** bên trong (AC-T3.1: xoay ±15°, lật ngang/dọc,
   * phóng to/thu nhỏ có tỉ lệ). Mỗi lần gọi = một bước undo riêng.
   *
   * Đang có **vật đang bay** (bản dán chưa chốt) thì ghép nấc biến đổi lên chính
   * nó, không cắt lại vùng chọn: cắt lại sẽ kéo theo cả nội dung gốc nằm trong
   * vùng chọn.
   */
  const transformSelectionBy = useCallback(
    (patch: Partial<SelectionTransform>) => {
      const sel = selectionRef.current;
      if (!sel || !isSelectionUsable(sel)) {
        showToast("Chưa có vùng chọn — hãy khoanh vùng bằng công cụ Chọn trước.");
        return;
      }
      const reason = activeLayerBlockReason();
      if (reason) {
        showToast(reason);
        return;
      }
      const pending = floatKindRef.current !== null;
      const baseSel = (pending ? floatBaseSelectionRef.current : null) ?? sel;
      if (!pending && !beginFloat(sel)) return;
      const t = composeTransform(
        pending ? transformRef.current : IDENTITY_TRANSFORM,
        patch,
      );
      transformRef.current = t;
      renderFloat(t);
      commitSelection(transformSelection(baseSel, t, selectionCenter(baseSel)));
      if (!pending) endFloat();
      compositeNow();
    },
    [
      activeLayerBlockReason,
      beginFloat,
      commitSelection,
      compositeNow,
      endFloat,
      renderFloat,
      showToast,
    ],
  );

  /** Xoay vùng chọn một nấc 15° (AC-T3.1). */
  const rotateSelection = useCallback(
    (direction: 1 | -1) =>
      transformSelectionBy({ rotate: direction * ROTATE_STEP }),
    [transformSelectionBy],
  );

  /**
   * Lật vùng chọn theo trục ngang/dọc (AC-T3.1). Vật đang bay thì lật là **đảo
   * trạng thái** (lật hai lần về như cũ); vùng chọn cắt thì mỗi lần là một nấc.
   */
  const flipSelection = useCallback(
    (axis: "h" | "v") => {
      const pending = floatKindRef.current !== null;
      const current = transformRef.current;
      transformSelectionBy(
        axis === "h"
          ? { flipH: pending ? !current.flipH : true }
          : { flipV: pending ? !current.flipV : true },
      );
    },
    [transformSelectionBy],
  );

  /** Phóng to/thu nhỏ vùng chọn **có tỉ lệ** (AC-T3.1). */
  const scaleSelectionBy = useCallback(
    (factor: number) => transformSelectionBy({ scale: factor }),
    [transformSelectionBy],
  );

  /** `Delete`: xoá nội dung trong vùng chọn trên layer đang chọn (AC-T3.2). */
  const deleteSelection = useCallback(() => {
    const sel = selectionRef.current;
    if (!sel || !isSelectionUsable(sel)) {
      showToast("Chưa có vùng chọn để xóa — hãy khoanh vùng bằng công cụ Chọn.");
      return;
    }
    const ctx = getCtx();
    if (!ctx) return;
    const reason = activeLayerBlockReason();
    if (reason) {
      showToast(reason);
      return;
    }
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    snapshot();
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.clip(buildSelectionPath(sel, w, h), selectionFillRule(sel));
    ctx.clearRect(0, 0, w, h);
    ctx.restore();
    compositeNow();
    showToast("Đã xóa nội dung trong vùng chọn.");
  }, [
    activeLayerBlockReason,
    compositeNow,
    getCtx,
    showToast,
    snapshot,
  ]);

  /** `Ctrl+C`: chép pixel trong vùng chọn của layer đang chọn vào clipboard nội bộ. */
  const copySelection = useCallback(() => {
    const sel = selectionRef.current;
    const ctx = getCtx();
    if (!sel || !isSelectionUsable(sel) || !ctx) {
      showToast("Chưa có vùng chọn để sao chép.");
      return;
    }
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const clip = document.createElement("canvas");
    clip.width = w;
    clip.height = h;
    const cctx = clip.getContext("2d");
    if (!cctx) return;
    blitSelectionMask(
      cctx,
      ctx.canvas,
      buildSelectionPath(sel, w, h),
      selectionFillRule(sel),
    );
    clipboardRef.current = { canvas: clip, selection: sel };
    showToast("Đã sao chép vùng chọn — Ctrl+V để dán.");
  }, [getCtx, showToast]);

  /**
   * `Ctrl+V`: dán phần vừa sao chép vào layer đang chọn dưới dạng **vật đang
   * bay** (AC-T3.3): lệch một nhịp để thấy ngay, kéo được **riêng** mà không
   * đụng nội dung gốc (nền của vật đang bay là layer trước khi dán, không khoét
   * gì), xoay/lật/phóng được, và chỉ chốt khi bấm ra ngoài, `Enter`, `Esc` hoặc
   * làm thao tác khác.
   */
  const pasteSelection = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip) {
      showToast("Chưa có gì để dán — hãy Ctrl+C một vùng chọn trước.");
      return;
    }
    const ctx = getCtx();
    if (!ctx) return;
    const reason = activeLayerBlockReason();
    if (reason) {
      showToast(reason);
      return;
    }
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    // Bản dán trước (nếu còn đang bay) phải chốt trước khi dán bản mới
    endFloat();
    snapshot();
    floatCanvasRef.current = clip.canvas;
    floatBaseRef.current = ctx.getImageData(0, 0, w, h);
    floatBaseSelectionRef.current = clip.selection;
    floatBaseTransformRef.current = IDENTITY_TRANSFORM;
    // Lệch một nhịp so với bản gốc để thấy ngay là đã dán (bản dán vẫn nằm ngoài
    // vùng gốc ở mức đủ nhận ra, và kéo được nên không cần lệch nhiều).
    const placement: SelectionTransform = {
      ...IDENTITY_TRANSFORM,
      dx: PASTE_OFFSET,
      dy: PASTE_OFFSET,
    };
    transformRef.current = placement;
    floatLayerRef.current = activeLayerId;
    floatKindRef.current = "paste";
    renderFloat(placement);
    commitSelection(
      transformSelection(clip.selection, placement, selectionCenter(clip.selection)),
    );
    // Dán tiếp thì lệch thêm một nhịp, không chồng khít lên bản cũ
    const shifted = document.createElement("canvas");
    shifted.width = w;
    shifted.height = h;
    shifted.getContext("2d")?.drawImage(clip.canvas, PASTE_OFFSET, PASTE_OFFSET);
    clipboardRef.current = {
      canvas: shifted,
      selection: translateSelection(clip.selection, PASTE_OFFSET, PASTE_OFFSET),
    };
    compositeNow();
    showToast(
      "Đã dán — kéo để đặt chỗ, xoay/lật nếu cần, Enter hoặc Esc để chốt.",
    );
  }, [
    activeLayerBlockReason,
    activeLayerId,
    commitSelection,
    compositeNow,
    endFloat,
    getCtx,
    renderFloat,
    showToast,
    snapshot,
  ]);

  /** Đảo vùng chọn (AC-T3.4). Đổi đường bao thì chốt bản dán đang bay trước. */
  const invertSelection = useCallback(() => {
    const sel = selectionRef.current;
    if (!sel || !isSelectionUsable(sel)) {
      showToast("Chưa có vùng chọn để đảo.");
      return;
    }
    endFloat();
    const next = toggleSelectionInvert(sel);
    commitSelection(next);
    showToast(
      next.inverted
        ? "Đã đảo vùng chọn — thao tác giờ tác động ra ngoài đường bao."
        : "Vùng chọn đã trở lại như trước.",
    );
  }, [commitSelection, endFloat, showToast]);

  /**
   * Bút lấy màu: đọc 1 pixel từ **ảnh tổng hợp** đang hiển thị (BR-T09), không
   * lấy từ layer đơn lẻ. Chỉ đọc nên không vào lịch sử undo.
   */
  const pickColorAt = useCallback(
    (px: number, py: number) => {
      const display = canvasRef.current;
      const ctx = display?.getContext("2d");
      if (!display || !ctx) return;
      const x = Math.floor(px);
      const y = Math.floor(py);
      if (x < 0 || y < 0 || x >= display.width || y >= display.height) return;
      const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
      if (a === 0) {
        showToast("Chỗ này trong suốt — không có màu để lấy.");
        return;
      }
      const hex = `#${[r, g, b]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")}`;
      setColor(hex);
      showToast(`Đã lấy màu ${hex} từ ảnh tổng hợp.`);
    },
    [showToast],
  );

  /** Công cụ Chọn lúc bấm xuống: trong vùng chọn = dời, ngoài = khoanh vùng mới. */
  const selectPointerDown = useCallback(
    (px: number, py: number) => {
      const sel = selectionRef.current;
      if (sel && pointInSelection(sel, { x: px, y: py })) {
        const reason = activeLayerBlockReason();
        if (reason) {
          showToast(reason);
          return;
        }
        // Bấm trong vùng chọn: kéo **vật đang bay** (bản dán) hoặc chờ xem có
        // kéo thật không rồi mới cắt pixel (bấm suông không đổi gì). Phép biến
        // đổi lúc bấm là mốc để cộng dồn, nên kéo nhiều lần không trôi.
        floatStartRef.current = { x: px, y: py };
        floatBaseTransformRef.current = transformRef.current;
        // Chưa có gì đang bay thì đây là vùng sẽ bị khoét khi kéo thật; đang bay
        // rồi (bản dán) thì **giữ nguyên** mốc neo của vật đang bay, không lấy
        // vùng chọn hiện tại (nó đã dời theo vật) làm mốc mới.
        if (floatKindRef.current === null) {
          floatBaseSelectionRef.current = sel;
        }
        isDrawing.current = true;
        return;
      }
      // Bấm ra ngoài vùng chọn = chốt bản dán đang bay, rồi khoanh vùng mới
      endFloat();
      selectionStartRef.current = { x: px, y: py };
      selectionDraftRef.current =
        selectMode === "rect"
          ? rectSelection({ x: px, y: py }, { x: px, y: py })
          : { points: [{ x: px, y: py }], inverted: false };
      isDrawing.current = true;
      drawSelectionOverlay();
    },
    [
      activeLayerBlockReason,
      drawSelectionOverlay,
      endFloat,
      selectMode,
      showToast,
    ],
  );

  /** Công cụ Chọn lúc kéo: hoặc dời vùng chọn (kèm pixel), hoặc mở rộng vùng mới. */
  const selectPointerMove = useCallback(
    (px: number, py: number) => {
      const start = floatStartRef.current;
      const baseSel = floatBaseSelectionRef.current;
      if (start && baseSel) {
        const baseT = floatBaseTransformRef.current;
        const t: SelectionTransform = {
          ...baseT,
          dx: baseT.dx + (px - start.x),
          dy: baseT.dy + (py - start.y),
        };
        if (floatKindRef.current === null) {
          if (t.dx === 0 && t.dy === 0) return;
          if (!beginFloat(baseSel)) return;
        }
        transformRef.current = t;
        renderFloat(t);
        // Kiến bám theo vùng chọn đang bay
        selectionDraftRef.current = transformSelection(
          baseSel,
          t,
          selectionCenter(baseSel),
        );
        drawSelectionOverlay();
        return;
      }
      const s = selectionStartRef.current;
      if (!s) return;
      if (selectMode === "rect") {
        selectionDraftRef.current = rectSelection(s, { x: px, y: py });
      } else {
        const draft = selectionDraftRef.current;
        if (!draft) return;
        selectionDraftRef.current = {
          points: appendLassoPoint(draft.points, { x: px, y: py }),
          inverted: false,
        };
      }
      drawSelectionOverlay();
    },
    [beginFloat, drawSelectionOverlay, renderFloat, selectMode],
  );

  /** Công cụ Chọn lúc nhả chuột: chốt vùng chọn / kết thúc một lần dời. */
  const selectPointerUp = useCallback(() => {
    const wasMoving = floatStartRef.current !== null;
    const draft = selectionDraftRef.current;
    const t = transformRef.current;
    const baseSel = floatBaseSelectionRef.current;
    const kind = floatKindRef.current;
    selectionDraftRef.current = null;
    selectionStartRef.current = null;
    floatStartRef.current = null;
    if (wasMoving) {
      if (kind && baseSel) {
        commitSelection(transformSelection(baseSel, t, selectionCenter(baseSel)));
        compositeNow();
        // Vùng chọn bị khoét thì hết cử chỉ là chốt; bản dán vẫn **đang bay**
        // để còn kéo/xoay riêng tiếp, chỉ chốt khi có thao tác khác.
        if (kind === "cut") endFloat();
      } else {
        endFloat();
      }
      drawSelectionOverlay();
      return;
    }
    // Khoanh xong; vùng quá nhỏ (bấm suông) nghĩa là bỏ chọn (AC-T3.4)
    commitSelection(draft);
    drawSelectionOverlay();
  }, [commitSelection, compositeNow, drawSelectionOverlay, endFloat]);

  /** Hoàn nguyên 1 bước: trả bitmap về đúng layer mà thao tác đó đã sửa. */
  const undo = useCallback(() => {
    // Bitmap sắp bị ghi lại → chốt bản dán đang bay trước
    endFloat();
    const entry = historyRef.current[historyRef.current.length - 1];
    if (!entry) return;
    const layerCanvas = getLayerCanvas(entry.layerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!layerCanvas || !ctx) return;
    futureRef.current = [
      ...futureRef.current,
      { layerId: entry.layerId, data: ctx.getImageData(0, 0, layerCanvas.width, layerCanvas.height) },
    ];
    historyRef.current = historyRef.current.slice(0, -1);
    ctx.putImageData(entry.data, 0, 0);
    // Chuyển sang layer vừa hoàn nguyên để người dùng thấy ngay kết quả
    setActiveLayerId(entry.layerId);
    compositeNow();
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
    setIsSaved(false);
  }, [endFloat, getLayerCanvas, compositeNow]);

  /** Làm lại bước vừa bị undo. */
  const redo = useCallback(() => {
    // Bitmap sắp bị ghi lại → chốt bản dán đang bay trước
    endFloat();
    const entry = futureRef.current[futureRef.current.length - 1];
    if (!entry) return;
    const layerCanvas = getLayerCanvas(entry.layerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!layerCanvas || !ctx) return;
    historyRef.current = [
      ...historyRef.current,
      { layerId: entry.layerId, data: ctx.getImageData(0, 0, layerCanvas.width, layerCanvas.height) },
    ];
    futureRef.current = futureRef.current.slice(0, -1);
    ctx.putImageData(entry.data, 0, 0);
    setActiveLayerId(entry.layerId);
    compositeNow();
    setCanRedo(futureRef.current.length > 0);
    setCanUndo(true);
    setIsSaved(false);
  }, [endFloat, getLayerCanvas, compositeNow]);

  /** Xóa **layer đang chọn** (không đụng layer khác) rồi composite lại. */
  const clearCanvas = useCallback(() => {
    const layerCanvas = activeLayerId ? getLayerCanvas(activeLayerId) : null;
    const ctx = layerCanvas?.getContext("2d");
    if (!layerCanvas || !ctx) return;
    snapshot();
    ctx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
    compositeNow();
    setReviewResult(null);
    setAnalysisError(null);
    setSelectedFindingIndex(null);
    setShowAnalysis(false);
  }, [getLayerCanvas, activeLayerId, snapshot, compositeNow]);

  // Tự động nạp nét vẽ của đúng trang trong đúng dự án (IndexedDB).
  // Sau khi có dữ liệu → đồng bộ bitmap layer (xem `resyncLayersWithData`).
  useEffect(() => {
    if (!projectId) {
      setPanelData({});
      setStacks({});
      layerCanvasesRef.current.clear();
      historyRef.current = [];
      futureRef.current = [];
      return;
    }
    let isCancelled = false;
    async function loadData() {
      try {
        const { stacks: loadedStacks, legacyPanels } = await getPageStacksFromDB(
          projectId!,
          page,
        );
        if (isCancelled) return;
        const data = legacyPanels || {};
        setPanelData(data);
        setIsSaved(true);
        // Dữ liệu trang mới đã có → đồng bộ ngăn xếp + bitmap layer
        resyncLayersWithData(loadedStacks);
      } catch {
        if (!isCancelled) {
          setPanelData({});
          resyncLayersWithData({});
        }
      }
    }
    loadData();
    return () => {
      isCancelled = true;
      // Trang cũ còn thay đổi chưa ghi → ghi ngay trước khi đổi trang
      flushPendingSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, page]);

  // Phím tắt bàn phím (Ctrl+Z, Ctrl+Y, Ctrl+S, vùng chọn: Delete/C/C/V, Esc)
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return Boolean(
        el &&
          (el.tagName === "INPUT" ||
            el.tagName === "TEXTAREA" ||
            el.isContentEditable),
      );
    };
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (mod && key === "y") {
        e.preventDefault();
        redo();
      } else if (mod && key === "s") {
        e.preventDefault();
        saveDraft();
      } else if (mod && key === "c") {
        // AC-T3.3: sao chép vùng chọn trên layer đang chọn
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        copySelection();
      } else if (mod && key === "v") {
        // AC-T3.3: dán trong cùng khung
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        pasteSelection();
      } else if (mod && e.shiftKey && key === "i") {
        // AC-T3.4: đảo vùng chọn
        e.preventDefault();
        invertSelection();
      } else if (!mod && (e.key === "Delete" || e.key === "Backspace")) {
        // AC-T3.2: xoá nội dung trong vùng chọn
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        deleteSelection();
      } else if (e.key === "Escape") {
        // AC-T3.4: Esc bỏ chọn. Đang toàn màn hình thì nhường Esc cho việc thoát
        // toàn màn hình (đã có listener riêng) để không làm hai việc một lúc.
        if (panelFullscreen) return;
        if (isTypingTarget(e.target)) return;
        if (selectionRef.current) clearSelection();
      } else if (e.key === "Enter" && floatKindRef.current === "paste") {
        // Chốt bản dán đang bay (giữ nguyên vùng chọn để xoá/dời tiếp nếu muốn)
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        endFloat();
        compositeNow();
        showToast("Đã chốt bản dán vào layer.");
      } else if (!mod && (e.key === "[" || e.key === "]")) {
        // AC-T2.4: [ ] đổi size ±2, Shift ±10
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        const step = (e.shiftKey ? 10 : 2) * (e.key === "]" ? 1 : -1);
        nudgeSize(step);
      } else if (!mod && !e.altKey && !e.shiftKey && SHORTCUT_TO_TOOL[key]) {
        // AC-T1.1: phím tắt riêng cho từng công cụ — `1`–`9` theo Phụ lục A,
        // các công cụ thêm ở Phase 3 dùng chữ cái L / G / A / Y / C / U.
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        const nextTool = SHORTCUT_TO_TOOL[key];
        if (nextTool) setTool(nextTool);
      } else if (mod && e.shiftKey && key === "n") {
        // Phụ lục A: thêm layer. Chromium giành Ctrl+Shift+N cho cửa sổ ẩn danh
        // nên trên Chrome phím này có thể không tới được trang; nút "+" ở bảng
        // Layer vẫn dùng bình thường (xem appendix-T-CHECK).
        e.preventDefault();
        addLayer();
      } else if (mod && e.shiftKey && key === "e") {
        // Phụ lục A: gộp layer đang chọn xuống layer dưới
        e.preventDefault();
        if (activeLayerId) mergeLayerDown(activeLayerId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    undo,
    redo,
    saveDraft,
    nudgeSize,
    panelFullscreen,
    clearSelection,
    copySelection,
    pasteSelection,
    invertSelection,
    deleteSelection,
    endFloat,
    compositeNow,
    showToast,
    setTool,
    addLayer,
    mergeLayerDown,
    activeLayerId,
  ]);

  // Chèn chữ / lời thoại vào canvas
  const insertText = useCallback(
    (text: string) => {
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx || !textInputPos || !text.trim()) {
        setShowTextInput(false);
        setTextInputPos(null);
        return;
      }
      snapshot();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = settings.opacity / 100;
      ctx.font = `${Math.max(14, size * 3.5)}px "Comic Sans MS", "Arial", sans-serif`;
      ctx.fillStyle = color;
      ctx.textBaseline = "middle";
      // textInputPos là screen px trong khung → đổi sang toạ độ artwork (3A)
      const { x: tx, y: ty } = screenToArtwork(
        viewportRef.current,
        textInputPos.x,
        textInputPos.y,
      );
      ctx.fillText(text, tx, ty);
      ctx.globalAlpha = 1;
      compositeNow();
      setShowTextInput(false);
      setTextInputPos(null);
      showToast("Đã thêm lời thoại!");
    },
    [getCtx, textInputPos, size, color, settings.opacity, snapshot, compositeNow, showToast],
  );

  const cancelText = useCallback(() => {
    setShowTextInput(false);
    setTextInputPos(null);
  }, []);

  // Xuất ảnh khung tranh hiện tại (PNG)
  const exportCurrentPanel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activePanel) {
      showToast("Hãy mở một khung tranh để xuất ảnh");
      return;
    }
    const link = document.createElement("a");
    link.download = `manga-panel-${activePanel}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    showToast("Đã xuất ảnh khung tranh!");
  }, [activePanel, showToast]);

  // Xuất toàn bộ trang truyện thành ảnh hoàn chỉnh (PNG 1200x1600)
  const exportFullPage = useCallback(() => {
    const w = 1200;
    const h = 1600;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = w;
    exportCanvas.height = h;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    // Nền giấy trắng manga
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    let loaded = 0;
    const total = layout.panels.length;

    function finalize() {
      const link = document.createElement("a");
      link.download = `animan-page-${page}.png`;
      link.href = exportCanvas.toDataURL("image/png");
      link.click();
      showToast(`Đã xuất toàn bộ Trang ${page}!`);
    }

    if (total === 0) {
      finalize();
      return;
    }

    layout.panels.forEach((p) => {
      const px = (p.x / 100) * w;
      const py = (p.y / 100) * h;
      const pw = (p.w / 100) * w;
      const ph = (p.h / 100) * h;

      const dataUrl = panelData[p.id];
      if (dataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, px, py, pw, ph);
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 3;
          ctx.strokeRect(px, py, pw, ph);
          loaded++;
          if (loaded === total) finalize();
        };
        img.onerror = () => {
          loaded++;
          if (loaded === total) finalize();
        };
        img.src = dataUrl;
      } else {
        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, pw, ph);
        loaded++;
        if (loaded === total) finalize();
      }
    });
  }, [layout, panelData, page, showToast]);

  // Hình học khung nhìn (RC-1 + 3A): backing CỐ ĐỊNH theo khung; CSS đặt theo
  // `scale = fitScale × zoom` + pan. Pan/zoom KHÔNG đụng pixel (BR-T06).
  const applyViewport = useCallback(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent || !activePanel) return;
    const rect = parent.getBoundingClientRect();
    if (!rect || rect.width < 1) return;

    const backing = getPanelBackingSize(layout, activePanel);
    if (canvas.width !== backing.w) canvas.width = backing.w;
    if (canvas.height !== backing.h) canvas.height = backing.h;

    const fit = fitView(backing.w, backing.h, rect.width, rect.height);
    fitRef.current = fit;
    frameRef.current = {
      frameW: rect.width,
      frameH: rect.height,
      artW: backing.w,
      artH: backing.h,
    };

    const zoom = clampScale(viewZoomRef.current, MIN_ZOOM, MAX_ZOOM);
    const scale = fit.scale * zoom;
    // Kẹp pan để khung vẽ không hở khoảng trắng; ghi lại để lần kéo sau nối tiếp.
    const pan = clampPan(
      viewPanRef.current.x,
      viewPanRef.current.y,
      backing.w * scale,
      backing.h * scale,
      rect.width,
      rect.height,
    );
    viewPanRef.current = pan;
    const tx = fit.tx + pan.x;
    const ty = fit.ty + pan.y;

    let cssW = Math.round(backing.w * scale);
    let cssH = Math.round(backing.h * scale);
    // Khung vừa khít → khít đúng hộp để không hở viền 1px
    if (
      zoom === 1 &&
      Math.abs(cssW - rect.width) < 2 &&
      Math.abs(cssH - rect.height) < 2
    ) {
      cssW = Math.round(rect.width);
      cssH = Math.round(rect.height);
    }
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.style.left = `${Math.round(tx)}px`;
    canvas.style.top = `${Math.round(ty)}px`;

    // Lớp phủ vùng chọn: cùng khung hình với canvas hiển thị, nhưng mực vẽ theo
    // CSS px (1,6px) nên đường kiến không dày lên khi zoom (BR-T06).
    const overlay = selectionOverlayRef.current;
    if (overlay) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      overlayDprRef.current = dpr;
      overlay.style.width = `${cssW}px`;
      overlay.style.height = `${cssH}px`;
      overlay.style.left = `${Math.round(tx)}px`;
      overlay.style.top = `${Math.round(ty)}px`;
      const bw = Math.max(1, Math.round(cssW * dpr));
      const bh = Math.max(1, Math.round(cssH * dpr));
      if (overlay.width !== bw) overlay.width = bw;
      if (overlay.height !== bh) overlay.height = bh;
    }

    viewportRef.current = { scale, tx, ty };
    drawSelectionOverlay();
  }, [activePanel, layout, drawSelectionOverlay]);

  // Giữ tham chiếu mới nhất để effect zoom/pan không phải phụ thuộc identity
  const applyViewportRef = useRef(applyViewport);
  useEffect(() => {
    applyViewportRef.current = applyViewport;
  }, [applyViewport]);

  /**
   * Kẹp pan theo khung/ảnh hiện tại — chặn kéo ra ngoài biên làm hở khoảng
   * trắng (BR-T06). Dùng cho handler kéo pan và zoom bằng con lăn.
   */
  const clampCurrentPan = useCallback(
    (panX: number, panY: number, zoom: number) => {
      const { frameW, frameH, artW, artH } = frameRef.current;
      const scale = fitRef.current.scale * zoom;
      return clampPan(panX, panY, artW * scale, artH * scale, frameW, frameH);
    },
    [],
  );

  // Đổi khung → reset lịch sử undo + khung nhìn, nạp pixel từng layer đã lưu (RC-1)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activePanel) return;

    // Lịch sử undo gắn theo panel → reset khi đổi panel
    historyRef.current = [];
    futureRef.current = [];
    setCanUndo(false);
    setCanRedo(false);

    // Mỗi khung mở ra ở khung vừa khít (zoom 100%, không pan)
    viewZoomRef.current = 1;
    viewPanRef.current = { x: 0, y: 0 };
    setViewZoom(1);
    setViewPan({ x: 0, y: 0 });

    applyViewportRef.current();

    // Khung chưa từng mở trong phiên này → nạp pixel từng layer đã lưu
    // (chỉ nạp layer chưa có bitmap; ảnh cũ được co 1 lần về backing).
    const stack = stacksRef.current[activePanel];
    if (stack) seedStackPixels(stack);
    compositeNow();

    const ro = new ResizeObserver(() => applyViewportRef.current());
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel, layout.id]);

  // Zoom/pan đổi → cập nhật hình học, KHÔNG reset lịch sử undo
  useEffect(() => {
    viewZoomRef.current = viewZoom;
    viewPanRef.current = viewPan;
    applyViewportRef.current();
  }, [viewZoom, viewPan]);

  // Zoom bằng con lăn, neo tại vị trí con trỏ (BR-T06). Gắn native để
  // preventDefault được (React để wheel ở chế độ passive).
  useEffect(() => {
    const el = inputRef.current;
    if (!el || !activePanel) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const parent = el.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const fit = fitRef.current;
      const next = zoomAt(
        viewportRef.current,
        Math.exp(-e.deltaY * 0.0015),
        e.clientX - rect.left,
        e.clientY - rect.top,
        fit.scale * MIN_ZOOM,
        fit.scale * MAX_ZOOM,
      );
      setViewZoom(next.scale / (fit.scale || 1));
      const { frameW, frameH, artW, artH } = frameRef.current;
      setViewPan(
        clampPan(
          next.tx - fit.tx,
          next.ty - fit.ty,
          artW * next.scale,
          artH * next.scale,
          frameW,
          frameH,
        ),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [activePanel]);

  // Giữ Space = tạm chuyển sang pan (Phụ lục A BRD)
  useEffect(() => {
    const isTypingTarget = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.isContentEditable);
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTypingTarget(e.target)) return;
      e.preventDefault();
      spaceHeldRef.current = true;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceHeldRef.current = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  // ── Công cụ mở rộng (Phase 3 slice D) ─────────────────────────────────────────

  /** Nhịp phun airbrush: ~25 nhịp/giây, đủ mượt mà không nặng máy. */
  const AIRBRUSH_TICK_MS = 40;

  /**
   * Dừng nhịp phun airbrush. Gọi khi nhả chuột, đổi công cụ và lúc tháo hook —
   * không thì nhịp phun cũ vẫn rắc mực lên layer sau khi người dùng đã buông.
   */
  const stopSpray = useCallback(() => {
    if (sprayTimerRef.current !== null) {
      clearInterval(sprayTimerRef.current);
      sprayTimerRef.current = null;
    }
    sprayPointRef.current = null;
  }, []);

  /**
   * Một nhịp phun: rắc các hạt ngẫu nhiên quanh điểm đang giữ vào bộ đệm nét
   * rồi hợp nhất lại vào layer. Mực tích dần trong bộ đệm nên **càng giữ lâu
   * chỗ đó càng đậm**, đúng cảm giác cọ phun.
   */
  const sprayOnce = useCallback(
    (x: number, y: number) => {
      const buffer = strokeBufferRef.current;
      const bufferCtx = buffer?.getContext("2d");
      if (!buffer || !bufferCtx) return;
      const dabs = sprayDabs(
        airbrushDabsPerTick(settings.flow),
        Math.max(1, settings.size / 2),
      );
      const dabRadius = airbrushDabRadius(settings.size);
      bufferCtx.globalCompositeOperation = "source-over";
      bufferCtx.globalAlpha = dabAlpha(settings.flow) * 0.5;
      bufferCtx.fillStyle = color;
      for (const d of dabs) {
        bufferCtx.beginPath();
        bufferCtx.arc(x + d.x, y + d.y, dabRadius, 0, Math.PI * 2);
        bufferCtx.fill();
      }
      paintStrokeBuffer();
    },
    [settings, color, paintStrokeBuffer],
  );

  /**
   * Xem trước cú kéo của Hình / Đường-mũi tên / Đường cong / Chuyển sắc. Chỗ gọi
   * đã khôi phục layer về bitmap trước cú kéo nên ở đây chỉ việc vẽ.
   */
  const drawDragPreview = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      from: { x: number; y: number },
      to: { x: number; y: number },
      shiftKey: boolean,
    ) => {
      const { artW, artH } = frameRef.current;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.filter = "none";

      // Chuyển sắc (BRD T-1 #11): cú kéo chính là trục chuyển sắc
      if (tool === "gradient") {
        const gradient = buildGradient(
          ctx,
          settings.gradientShape,
          from,
          to,
          color,
          settings.gradientEnd,
        );
        const sel = selectionRef.current;
        ctx.save();
        // Có vùng chọn thì chỉ trải màu bên trong vùng đó (như thùng sơn, BR-T10)
        if (sel && isSelectionUsable(sel)) {
          ctx.clip(buildSelectionPath(sel, artW, artH), selectionFillRule(sel));
        }
        ctx.globalAlpha = settings.opacity / 100;
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, artW, artH);
        ctx.restore();
        return;
      }

      // Đường cong (BRD T-1 #15): Bézier 2 điểm điều khiển, uốn theo "Độ cong"
      if (tool === "curve") {
        const end = shiftKey ? snapToAngle(from, to) : to;
        const [c1, c2] = curveControlPoints(from, end, settings.curveBow);
        ctx.strokeStyle = color;
        ctx.globalAlpha = settings.opacity / 100;
        ctx.lineWidth = settings.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        drawWithSymmetry(
          ctx,
          settings.symmetry,
          ctx.canvas.width,
          ctx.canvas.height,
          () => {
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
            ctx.stroke();
          },
        );
        return;
      }

      // Hình và Đường/mũi tên dùng chung một bộ dựng đường bao
      const kind: ShapeKind =
        tool === "line" ? (shapeType === "arrow" ? "arrow" : "line") : shapeType;
      let end = to;
      if (shiftKey) {
        // Shift: khoá 45° cho đường/mũi tên, vuông/tròn đều cho hình
        end =
          kind === "line" || kind === "arrow"
            ? snapToAngle(from, to)
            : constrainSquare(from, to);
      }
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = settings.opacity / 100;
      ctx.lineWidth = settings.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      drawWithSymmetry(
        ctx,
        settings.symmetry,
        ctx.canvas.width,
        ctx.canvas.height,
        () => {
          buildShapePath(ctx, kind, from, end, shapeSides, settings.size);
          // Đầu mũi tên luôn tô đặc; hình kín chỉ tô khi bật Đổ đặc nền
          if (kind === "arrow" || (shapeFill && kindLetsFill(kind))) ctx.fill();
          ctx.stroke();
        },
      );
    },
    [
      tool,
      shapeType,
      shapeFill,
      shapeSides,
      color,
      settings,
    ],
  );

  /**
   * Một nhát của công cụ Mờ / Sắc nét (BRD T-1 #16): lấy vùng dưới cọ, xử lý
   * pixel, rồi gộp lại qua **mặt nạ tròn mềm** nên không thấy vết cọ.
   */
  const effectDabAt = useCallback(
    (x: number, y: number) => {
      const layer = activeLayerId ? getLayerCanvas(activeLayerId) : null;
      const ctx = layer?.getContext("2d", { willReadFrequently: true });
      if (!layer || !ctx) return;
      const r = Math.max(2, settings.size / 2);
      const x0 = Math.max(0, Math.floor(x - r));
      const y0 = Math.max(0, Math.floor(y - r));
      const x1 = Math.min(layer.width, Math.ceil(x + r));
      const y1 = Math.min(layer.height, Math.ceil(y + r));
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 3 || h < 3) return;

      const region = ctx.getImageData(x0, y0, w, h);
      if (settings.effectMode === "blur") {
        boxBlurRGBA(region.data, w, h, blurRadiusForSize(settings.size), 2);
      } else {
        sharpenRGBA(
          region.data,
          w,
          h,
          sharpenAmountForStrength(settings.effectStrength),
        );
      }

      let temp = effectTmpRef.current;
      if (!temp || temp.width !== w || temp.height !== h) {
        temp = document.createElement("canvas");
        temp.width = w;
        temp.height = h;
        effectTmpRef.current = temp;
      }
      const tctx = temp.getContext("2d");
      if (!tctx) return;
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.globalCompositeOperation = "source-over";
      tctx.globalAlpha = 1;
      tctx.clearRect(0, 0, w, h);
      tctx.putImageData(region, 0, 0);
      // Mặt nạ vẽ SAU ảnh: `destination-in` giữ màu của đích (bài học 3C)
      tctx.globalCompositeOperation = "destination-in";
      const strength = Math.min(1, Math.max(0.05, settings.effectStrength / 100));
      const mask = tctx.createRadialGradient(
        w / 2,
        h / 2,
        0,
        w / 2,
        h / 2,
        Math.max(1, Math.min(w, h) / 2),
      );
      mask.addColorStop(0, `rgba(255,255,255,${strength})`);
      mask.addColorStop(0.55, `rgba(255,255,255,${(strength * 0.75).toFixed(3)})`);
      mask.addColorStop(1, "rgba(255,255,255,0)");
      tctx.fillStyle = mask;
      tctx.fillRect(0, 0, w, h);

      // Vùng chọn (3C) giới hạn phạm vi hiệu ứng, giống thùng sơn (BR-T10): nhân
      // thêm mặt nạ vùng chọn vào alpha (vùng đã đảo vẫn đúng nhờ luật even-odd).
      const sel = selectionRef.current;
      if (sel && isSelectionUsable(sel)) {
        tctx.save();
        tctx.setTransform(1, 0, 0, 1, 0, 0);
        tctx.translate(-x0, -y0);
        tctx.fillStyle = "#ffffff";
        tctx.globalCompositeOperation = "destination-in";
        tctx.fill(
          buildSelectionPath(sel, layer.width, layer.height),
          selectionFillRule(sel),
        );
        tctx.restore();
      }

      tctx.globalCompositeOperation = "source-over";

      ctx.globalAlpha = 1;
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(temp, x0, y0);
    },
    [activeLayerId, getLayerCanvas, settings],
  );

  /**
   * Nhát hiệu ứng kèm **đối xứng**: mỗi ô gương phải xử lý pixel tại chỗ của nó
   * (khác nét vẽ, nơi chỉ cần chép lại hình).
   */
  const applyEffectDab = useCallback(
    (x: number, y: number) => {
      const layer = activeLayerId ? getLayerCanvas(activeLayerId) : null;
      if (!layer) return;
      const points = symmetryTransforms(
        settings.symmetry,
        layer.width,
        layer.height,
      ).map((m) => transformSymmetryPoint({ x, y }, m));
      for (const p of points) effectDabAt(p.x, p.y);
    },
    [activeLayerId, getLayerCanvas, settings, effectDabAt],
  );

  /** Đang phun thì đổi công cụ / tháo hook phải dừng nhịp phun ngay. */
  useEffect(() => {
    if (tool !== "airbrush") stopSpray();
  }, [tool, stopSpray]);
  useEffect(() => () => stopSpray(), [stopSpray]);

  // ── Drawing event handlers ────────────────────────────────────────────────────

  const down = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!activePanel) return;

      const canvasEl = canvasRef.current;
      const parentEl = canvasEl?.parentElement;
      const rect = parentEl?.getBoundingClientRect();
      if (!canvasEl || !parentEl || !rect) return;
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // 0. Pan (công cụ pan hoặc giữ Space) — đổi khung nhìn, không đụng pixel
      if (tool === "pan" || spaceHeldRef.current) {
        e.preventDefault();
        isPanningRef.current = true;
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          panX: viewPanRef.current.x,
          panY: viewPanRef.current.y,
        };
        return;
      }

      // 0b. Công cụ Chọn: khoanh vùng không cần layer ghi được, nên xét trước cổng
      //     chặn (vẫn khoanh/copy được trên layer AI); chỉ lúc **dời** mới cần ghi.
      if (tool === "select") {
        const { x: selX, y: selY } = screenToArtwork(
          viewportRef.current,
          screenX,
          screenY,
        );
        selectPointerDown(selX, selY);
        return;
      }

      // Cổng chặn ghi vào layer (layer AI chỉ đọc / bị khoá / đang ẩn) — luôn nêu
      // đúng lý do thay vì thất bại im lặng (AC-T3.5).
      const blockReason = activeLayerBlockReason();
      if (blockReason) {
        showToast(blockReason);
        return;
      }

      // Mọi công cụ khác công cụ Chọn đều sửa layer → chốt bản dán đang bay
      // trước, nếu không lần vẽ lại sau sẽ ghi đè lên thay đổi mới.
      endFloat();

      const ctx = getCtx();
      if (!ctx) return;

      // Lưu ý: opacity/blend của layer được áp **lúc composite** (RC-4),
      // không nướng vào pixel → đổi opacity layer sau đó không mất nét.

      // Toạ độ artwork qua khung nhìn (3A): pan/zoom không đổi pixel dữ liệu.
      const { x: px, y: py } = screenToArtwork(
        viewportRef.current,
        screenX,
        screenY,
      );

      // 1. Bút lấy màu (BR-T09): chỉ đọc ảnh tổng hợp, không sửa layer
      if (tool === "eyedropper") {
        pickColorAt(px, py);
        return;
      }

      // 2. Công cụ đổ màu (Fill / Paint Bucket) — tôn trọng vùng chọn (BR-T10)
      if (tool === "fill") {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const mask = buildSelectionMask(w, h);
        const before = ctx.getImageData(0, 0, w, h);
        // Bản sao **trước khi đổ** → chỉ đẩy vào lịch sử nếu thật sự có pixel đổi
        const forHistory = new ImageData(
          new Uint8ClampedArray(before.data),
          w,
          h,
        );
        const painted = floodFillPixels(
          before.data,
          w,
          h,
          Math.floor(px),
          Math.floor(py),
          hexToRgba(color),
          { mask, tolerance: FLOOD_TOLERANCE },
        );
        if (painted === 0) {
          showToast(
            mask
              ? "Không đổ được: điểm bấm nằm ngoài vùng chọn hoặc vùng đã cùng màu."
              : "Không đổ được: vùng này đã cùng màu rồi.",
          );
          return;
        }
        pushHistory(forHistory);
        ctx.putImageData(before, 0, 0);
        compositeNow();
        return;
      }

      // 3. Công cụ kéo thả có xem trước: Hình / Đường-mũi tên / Đường cong /
      //    Chuyển sắc (BRD T-1 #6, #10, #11, #15). Layer được chụp lại một lần
      //    rồi mỗi lần di chuột vẽ lại từ ảnh chụp → hình không nhoè dần.
      if (DRAG_PREVIEW_TOOLS.includes(tool)) {
        snapshot();
        isDrawing.current = true;
        startPosRef.current = { x: px, y: py };
        previewSnapshotRef.current = ctx.getImageData(
          0,
          0,
          ctx.canvas.width,
          ctx.canvas.height,
        );
        return;
      }

      // 3b. Cọ phun (BRD T-1 #12): mực ra theo **nhịp**, nên giữ chuột đứng yên
      //     vẫn phun; đổi công cụ hoặc nhả chuột là dừng nhịp.
      if (tool === "airbrush") {
        const airBuffer = getStrokeBuffer();
        const airCtx = airBuffer?.getContext("2d");
        if (!airBuffer || !airCtx) return;
        snapshot();
        strokeBaseImageRef.current = ctx.getImageData(
          0,
          0,
          ctx.canvas.width,
          ctx.canvas.height,
        );
        airCtx.globalCompositeOperation = "source-over";
        airCtx.globalAlpha = 1;
        airCtx.clearRect(0, 0, airBuffer.width, airBuffer.height);
        isDrawing.current = true;
        stopSpray();
        sprayPointRef.current = { x: px, y: py };
        sprayOnce(px, py);
        sprayTimerRef.current = setInterval(() => {
          const p = sprayPointRef.current;
          if (p) sprayOnce(p.x, p.y);
        }, AIRBRUSH_TICK_MS);
        return;
      }

      // 3c. Làm mờ / Làm sắc nét (BRD T-1 #16): đọc pixel layer rồi ghi lại
      //     theo mặt nạ tròn, nên mỗi nhát là một lần xử lý thật (đi lại thì mờ thêm).
      if (tool === "effect") {
        snapshot();
        isDrawing.current = true;
        applyEffectDab(px, py);
        renderComposite();
        return;
      }

      // 4. Công cụ chèn chữ / lời thoại (Text)
      if (tool === "text") {
        // Ô nhập là CSS px màn hình — sẽ đổi sang toạ độ artwork lúc chèn chữ
        setTextInputPos({ x: screenX, y: screenY });
        setShowTextInput(true);
        return;
      }

      // 5. Các công cụ nét vẽ tự do (Bút, Cọ, Tẩy, Đối xứng)
      //    Nét tích vào bộ đệm rồi hợp nhất MỘT lần với `opacity` nét (AC-T2.6).
      //    Chốt lại danh sách công cụ để một công cụ mới quên xử lý ở trên không
      //    âm thầm vẽ ra nét (các công cụ khác đều đã `return` trước đó).
      if (!FREEHAND_TOOLS.includes(tool)) return;
      const buffer = getStrokeBuffer();
      const bufferCtx = buffer?.getContext("2d");
      if (!buffer || !bufferCtx) return;
      snapshot();
      strokeBaseImageRef.current = ctx.getImageData(
        0,
        0,
        ctx.canvas.width,
        ctx.canvas.height,
      );
      bufferCtx.globalCompositeOperation = "source-over";
      bufferCtx.clearRect(0, 0, buffer.width, buffer.height);
      // Cọ (và công cụ Đối xứng, vốn là cọ có trục gương) đậm dần theo `flow`
      bufferCtx.globalAlpha =
        tool === "brush" || tool === "symmetry" ? dabAlpha(settings.flow) : 1;
      bufferCtx.strokeStyle = tool === "eraser" ? "#000000" : color;
      bufferCtx.fillStyle = bufferCtx.strokeStyle;
      bufferCtx.lineWidth = settings.size;
      bufferCtx.lineCap = "round";
      bufferCtx.lineJoin = "round";
      strokeLastPointRef.current = { x: px, y: py };
      // Nhát đầu là một chấm tròn → nét hiện ngay khi vừa bấm, không phải kéo
      bufferCtx.beginPath();
      bufferCtx.arc(px, py, Math.max(0.5, settings.size / 2), 0, Math.PI * 2);
      bufferCtx.fill();
      isDrawing.current = true;
      paintStrokeBuffer();
    },
    [
      activePanel,
      getCtx,
      tool,
      color,
      settings,
      getStrokeBuffer,
      paintStrokeBuffer,
      snapshot,
      compositeNow,
      showToast,
      activeLayerBlockReason,
      selectPointerDown,
      pickColorAt,
      buildSelectionMask,
      pushHistory,
      endFloat,
      sprayOnce,
      stopSpray,
      applyEffectDab,
      renderComposite,
    ],
  );

  const move = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Pan đang diễn ra → chỉ dịch khung nhìn
      if (isPanningRef.current && panStartRef.current) {
        const start = panStartRef.current;
        setViewPan(
          clampCurrentPan(
            start.panX + (e.clientX - start.x),
            start.panY + (e.clientY - start.y),
            viewZoomRef.current,
          ),
        );
        return;
      }
      if (!isDrawing.current) return;
      const ctx = getCtx();
      const parent = canvasRef.current?.parentElement;
      if (!ctx || !parent) return;
      const rect = parent.getBoundingClientRect();
      const { x: curX, y: curY } = screenToArtwork(
        viewportRef.current,
        e.clientX - rect.left,
        e.clientY - rect.top,
      );

      // Công cụ Chọn: dời vùng chọn hoặc mở rộng vùng đang khoanh (AC-T3.1)
      if (tool === "select") {
        selectPointerMove(curX, curY);
        return;
      }

      // Làm mờ / Làm sắc nét: mỗi lần di chuột là một nhát xử lý pixel thật
      // (BRD T-1 #16) — đi qua đi lại thì vùng đó mờ (nét) thêm.
      if (tool === "effect") {
        applyEffectDab(curX, curY);
        renderComposite();
        return;
      }

      // Cọ phun: nhịp phun tự rắc mực, ở đây chỉ cập nhật điểm đang nhắm
      // (BRD T-1 #12).
      if (tool === "airbrush") {
        sprayPointRef.current = { x: curX, y: curY };
        return;
      }

      // Xem trước cú kéo: Hình / Đường-mũi tên / Đường cong / Chuyển sắc
      if (
        DRAG_PREVIEW_TOOLS.includes(tool) &&
        startPosRef.current &&
        previewSnapshotRef.current
      ) {
        ctx.putImageData(previewSnapshotRef.current, 0, 0);
        drawDragPreview(ctx, startPosRef.current, { x: curX, y: curY }, e.shiftKey);
        renderComposite();
        return;
      }

      // Nét vẽ tự do: tích vào bộ đệm (đã làm mượt — BR-T03) rồi vẽ lại preview
      const buffer = strokeBufferRef.current;
      const bufferCtx = buffer?.getContext("2d");
      const lastPoint = strokeLastPointRef.current;
      if (!buffer || !bufferCtx || !lastPoint) return;
      const nextPoint = smoothPoint(
        lastPoint,
        { x: curX, y: curY },
        settings.smoothing,
      );
      bufferCtx.globalCompositeOperation = "source-over";
      bufferCtx.globalAlpha =
        tool === "brush" || tool === "symmetry" ? dabAlpha(settings.flow) : 1;
      bufferCtx.strokeStyle = tool === "eraser" ? "#000000" : color;
      bufferCtx.lineWidth = settings.size;
      bufferCtx.lineCap = "round";
      bufferCtx.lineJoin = "round";
      bufferCtx.beginPath();
      bufferCtx.moveTo(lastPoint.x, lastPoint.y);
      bufferCtx.lineTo(nextPoint.x, nextPoint.y);
      bufferCtx.stroke();
      strokeLastPointRef.current = nextPoint;
      paintStrokeBuffer();
    },
    [
      getCtx,
      tool,
      color,
      settings,
      paintStrokeBuffer,
      renderComposite,
      clampCurrentPan,
      drawDragPreview,
      applyEffectDab,
      selectPointerMove,
    ],
  );

  const up = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current = null;
      return;
    }
    if (!isDrawing.current) return;
    isDrawing.current = false;
    startPosRef.current = null;
    previewSnapshotRef.current = null;
    // Cọ phun: nhả chuột là hết nhịp phun (BRD T-1 #12)
    stopSpray();
    // Công cụ Chọn: chốt vùng chọn / kết thúc một lần dời (AC-T3.1–T3.4)
    if (tool === "select") {
      selectPointerUp();
      return;
    }
    // Nét đã hợp nhất vào layer trong lúc vẽ → chỉ cần dọn bộ đệm.
    clearStrokeBuffer();
    const ctx = getCtx();
    if (ctx) {
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
    }
    compositeNow();
    setStrokeCount((n) => {
      const next = n + 1;
      if (next === 8 && !ghostType && activePanel) {
        setPanelSuggestPulse(true);
        if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = setTimeout(
          () => setPanelSuggestPulse(false),
          5000,
        );
      }
      return next;
    });
  }, [
    activePanel,
    getCtx,
    ghostType,
    compositeNow,
    clearStrokeBuffer,
    tool,
    selectPointerUp,
    stopSpray,
  ]);

  // ── AI actions ────────────────────────────────────────────────────────────────

  const runCompletion = useCallback(() => {
    setCompletionLoading(true);
    setCompletionReady(false);
    setAppliedCompletion(null);
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    completionTimerRef.current = setTimeout(() => {
      const totalPages = pages.length || 1;
      const currentPageNum = page || 1;
      const isStart = currentPageNum === 1;
      const isClimax = currentPageNum > 1 && currentPageNum < totalPages;

      const dynamicCompletions: PageCompletion[] = [
        {
          id: `dyn-kisho-${currentPageNum}`,
          name: isStart
            ? `Trang ${currentPageNum}/${totalPages} — Khởi (Thiết lập bối cảnh)`
            : isClimax
              ? `Trang ${currentPageNum}/${totalPages} — Thừa/Chuyển (Cao trào & Xung đột)`
              : `Trang ${currentPageNum}/${totalPages} — Hợp (Giải quyết & Chuyển tiếp)`,
          flow: isStart
            ? "Đại cảnh rộng → Giới thiệu nhân vật → Sự kiện khơi mào → Đẩy nhanh nhịp"
            : isClimax
              ? "Căng thẳng dồn dập → Va chạm bất ngờ → Đòn đánh cao trào → Dư chấn"
              : "Hậu quả đòn đánh → Biểu cảm lắng đọng → Hé lộ manh mối mới → Chuyển cảnh",
          hints: isStart
            ? [
                "Đại cảnh thiết lập không gian",
                "Nhân vật xuất hiện",
                "Cận cảnh phản ứng",
                "Khoảnh khắc kích hoạt câu chuyện",
              ]
            : isClimax
              ? [
                  "Xung đột bắt đầu",
                  "Góc nhìn kịch tính",
                  "Khung điểm nhấn bùng nổ",
                  "Phản ứng sau cao trào",
                ]
              : [
                  "Khung toàn cảnh dư âm",
                  "Cận cảnh nhân vật suy ngẫm",
                  "Gợi mở bí ẩn tiếp theo",
                  "Khung kết chuyển sang trang sau",
                ],
          compIds: ["aut-c1", "aut-c3", "aut-c2", "aut-c4"],
        },
        ...PAGE_COMPLETIONS[sceneType],
      ];

      setCompletions(dynamicCompletions);
      setCompletionLoading(false);
      setCompletionReady(true);
    }, 1200);
  }, [sceneType, page, pages.length]);

  const applyCompletion = useCallback(
    (c: PageCompletion) => {
      setAppliedCompletion(c.id);
      const hints: Record<string, string> = {};
      const comps: Record<string, string | null> = {};
      layout.panels.forEach((p, pi) => {
        if (p.id !== activePanel) {
          hints[p.id] = c.hints[pi] ?? "AI gợi ý";
          comps[p.id] = c.compIds[pi] ?? null;
        }
      });
      setPanelHints(hints);
      setPanelAutoComp(comps);
      showToast("Đã áp dụng gợi ý AI cho các khung trống");
    },
    [layout.panels, activePanel, showToast],
  );

  const dismissAnalysis = useCallback(() => {
    if (reviewAbortRef.current) {
      reviewAbortRef.current.abort();
      reviewAbortRef.current = null;
    }
    setShowAnalysis(false);
    setAnalyzing(false);
    setAnalysisError(null);
    setSelectedFindingIndex(null);
  }, []);

  const runAnalysis = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!activePanel || !canvas) {
      showToast("Vui lòng mở một khung truyện để phân tích nét vẽ.");
      return;
    }

    if (strokeCount === 0 && !userDrawingPrompt.trim()) {
      showToast("Vẽ nét phác thảo hoặc nhập ý tưởng muốn vẽ trước khi phân tích.");
      return;
    }

    const snapshotPayload = createCanvasSnapshot(canvas);
    if (!snapshotPayload) {
      showToast("Không thể tạo ảnh chụp canvas để gửi tới AI.");
      return;
    }

    if (reviewAbortRef.current) {
      reviewAbortRef.current.abort();
    }
    const abortController = new AbortController();
    reviewAbortRef.current = abortController;

    setAnalyzing(true);
    setShowAnalysis(true);
    setAnalysisError(null);
    setReviewResult(null);
    setSelectedFindingIndex(null);

    try {
      const result = await requestAiDrawingReview(
        authenticatedFetch,
        snapshotPayload,
        userDrawingPrompt.trim() || undefined,
        abortController.signal,
      );
      if (abortController.signal.aborted) return;
      setReviewResult(result);
      showToast("AI đã hoàn tất nhận xét bức vẽ!");
    } catch (err: unknown) {
      if (abortController.signal.aborted) return;
      const errorMsg =
        err instanceof Error ? err.message : "Không thể phân tích nét vẽ.";
      setAnalysisError(errorMsg);
    } finally {
      if (!abortController.signal.aborted) {
        setAnalyzing(false);
      }
    }
  }, [activePanel, authenticatedFetch, strokeCount, userDrawingPrompt, showToast]);

  const runTool = useCallback(
    async (toolId: string) => {
      if (!activePanel) {
        showToast("Hãy nhấn vào một khung để vẽ trước");
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const task = TOOL_TASK_MAP[toolId];
      if (!task) {
        showToast(`Công cụ "${toolId}" chưa được hỗ trợ`);
        return;
      }

      const snapshotPayload = createCanvasSnapshot(canvas);
      if (!snapshotPayload) {
        showToast("Không thể chụp canvas để gửi tới AI.");
        return;
      }

      // Hủy ghost stroke call đang chạy nếu có
      if (ghostAbortRef.current) {
        ghostAbortRef.current.abort();
      }
      const abortCtrl = new AbortController();
      ghostAbortRef.current = abortCtrl;

      const toolHint = TOOL_HINT_MAP[toolId] as
        | import("@/lib/ai-drawing-api").AiDrawingToolHint
        | undefined;
      const promptText = userDrawingPrompt.trim() || undefined;

      setProcessingTool(toolId);
      setGhostStrokes(null);
      setGhostStrokesSummary(null);

      try {
        const result = await requestAiGhostStrokes(
          authenticatedFetch,
          snapshotPayload,
          task,
          toolHint,
          promptText,
          abortCtrl.signal,
        );
        if (abortCtrl.signal.aborted) return;
        setGhostStrokes(result.strokes.length > 0 ? result.strokes : null);
        setGhostStrokesSummary(result.summary);
        if (result.strokes.length === 0) {
          showToast(`AI: ${result.summary}`);
        } else {
          showToast("Nét gợi ý AI đã hiện trên canvas");
        }
      } catch (err: unknown) {
        if (abortCtrl.signal.aborted) return;
        const msg =
          err instanceof Error
            ? err.message
            : "Không thể sinh nét gợi ý AI.";
        showToast(msg);
      } finally {
        if (!abortCtrl.signal.aborted) {
          setProcessingTool(null);
        }
      }
    },
    [showToast, activePanel, authenticatedFetch, userDrawingPrompt],
  );

  const clearAiSuggestions = useCallback(() => {
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
    if (toolTimerRef.current) clearTimeout(toolTimerRef.current);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    if (reviewAbortRef.current) {
      reviewAbortRef.current.abort();
      reviewAbortRef.current = null;
    }
    if (ghostAbortRef.current) {
      ghostAbortRef.current.abort();
      ghostAbortRef.current = null;
    }
    completionTimerRef.current = null;
    analysisTimerRef.current = null;
    toolTimerRef.current = null;
    pulseTimerRef.current = null;
    setPanelSuggestPulse(false);
    setCompletionLoading(false);
    setCompletionReady(false);
    setCompletions([]);
    setAppliedCompletion(null);
    setPanelHints({});
    setPanelAutoComp({});
    setAnalyzing(false);
    setAnalysisError(null);
    setReviewResult(null);
    setSelectedFindingIndex(null);
    setShowAnalysis(false);
    setProcessingTool(null);
    setGhostType(null);
    setGhostId(null);
    setGhostStrokes(null);
    setGhostStrokesSummary(null);
    setSelectedComp(null);
    setActiveGuides([]);
    setShowPanelSuggestions(false);
  }, []);

  const toggleGuide = useCallback((g: GuideId) => {
    setActiveGuides((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  }, []);

  const applyComp = useCallback(
    (id: string) => {
      setSelectedComp(id);
      // Gọi AI sinh nét gợi ý bố cục động dựa trên tranh hiện tại
      runTool("composition-overlay");
    },
    [runTool],
  );

  const applyPose = useCallback(
    (id: string) => {
      // Gọi AI sinh nét gợi ý dáng động dựa trên tranh hiện tại
      runTool("pose-guidance");
    },
    [runTool],
  );

  const enterPanel = useCallback(
    (panelId: string) => {
      if (reviewAbortRef.current) {
        reviewAbortRef.current.abort();
        reviewAbortRef.current = null;
      }
      if (ghostAbortRef.current) {
        ghostAbortRef.current.abort();
        ghostAbortRef.current = null;
      }
      // Khung chưa có ngăn xếp (lần đầu mở trong phiên) → tạo bộ layer mặc định
      setStacks((prev) =>
        prev[panelId]
          ? prev
          : { ...prev, [panelId]: createDefaultPanelStack(panelId) },
      );
      setActivePanel(panelId);
      setShowPanelSuggestions(false);
      setShowSuggestBtn(true);
      setShowAnalysis(false);
      setAnalyzing(false);
      setAnalysisError(null);
      setReviewResult(null);
      setSelectedFindingIndex(null);
      setGhostStrokes(null);
      setGhostStrokesSummary(null);
      historyRef.current = [];
      futureRef.current = [];
      // Vùng chọn gắn với từng khung → đổi khung thì bỏ chọn (như lịch sử undo)
      clearSelection();
      endFloat();
      const autoCompId = panelAutoComp[panelId];
      if (autoCompId) {
        setSelectedComp(autoCompId);
      }
    },
    [panelAutoComp, clearSelection, endFloat],
  );

  const exitPanel = useCallback(() => {
    if (reviewAbortRef.current) {
      reviewAbortRef.current.abort();
      reviewAbortRef.current = null;
    }
    if (ghostAbortRef.current) {
      ghostAbortRef.current.abort();
      ghostAbortRef.current = null;
    }
    setActivePanel(null);
    setShowPanelSuggestions(false);
    setShowSuggestBtn(true);
    setPanelFullscreen(false);
    setShowAnalysis(false);
    setAnalyzing(false);
    setAnalysisError(null);
    setReviewResult(null);
    setSelectedFindingIndex(null);
    setGhostStrokes(null);
    setGhostStrokesSummary(null);
    historyRef.current = [];
    futureRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      if (reviewAbortRef.current) {
        reviewAbortRef.current.abort();
      }
      if (ghostAbortRef.current) {
        ghostAbortRef.current.abort();
      }
    };
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────────

  /** Phóng/thu quanh tâm khung (nút −/+) — kẹp 10%–800% (BR-T06). */
  const zoomBy = useCallback((factor: number) => {
    setViewZoom((z) => clampScale(z * factor, MIN_ZOOM, MAX_ZOOM));
  }, []);

  /** Về khung vừa khít (zoom 100%, bỏ pan). */
  const resetView = useCallback(() => {
    setViewZoom(1);
    setViewPan({ x: 0, y: 0 });
  }, []);

  /**
   * Cỡ pixel thật của panel khi xuất PNG — chính là backing (`getPanelBackingSize`),
   * đúng bằng kích thước ảnh `exportCurrentPanel` tạo ra. Hiện ở chip zoom để
   * người dùng biết đâu là chuẩn xuất bản.
   */
  const panelBackingSize = activePanel
    ? getPanelBackingSize(layout, activePanel)
    : null;

  const panelDef = activePanel
    ? (layout.panels.find((p) => p.id === activePanel) ?? null)
    : null;
  const panelAspect = panelDef ? (panelDef.w / panelDef.h) * 0.75 : 0.75;

  return {
    // Canvas ref
    canvasRef,
    inputRef,
    /** Lớp phủ vẽ "marching ants" của vùng chọn (3C) */
    selectionOverlayRef,
    // Khung nhìn (3A — pan/zoom)
    zoom: viewZoom,
    zoomBy,
    resetView,
    panelBackingSize,
    // Drawing
    tool,
    setTool,
    size,
    setSize,
    /** Thuộc tính nét của công cụ đang chọn (3B) */
    settings,
    updateSettings,
    nudgeSize,
    color,
    setColor,
    // Pages
    page,
    setPage,
    pages,
    setPages,
    addPage,
    layout,
    setLayout,
    activePanel,
    panelData,
    // Right panel
    rightTab,
    setRightTab,
    // Ngăn xếp layer theo khung (spec 02 §2.2, §7)
    stacks,
    activeStack,
    layers,
    // Tool extensions
    shapeType,
    setShapeType,
    shapeFill,
    setShapeFill,
    /** Số cạnh đa giác / số cánh sao của công cụ Hình (Phase 3D) */
    shapeSides,
    setShapeSides,
    // Vùng chọn (3C — BR-T05, AC-T3.1–T3.4)
    selection,
    selectMode,
    setSelectMode,
    rotateSelection,
    flipSelection,
    scaleSelectionBy,
    invertSelection,
    deleteSelection,
    copySelection,
    pasteSelection,
    clearSelection,
    showTextInput,
    setShowTextInput,
    textInputPos,
    insertText,
    cancelText,
    canUndo,
    canRedo,
    isSaved,
    saveDraft,
    exportCurrentPanel,
    exportFullPage,
    // AI
    sceneType,
    setSceneType,
    activeGuides,
    selectedComp,
    setSelectedComp,
    poseCategory,
    setPoseCategory,
    // Layers
    activeLayerId,
    setActiveLayerId,
    toggleLayerVisibility,
    toggleLayerLock,
    setLayerOpacity,
    addLayer,
    removeLayer,
    reorderLayer,
    renameLayer,
    moveLayerTo,
    duplicateLayer,
    mergeLayerDown,
    getLayerThumbnail,
    // Collapsibles
    showCompSection,
    setShowCompSection,
    showPoseSection,
    setShowPoseSection,
    showGuideSection,
    setShowGuideSection,
    // Ghost overlay (AI dynamic strokes)
    ghostType,
    setGhostType,
    ghostId,
    setGhostId,
    ghostOpacity,
    setGhostOpacity,
    ghostStrokes,
    setGhostStrokes,
    ghostStrokesSummary,
    userDrawingPrompt,
    setUserDrawingPrompt,
    // Legacy placeholder compat
    drawingPlaceholder: null,
    setDrawingPlaceholder: () => {},
    // Completion
    completionLoading,
    completionReady,
    setCompletionReady,
    completions,
    appliedCompletion,
    setAppliedCompletion,
    panelHints,
    panelAutoComp,
    // Analysis & Review
    strokeCount,
    analyzing,
    analysisResult,
    analysisError,
    reviewResult,
    selectedFindingIndex,
    setSelectedFindingIndex,
    showAnalysis,
    dismissAnalysis,
    // Processing & toast
    processingTool,
    toast,
    // Suggestion widget
    showPanelSuggestions,
    setShowPanelSuggestions,
    panelSuggestPulse,
    showSuggestBtn,
    setShowSuggestBtn,
    // Fullscreen
    panelFullscreen,
    setPanelFullscreen,
    // Derived
    panelDef,
    panelAspect,
    // Handlers
    undo,
    redo,
    clearCanvas,
    down,
    move,
    up,
    runCompletion,
    applyCompletion,
    runAnalysis,
    runTool,
    toggleGuide,
    applyComp,
    applyPose,
    enterPanel,
    exitPanel,
    showToast,
    clearAiSuggestions,
  };
}
