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
  mergeDownInList,
  moveLayerInList,
  moveLayerToIndex,
} from "../lib/layerOps";
import { dabAlpha, hardnessBlurRadius, smoothPoint } from "../lib/stroke";
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

export const TOOL_NAMES: Record<DrawTool, string> = {
  pen: "Bút vẽ",
  brush: "Cọ",
  eraser: "Tẩy",
  fill: "Đổ màu",
  select: "Chọn",
  shape: "Hình",
  text: "Chữ",
  pan: "Di chuyển",
};

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

/** Thuật toán Flood Fill (BFS) đổ màu liên tục trên canvas */
function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillRgba: [number, number, number, number],
  tolerance = 36,
) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const startIdx = (startY * width + startX) * 4;
  const startR = data[startIdx];
  const startG = data[startIdx + 1];
  const startB = data[startIdx + 2];
  const startA = data[startIdx + 3];

  // Nếu điểm click đã trùng màu đổ thì bỏ qua
  if (
    Math.abs(startR - fillRgba[0]) < 6 &&
    Math.abs(startG - fillRgba[1]) < 6 &&
    Math.abs(startB - fillRgba[2]) < 6 &&
    Math.abs(startA - fillRgba[3]) < 6
  ) {
    return;
  }

  function matchesStart(idx: number): boolean {
    const dr = Math.abs(data[idx] - startR);
    const dg = Math.abs(data[idx + 1] - startG);
    const db = Math.abs(data[idx + 2] - startB);
    const da = Math.abs(data[idx + 3] - startA);
    return dr <= tolerance && dg <= tolerance && db <= tolerance && da <= tolerance;
  }

  const visited = new Uint8Array(width * height);
  const queue: number[] = [startX + startY * width];
  visited[startX + startY * width] = 1;

  while (queue.length > 0) {
    const pos = queue.pop()!;
    const px = pos % width;
    const py = Math.floor(pos / width);
    const idx = (py * width + px) * 4;

    data[idx] = fillRgba[0];
    data[idx + 1] = fillRgba[1];
    data[idx + 2] = fillRgba[2];
    data[idx + 3] = fillRgba[3];

    // 4 hướng lân cận
    const neighbors = [
      [px + 1, py],
      [px - 1, py],
      [px, py + 1],
      [px, py - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const npos = nx + ny * width;
        if (!visited[npos]) {
          visited[npos] = 1;
          const nidx = (ny * width + nx) * 4;
          if (matchesStart(nidx)) {
            queue.push(npos);
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
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
  const [shapeType, setShapeType] = useState<"rect" | "circle" | "line">("rect");
  const [shapeFill, setShapeFill] = useState(false);

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
    [activeLayerId, updateActiveLayers, setActiveLayerId, showToast],
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
    ctx.drawImage(buffer, 0, 0);

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
   * Ghi lại bitmap của layer đang chọn **trước khi thay đổi nó**
   * (gọi ở đầu mỗi thao tác) → 1 lần Ctrl+Z hoàn nguyên đúng 1 thao tác,
   * không ảnh hưởng layer khác (BR-T08).
   */
  const snapshot = useCallback(() => {
    const layerCanvas = activeLayerId ? getLayerCanvas(activeLayerId) : null;
    if (!layerCanvas) return;
    const ctx = layerCanvas.getContext("2d");
    if (!ctx) return;
    historyRef.current = [
      ...historyRef.current.slice(-19),
      {
        layerId: activeLayerId,
        data: ctx.getImageData(0, 0, layerCanvas.width, layerCanvas.height),
      },
    ];
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
    setIsSaved(false);
  }, [activeLayerId, getLayerCanvas]);

  /** Hoàn nguyên 1 bước: trả bitmap về đúng layer mà thao tác đó đã sửa. */
  const undo = useCallback(() => {
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
  }, [getLayerCanvas, compositeNow]);

  /** Làm lại bước vừa bị undo. */
  const redo = useCallback(() => {
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
  }, [getLayerCanvas, compositeNow]);

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

  // Phím tắt bàn phím (Ctrl+Z, Ctrl+Y, Ctrl+S)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveDraft();
      } else if (!e.ctrlKey && !e.metaKey && (e.key === "[" || e.key === "]")) {
        // AC-T2.4: [ ] đổi size ±2, Shift ±10
        const target = e.target as HTMLElement | null;
        const typing =
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable);
        if (typing) return;
        e.preventDefault();
        const step = (e.shiftKey ? 10 : 2) * (e.key === "]" ? 1 : -1);
        nudgeSize(step);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, saveDraft, nudgeSize]);

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

    viewportRef.current = { scale, tx, ty };
  }, [activePanel, layout]);

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

      const currentLayer = layers.find((l) => l.id === activeLayerId);
      if (currentLayer?.kind === "ai" || currentLayer?.readOnly) {
        showToast(
          `Layer "${currentLayer?.name}" là layer AI — chỉ đọc, hãy chọn layer khác để vẽ!`,
        );
        return;
      }
      if (currentLayer?.locked) {
        showToast(`Layer "${currentLayer.name}" đang bị khóa, hãy mở khóa để vẽ!`);
        return;
      }
      if (currentLayer && !currentLayer.visible) {
        showToast(`Layer "${currentLayer.name}" đang bị ẩn!`);
        return;
      }

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

      // 1. Công cụ đổ màu (Fill / Paint Bucket)
      if (tool === "fill") {
        snapshot();
        floodFill(ctx, Math.floor(px), Math.floor(py), hexToRgba(color));
        compositeNow();
        return;
      }

      // 2. Công cụ hình học (Shape)
      if (tool === "shape") {
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

      // 3. Công cụ chèn chữ / lời thoại (Text)
      if (tool === "text") {
        // Ô nhập là CSS px màn hình — sẽ đổi sang toạ độ artwork lúc chèn chữ
        setTextInputPos({ x: screenX, y: screenY });
        setShowTextInput(true);
        return;
      }

      // 4. Các công cụ nét vẽ tự do (Pen, Brush, Eraser)
      //    Nét tích vào bộ đệm rồi hợp nhất MỘT lần với `opacity` nét (AC-T2.6).
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
      bufferCtx.globalAlpha = tool === "brush" ? dabAlpha(settings.flow) : 1;
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
      layers,
      activeLayerId,
      showToast,
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

      // Xử lý preview kéo thả hình học (Rubber-band preview)
      if (tool === "shape" && startPosRef.current && previewSnapshotRef.current) {
        ctx.putImageData(previewSnapshotRef.current, 0, 0);
        const sx = startPosRef.current.x;
        const sy = startPosRef.current.y;
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.globalAlpha = settings.opacity / 100;
        ctx.lineWidth = settings.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (shapeType === "rect") {
          const rx = Math.min(sx, curX);
          const ry = Math.min(sy, curY);
          const rw = Math.abs(curX - sx);
          const rh = Math.abs(curY - sy);
          if (shapeFill) ctx.fillRect(rx, ry, rw, rh);
          ctx.strokeRect(rx, ry, rw, rh);
        } else if (shapeType === "circle") {
          const rx = Math.min(sx, curX);
          const ry = Math.min(sy, curY);
          const rw = Math.abs(curX - sx);
          const rh = Math.abs(curY - sy);
          ctx.beginPath();
          ctx.ellipse(
            rx + rw / 2,
            ry + rh / 2,
            Math.max(1, rw / 2),
            Math.max(1, rh / 2),
            0,
            0,
            Math.PI * 2,
          );
          if (shapeFill) ctx.fill();
          ctx.stroke();
        } else if (shapeType === "line") {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(curX, curY);
          ctx.stroke();
        }
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
      bufferCtx.globalAlpha = tool === "brush" ? dabAlpha(settings.flow) : 1;
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
      shapeType,
      shapeFill,
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
  }, [activePanel, getCtx, ghostType, compositeNow, clearStrokeBuffer]);

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
      const autoCompId = panelAutoComp[panelId];
      if (autoCompId) {
        setSelectedComp(autoCompId);
      }
    },
    [panelAutoComp],
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
