"use client";

import React, { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart2,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Grid3x3,
  Maximize2,
  MessageCircle,
  Mountain,
  PenTool,
  PersonStanding,
  RefreshCw,
  Sliders,
  Smile,
  Sparkles,
  User,
  Wand2,
  Zap,
  Info,
  Layers,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { CompletionCard } from "./CompletionCard";
import { GUIDE_CONFIG, GUIDE_DOT } from "../hooks/useDrawStudio";
import {
  AI_TOOLS,
  COMP_SUGGESTIONS,
  POSES,
  type GuideId,
  type LayoutDef,
  type PageCompletion,
  type PoseCategory,
  type SceneType,
} from "../data";
import type { AiStrokePath } from "@/lib/ai-drawing-api";

type Props = {
  sceneType: SceneType;
  setSceneType: (t: SceneType) => void;
  setCompletionReady: (v: boolean) => void;
  setAppliedCompletion: (v: string | null) => void;
  runCompletion: () => void;
  strokeCount: number;
  completionLoading: boolean;
  completionReady: boolean;
  completions: PageCompletion[];
  layout: LayoutDef;
  activePanel: string | null;
  appliedCompletion: string | null;
  applyCompletion: (c: PageCompletion) => void;
  runAnalysis: () => void;
  processingTool: string | null;
  analyzing: boolean;
  runTool: (id: string) => void;
  showCompSection: boolean;
  setShowCompSection: React.Dispatch<React.SetStateAction<boolean>>;
  applyComp: (id: string) => void;
  selectedComp: string | null;
  showPoseSection: boolean;
  setShowPoseSection: React.Dispatch<React.SetStateAction<boolean>>;
  poseCategory: PoseCategory;
  setPoseCategory: (cat: PoseCategory) => void;
  applyPose: (id: string) => void;
  ghostType: "comp" | "pose" | null;
  ghostId: string | null;
  ghostOpacity?: number;
  setGhostOpacity?: (v: number) => void;
  ghostStrokes?: AiStrokePath[] | null;
  setGhostStrokes?: (v: AiStrokePath[] | null) => void;
  ghostStrokesSummary?: string | null;
  userDrawingPrompt?: string;
  setUserDrawingPrompt?: (v: string) => void;
  showGuideSection: boolean;
  setShowGuideSection: React.Dispatch<React.SetStateAction<boolean>>;
  toggleGuide: (g: GuideId) => void;
  activeGuides: GuideId[];
};

const TOOL_ICONS: Record<string, React.ReactNode> = {
  "clean-lines": <PenTool size={15} className="text-indigo-400" />,
  "screentone": <Grid3x3 size={15} className="text-sky-400" />,
  "speech-bubble": <MessageCircle size={15} className="text-pink-400" />,
  "speed-lines": <Zap size={15} className="text-emerald-400" />,
  "fix-comp": <Maximize2 size={15} className="text-amber-400" />,
};

// Thông tin chi tiết và gợi ý riêng cho từng loại cảnh
const SCENE_METADATA: Record<
  SceneType,
  {
    title: string;
    description: string;
    badge: string;
    accentColor: string;
    presets: string[];
  }
> = {
  auto: {
    title: "AI Tự Phân Tích (Thông Minh)",
    description: "AI tự động phân tích nét vẽ & mô tả ý tưởng để tự động xác định thể loại và sinh nét phác thảo phù hợp nhất.",
    badge: "Tự động • Đa thể loại",
    accentColor: "from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-300",
    presets: [
      "Nhân vật nữ vung kiếm nghiêng 45 độ, hiệu ứng chém gió",
      "Hai nhân vật đối thoại cự ly gần căng thẳng",
      "Khung cảnh thành phố góc nhìn từ trên cao xuống",
      "Cận cảnh ánh mắt sắc bén sẵn sàng chiến đấu",
    ],
  },
  action: {
    title: "Cảnh Hành Động (Action)",
    description: "Tập trung đường nét tốc độ (speed lines), góc nghiêng kịch tính & tương phản lực đánh mạnh.",
    badge: "Kịch tính • Năng lượng",
    accentColor: "from-amber-500/20 to-pink-500/20 border-amber-500/30 text-amber-300",
    presets: [
      "Nhân vật vung kiếm chém ngang tạo vệt sáng",
      "Cú đấm bật lùi tạo sóng xung kích nổ",
      "Tư thế né đòn lộn nhào trên không",
      "Hiệu ứng speed lines và bụi đất bùng nổ",
    ],
  },
  dialogue: {
    title: "Cảnh Đối Thoại (Dialogue)",
    description: "Tập trung phân bổ vị trí bong bóng thoại cân xứng, góc nhìn qua vai (OTS) & bắt trọn ánh mắt.",
    badge: "Tâm lý • Giao tiếp",
    accentColor: "from-sky-500/20 to-purple-500/20 border-sky-500/30 text-sky-300",
    presets: [
      "Hai nhân vật đối mặt cự ly gần căng thẳng",
      "Góc nhìn qua vai khi đang trò chuyện",
      "Biểu cảm bất ngờ mở to mắt khi nghe bí mật",
      "Khoanh tay đứng trầm ngâm suy nghĩ",
    ],
  },
  landscape: {
    title: "Cảnh Phong Cảnh (Landscape)",
    description: "Tập trung phân lớp tiền - trung - hậu cảnh, đường chân trời rộng & phối cảnh điểm tụ sâu.",
    badge: "Không gian • Chiều sâu",
    accentColor: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-300",
    presets: [
      "Đường chân trời hoàng hôn góc nhìn toàn cảnh",
      "Cổng thành cổ kính nhìn hất từ dưới lên",
      "Khu phố tấp nập có điểm tụ phối cảnh 1 điểm",
      "Khu rừng rậm rạp phân lớp tiền cảnh - hậu cảnh",
    ],
  },
  closeup: {
    title: "Cảnh Cận Cảnh (Closeup)",
    description: "Tập trung khắc họa cảm xúc ánh mắt, khóe môi, giọt mồ hôi & đổ bóng vi khuôn mặt nhân vật.",
    badge: "Cảm xúc • Vi chi tiết",
    accentColor: "from-rose-500/20 to-pink-500/20 border-rose-500/30 text-rose-300",
    presets: [
      "Ánh mắt sắc lạnh đầy kiên định quyết tâm",
      "Góc nghiêng 3/4 nụ cười mỉm bí hiểm",
      "Biểu cảm bi thương giọt lệ lăn trên má",
      "Khuôn mặt thở dốc mồ hôi sau trận chiến",
    ],
  },
  wide: {
    title: "Cảnh Tổng Thể (Wide)",
    description: "Nhấn mạnh tương phản kích thước nhân vật so với đại cảnh, bố cục 1/3 & sự kỳ vĩ của thế giới.",
    badge: "Đại cảnh • Kỳ vĩ",
    accentColor: "from-indigo-500/20 to-purple-500/20 border-indigo-500/30 text-indigo-300",
    presets: [
      "Nhân vật đứng cô độc giữa quảng trường lớn",
      "Toàn cảnh chiến trường hoang tàn đổ nát",
      "Góc chim nhìn từ trên cao xuống thành phố",
      "Đoàn thám hiểm tiến vào hẻm núi hiểm trở",
    ],
  },
};

export function AiTab({
  sceneType,
  setSceneType,
  setCompletionReady,
  setAppliedCompletion,
  runCompletion,
  strokeCount,
  completionLoading,
  completionReady,
  completions,
  layout,
  activePanel,
  appliedCompletion,
  applyCompletion,
  runAnalysis,
  processingTool,
  analyzing,
  runTool,
  showCompSection,
  setShowCompSection,
  applyComp,
  selectedComp,
  showPoseSection,
  setShowPoseSection,
  poseCategory,
  setPoseCategory,
  applyPose,
  ghostType,
  ghostId,
  ghostOpacity,
  setGhostOpacity,
  ghostStrokes,
  setGhostStrokes,
  ghostStrokesSummary,
  userDrawingPrompt,
  setUserDrawingPrompt,
  showGuideSection,
  setShowGuideSection,
  toggleGuide,
  activeGuides,
}: Props) {
  const currentScene = SCENE_METADATA[sceneType];
  const isWorking = processingTool !== null || analyzing || completionLoading;

  return (
    <div className="flex-1 overflow-y-auto bg-[#120a1f] text-white">
      <div className="p-3.5 space-y-4">
        {/* 1. Chọn Loại Cảnh (Scene Type Selector) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/40 text-[10px] uppercase tracking-wider font-semibold">
              Loại Cảnh Manga
            </span>
            <span className="text-[10px] text-pink-400 font-medium">
              {currentScene.badge}
            </span>
          </div>

          <div className="grid grid-cols-6 gap-1 bg-white/[0.03] p-1 rounded-2xl border border-white/5">
            {(
              [
                ["auto", <Bot size={13} />, "Tự động"],
                ["action", <Zap size={13} />, "Hành động"],
                ["dialogue", <MessageCircle size={13} />, "Đối thoại"],
                ["landscape", <Mountain size={13} />, "Phong cảnh"],
                ["closeup", <User size={13} />, "Cận cảnh"],
                ["wide", <Maximize2 size={13} />, "Tổng thể"],
              ] as [SceneType, React.ReactNode, string][]
            ).map(([type, icon, label]) => (
              <button
                key={type}
                onClick={() => {
                  setSceneType(type);
                  setCompletionReady(false);
                  setAppliedCompletion(null);
                }}
                title={label}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[9px] font-medium transition-all ${
                  sceneType === type
                    ? "bg-gradient-to-b from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/20"
                    : "text-white/40 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                {icon}
                <span className="leading-none truncate w-full text-center">{label}</span>
              </button>
            ))}
          </div>

          {/* Banner Kim chỉ nam cho loại cảnh đang chọn */}
          <div className={`mt-2 p-2.5 rounded-xl border bg-gradient-to-r ${currentScene.accentColor} flex items-start gap-2`}>
            <Info size={13} className="flex-shrink-0 mt-0.5 opacity-80" />
            <div className="text-[10px] leading-relaxed">
              <strong className="block font-semibold mb-0.5">{currentScene.title}</strong>
              <span className="opacity-80">{currentScene.description}</span>
            </div>
          </div>
        </div>

        {/* 2. Mục Prompt Ý Tưởng Muốn Vẽ & Các Nút Thực Thi */}
        <div className="space-y-2.5 bg-white/[0.03] border border-white/10 rounded-2xl p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <label className="text-white/80 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={12} className="text-pink-400" />
              Ý Tưởng Muốn Vẽ (User Prompt)
            </label>
            {userDrawingPrompt && (
              <button
                onClick={() => setUserDrawingPrompt?.("")}
                className="text-white/40 hover:text-white text-[10px] transition-colors"
              >
                Xóa chữ
              </button>
            )}
          </div>

          <textarea
            value={userDrawingPrompt ?? ""}
            onChange={(e) => setUserDrawingPrompt?.(e.target.value)}
            placeholder={`Mô tả ý tưởng muốn vẽ (vd: ${currentScene.presets[0]}... AI sẽ phác thảo ngay cả từ trang trắng)`}
            rows={2}
            className="w-full bg-[#0a0512] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/25 resize-none focus:outline-none focus:border-pink-500/60 focus:ring-1 focus:ring-pink-500/30 transition-all"
          />

          {/* Gợi ý mẫu nhanh theo loại cảnh */}
          <div>
            <span className="text-[9px] text-white/40 block mb-1">
              Gợi ý ý tưởng nhanh cho {currentScene.title.split("(")[0]}:
            </span>
            <div className="flex flex-wrap gap-1">
              {currentScene.presets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setUserDrawingPrompt?.(preset)}
                  className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-pink-500/20 hover:text-pink-200 border border-white/5 text-[9px] text-white/60 transition-colors text-left"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Trạng thái nhắc nhở nếu chưa chọn panel */}
          {!activePanel && (
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2 text-amber-200 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 animate-ping" />
              <span>Hãy nhấn vào một khung tranh trên trang để kích hoạt tính năng AI</span>
            </div>
          )}

          {/* CÁC NÚT BẤM THỰC THI TÍNH NĂNG THEO PROMPT */}
          <div className="pt-1 space-y-1.5">
            <button
              onClick={() => runTool("clean-lines")}
              disabled={isWorking || !activePanel}
              className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md ${
                !isWorking && activePanel
                  ? "bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white shadow-pink-500/20 active:scale-[0.99]"
                  : "bg-white/5 text-white/30 border border-white/5 cursor-not-allowed"
              }`}
            >
              {processingTool === "clean-lines" ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <RefreshCw size={14} />
                </motion.div>
              ) : (
                <Wand2 size={14} className="text-pink-300" />
              )}
              <span>{processingTool === "clean-lines" ? "AI đang sinh nét gợi ý..." : "AI Tạo Nét Gợi Ý Từ Ý Tưởng"}</span>
            </button>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => runTool("composition-overlay")}
                disabled={isWorking || !activePanel}
                className="py-1.5 px-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-200 text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
              >
                {processingTool === "composition-overlay" ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    <RefreshCw size={11} />
                  </motion.div>
                ) : (
                  <Grid3x3 size={11} />
                )}
                <span>Gợi ý Bố cục</span>
              </button>

              <button
                onClick={() => runTool("pose-guidance")}
                disabled={isWorking || !activePanel}
                className="py-1.5 px-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-200 text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
              >
                {processingTool === "pose-guidance" ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    <RefreshCw size={11} />
                  </motion.div>
                ) : (
                  <PersonStanding size={11} />
                )}
                <span>Gợi ý Dáng vẽ</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Thẻ Trạng Thái Ghost Strokes (khi đang hiện nét mờ) */}
        {ghostStrokes && ghostStrokes.length > 0 && (
          <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-3 space-y-2 shadow-lg shadow-purple-900/10">
            <div className="flex items-center justify-between">
              <span className="text-purple-200 text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-400" />
                Đang hiển thị {ghostStrokes.length} nét gợi ý AI
              </span>
              <button
                onClick={() => setGhostStrokes?.(null)}
                className="text-white/50 hover:text-white text-[10px] px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors font-medium"
              >
                Ẩn nét
              </button>
            </div>

            {ghostStrokesSummary && (
              <p className="text-purple-100 text-[10px] leading-relaxed italic bg-black/30 p-2.5 rounded-xl border border-white/5">
                "{ghostStrokesSummary}"
              </p>
            )}

            {ghostOpacity !== undefined && setGhostOpacity && (
              <div className="flex items-center gap-2 pt-1 border-t border-purple-500/20">
                <Sliders size={11} className="text-purple-300 flex-shrink-0" />
                <span className="text-white/50 text-[9px] flex-shrink-0">Độ đậm nét:</span>
                <input
                  type="range"
                  min={10}
                  max={80}
                  value={ghostOpacity}
                  onChange={(e) => setGhostOpacity(Number(e.target.value))}
                  className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
                <span className="text-white/60 text-[9px] font-mono w-6 text-right">
                  {ghostOpacity}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* 4. Bộ Công Cụ AI Vẽ Từng Phần (Dynamic Ghost Tools) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-white/40 text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1">
              <Zap size={11} className="text-yellow-400" />
              Công Cụ Vẽ Hỗ Trợ AI
            </span>
          </div>

          <button
            onClick={runAnalysis}
            disabled={isWorking || !activePanel}
            className="w-full py-2 px-3 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/25 text-pink-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
          >
            {analyzing ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                <RefreshCw size={13} />
              </motion.div>
            ) : (
              <BarChart2 size={13} />
            )}
            <span>Phân Tích Nét Vẽ & Chỉ Lỗi Lệch</span>
          </button>

          <div className="grid grid-cols-1 gap-1.5">
            {AI_TOOLS.map((t) => {
              const isProcessing = processingTool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => runTool(t.id)}
                  disabled={isWorking || !activePanel}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all ${
                    isProcessing
                      ? "bg-purple-500/25 border-purple-400 ring-1 ring-purple-400/50"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10"
                  } ${!activePanel ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#0a0512] border border-white/10 flex items-center justify-center flex-shrink-0">
                    {TOOL_ICONS[t.id] ?? <Wand2 size={14} className="text-purple-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white text-xs font-medium truncate">{t.label}</span>
                    </div>
                    <p className="text-white/40 text-[9px] leading-tight truncate">{t.desc}</p>
                  </div>
                  {isProcessing ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                      <RefreshCw size={12} className="text-purple-400" />
                    </motion.div>
                  ) : (
                    <ChevronRight size={12} className="text-white/20" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Bố Cục Gợi Ý Động (Theo đúng SceneType đang chọn) */}
        <div className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
          <button
            onClick={() => setShowCompSection((v) => !v)}
            className="w-full flex items-center justify-between p-3 text-white/60 hover:text-white transition-colors"
          >
            <span className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5">
              <Grid3x3 size={11} className="text-purple-400" />
              Bố Cục Gợi Ý Cho: {currentScene.title.split("(")[0]}
            </span>
            {showCompSection ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>

          <AnimatePresence>
            {showCompSection && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 pt-0 space-y-2">
                  <p className="text-[9px] text-white/40">
                    Chọn bố cục tương ứng với thể loại để AI sinh đường dẫn mắt:
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {COMP_SUGGESTIONS[sceneType].map((c) => (
                      <button
                        key={c.id}
                        onClick={() => applyComp(c.id)}
                        disabled={isWorking || !activePanel}
                        className={`rounded-xl border p-2 text-left transition-all ${
                          selectedComp === c.id
                            ? "border-purple-400 bg-purple-500/15 ring-1 ring-purple-500/40"
                            : "border-white/10 hover:border-white/20 bg-white/[0.02]"
                        } ${!activePanel ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-semibold text-white truncate">{c.name}</span>
                          <Sparkles size={10} className="text-purple-400" />
                        </div>
                        <p className="text-[9px] text-white/40 leading-tight">{c.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 6. Tư Thế Tham Chiếu (AI Phân Tích Dáng) */}
        <div className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
          <button
            onClick={() => setShowPoseSection((v) => !v)}
            className="w-full flex items-center justify-between p-3 text-white/60 hover:text-white transition-colors"
          >
            <span className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5">
              <PersonStanding size={11} className="text-pink-400" />
              Tư Thế Tham Chiếu Dáng Vẽ
            </span>
            {showPoseSection ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>

          <AnimatePresence>
            {showPoseSection && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 pt-0 space-y-2">
                  <button
                    onClick={() => applyPose("auto")}
                    disabled={isWorking || !activePanel}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-500/25 to-purple-500/25 hover:from-indigo-500/35 hover:to-purple-500/35 border border-indigo-500/40 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-40"
                  >
                    {processingTool === "pose-guidance" ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                        <RefreshCw size={13} />
                      </motion.div>
                    ) : (
                      <Sparkles size={13} className="text-pink-300" />
                    )}
                    <span>AI Nhận Diện Nhân Vật & Sinh Khung Xương</span>
                  </button>

                  <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
                    {(
                      [
                        ["stand", <PersonStanding size={11} />, "Đứng"],
                        ["sit", <User size={11} />, "Ngồi"],
                        ["action", <Dumbbell size={11} />, "Hành động"],
                        ["emotion", <Smile size={11} />, "Cảm xúc"],
                      ] as [PoseCategory, React.ReactNode, string][]
                    ).map(([cat, icon, label]) => (
                      <button
                        key={cat}
                        onClick={() => setPoseCategory(cat)}
                        className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[9px] font-medium transition-all ${
                          poseCategory === cat
                            ? "bg-purple-500/30 text-purple-300 font-bold"
                            : "text-white/40 hover:text-white"
                        }`}
                      >
                        {icon}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {POSES[poseCategory].map((pose) => (
                      <button
                        key={pose.id}
                        onClick={() => applyPose(pose.id)}
                        disabled={isWorking || !activePanel}
                        className="rounded-xl border border-white/10 hover:border-pink-500/40 p-2 text-center bg-white/[0.02] hover:bg-pink-500/10 transition-all disabled:opacity-50"
                      >
                        <p className="text-[10px] text-white font-medium truncate">{pose.label}</p>
                        <span className="text-[8px] text-pink-400 block mt-0.5">+ AI Dáng</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 7. AI Gợi Ý Hoàn Thiện Toàn Trang (Full Page Flow) */}
        <div className="space-y-2 bg-gradient-to-br from-purple-950/20 to-black p-3 rounded-2xl border border-white/5">
          <span className="text-white/40 text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5">
            <Layers size={11} className="text-purple-400" />
            AI Hoàn Thiện Mạch Truyện Cả Trang
          </span>

          <button
            onClick={runCompletion}
            disabled={completionLoading}
            className="w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-md shadow-purple-500/20 active:scale-[0.99] disabled:opacity-50"
          >
            {completionLoading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                <RefreshCw size={13} />
              </motion.div>
            ) : (
              <Wand2 size={13} />
            )}
            <span>{completionLoading ? "AI đang tính mạch truyện theo ngữ cảnh..." : "Gợi Ý Kịch Bản Toàn Trang (Xuyên Suốt)"}</span>
          </button>

          <AnimatePresence>
            {completionReady && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {completions.map((c) => (
                    <CompletionCard
                      key={c.id}
                      completion={c}
                      layout={layout}
                      activePanel={activePanel}
                      applied={appliedCompletion === c.id}
                      onApply={() => applyCompletion(c)}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 8. Đường Dẫn Hướng Cố Định (Guides) */}
        <div className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
          <button
            onClick={() => setShowGuideSection((v) => !v)}
            className="w-full flex items-center justify-between p-3 text-white/60 hover:text-white transition-colors"
          >
            <span className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5">
              <Grid3x3 size={11} />
              Đường Dóng Bố Cục Cơ Bản
            </span>
            {showGuideSection ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>

          <AnimatePresence>
            {showGuideSection && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 pt-0 grid grid-cols-2 gap-1.5">
                  {GUIDE_CONFIG.map((g) => {
                    const isActive = activeGuides.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        onClick={() => toggleGuide(g.id)}
                        className={`p-2 rounded-xl border text-left text-xs font-medium flex items-center gap-2 transition-all ${
                          isActive
                            ? "border-pink-500/50 bg-pink-500/10 text-white"
                            : "border-white/5 bg-white/[0.02] text-white/40 hover:text-white/70"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${GUIDE_DOT[g.id]}`} />
                        <span className="text-[10px] truncate">{g.label}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
