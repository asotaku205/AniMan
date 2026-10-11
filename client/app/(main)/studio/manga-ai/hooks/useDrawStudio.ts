"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AI_TOOLS,
  COMP_SUGGESTIONS,
  LAYOUTS,
  PAGE_COMPLETIONS,
  createUserLayer,
  type DrawTool,
  type GuideId,
  type LayoutDef,
  type LayerItem,
  type PageCompletion,
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
import { getPageDrawingFromDB, savePageDrawingToDB } from "../lib/mangaStorage";
import { buildCompositePlan, compositeTo } from "../lib/layerEngine";

// ─── Derived constants (stable — defined outside hook) ────────────────────────

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
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drawing state
  const [tool, setTool] = useState<DrawTool>("pen");
  const [size, setSize] = useState(4);
  const [color, setColor] = useState("#111111");

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
  const [layers, setLayers] = useState<LayerItem[]>(() => [
    createUserLayer("Sketch (Phác thảo)", { id: "l1" }),
    createUserLayer("Ink (Đi nét)", { id: "l2" }),
    createUserLayer("Tone (Đổ bóng)", { id: "l3" }),
    createUserLayer("Text (Thoại)", { id: "l4" }),
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>("l1");

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

  const toggleLayerVisibility = useCallback((id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
    );
  }, []);

  const toggleLayerLock = useCallback((id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)),
    );
  }, []);

  const setLayerOpacity = useCallback((id: string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, opacity: Math.max(0, Math.min(100, Math.round(opacity))) }
          : l,
      ),
    );
  }, []);

  /** Mirror `layers` để `addLayer` lấy được số lượng hiện tại mà không cần updater hàm */
  const layersRef = useRef<LayerItem[]>(layers);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);
  /** Mirror `panelData` cho effect resize/nạp ảnh (tránh dependency vòng) */
  const panelDataRef = useRef(panelData);
  useEffect(() => {
    panelDataRef.current = panelData;
  }, [panelData]);

  const addLayer = useCallback(
    (name?: string) => {
      const layer = createUserLayer(
        name?.trim() || `Layer ${layersRef.current.length + 1}`,
      );
      setLayers((prev) => [layer, ...prev]);
      setActiveLayerId(layer.id);
      showToast("Đã tạo layer mới!");
    },
    [showToast],
  );

  const removeLayer = useCallback(
    (id: string) => {
      setLayers((prev) => {
        if (prev.length <= 1) {
          showToast("Phải giữ lại ít nhất 1 layer!");
          return prev;
        }
        const next = prev.filter((l) => l.id !== id);
        if (activeLayerId === id && next.length > 0) {
          setActiveLayerId(next[0].id);
        }
        showToast("Đã xóa layer!");
        return next;
      });
      // Giải phóng bitmap của layer vừa xóa (mọi panel)
      for (const key of [...layerCanvasesRef.current.keys()]) {
        if (key.endsWith(`::${id}`)) layerCanvasesRef.current.delete(key);
      }
    },
    [activeLayerId, showToast],
  );

  const reorderLayer = useCallback((id: string, direction: "up" | "down") => {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx === -1) return prev;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, moved);
      return copy;
    });
  }, []);

  const renameLayer = useCallback((id: string, newName: string) => {
    if (!newName.trim()) return;
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, name: newName.trim() } : l)),
    );
  }, []);


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

  const syncToStorage = useCallback(
    (data: Record<string, string>, targetPage: number) => {
      if (!projectId) return;
      savePageDrawingToDB(projectId, targetPage, data, layout.id);
      setIsSaved(true);
      if (onSavePageData) {
        onSavePageData(targetPage, layout.id, data);
      }
    },
    [projectId, layout.id, onSavePageData],
  );

  const saveDraft = useCallback(() => {
    if (!projectId) return;
    savePageDrawingToDB(projectId, page, panelData, layout.id);
    setIsSaved(true);
    if (onSavePageData) {
      onSavePageData(page, layout.id, panelData);
    }
    showToast("Đã lưu tiến độ tranh vào IndexedDB!");
  }, [projectId, page, panelData, layout.id, onSavePageData, showToast]);

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
   * Tự đổi kích thước kèm canvas hiển thị và **giữ lại nội dung** cũ.
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
        if (layerCanvas) {
          next
            .getContext("2d")
            ?.drawImage(layerCanvas, 0, 0, next.width, next.height);
        }
        layerCanvas = next;
        layerCanvasesRef.current.set(key, layerCanvas);
      }
      return layerCanvas;
    },
    [activePanel],
  );

  /**
   * Render các layer lên canvas hiển thị rồi lưu bitmap phẳng của panel
   * (`panelData[panelId]`) — trang xem trước và xuất file dùng bản này.
   * Nét AI không nằm trong đây (C2: xuất trang không kèm nét AI).
   */
  const compositeNow = useCallback(() => {
    const display = canvasRef.current;
    if (!display || !activePanel) return;
    compositeTo(display, buildCompositePlan(layers, layerCanvasesRef.current), {
      background: "#ffffff",
      width: display.width,
      height: display.height,
    });
    const dataUrl = display.toDataURL();
    setPanelData((prev) => {
      const next = { ...prev, [activePanel]: dataUrl };
      setTimeout(() => syncToStorage(next, page), 0);
      return next;
    });
  }, [layers, activePanel, page, syncToStorage]);

  /**
   * Nạp dữ liệu trang mới xong → dọn bitmap layer của trang cũ và (nếu panel
   * đang mở) ghi bitmap đã lưu vào layer dưới đáy rồi render lại.
   * Gọi từ callback async của effect nạp dữ liệu — không set state trong effect.
   */
  const resyncLayersWithData = useCallback(
    (data: Record<string, string>) => {
      layerCanvasesRef.current.clear();
      historyRef.current = [];
      futureRef.current = [];
      if (!activePanel) return;
      const saved = data[activePanel];
      const bottomId = layersRef.current[layersRef.current.length - 1]?.id;
      if (bottomId && saved) {
        const layerCanvas = getLayerCanvas(bottomId);
        if (layerCanvas) {
          const img = new Image();
          img.onload = () => {
            layerCanvas
              .getContext("2d")
              ?.drawImage(img, 0, 0, layerCanvas.width, layerCanvas.height);
            compositeNow();
          };
          img.src = saved;
          return;
        }
      }
      // Không có dữ liệu đã lưu cho panel này → xóa trắng canvas hiển thị
      const display = canvasRef.current;
      const ctx = display?.getContext("2d");
      if (display && ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, display.width, display.height);
      }
    },
    [activePanel, getLayerCanvas, compositeNow],
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
      layerCanvasesRef.current.clear();
      historyRef.current = [];
      futureRef.current = [];
      return;
    }
    let isCancelled = false;
    async function loadData() {
      try {
        const loaded = await getPageDrawingFromDB(projectId!, page);
        if (isCancelled) return;
        const data = loaded || {};
        setPanelData(data);
        setIsSaved(true);
        // Dữ liệu trang mới đã có → đồng bộ bitmap layer với dữ liệu này
        resyncLayersWithData(data);
      } catch {
        if (!isCancelled) {
          setPanelData({});
        }
      }
    }
    loadData();
    return () => {
      isCancelled = true;
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, saveDraft]);

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
      ctx.font = `${Math.max(14, size * 3.5)}px "Comic Sans MS", "Arial", sans-serif`;
      ctx.fillStyle = color;
      ctx.textBaseline = "middle";
      ctx.fillText(text, textInputPos.x, textInputPos.y);
      compositeNow();
      setShowTextInput(false);
      setTextInputPos(null);
      showToast("Đã thêm lời thoại!");
    },
    [getCtx, textInputPos, size, color, snapshot, compositeNow, showToast],
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

  // Đổi kích thước canvas theo panel & nạp bitmap đã lưu vào layer dưới đáy (RC-1)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activePanel) return;

    let loadingSaved = false;
    const applyLayout = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect || rect.width < 1) return;
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Lịch sử undo gắn theo panel → reset khi đổi panel
      historyRef.current = [];
      futureRef.current = [];
      setCanUndo(false);
      setCanRedo(false);

      // Panel chưa từng mở trong phiên này → nạp bitmap đã lưu
      // vào layer dưới đáy (Phase 2 sẽ lưu pixel theo từng layer).
      const bottomId = layersRef.current[layersRef.current.length - 1]?.id;
      const saved = panelDataRef.current[activePanel];
      if (bottomId && saved && !layerCanvasesRef.current.has(`${activePanel}::${bottomId}`)) {
        const layerCanvas = getLayerCanvas(bottomId);
        if (layerCanvas) {
          loadingSaved = true;
          const img = new Image();
          img.onload = () => {
            layerCanvas
              .getContext("2d")
              ?.drawImage(img, 0, 0, layerCanvas.width, layerCanvas.height);
            loadingSaved = false;
            compositeNow();
          };
          img.onerror = () => {
            loadingSaved = false;
          };
          img.src = saved;
          return;
        }
      }
      compositeNow();
    };

    applyLayout();
    const ro = new ResizeObserver(() => {
      if (!loadingSaved) applyLayout();
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel]);

  // ── Drawing event handlers ────────────────────────────────────────────────────

  const down = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!activePanel) return;

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

      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx) return;

      // Lưu ý: opacity/blend của layer được áp **lúc composite** (RC-4),
      // không nướng vào pixel → đổi opacity layer sau đó không mất nét.

      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

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
          canvas.width,
          canvas.height,
        );
        return;
      }

      // 3. Công cụ chèn chữ / lời thoại (Text)
      if (tool === "text") {
        setTextInputPos({ x: px, y: py });
        setShowTextInput(true);
        return;
      }

      // 4. Các công cụ nét vẽ tự do (Pen, Brush, Eraser)
      snapshot();
      isDrawing.current = true;
      ctx.beginPath();
      ctx.moveTo(px, py);
      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = size * 4;
      } else if (tool === "brush") {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.lineWidth = size * 2;
        ctx.globalAlpha = 0.5;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.globalAlpha = 1;
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    },
    [activePanel, getCtx, tool, color, size, snapshot, compositeNow, layers, activeLayerId, showToast],
  );

  const move = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current) return;
      const ctx = getCtx();
      const canvas = canvasRef.current;
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;

      // Xử lý preview kéo thả hình học (Rubber-band preview)
      if (tool === "shape" && startPosRef.current && previewSnapshotRef.current) {
        ctx.putImageData(previewSnapshotRef.current, 0, 0);
        const sx = startPosRef.current.x;
        const sy = startPosRef.current.y;
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = size;
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
        compositeNow();
        return;
      }

      // Xử lý nét vẽ tự do
      ctx.lineTo(curX, curY);
      ctx.stroke();
      compositeNow();
    },
    [getCtx, tool, color, size, shapeType, shapeFill, compositeNow],
  );

  const up = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    startPosRef.current = null;
    previewSnapshotRef.current = null;
    const ctx = getCtx();
    if (ctx) {
      ctx.globalAlpha = 1;
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
  }, [activePanel, getCtx, ghostType, compositeNow]);

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

  const panelDef = activePanel
    ? (layout.panels.find((p) => p.id === activePanel) ?? null)
    : null;
  const panelAspect = panelDef ? (panelDef.w / panelDef.h) * 0.75 : 0.75;

  return {
    // Canvas ref
    canvasRef,
    inputRef,
    // Drawing
    tool,
    setTool,
    size,
    setSize,
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
    layers,
    setLayers,
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
