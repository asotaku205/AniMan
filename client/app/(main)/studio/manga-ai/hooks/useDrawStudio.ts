"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AI_TOOLS,
  COMP_SUGGESTIONS,
  LAYOUTS,
  PAGE_COMPLETIONS,
  type DrawTool,
  type DrawingPlaceholderId,
  type GuideId,
  type LayoutDef,
  type LayerItem,
  type PageCompletion,
  type PoseCategory,
  type SceneType,
} from "../data";

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

const DRAWING_PLACEHOLDER_IDS: DrawingPlaceholderId[] = [
  "clean-lines",
  "screentone",
  "speech-bubble",
  "speed-lines",
];

function isDrawingPlaceholderId(id: string): id is DrawingPlaceholderId {
  return DRAWING_PLACEHOLDER_IDS.includes(id as DrawingPlaceholderId);
}

// ─── Hook return type ──────────────────────────────────────────────────────────

export type DrawStudioState = ReturnType<typeof useDrawStudio>;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDrawStudio() {
  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<ImageData[]>([]);
  const futureRef = useRef<ImageData[]>([]);
  const isDrawing = useRef(false);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drawing state
  const [tool, setTool] = useState<DrawTool>("pen");
  const [size, setSize] = useState(4);
  const [color, setColor] = useState("#111111");

  // Pages / panels
  const [page, setPage] = useState(1);
  const [layout, setLayout] = useState<LayoutDef>(LAYOUTS[0]);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [panelData, setPanelData] = useState<Record<string, string>>({});

  // Right panel
  const [rightTab, setRightTab] = useState<"ai" | "layout" | "layers">("ai");
  const [layers, setLayers] = useState<LayerItem[]>([
    { id: "l1", name: "Sketch", visible: true, locked: false },
    { id: "l2", name: "Ink", visible: true, locked: false },
    { id: "l3", name: "Tone", visible: true, locked: false },
    { id: "l4", name: "Text", visible: true, locked: false },
  ]);

  // AI / scene
  const [sceneType, setSceneType] = useState<SceneType>("action");
  const [activeGuides, setActiveGuides] = useState<GuideId[]>([]);
  const [selectedComp, setSelectedComp] = useState<string | null>(null);
  const [poseCategory, setPoseCategory] = useState<PoseCategory>("stand");

  // Collapsibles
  const [showCompSection, setShowCompSection] = useState(true);
  const [showPoseSection, setShowPoseSection] = useState(false);
  const [showGuideSection, setShowGuideSection] = useState(false);

  // Ghost overlay
  const [ghostType, setGhostType] = useState<"comp" | "pose" | null>(null);
  const [ghostId, setGhostId] = useState<string | null>(null);
  const [ghostOpacity, setGhostOpacity] = useState(28);
  const [drawingPlaceholder, setDrawingPlaceholder] =
    useState<DrawingPlaceholderId | null>(null);

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
  const [strokeCount, setStrokeCount] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    score: number;
    items: string[];
  } | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

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


  // ESC exits fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Canvas helpers ────────────────────────────────────────────────────────────

  const getCtx = useCallback(
    () => canvasRef.current?.getContext("2d") ?? null,
    [],
  );

  const snapshot = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    historyRef.current = [
      ...historyRef.current.slice(-19),
      ctx.getImageData(0, 0, canvas.width, canvas.height),
    ];
    futureRef.current = [];
    if (activePanel)
      setPanelData((prev) => ({ ...prev, [activePanel]: canvas.toDataURL() }));
  }, [getCtx, activePanel]);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx || historyRef.current.length === 0) return;
    futureRef.current = [
      ...futureRef.current,
      ctx.getImageData(0, 0, canvas.width, canvas.height),
    ];
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    ctx.putImageData(prev, 0, 0);
    if (activePanel)
      setPanelData((d) => ({ ...d, [activePanel]: canvas.toDataURL() }));
  }, [getCtx, activePanel]);

  const redo = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx || futureRef.current.length === 0) return;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    historyRef.current = [
      ...historyRef.current,
      ctx.getImageData(0, 0, canvas.width, canvas.height),
    ];
    ctx.putImageData(next, 0, 0);
    if (activePanel)
      setPanelData((d) => ({ ...d, [activePanel]: canvas.toDataURL() }));
  }, [getCtx, activePanel]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    snapshot();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (activePanel) setPanelData((d) => ({ ...d, [activePanel]: "" }));
  }, [getCtx, snapshot, activePanel]);

  // Resize canvas on panel change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activePanel) return;
    const ro = new ResizeObserver(() => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const ctx = canvas.getContext("2d");
      canvas.width = rect.width;
      canvas.height = rect.height;
      const saved = panelData[activePanel];
      if (saved && ctx) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = saved;
      }
      historyRef.current = [];
      futureRef.current = [];
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel]);

  // ── Drawing event handlers ────────────────────────────────────────────────────

  const down = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!activePanel) return;
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx) return;
      isDrawing.current = true;
      const rect = canvas.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
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
    [activePanel, getCtx, tool, color, size],
  );

  const move = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current) return;
      const ctx = getCtx();
      const canvas = canvasRef.current;
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
    },
    [getCtx],
  );

  const up = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const ctx = getCtx();
    if (ctx) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
    }
    snapshot();
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
  }, [activePanel, getCtx, ghostType, snapshot]);

  // ── AI actions ────────────────────────────────────────────────────────────────

  const runCompletion = useCallback(() => {
    setCompletionLoading(true);
    setCompletionReady(false);
    setAppliedCompletion(null);
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    completionTimerRef.current = setTimeout(() => {
      setCompletions(PAGE_COMPLETIONS[sceneType]);
      setCompletionLoading(false);
      setCompletionReady(true);
    }, 2000);
  }, [sceneType]);

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

  const runAnalysis = useCallback(() => {
    setAnalyzing(true);
    setShowAnalysis(false);
    if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
    analysisTimerRef.current = setTimeout(() => {
      setAnalyzing(false);
      setAnalysisResult({
        score: 78,
        items: [
          "Bố cục cân bằng tốt",
          "Thiếu điểm nhấn chính",
          "Nên thêm đường dẫn mắt",
          "Tỷ lệ nhân vật hợp lý",
        ],
      });
      setShowAnalysis(true);
    }, 2200);
  }, []);

  const runTool = useCallback(
    (toolId: string) => {
      if (!activePanel) {
        showToast("Hãy nhấn vào một khung để vẽ trước");
        return;
      }
      setProcessingTool(toolId);
      if (toolTimerRef.current) clearTimeout(toolTimerRef.current);
      toolTimerRef.current = setTimeout(() => {
        setProcessingTool(null);
        if (toolId === "fix-comp") {
          setDrawingPlaceholder(null);
          const suggestions = COMP_SUGGESTIONS[sceneType];
          const pick =
            suggestions[Math.floor(Math.random() * suggestions.length)];
          setSelectedComp(pick.id);
          setGhostType("comp");
          setGhostId(pick.id);
          setActiveGuides((prev) => [...new Set([...prev, ...pick.guides])]);
          showToast(`Gợi ý bố cục "${pick.name}" đã hiện trên canvas`);
        } else if (isDrawingPlaceholderId(toolId)) {
          setDrawingPlaceholder(toolId);
          showToast(
            `Đã hiện nét gợi ý: ${AI_TOOLS.find((t) => t.id === toolId)?.label}`,
          );
        } else {
          setDrawingPlaceholder(null);
          showToast(
            `Đã áp dụng: ${AI_TOOLS.find((t) => t.id === toolId)?.label}`,
          );
        }
      }, 1800);
    },
    [showToast, activePanel, sceneType],
  );

  const clearAiSuggestions = useCallback(() => {
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
    if (toolTimerRef.current) clearTimeout(toolTimerRef.current);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
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
    setAnalysisResult(null);
    setShowAnalysis(false);
    setProcessingTool(null);
    setGhostType(null);
    setGhostId(null);
    setDrawingPlaceholder(null);
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
      if (selectedComp === id) {
        setSelectedComp(null);
        setGhostType(null);
        setGhostId(null);
      } else {
        setSelectedComp(id);
        setDrawingPlaceholder(null);
        setGhostType("comp");
        setGhostId(id);
        const comp = Object.values(COMP_SUGGESTIONS)
          .flat()
          .find((c) => c.id === id);
        if (comp?.guides.length)
          setActiveGuides((prev) => [...new Set([...prev, ...comp.guides])]);
      }
    },
    [selectedComp],
  );

  const applyPose = useCallback(
    (id: string) => {
      if (ghostId === id && ghostType === "pose") {
        setGhostType(null);
        setGhostId(null);
      } else {
        setDrawingPlaceholder(null);
        setGhostType("pose");
        setGhostId(id);
      }
    },
    [ghostId, ghostType],
  );

  const enterPanel = useCallback(
    (panelId: string) => {
      setActivePanel(panelId);
      setShowPanelSuggestions(false);
      setShowSuggestBtn(true);
      setShowAnalysis(false);
      setAnalysisResult(null);
      historyRef.current = [];
      futureRef.current = [];
      const autoCompId = panelAutoComp[panelId];
      if (autoCompId) {
        setSelectedComp(autoCompId);
        setGhostType("comp");
        setGhostId(autoCompId);
      }
    },
    [panelAutoComp],
  );

  const exitPanel = useCallback(() => {
    setActivePanel(null);
    setShowPanelSuggestions(false);
    setShowSuggestBtn(true);
    setPanelFullscreen(false);
    setShowAnalysis(false);
    historyRef.current = [];
    futureRef.current = [];
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────────

  const panelDef = activePanel
    ? (layout.panels.find((p) => p.id === activePanel) ?? null)
    : null;
  const panelAspect = panelDef ? (panelDef.w / panelDef.h) * 0.75 : 0.75;

  return {
    // Canvas ref
    canvasRef,
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
    layout,
    setLayout,
    activePanel,
    panelData,
    // Right panel
    rightTab,
    setRightTab,
    layers,
    setLayers,
    // AI
    sceneType,
    setSceneType,
    activeGuides,
    selectedComp,
    setSelectedComp,
    poseCategory,
    setPoseCategory,
    // Collapsibles
    showCompSection,
    setShowCompSection,
    showPoseSection,
    setShowPoseSection,
    showGuideSection,
    setShowGuideSection,
    // Ghost
    ghostType,
    setGhostType,
    ghostId,
    setGhostId,
    ghostOpacity,
    setGhostOpacity,
    drawingPlaceholder,
    setDrawingPlaceholder,
    // Completion
    completionLoading,
    completionReady,
    setCompletionReady,
    completions,
    appliedCompletion,
    setAppliedCompletion,
    panelHints,
    panelAutoComp,
    // Analysis
    strokeCount,
    analyzing,
    analysisResult,
    showAnalysis,
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
