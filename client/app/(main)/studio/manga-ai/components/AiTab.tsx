"use client";

import React from "react";
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
} from "lucide-react";
import { CompletionCard } from "./CompletionCard";
import { CompThumb, PoseThumb } from "./SvgComponent";
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
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-3 space-y-4">
        {/* 1. Scene type */}
        <div>
          <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2">
            Loại cảnh
          </p>
          <div className="flex gap-1">
            {(
              [
                ["action", <Zap size={12} />, "Hành động"],
                ["dialogue", <MessageCircle size={12} />, "Đối thoại"],
                ["landscape", <Mountain size={12} />, "Phong cảnh"],
                ["closeup", <User size={12} />, "Cận cảnh"],
                ["wide", <Maximize2 size={12} />, "Tổng thể"],
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
                className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[9px] transition-all ${
                  sceneType === type
                    ? "bg-pink-500/20 text-pink-400 ring-1 ring-pink-500/40"
                    : "text-white/30 hover:bg-white/5 hover:text-white/60"
                }`}
              >
                {icon}
                <span className="leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. User Prompt: Mô tả ý tưởng muốn vẽ (khi tranh chưa rõ ràng) */}
        <div className="space-y-1.5 bg-white/[0.03] border border-white/5 rounded-2xl p-3">
          <div className="flex items-center justify-between">
            <label className="text-white/60 text-[10px] font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={11} className="text-pink-400" /> Ý tưởng muốn vẽ (Prompt)
            </label>
            {userDrawingPrompt && (
              <button
                onClick={() => setUserDrawingPrompt?.("")}
                className="text-white/30 hover:text-white/70 text-[9px] transition-colors"
              >
                Xóa
              </button>
            )}
          </div>
          <textarea
            value={userDrawingPrompt ?? ""}
            onChange={(e) => setUserDrawingPrompt?.(e.target.value)}
            placeholder="Mô tả ý tưởng nếu nét vẽ còn thô (vd: nhân vật nữ vung kiếm nghiêng 45 độ, hiệu ứng chém gió mạnh, mắt nhìn thẳng...)"
            rows={2}
            className="w-full bg-[#0a0512] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white placeholder-white/20 resize-none focus:outline-none focus:border-pink-500/50 transition-colors"
          />
          <p className="text-[9px] text-white/30 leading-relaxed">
            💡 Khi hình vẽ chưa rõ ràng, AI sẽ kết hợp canvas cùng mô tả này để sinh nét gợi ý chuẩn xác nhất.
          </p>
        </div>

        {/* 3. Ghost strokes status card (nếu đang có nét gợi ý trên canvas) */}
        {ghostStrokes && ghostStrokes.length > 0 && (
          <div className="bg-purple-500/10 border border-purple-500/25 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-purple-300 text-xs font-semibold flex items-center gap-1.5">
                <Wand2 size={13} className="text-purple-400" /> Đang hiện {ghostStrokes.length} nét gợi ý AI
              </span>
              <button
                onClick={() => setGhostStrokes?.(null)}
                className="text-white/40 hover:text-white text-[10px] px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                Ẩn nét
              </button>
            </div>
            {ghostStrokesSummary && (
              <p className="text-purple-200/80 text-[10px] leading-relaxed italic bg-black/20 p-2 rounded-xl">
                {ghostStrokesSummary}
              </p>
            )}
            {ghostOpacity !== undefined && setGhostOpacity && (
              <div className="flex items-center gap-2 pt-1 border-t border-purple-500/15">
                <Sliders size={10} className="text-purple-400 flex-shrink-0" />
                <span className="text-white/40 text-[9px] flex-shrink-0">Độ mờ nét:</span>
                <input
                  type="range"
                  min={8}
                  max={80}
                  value={ghostOpacity}
                  onChange={(e) => setGhostOpacity(+e.target.value)}
                  className="flex-1 h-1 accent-purple-400"
                />
                <span className="text-purple-300 text-[9px] w-6 text-right">
                  {ghostOpacity}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* 4. AI Hoàn thiện trang */}
        <div className="space-y-2">
          <p className="text-white/30 text-[10px] uppercase tracking-widest flex items-center gap-1">
            <Wand2 size={10} className="text-purple-400" /> AI HOÀN THIỆN TRANG
          </p>

          <button
            onClick={runCompletion}
            disabled={strokeCount === 0 || completionLoading}
            className={`w-full py-3 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              strokeCount > 0
                ? "bg-gradient-to-r from-pink-200 to-white hover:from-pink-100 hover:to-white text-rose-950 shadow-lg shadow-pink-300/30"
                : "bg-gradient-to-r from-pink-200/20 to-white/20 text-white/30 cursor-not-allowed"
            }`}
          >
            {completionLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <RefreshCw size={15} />
              </motion.div>
            ) : (
              <Wand2 size={15} />
            )}
            {completionLoading
              ? "AI đang phân tích..."
              : "AI gợi ý hoàn thiện trang"}
          </button>

          {strokeCount === 0 && (
            <p className="text-white/20 text-[10px] text-center">
              Vẽ nét đầu tiên để bật tính năng
            </p>
          )}

          {completionLoading && (
            <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-purple-500"
                initial={{ width: "0%" }}
                animate={{ width: "90%" }}
                transition={{ duration: 1.8 }}
              />
            </div>
          )}

          <AnimatePresence>
            {completionReady && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-2">
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

          {appliedCompletion && (
            <div className="flex items-start gap-2 bg-purple-500/10 border border-purple-500/20 rounded-xl p-2.5">
              <Bot size={12} className="text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-purple-300 text-[10px] leading-relaxed">
                Về trang → mỗi khung trống hiện gợi ý AI. Nhấn vào khung để vẽ.
              </p>
            </div>
          )}
        </div>

        {/* 5. Công cụ AI sinh nét mờ động */}
        <div className="space-y-2">
          <p className="text-white/30 text-[10px] uppercase tracking-widest flex items-center gap-1">
            <Zap size={10} className="text-yellow-400" /> CÔNG CỤ AI VẼ (DYNAMIC GHOST)
          </p>

          <button
            onClick={runAnalysis}
            disabled={processingTool !== null || analyzing}
            className="w-full py-2.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 text-pink-400 text-xs font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {analyzing ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <RefreshCw size={13} />
              </motion.div>
            ) : (
              <BarChart2 size={13} />
            )}
            Phân tích bức vẽ & chỉ chỗ lệch
          </button>

          <div className="space-y-1.5">
            {AI_TOOLS.map((t) => {
              const isProcessing = processingTool === t.id;
              return (
                <motion.div
                  key={t.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => runTool(t.id)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    isProcessing
                      ? "bg-purple-500/20 border-purple-400 shadow-md ring-1 ring-purple-400/40"
                      : "bg-white/[0.03] border-white/5 hover:bg-white/5 hover:border-white/10"
                  } ${
                    processingTool && !isProcessing
                      ? "opacity-40 cursor-not-allowed"
                      : ""
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#0a0512] border border-white/10 flex items-center justify-center flex-shrink-0">
                    {TOOL_ICONS[t.id] ?? <Wand2 size={15} className="text-purple-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.dot}`} />
                      <span className="text-white text-xs font-medium truncate">
                        {t.label}
                      </span>
                    </div>
                    <p className="text-white/40 leading-tight text-[10px] truncate">
                      {t.desc}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {isProcessing ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        className="text-purple-400"
                      >
                        <RefreshCw size={13} />
                      </motion.div>
                    ) : (
                      <ChevronRight size={13} className="text-white/20" />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* 6. Bố cục gợi ý (AI động) */}
        <div className="border border-white/5 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowCompSection((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-white/40 hover:text-white/70 transition-colors"
          >
            <span className="text-[10px] uppercase tracking-widest font-medium flex items-center gap-1.5">
              <Grid3x3 size={10} /> BỐ CỤC GỢI Ý (AI PHÂN TÍCH)
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
                  <p className="text-[9px] text-white/30 italic">
                    Nhấn để AI phân tích tranh hiện tại và sinh các đường dẫn mắt & khung gợi ý mờ:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {COMP_SUGGESTIONS[sceneType].map((c) => (
                      <button
                        key={c.id}
                        onClick={() => applyComp(c.id)}
                        disabled={processingTool !== null}
                        className={`rounded-xl overflow-hidden border p-2 text-left transition-all ${
                          selectedComp === c.id
                            ? "border-purple-400 bg-purple-500/10 ring-1 ring-purple-500/40"
                            : "border-white/10 hover:border-white/20 bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-white truncate">
                            {c.name}
                          </span>
                          <Sparkles size={10} className="text-purple-400 flex-shrink-0" />
                        </div>
                        <p className="text-[9px] text-white/40 leading-tight">
                          {c.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 7. Tư thế tham chiếu (AI phân tích dáng) */}
        <div className="border border-white/5 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowPoseSection((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-white/40 hover:text-white/70 transition-colors"
          >
            <span className="text-[10px] uppercase tracking-widest font-medium flex items-center gap-1.5">
              <PersonStanding size={10} /> TƯ THẾ THAM CHIẾU (AI DÁNG)
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
                  <p className="text-[9px] text-white/30 italic">
                    Chọn nhóm tư thế rồi nhấn để AI gợi ý tỷ lệ khung xương trên tranh:
                  </p>
                  <div className="flex gap-1">
                    {(
                      [
                        ["stand", <PersonStanding size={11} />, "Đứng"],
                        ["sit", <User size={11} />, "Ngồi"],
                        ["action", <Dumbbell size={11} />, "Động tác"],
                        ["emotion", <Smile size={11} />, "Cảm xúc"],
                      ] as [PoseCategory, React.ReactNode, string][]
                    ).map(([cat, icon, label]) => (
                      <button
                        key={cat}
                        onClick={() => setPoseCategory(cat)}
                        className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[9px] transition-all ${
                          poseCategory === cat
                            ? "bg-purple-500/20 text-purple-400"
                            : "bg-white/5 text-white/40 hover:text-white/60"
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
                        disabled={processingTool !== null}
                        className="rounded-xl border border-white/10 hover:border-purple-400/50 p-2 text-center bg-white/[0.02] hover:bg-purple-500/10 transition-all"
                      >
                        <p className="text-[10px] text-white font-medium truncate">
                          {pose.label}
                        </p>
                        <span className="text-[8px] text-purple-400">Gợi ý AI</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 8. Lưới hướng dẫn */}
        <div className="border border-white/5 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowGuideSection((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-white/40 hover:text-white/70 transition-colors"
          >
            <span className="text-[10px] uppercase tracking-widest font-medium flex items-center gap-1.5">
              <Grid3x3 size={10} /> LƯỚI HƯỚNG DẪN
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
                <div className="p-3 pt-0 space-y-1.5">
                  {GUIDE_CONFIG.map((g: (typeof GUIDE_CONFIG)[number]) => (
                    <button
                      key={g.id}
                      onClick={() => toggleGuide(g.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all ${
                        activeGuides.includes(g.id)
                          ? "bg-white/5 border border-white/10"
                          : "border border-transparent hover:bg-white/[0.03]"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${GUIDE_DOT[g.id]}`}
                      />
                      <span
                        className={
                          activeGuides.includes(g.id) ? g.color : "text-white/50"
                        }
                      >
                        {g.label}
                      </span>
                      {activeGuides.includes(g.id) && (
                        <Check size={10} className="ml-auto text-green-400" />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
