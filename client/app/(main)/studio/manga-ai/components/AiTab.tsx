"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  BarChart2,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Dumbbell,
  Grid3x3,
  Info,
  Layers,
  Maximize2,
  MessageCircle,
  Mountain,
  PersonStanding,
  RefreshCw,
  Smile,
  Sparkles,
  User,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { GUIDE_CONFIG, GUIDE_DOT } from "../hooks/useDrawStudio";
import {
  COMP_SUGGESTIONS,
  POSES,
  type GuideId,
  type PoseCategory,
  type SceneType,
} from "../data";
import {
  AI_DRAWING_MODEL_LABEL,
  type AiDrawingQuota,
  type AiPageStoryFlowPanelHint,
  type AiPageStoryFlowResponse,
} from "@/lib/ai-drawing-api";
import type {
  ReferenceImageItem,
  ReferenceImageSource,
  ReferenceOverlayPosition,
} from "../lib/referenceImages";
import { ReferenceImagePanel } from "./ReferenceImagePanel";

type Props = {
  sceneType: SceneType;
  setSceneType: (t: SceneType) => void;
  /** Mạch truyện cả trang — mọi trường đều từ API thật (D-1) */
  runStoryFlow: () => void;
  cancelStoryFlow: () => void;
  applyStoryFlow: () => void;
  dismissStoryFlow: () => void;
  storyFlow: AiPageStoryFlowResponse | null;
  /** Gợi ý đã đối chiếu layout đang mở (VD-5) */
  storyFlowPanels: AiPageStoryFlowPanelHint[];
  storyLoading: boolean;
  storyError: string | null;
  /** Thời điểm nhận kết quả, ms — dòng nguồn AI (AC-D2.2) */
  storyAt: number | null;
  appliedStoryPanels: string[];
  activePanel: string | null;
  runAnalysis: () => void;
  analyzing: boolean;
  showCompSection: boolean;
  setShowCompSection: React.Dispatch<React.SetStateAction<boolean>>;
  applyComp: (id: string) => void;
  selectedComp: string | null;
  showPoseSection: boolean;
  setShowPoseSection: React.Dispatch<React.SetStateAction<boolean>>;
  poseCategory: PoseCategory;
  setPoseCategory: (cat: PoseCategory) => void;
  applyPose: (id: string) => void;
  /** Tư thế mẫu đang chọn (chỉ tham chiếu, không gọi AI) */
  selectedPoseId: string | null;
  /** Lượt AI còn lại (null = chưa lấy được thì ẩn dòng quota) */
  aiQuota?: AiDrawingQuota | null;
  userDrawingPrompt?: string;
  setUserDrawingPrompt?: (v: string) => void;
  /** Ảnh mẫu tham khảo của khung đang mở (tối đa 3, kho riêng) */
  referenceImages: ReferenceImageItem[];
  onDeleteReferenceImage: (id: string) => void;
  referenceSource: ReferenceImageSource;
  onReferenceSourceChange: (source: ReferenceImageSource) => void;
  /** Lớp ảnh mẫu đè lên khung vẽ để đồ theo: chỉ xem, không vào lớp vẽ hay bản xuất */
  referenceOverlayOn: boolean;
  onReferenceOverlayToggle: () => void;
  referenceOverlayOpacity: number;
  onReferenceOverlayOpacityChange: (value: number) => void;
  referenceOverlayPosition: ReferenceOverlayPosition;
  onReferenceOverlayPositionChange: (position: ReferenceOverlayPosition) => void;
  referenceOverlayImageId: string | null;
  onReferenceOverlayImageSelect: (id: string) => void;
  /** Sinh ảnh mẫu tham khảo (Cloudflare, job bất đồng bộ) */
  generateReferenceImage: () => void;
  cancelReferenceImageGeneration: () => void;
  referenceGenerating: boolean;
  referenceJobStatusText: string | null;
  referenceError: string | null;
  referenceConsentPending: boolean;
  referenceConsentNotice: { version: string; notice: string } | null;
  acceptReferenceImageConsent: () => void;
  declineReferenceImageConsent: () => void;
  showGuideSection: boolean;
  setShowGuideSection: React.Dispatch<React.SetStateAction<boolean>>;
  toggleGuide: (g: GuideId) => void;
  activeGuides: GuideId[];
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
    description:
      "AI tự động phân tích nét vẽ và mô tả ý tưởng để xác định thể loại cảnh, làm ngữ cảnh cho phân tích nét vẽ và gợi ý mạch truyện.",
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

/** Giờ:phút:giây của thời điểm gọi AI, theo giờ máy người dùng. */
function formatAiTime(at: number): string {
  return new Date(at).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * BR-D04 / AC-D2.2: mọi khối hiển thị dữ liệu **thật** từ AI đều phải có dòng
 * nguồn gồm thời điểm gọi, mô hình đang dùng và `sourceIds` trích dẫn.
 * Không có dữ liệu AI thì không hiện dòng nào.
 */
function AiSourceLine({
  at,
  sourceIds,
  model,
}: {
  at: number | null;
  sourceIds?: readonly string[];
  /** Model thật từ phản hồi server (Phase 5E); thiếu thì dùng hằng dự phòng. */
  model?: string | null;
}) {
  if (at === null) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8px] leading-tight text-white/35">
      <span className="inline-flex items-center gap-1">
        <Bot size={8} />
        {model && model.length > 0 ? model : AI_DRAWING_MODEL_LABEL}
      </span>
      <span className="inline-flex items-center gap-1">
        <Clock size={8} />
        {formatAiTime(at)}
      </span>
      <span>
        Nguồn:{" "}
        {sourceIds && sourceIds.length > 0
          ? sourceIds.join(", ")
          : "không trích dẫn"}
      </span>
    </p>
  );
}

export function AiTab({
  sceneType,
  setSceneType,
  runStoryFlow,
  cancelStoryFlow,
  applyStoryFlow,
  dismissStoryFlow,
  storyFlow,
  storyFlowPanels,
  storyLoading,
  storyError,
  storyAt,
  appliedStoryPanels,
  activePanel,
  runAnalysis,
  analyzing,
  showCompSection,
  setShowCompSection,
  applyComp,
  selectedComp,
  showPoseSection,
  setShowPoseSection,
  poseCategory,
  setPoseCategory,
  applyPose,
  selectedPoseId,
  aiQuota,
  userDrawingPrompt,
  setUserDrawingPrompt,
  referenceImages,
  onDeleteReferenceImage,
  referenceSource,
  onReferenceSourceChange,
  referenceOverlayOn,
  onReferenceOverlayToggle,
  referenceOverlayOpacity,
  onReferenceOverlayOpacityChange,
  referenceOverlayPosition,
  onReferenceOverlayPositionChange,
  referenceOverlayImageId,
  onReferenceOverlayImageSelect,
  generateReferenceImage,
  cancelReferenceImageGeneration,
  referenceGenerating,
  referenceJobStatusText,
  referenceError,
  referenceConsentPending,
  referenceConsentNotice,
  acceptReferenceImageConsent,
  declineReferenceImageConsent,
  showGuideSection,
  setShowGuideSection,
  toggleGuide,
  activeGuides,
}: Props) {
  const currentScene = SCENE_METADATA[sceneType];
  const isWorking = analyzing || storyLoading;

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
                  // Đổi thể loại cảnh ⇒ kết quả AI cũ không còn đúng ngữ cảnh
                  dismissStoryFlow();
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

        {/* 2. Phân tích nét vẽ và chỉ lỗi lệch (riêng, tách khỏi ảnh mẫu).
            Ô prompt đã dời vào khung Ảnh mẫu tham khảo bên dưới, cùng
            một state nên nút phân tích vẫn đọc được nội dung đã gõ. */}
        <div className="space-y-2.5 bg-white/[0.03] border border-white/10 rounded-2xl p-3 shadow-sm">
          {/* Lượt AI còn lại — chỉ hiện khi lấy được từ server */}
          {aiQuota && (
            <p className="text-[9px] text-white/40">
              Giới hạn AI: còn {Math.max(0, aiQuota.minuteLimit - aiQuota.minuteUsed)}/
              {aiQuota.minuteLimit} lượt trong phút này ·{" "}
              {Math.max(0, aiQuota.dayLimit - aiQuota.dayUsed)}/{aiQuota.dayLimit} lượt
              hôm nay
            </p>
          )}

          {/* Trạng thái nhắc nhở nếu chưa chọn panel */}
          {!activePanel && (
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2 text-amber-200 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 animate-ping" />
              <span>Hãy nhấn vào một khung tranh trên trang để kích hoạt tính năng AI</span>
            </div>
          )}

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
          <p className="text-white/35 text-[9px] leading-relaxed">
            Phân tích chỉ trả về nhận xét bằng chữ, không vẽ thêm nét nào lên
            khung của bạn.
          </p>
        </div>

        {/* 2b. Ảnh mẫu tham khảo (sinh ảnh bằng job Cloudflare) */}
        <ReferenceImagePanel
          images={referenceImages}
          ideaPrompt={userDrawingPrompt ?? ""}
          onIdeaPromptChange={setUserDrawingPrompt}
          ideaPresets={currentScene.presets}
          ideaSceneLabel={currentScene.title.split("(")[0]}
          source={referenceSource}
          onSourceChange={onReferenceSourceChange}
          onDeleteImage={onDeleteReferenceImage}
          overlayOn={referenceOverlayOn}
          onOverlayToggle={onReferenceOverlayToggle}
          overlayOpacity={referenceOverlayOpacity}
          onOverlayOpacityChange={onReferenceOverlayOpacityChange}
          overlayPosition={referenceOverlayPosition}
          onOverlayPositionChange={onReferenceOverlayPositionChange}
          overlayImageId={referenceOverlayImageId}
          onOverlayImageSelect={onReferenceOverlayImageSelect}
          onGenerate={generateReferenceImage}
          onCancelGenerate={cancelReferenceImageGeneration}
          generating={referenceGenerating}
          jobStatusText={referenceJobStatusText}
          generationError={referenceError}
          consentPending={referenceConsentPending}
          consentNotice={referenceConsentNotice}
          onAcceptConsent={acceptReferenceImageConsent}
          onDeclineConsent={declineReferenceImageConsent}
        />

        {/* 3. Bố Cục Mẫu (tham chiếu, theo SceneType đang chọn) */}
        <div className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
          <button
            onClick={() => setShowCompSection((v) => !v)}
            className="w-full flex items-center justify-between p-3 text-white/60 hover:text-white transition-colors"
          >
            <span className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5">
              <Grid3x3 size={11} className="text-purple-400" />
              Bố Cục Mẫu Cho: {currentScene.title.split("(")[0]}
            </span>
            <span className="flex items-center gap-2">
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[8px] font-semibold normal-case tracking-normal text-white/50">
                Mẫu tham chiếu
              </span>
              {showCompSection ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
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
                    Bố cục do studio soạn sẵn để tham chiếu, không phải kết quả
                    AI và không gọi AI. Chọn một mẫu để tham chiếu khi vẽ, bật
                    đường dóng ở mục dưới để tự căn theo mẫu đã chọn.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {COMP_SUGGESTIONS[sceneType].map((c) => (
                      <button
                        key={c.id}
                        onClick={() => applyComp(c.id)}
                        disabled={!activePanel}
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

        {/* 4. Tư Thế Mẫu (tham chiếu) */}
        <div className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
          <button
            onClick={() => setShowPoseSection((v) => !v)}
            className="w-full flex items-center justify-between p-3 text-white/60 hover:text-white transition-colors"
          >
            <span className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5">
              <PersonStanding size={11} className="text-pink-400" />
              Tư Thế Mẫu Tham Chiếu
            </span>
            <span className="flex items-center gap-2">
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[8px] font-semibold normal-case tracking-normal text-white/50">
                Mẫu tham chiếu
              </span>
              {showPoseSection ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
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
                  <p className="text-[9px] text-white/40">
                    Tư thế mẫu chỉ để tham chiếu khi vẽ, không gọi AI và không
                    sinh khung xương.
                  </p>

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
                        disabled={!activePanel}
                        className={`rounded-xl border p-2 text-center transition-all disabled:opacity-50 ${
                          selectedPoseId === pose.id
                            ? "border-pink-400 bg-pink-500/15 ring-1 ring-pink-500/40"
                            : "border-white/10 hover:border-pink-500/40 bg-white/[0.02] hover:bg-pink-500/10"
                        }`}
                      >
                        <p className="text-[10px] text-white font-medium truncate">{pose.label}</p>
                        <span className="text-[8px] text-pink-400 block mt-0.5">Tham chiếu</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 5. Mạch Truyện Cả Trang — kết quả API thật, task `page_story_flow` (D-1) */}
        <div className="space-y-2 bg-gradient-to-br from-purple-950/20 to-black p-3 rounded-2xl border border-white/5">
          <span className="text-white/40 text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5">
            <Layers size={11} className="text-purple-400" />
            AI Gợi Ý Mạch Truyện Cả Trang
          </span>

          <div className="flex items-stretch gap-1.5">
            <button
              onClick={runStoryFlow}
              disabled={storyLoading}
              className="flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-md shadow-purple-500/20 active:scale-[0.99] disabled:opacity-50"
            >
              {storyLoading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <RefreshCw size={13} />
                </motion.div>
              ) : (
                <Wand2 size={13} />
              )}
              <span>
                {storyLoading
                  ? "AI đang dựng mạch truyện theo ngữ cảnh..."
                  : storyFlow
                    ? "Gọi lại gợi ý mạch truyện"
                    : "Gợi Ý Kịch Bản Toàn Trang (Xuyên Suốt)"}
              </span>
            </button>

            {storyLoading && (
              <button
                onClick={cancelStoryFlow}
                className="rounded-xl border border-white/15 bg-white/5 px-2.5 text-[10px] font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {storyError && (
            <div className="flex items-start gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-2 text-[9px] leading-relaxed text-amber-200">
              <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p>{storyError}</p>
                <p className="text-amber-200/60">
                  Bạn vẫn có thể tiếp tục vẽ; nút gọi lại vẫn dùng được.
                </p>
              </div>
            </div>
          )}

          <AnimatePresence>
            {storyFlow && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-2 rounded-xl border border-purple-500/20 bg-black/30 p-2.5">
                  <div className="flex items-start gap-1.5">
                    <p className="flex-1 text-[10px] italic leading-relaxed text-purple-100">
                      &ldquo;{storyFlow.summary}&rdquo;
                    </p>
                    <button
                      onClick={dismissStoryFlow}
                      title="Ẩn kết quả"
                      className="text-white/30 transition-colors hover:text-white/70"
                    >
                      <X size={11} />
                    </button>
                  </div>

                  <p className="rounded-lg bg-purple-500/10 px-2 py-1.5 text-[9px] leading-relaxed text-purple-200">
                    {storyFlow.flow}
                  </p>

                  <ul className="space-y-1">
                    {storyFlowPanels.map((panel) => (
                      <li
                        key={`${panel.panelId}-${panel.order}`}
                        className="flex items-start gap-1.5 text-[9px] leading-relaxed text-white/70"
                      >
                        <span className="rounded bg-white/10 px-1 font-mono text-[8px] text-white/50">
                          {panel.panelId}
                        </span>
                        <span className="flex-1">
                          <span className="text-purple-300">{panel.camera}</span>
                          {" — "}
                          {panel.hint}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {storyFlowPanels.length === 0 && (
                    <p className="text-[9px] leading-relaxed text-amber-200/70">
                      Gợi ý không khớp khung nào của trang này (layout đang mở
                      không có các khung mà AI trả về).
                    </p>
                  )}

                  <AiSourceLine
                    at={storyAt}
                    sourceIds={storyFlow.sourceIds}
                    model={storyFlow.model}
                  />

                  <button
                    onClick={applyStoryFlow}
                    disabled={storyFlowPanels.length === 0}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/15 py-1.5 text-[10px] font-semibold text-purple-100 transition-colors hover:bg-purple-500/25 disabled:opacity-40"
                  >
                    <Check size={11} />
                    {appliedStoryPanels.length > 0
                      ? `Đã áp lên ${appliedStoryPanels.length} khung — áp lại`
                      : "Áp gợi ý lên từng khung"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 6. Đường Dẫn Hướng Cố Định (Guides) */}
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
