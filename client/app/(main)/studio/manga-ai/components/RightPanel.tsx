"use client";

import React, { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Combine,
  Copy,
  Edit2,
  Eye,
  EyeOff,
  Grid3x3,
  Layers,
  Lock,
  Plus,
  Sliders,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { AiTab } from "./AiTab";
import { canRemoveLayerInList, MAX_LAYERS_PER_PANEL } from "../lib/layerOps";
import {
  LAYOUTS,
  type LayerItem,
  type LayoutDef,
  type RightTab,
} from "../data";
import type { DrawStudioState } from "../hooks/useDrawStudio";

type Props = {
  s: DrawStudioState;
};

export function RightPanel({ s }: Props) {
  /** Layer đang đổi tên inline (dblclick vào tên) + giá trị đang soạn */
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const cancelLayerRenameRef = useRef(false);
  /** Layer đang kéo-thả để sắp xếp */
  const [dragId, setDragId] = useState<string | null>(null);
  /** Thu gọn panel thành ray 44px để lấy chỗ cho canvas (state cục bộ, không lưu). */
  const [collapsed, setCollapsed] = useState(false);

  const userLayers = s.layers.filter((l) => l.kind !== "ai");
  /** Thumbnail 40×40 từng layer — làm mới khi layers/panel/composite đổi */
  const thumbs = useMemo(() => {
    const thumbById: Record<string, string | null> = {};
    for (const l of s.layers) thumbById[l.id] = s.getLayerThumbnail(l.id);
    return thumbById;
  }, [s.layers, s.panelData, s.activePanel, s.getLayerThumbnail]);

  // AC-L2.8: tiêu đề tab hiện luôn số layer hiện tại / trần 12 (BR-L13).
  const layerTabLabel =
    s.layers.length > 0
      ? `Layers ${s.layers.length}/${MAX_LAYERS_PER_PANEL}`
      : "Layers";
  const tabs: [RightTab, React.ReactNode, string][] = [
    ["ai", <Bot size={13} />, "AI Gợi ý"],
    ["layout", <Grid3x3 size={13} />, "Bố cục trang"],
    ["layers", <Layers size={13} />, layerTabLabel],
  ];

  if (collapsed) {
    return (
      <div className="w-11 bg-[#120a1f] border-l border-white/5 flex flex-col items-center py-2 gap-1 flex-shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          title="Mở rộng panel"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="w-6 h-px bg-white/10 my-1" />
        {tabs.map(([tab, icon, label]) => (
          <button
            key={tab}
            onClick={() => {
              s.setRightTab(tab);
              setCollapsed(false);
            }}
            title={label}
            aria-label={label}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              s.rightTab === tab
                ? "bg-pink-500/20 text-pink-400"
                : "text-white/40 hover:text-white hover:bg-white/5"
            }`}
          >
            {icon}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="w-[340px] bg-[#120a1f] border-l border-white/5 flex flex-col flex-shrink-0">
      {/* Tab bar */}
      <div className="flex border-b border-white/5 flex-shrink-0">
        {tabs.map(([tab, icon, label]) => (
          <button
            key={tab}
            onClick={() => s.setRightTab(tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-medium transition-colors ${
              s.rightTab === tab
                ? "text-pink-400 border-b-2 border-pink-500"
                : "text-white/30 hover:text-white/60"
            }`}
          >
            {icon} {label}
          </button>
        ))}
        <button
          onClick={() => setCollapsed(true)}
          title="Thu gọn panel để lấy chỗ cho canvas"
          aria-label="Thu gọn panel"
          className="w-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors border-l border-white/5"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* AI Tab */}
      {s.rightTab === "ai" && (
        <AiTab
          sceneType={s.sceneType}
          setSceneType={s.setSceneType}
          runStoryFlow={s.runStoryFlow}
          cancelStoryFlow={s.cancelStoryFlow}
          applyStoryFlow={s.applyStoryFlow}
          dismissStoryFlow={s.dismissStoryFlow}
          storyFlow={s.storyFlow}
          storyFlowPanels={s.storyFlowPanels}
          storyLoading={s.storyLoading}
          storyError={s.storyError}
          storyAt={s.storyAt}
          appliedStoryPanels={s.appliedStoryPanels}
          activePanel={s.activePanel}
          runAnalysis={s.runAnalysis}
          analyzing={s.analyzing}
          showCompSection={s.showCompSection}
          setShowCompSection={s.setShowCompSection}
          applyComp={s.applyComp}
          selectedComp={s.selectedComp}
          showPoseSection={s.showPoseSection}
          setShowPoseSection={s.setShowPoseSection}
          poseCategory={s.poseCategory}
          setPoseCategory={s.setPoseCategory}
          applyPose={s.applyPose}
          selectedPoseId={s.selectedPoseId}
          aiQuota={s.aiQuota}
          userDrawingPrompt={s.userDrawingPrompt}
          setUserDrawingPrompt={s.setUserDrawingPrompt}
          referenceImages={s.referenceImages}
          onDeleteReferenceImage={s.deleteReferenceImage}
          referenceSource={s.referenceSource}
          onReferenceSourceChange={s.setReferenceSource}
          referenceOverlayOn={s.referenceOverlayOn}
          onReferenceOverlayToggle={s.toggleReferenceOverlay}
          referenceOverlayOpacity={s.referenceOverlayOpacity}
          onReferenceOverlayOpacityChange={s.setReferenceOverlayOpacity}
          referenceOverlayPosition={s.referenceOverlayPosition}
          onReferenceOverlayPositionChange={s.setReferenceOverlayPosition}
          referenceOverlayImageId={s.referenceOverlayImageId}
          onReferenceOverlayImageSelect={s.selectReferenceOverlayImage}
          referenceCorrection={s.referenceCorrection}
          onReferenceCorrectionChange={s.setReferenceCorrection}
          referenceOutputSize={s.referenceOutputSize}
          generateReferenceImage={s.generateReferenceImage}
          cancelReferenceImageGeneration={s.cancelReferenceImageGeneration}
          referenceGenerating={s.referenceGenerating}
          referenceJobStatusText={s.referenceJobStatusText}
          referenceError={s.referenceError}
          referenceConsentPending={s.referenceConsentPending}
          referenceConsentNotice={s.referenceConsentNotice}
          acceptReferenceImageConsent={s.acceptReferenceImageConsent}
          declineReferenceImageConsent={s.declineReferenceImageConsent}
          showGuideSection={s.showGuideSection}
          setShowGuideSection={s.setShowGuideSection}
          toggleGuide={s.toggleGuide}
          activeGuides={s.activeGuides}
        />
      )}

      {/* Layout Tab */}
      {s.rightTab === "layout" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <p className="text-white/30 text-[10px] uppercase tracking-widest mb-3">
            Chọn bố cục
          </p>
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                s.setLayout(l);
                s.exitPanel();
              }}
              className={`w-full flex items-center gap-3 p-2.5 rounded-2xl border transition-all ${
                s.layout.id === l.id
                  ? "border-pink-500/50 bg-pink-500/5"
                  : "border-white/5 hover:border-white/10 hover:bg-white/[0.03]"
              }`}
            >
              <div className="w-12 h-16 bg-white rounded-lg overflow-hidden flex-shrink-0 relative border border-gray-200">
                {l.panels.map((p) => (
                  <div
                    key={p.id}
                    className="absolute border border-gray-300"
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      width: `${p.w}%`,
                      height: `${p.h}%`,
                    }}
                  />
                ))}
              </div>
              <div className="flex-1 text-left">
                <p
                  className={`text-sm font-medium ${s.layout.id === l.id ? "text-pink-400" : "text-white/70"}`}
                >
                  {l.label}
                </p>
                <p className="text-white/30 text-[10px]">
                  {l.panels.length} khung
                </p>
              </div>
              {s.layout.id === l.id && (
                <Check size={14} className="text-pink-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Layers Tab */}
      {s.rightTab === "layers" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} className="text-pink-400" /> Quản Lý Layer
              </p>
              <p className="text-[10px] text-white/40">
                Layer đang chọn:{" "}
                <span className="text-pink-300 font-semibold">
                  {s.layers.find((l) => l.id === s.activeLayerId)?.name ?? "Chưa chọn"}
                </span>
              </p>
            </div>
            <button
              onClick={() => s.addLayer()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 text-[10px] font-semibold transition-all border border-pink-500/30"
            >
              <Plus size={12} /> Thêm Layer
            </button>
          </div>

          {/* Quick preset layer chips */}
          <div className="flex flex-wrap gap-1 bg-white/[0.02] p-1.5 rounded-xl border border-white/5">
            {[
              { label: "+ Phác thảo", name: "Sketch" },
              { label: "+ Đi nét", name: "Ink" },
              { label: "+ Đổ bóng", name: "Tone" },
              { label: "+ Thoại", name: "Text" },
            ].map((p) => (
              <button
                key={p.name}
                onClick={() => s.addLayer(p.name)}
                className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[9px] transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Layer List — chỉ lớp của người dùng; nhóm lớp AI đã gỡ cùng nét mờ (28/10/2026).
              `isAi` còn lại trong mã hiển thị chỉ để phòng dữ liệu cũ lọt qua, luôn false với ngăn xếp đã chuẩn hóa. */}
          {(
            [
              { title: "Lớp của tôi", items: userLayers, isAi: false },
            ] as const
          )
            .filter((g) => g.items.length > 0)
            .map((group) => (
              <div key={group.title} className="space-y-1.5">
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                    {group.title}
                  </span>
                  <span className="text-[9px] font-mono text-white/25">
                    {group.items.length}
                  </span>
                  {group.isAi && (
                    <span
                      className="px-1.5 py-px rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[9px] font-bold"
                      title="Layer AI chỉ đọc — không vẽ, không đổi tên, không nhân bản/gộp"
                    >
                      AI
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <AnimatePresence>
                    {group.items.map((layer) => {
                      const isActive = s.activeLayerId === layer.id;
                      const opacity = layer.opacity ?? 100;
                      const li = s.layers.findIndex((l) => l.id === layer.id);
                      const thumb = thumbs[layer.id];
                      return (
                        <motion.div
                          key={layer.id}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          draggable={!group.isAi}
                          onDragStart={(e) => {
                            const dragEvent =
                              e as unknown as React.DragEvent<HTMLDivElement>;
                            dragEvent.dataTransfer.effectAllowed = "move";
                            dragEvent.dataTransfer.setData("text/plain", layer.id);
                            setDragId(layer.id);
                          }}
                          onDragEnd={() => setDragId(null)}
                          onDragOver={(e) => {
                            if (!group.isAi) e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const dragEvent =
                              e as unknown as React.DragEvent<HTMLDivElement>;
                            const src =
                              dragId ??
                              dragEvent.dataTransfer.getData("text/plain");
                            setDragId(null);
                            if (src && src !== layer.id) {
                              s.moveLayerTo(src, li);
                            }
                          }}
                          onClick={() => {
                            if (!group.isAi) s.setActiveLayerId(layer.id);
                          }}
                          className={`p-2.5 rounded-xl border transition-all space-y-1.5 ${
                            group.isAi ? "" : "cursor-pointer"
                          } ${
                            dragId === layer.id ? "opacity-40" : ""
                          } ${
                            isActive
                              ? "bg-purple-950/30 border-pink-500/50 shadow-md ring-1 ring-pink-500/30"
                              : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {/* Thumbnail 40×40 */}
                            {group.isAi ? (
                              <div
                                className="w-10 h-10 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center flex-shrink-0"
                                title="Lớp AI tham chiếu (không chứa nét vẽ thật)"
                              >
                                <Bot size={16} className="text-purple-300" />
                              </div>
                            ) : thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                draggable={false}
                                className="w-10 h-10 rounded-lg object-cover border border-white/10 bg-white flex-shrink-0"
                              />
                            ) : (
                              <div
                                className="w-10 h-10 rounded-lg border border-dashed border-white/15 bg-white/[0.02] flex-shrink-0"
                                title="Layer trống — chưa có nét vẽ"
                              />
                            )}

                            {/* Active radio indicator */}
                            <div
                              className={`w-2.5 h-2.5 rounded-full border transition-all flex-shrink-0 ${
                                isActive
                                  ? "border-pink-400 bg-pink-500 ring-2 ring-pink-500/20"
                                  : "border-white/20 bg-transparent"
                              }`}
                              title={
                                isActive ? "Layer đang vẽ" : "Nhấn để chọn layer này"
                              }
                            />

                            {/* Visibility button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                s.toggleLayerVisibility(layer.id);
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${
                                layer.visible
                                  ? "text-white/60 hover:text-white"
                                  : "text-white/20 hover:text-white/40"
                              }`}
                              title={layer.visible ? "Ẩn layer" : "Hiện layer"}
                            >
                              {layer.visible ? (
                                <Eye size={14} />
                              ) : (
                                <EyeOff size={14} />
                              )}
                            </button>

                            {/* Layer name — dblclick để đổi tên inline (layer AI chỉ đọc) */}
                            {editingLayerId === layer.id ? (
                              <input
                                autoFocus
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onBlur={() => {
                                  if (!cancelLayerRenameRef.current) {
                                    s.renameLayer(layer.id, editingName);
                                  }
                                  cancelLayerRenameRef.current = false;
                                  setEditingLayerId(null);
                                }}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === "Enter") {
                                    (e.target as HTMLInputElement).blur();
                                  } else if (e.key === "Escape") {
                                    cancelLayerRenameRef.current = true;
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className={`flex-1 min-w-0 bg-transparent border-b border-pink-500/60 text-xs px-0.5 outline-none ${
                                  isActive
                                    ? "text-white font-bold"
                                    : "text-white/60"
                                }`}
                              />
                            ) : (
                              <>
                                <span
                                  onDoubleClick={(e) => {
                                    if (group.isAi) return;
                                    e.stopPropagation();
                                    setEditingName(layer.name);
                                    setEditingLayerId(layer.id);
                                  }}
                                  title={group.isAi ? "Layer AI chỉ đọc" : "Double-click hoặc bấm biểu tượng bút để đổi tên"}
                                  className={`flex-1 text-xs font-medium truncate ${
                                    group.isAi ? "cursor-default" : "cursor-text"
                                  } ${isActive ? "text-white font-bold" : "text-white/60"}`}
                                >
                                  {layer.name}
                                </span>
                                {!group.isAi && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingName(layer.name);
                                      setEditingLayerId(layer.id);
                                    }}
                                    title="Đổi tên layer"
                                    aria-label={`Đổi tên ${layer.name}`}
                                    className="p-1 text-white/35 hover:text-pink-300"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                )}
                              </>
                            )}

                            {/* Lock button (layer AI vốn đã khóa — ẩn) */}
                            {!group.isAi && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  s.toggleLayerLock(layer.id);
                                }}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  layer.locked
                                    ? "text-amber-400"
                                    : "text-white/30 hover:text-white/60"
                                }`}
                                title={
                                  layer.locked ? "Mở khóa layer" : "Khóa layer"
                                }
                              >
                                {layer.locked ? (
                                  <Lock size={14} />
                                ) : (
                                  <Unlock size={14} />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Opacity slider cho MỌI layer người dùng (task 2.3) */}
                          {!group.isAi && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 pt-1.5 border-t border-white/5"
                            >
                              <Sliders
                                size={10}
                                className="text-pink-400 flex-shrink-0"
                              />
                              <span className="text-[9px] text-white/40 flex-shrink-0">
                                Độ mờ:
                              </span>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={opacity}
                                onChange={(e) =>
                                  s.setLayerOpacity(
                                    layer.id,
                                    Number(e.target.value),
                                  )
                                }
                                className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-pink-500"
                              />
                              <span className="text-[9px] font-mono text-white/60 w-6 text-right">
                                {opacity}%
                              </span>
                            </div>
                          )}

                          {/* Hành động phụ — chỉ mở ở layer đang chọn để hàng nào
                              cũng thoáng; mỗi nút 28×28 thay cho icon 10–12px cũ. */}
                          {!group.isAi && isActive && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center justify-end gap-1 pt-1.5 border-t border-white/5"
                            >
                              <button
                                disabled={li <= 0}
                                onClick={() => s.reorderLayer(layer.id, "up")}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                                title="Di chuyển lên trên"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                disabled={
                                  li < 0 ||
                                  li >= s.layers.length - 1 ||
                                  s.layers[li + 1]?.kind === "ai"
                                }
                                onClick={() => s.reorderLayer(layer.id, "down")}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                                title="Di chuyển xuống dưới"
                              >
                                <ChevronDown size={14} />
                              </button>
                              <button
                                onClick={() => s.duplicateLayer(layer.id)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                                title="Nhân bản layer"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                disabled={
                                  li >= s.layers.length - 1 ||
                                  s.layers[li + 1]?.kind === "ai"
                                }
                                onClick={() => s.mergeLayerDown(layer.id)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                                title="Gộp xuống layer bên dưới"
                              >
                                <Combine size={14} />
                              </button>
                              {canRemoveLayerInList(s.layers, layer.id) && (
                                <button
                                  onClick={() => s.removeLayer(layer.id)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                  title="Xoá layer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            ))}

          {/* Quick tips */}
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-[10px] leading-relaxed">
            💡 <strong>Mẹo Manga Artist:</strong> Bạn có thể giảm độ mờ của layer{" "}
            <strong>Sketch (Phác thảo)</strong> xuống 30-40% để dễ dàng đi nét mực trên layer{" "}
            <strong>Ink</strong> mà không bị rối mắt.
          </div>
        </div>
      )}
    </div>
  );
}
