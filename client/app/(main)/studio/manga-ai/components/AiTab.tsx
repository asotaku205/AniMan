"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart2, Bot, Check, ChevronDown, ChevronRight,
  Dumbbell, Grid3x3, Maximize2, MessageCircle, Mountain,
  PersonStanding, RefreshCw, Smile, User, Wand2, Zap,
} from "lucide-react";
import { CompletionCard } from "./CompletionCard";
import { AiToolPreview, CompThumb, PoseThumb } from "./SvgComponent";
import {
  GUIDE_CONFIG, GUIDE_DOT,
} from "../hooks/useDrawStudio";
import {
  AI_TOOLS, COMP_SUGGESTIONS, POSES,
  type GuideId, type LayoutDef, type PageCompletion,
  type PoseCategory, type SceneType,
} from "../data";

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
  showGuideSection: boolean;
  setShowGuideSection: React.Dispatch<React.SetStateAction<boolean>>;
  toggleGuide: (g: GuideId) => void;
  activeGuides: GuideId[];
};

export function AiTab({
  sceneType, setSceneType, setCompletionReady, setAppliedCompletion,
  runCompletion, strokeCount, completionLoading, completionReady,
  completions, layout, activePanel, appliedCompletion, applyCompletion,
  runAnalysis, processingTool, analyzing, runTool,
  showCompSection, setShowCompSection, applyComp, selectedComp,
  showPoseSection, setShowPoseSection, poseCategory, setPoseCategory, applyPose,
  ghostType, ghostId, showGuideSection, setShowGuideSection, toggleGuide, activeGuides,
}: Props) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-3 space-y-4">
        {/* 1. Scene type */}
        <div>
          <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2">Loại cảnh</p>
          <div className="flex gap-1">
            {([
              ["action",    <Zap size={12}/>,          "Hành động"],
              ["dialogue",  <MessageCircle size={12}/>, "Đối thoại"],
              ["landscape", <Mountain size={12}/>,      "Phong cảnh"],
              ["closeup",   <User size={12}/>,          "Cận cảnh"],
              ["wide",      <Maximize2 size={12}/>,     "Tổng thể"],
            ] as [SceneType, React.ReactNode, string][]).map(([type, icon, label]) => (
              <button key={type} onClick={() => { setSceneType(type); setCompletionReady(false); setAppliedCompletion(null); }}
                title={label}
                className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[9px] transition-all ${
                  sceneType === type
                    ? "bg-pink-500/20 text-pink-400 ring-1 ring-pink-500/40"
                    : "text-white/30 hover:bg-white/5 hover:text-white/60"
                }`}>
                {icon}
                <span className="leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. AI Hoàn thiện trang */}
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
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                <RefreshCw size={15} />
              </motion.div>
            ) : <Wand2 size={15} />}
            {completionLoading ? "AI đang phân tích..." : "AI gợi ý hoàn thiện trang"}
          </button>

          {strokeCount === 0 && (
            <p className="text-white/20 text-[10px] text-center">Vẽ nét đầu tiên để bật tính năng</p>
          )}

          {completionLoading && (
            <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div className="h-full bg-purple-500" initial={{ width: "0%" }} animate={{ width: "90%" }} transition={{ duration: 1.8 }} />
            </div>
          )}

          <AnimatePresence>
            {completionReady && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-2 gap-2">
                  {completions.map(c => (
                    <CompletionCard key={c.id} completion={c} layout={layout} activePanel={activePanel}
                      applied={appliedCompletion === c.id} onApply={() => applyCompletion(c)} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {appliedCompletion && (
            <div className="flex items-start gap-2 bg-purple-500/10 border border-purple-500/20 rounded-xl p-2.5">
              <Bot size={12} className="text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-purple-300 text-[10px] leading-relaxed">Về trang → mỗi khung trống hiện gợi ý AI. Nhấn vào khung để vẽ.</p>
            </div>
          )}
        </div>

        {/* 3. Công cụ AI nhanh */}
        <div className="space-y-2">
          <p className="text-white/30 text-[10px] uppercase tracking-widest flex items-center gap-1">
            <Zap size={10} className="text-yellow-400" /> CÔNG CỤ AI NHANH
          </p>

          <button onClick={runAnalysis} disabled={processingTool !== null || analyzing}
            className="w-full py-2 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 text-pink-400 text-xs font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50">
            {analyzing
              ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><RefreshCw size={13} /></motion.div>
              : <BarChart2 size={13} />}
            Phân tích bố cục
          </button>

          <div className="space-y-1.5">
            {AI_TOOLS.map(t => (
              <motion.div key={t.id} whileTap={{ scale: 0.98 }}
                onClick={() => runTool(t.id)}
                className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-all ${
                  processingTool === t.id
                    ? "bg-white/5 border-purple-500/30"
                    : "bg-white/[0.03] border-white/5 hover:bg-white/5 hover:border-white/10"
                } ${processingTool && processingTool !== t.id ? "opacity-40 cursor-not-allowed" : ""}`}>
                <div className="w-20 h-11 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                  <AiToolPreview id={t.id} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.dot}`} />
                    <span className="text-white text-xs font-medium truncate">{t.label}</span>
                  </div>
                  <p className="text-white/40 leading-tight text-[10px]">{t.desc}</p>
                </div>
                <div className="flex-shrink-0">
                  {processingTool === t.id
                    ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="text-purple-400"><Wand2 size={13} /></motion.div>
                    : <ChevronRight size={13} className="text-white/20" />}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* 4. Bố cục gợi ý */}
        <div className="border border-white/5 rounded-2xl overflow-hidden">
          <button onClick={() => setShowCompSection(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-white/40 hover:text-white/70 transition-colors">
            <span className="text-[10px] uppercase tracking-widest font-medium flex items-center gap-1.5">
              <Grid3x3 size={10} /> BỐ CỤC GỢI Ý
            </span>
            {showCompSection ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
          </button>
          <AnimatePresence>
            {showCompSection && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-2 gap-2 p-3 pt-0">
                  {COMP_SUGGESTIONS[sceneType].map(c => (
                    <button key={c.id} onClick={() => applyComp(c.id)}
                      className={`rounded-xl overflow-hidden border transition-all ${selectedComp === c.id ? "border-purple-500 ring-1 ring-purple-500/40" : "border-white/10 hover:border-white/20"}`}>
                      <div className="h-10 bg-white flex items-center justify-center">
                        <CompThumb id={c.id} />
                      </div>
                      <div className={`py-1 px-2 text-center ${selectedComp === c.id ? "bg-purple-600" : "bg-white/5"}`}>
                        <p className="text-[9px] text-white/70 truncate">{c.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 5. Tư thế tham chiếu */}
        <div className="border border-white/5 rounded-2xl overflow-hidden">
          <button onClick={() => setShowPoseSection(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-white/40 hover:text-white/70 transition-colors">
            <span className="text-[10px] uppercase tracking-widest font-medium flex items-center gap-1.5">
              <PersonStanding size={10} /> TƯ THẾ THAM CHIẾU
            </span>
            {showPoseSection ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
          </button>
          <AnimatePresence>
            {showPoseSection && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="p-3 pt-0 space-y-2">
                  <div className="flex gap-1">
                    {([
                      ["stand",  <PersonStanding size={11}/>, "Đứng"],
                      ["sit",    <User size={11}/>,            "Ngồi"],
                      ["action", <Dumbbell size={11}/>,        "Động tác"],
                      ["emotion",<Smile size={11}/>,           "Cảm xúc"],
                    ] as [PoseCategory, React.ReactNode, string][]).map(([cat, icon, label]) => (
                      <button key={cat} onClick={() => setPoseCategory(cat)}
                        className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[9px] transition-all ${poseCategory === cat ? "bg-purple-500/20 text-purple-400" : "bg-white/5 text-white/40 hover:text-white/60"}`}>
                        {icon}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {POSES[poseCategory].map(pose => (
                      <button key={pose.id} onClick={() => applyPose(pose.id)}
                        className={`rounded-xl overflow-hidden border transition-all ${ghostType === "pose" && ghostId === pose.id ? "border-purple-500 ring-1 ring-purple-500/40" : "border-white/10 hover:border-white/20"}`}>
                        <div className="h-12 bg-[#0d0817] flex items-center justify-center p-1">
                          <PoseThumb id={pose.id} />
                        </div>
                        <div className={`py-1 text-center text-[9px] ${ghostType === "pose" && ghostId === pose.id ? "bg-purple-700 text-white" : "bg-white/5 text-white/50"}`}>
                          {pose.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 6. Lưới hướng dẫn */}
        <div className="border border-white/5 rounded-2xl overflow-hidden">
          <button onClick={() => setShowGuideSection(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-white/40 hover:text-white/70 transition-colors">
            <span className="text-[10px] uppercase tracking-widest font-medium flex items-center gap-1.5">
              <Grid3x3 size={10} /> LƯỚI HƯỚNG DẪN
            </span>
            {showGuideSection ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
          </button>
          <AnimatePresence>
            {showGuideSection && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="p-3 pt-0 space-y-1.5">
                  {GUIDE_CONFIG.map((g: typeof GUIDE_CONFIG[number]) => (
                    <button key={g.id} onClick={() => toggleGuide(g.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all ${
                        activeGuides.includes(g.id)
                          ? "bg-white/5 border border-white/10"
                          : "border border-transparent hover:bg-white/[0.03]"
                      }`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${GUIDE_DOT[g.id]}`} />
                      <span className={activeGuides.includes(g.id) ? g.color : "text-white/50"}>{g.label}</span>
                      {activeGuides.includes(g.id) && <Check size={10} className="ml-auto text-green-400" />}
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
