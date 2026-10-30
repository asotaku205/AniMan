"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Maximize2, Sparkles, Trash2, X } from "lucide-react";
import {
  MAX_REFERENCE_IMAGES,
  REFERENCE_IMAGE_SOURCE_LABELS,
  type ReferenceImageItem,
  type ReferenceImageSource,
} from "../lib/referenceImages";

interface Props {
  /** Lịch sử ảnh mẫu của khung đang mở, tối đa 3 ảnh, mới nhất trước. */
  images: ReferenceImageItem[];
  /**
   * Ô prompt "Ý tưởng muốn vẽ" (dời từ khung phân tích sang đây theo
   * mockup đã duyệt 30/10/2026): cùng một state với phân tích nét vẽ,
   * chỉ khác vị trí hiển thị; sinh ảnh nguồn "prompt" bắt buộc có prompt.
   */
  ideaPrompt: string;
  onIdeaPromptChange?: (v: string) => void;
  /** Gợi ý mẫu nhanh theo loại cảnh đang chọn. */
  ideaPresets: string[];
  /** Tên loại cảnh đã cắt phần trong ngoặc, dùng cho nhãn gợi ý. */
  ideaSceneLabel: string;
  source: ReferenceImageSource;
  onSourceChange: (source: ReferenceImageSource) => void;
  onDeleteImage: (id: string) => void;
  /** Bấm nút sinh: tạo job Cloudflare rồi hỏi lại trạng thái cho tới khi xong. */
  onGenerate: () => void;
  /** Hủy job đang chạy (khi người dùng bấm Hủy trong lúc chờ). */
  onCancelGenerate: () => void;
  generating: boolean;
  /** Dòng tiến trình đang chờ (ví dụ đang chạy, đã chờ bao lâu). */
  jobStatusText: string | null;
  /** Lỗi lần sinh gần nhất, đã dịch sang tiếng Việt. */
  generationError: string | null;
  /** Hộp thoại đồng ý dữ liệu đang mở (xác nhận 18+ trước lần sinh đầu). */
  consentPending: boolean;
  consentNotice: { version: string; notice: string } | null;
  onAcceptConsent: () => void;
  onDeclineConsent: () => void;
}

/**
 * Panel "Ảnh mẫu tham khảo" (mockup đã duyệt 28/10/2026).
 *
 * Panel là một mục trong cột phải, đứng cạnh khung vẽ, KHÔNG BAO GIỜ phủ
 * lên khung vẽ. Sinh ảnh chạy bằng job bất đồng bộ qua Cloudflare Workers
 * AI (model FLUX.2 klein 4B cho cả 2 nguồn); ảnh mẫu chỉ để nhìn theo
 * và vẽ lại, không phải bản chính của truyện.
 */
export function ReferenceImagePanel({
  images,
  ideaPrompt,
  onIdeaPromptChange,
  ideaPresets,
  ideaSceneLabel,
  source,
  onSourceChange,
  onDeleteImage,
  onGenerate,
  onCancelGenerate,
  generating,
  jobStatusText,
  generationError,
  consentPending,
  consentNotice,
  onAcceptConsent,
  onDeclineConsent,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareOn, setCompareOn] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [zoomedId, setZoomedId] = useState<string | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const selected =
    images.find((image) => image.id === selectedId) ?? images[0] ?? null;
  const comparePartner = useMemo(() => {
    if (!compareOn || images.length < 2) return null;
    return (
      images.find((image) => image.id === compareId && image.id !== selected?.id) ??
      images.find((image) => image.id !== selected?.id) ??
      null
    );
  }, [compareOn, compareId, images, selected]);
  const zoomed = images.find((image) => image.id === zoomedId) ?? null;

  function handleThumbnailClick(image: ReferenceImageItem) {
    if (compareOn && selected && image.id !== selected.id) {
      setCompareId(image.id);
      return;
    }
    setSelectedId(image.id);
  }

  function renderImage(image: ReferenceImageItem, label: string) {
    if (!image.dataUrl) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-white/5 border border-dashed border-white/20 text-white/40 text-[10px] px-2 text-center">
          Bản ghi nội bộ, không phải ảnh AI
        </div>
      );
    }
    return (
      <img
        src={image.dataUrl}
        alt={label}
        className="w-full h-full object-contain bg-white"
      />
    );
  }

  return (
    <section className="border border-amber-400/30 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/15 text-left transition-colors"
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        <span className="text-amber-200 text-xs font-semibold flex-1">
          Ảnh mẫu tham khảo
        </span>
        <span className="text-white/40 text-[10px]">
          {images.length}/{MAX_REFERENCE_IMAGES}
        </span>
      </button>

      {!collapsed && (
        <div className="p-3 space-y-3">
          <p className="text-amber-200/90 text-[10px] font-semibold tracking-wide bg-amber-500/10 border border-amber-400/30 rounded-lg px-2 py-1.5">
            ẢNH MẪU THAM KHẢO, KHÔNG PHẢI BẢN CHÍNH
          </p>

          {/* Ô prompt "Ý tưởng muốn vẽ": nằm trong khung ảnh mẫu vì
              sinh ảnh dùng prompt này; phân tích nét vẽ đọc cùng state. */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-white/80 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} className="text-pink-400" />
                Ý Tưởng Muốn Vẽ
              </label>
              {ideaPrompt && onIdeaPromptChange && (
                <button
                  type="button"
                  onClick={() => onIdeaPromptChange("")}
                  className="text-white/40 hover:text-white text-[10px] transition-colors"
                >
                  Xóa chữ
                </button>
              )}
            </div>
            <textarea
              value={ideaPrompt}
              onChange={(event) => onIdeaPromptChange?.(event.target.value)}
              disabled={!onIdeaPromptChange}
              placeholder={`Mô tả ý tưởng muốn vẽ (vd: ${ideaPresets[0] ?? ""}...). Mô tả này làm ngữ cảnh cho sinh ảnh mẫu, phân tích nét vẽ và gợi ý mạch truyện.`}
              rows={2}
              className="w-full bg-[#0a0512] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/25 resize-none focus:outline-none focus:border-pink-500/60 focus:ring-1 focus:ring-pink-500/30 transition-all disabled:opacity-50"
            />
            <div>
              <span className="text-[9px] text-white/40 block mb-1">
                Gợi ý ý tưởng nhanh cho {ideaSceneLabel}:
              </span>
              <div className="flex flex-wrap gap-1">
                {ideaPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onIdeaPromptChange?.(preset)}
                    disabled={!onIdeaPromptChange}
                    className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-pink-500/20 hover:text-pink-200 border border-white/5 text-[9px] text-white/60 transition-colors text-left disabled:opacity-50"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-white/60 text-[10px] font-semibold">
              Nguồn sinh ảnh mẫu
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                Object.keys(REFERENCE_IMAGE_SOURCE_LABELS) as ReferenceImageSource[]
              ).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onSourceChange(option)}
                  aria-pressed={source === option}
                  className={`px-1.5 py-1.5 rounded-lg border text-[10px] leading-tight transition-colors ${
                    source === option
                      ? "bg-amber-500/25 border-amber-400/50 text-amber-100 font-semibold"
                      : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {REFERENCE_IMAGE_SOURCE_LABELS[option]}
                </button>
              ))}
            </div>
          </div>

          <p className="text-white/50 text-[10px]">
            Phong cách khóa: Manga trắng đen, nét sạch. Ảnh mẫu chỉ dùng để
            hỗ trợ bạn vẽ lại, không đưa vào bản chính và không xuất cùng
            truyện.
          </p>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={onGenerate}
              disabled={generating}
              className="w-full py-2 px-3 rounded-xl bg-amber-500/25 border border-amber-400/50 text-amber-100 text-xs font-semibold transition-colors hover:bg-amber-500/35 disabled:opacity-50 disabled:cursor-wait"
            >
              {generating ? "Đang sinh ảnh mẫu..." : "Sinh ảnh mẫu"}
            </button>
            {generating && (
              <button
                type="button"
                onClick={onCancelGenerate}
                className="w-full py-1.5 px-3 rounded-xl bg-white/5 border border-white/10 text-white/70 text-xs transition-colors hover:bg-white/10"
              >
                Hủy lần sinh này
              </button>
            )}
            {jobStatusText && !generationError && (
              <p className="text-white/60 text-[10px] leading-relaxed">
                {jobStatusText}
              </p>
            )}
            {generationError && (
              <p
                role="alert"
                className="text-red-300 text-[10px] leading-relaxed"
              >
                {generationError}
              </p>
            )}
            <p className="text-white/40 text-[10px] leading-relaxed">
              Sinh ảnh có thể mất vài phút vì model chạy trên Cloudflare.
              Ảnh về sẽ vào lịch sử bên dưới, tối đa 3 ảnh, để bạn vừa
              nhìn theo vừa vẽ.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-[10px] font-semibold">
                Lịch sử ({images.length}/{MAX_REFERENCE_IMAGES})
              </span>
              {images.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setCompareOn((value) => !value)}
                  aria-pressed={compareOn}
                  className={`px-2 py-1 rounded-lg border text-[10px] transition-colors ${
                    compareOn
                      ? "bg-amber-500/25 border-amber-400/50 text-amber-100 font-semibold"
                      : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                  }`}
                >
                  So sánh 2 ảnh
                </button>
              )}
            </div>

            {images.length === 0 ? (
              <p className="text-white/40 text-[10px] leading-relaxed bg-white/[0.03] border border-white/5 rounded-xl px-2 py-2.5">
                Chưa có ảnh mẫu nào cho khung này. Bấm Sinh ảnh mẫu để tạo
                ảnh đầu tiên; tối đa 3 ảnh gần nhất sẽ hiện ở đây để bạn
                vừa nhìn theo vừa vẽ.
              </p>
            ) : (
              <>
                <div
                  className={
                    comparePartner
                      ? "grid grid-cols-2 gap-2"
                      : "aspect-[4/3] rounded-xl overflow-hidden border border-white/10"
                  }
                >
                  {selected && (
                    <button
                      type="button"
                      onClick={() => setZoomedId(selected.id)}
                      title="Phóng to ảnh mẫu"
                      className="relative aspect-[4/3] rounded-xl overflow-hidden border border-white/10 bg-white group"
                    >
                      {renderImage(selected, "Ảnh mẫu tham khảo đang chọn")}
                      <span className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/50 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Maximize2 size={12} />
                      </span>
                    </button>
                  )}
                  {comparePartner && (
                    <button
                      type="button"
                      onClick={() => setZoomedId(comparePartner.id)}
                      title="Phóng to ảnh mẫu so sánh"
                      className="relative aspect-[4/3] rounded-xl overflow-hidden border border-white/10 bg-white group"
                    >
                      {renderImage(comparePartner, "Ảnh mẫu tham khảo so sánh")}
                      <span className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/50 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Maximize2 size={12} />
                      </span>
                    </button>
                  )}
                </div>
                {selected?.note && (
                  <p className="text-white/50 text-[10px] leading-relaxed">
                    {selected.note}
                  </p>
                )}

                <div className="flex gap-1.5">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className={`relative flex-1 aspect-[4/3] rounded-lg overflow-hidden border ${
                        image.id === selected?.id
                          ? "border-amber-400/70"
                          : image.id === comparePartner?.id
                            ? "border-sky-400/60"
                            : "border-white/10"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleThumbnailClick(image)}
                        title="Chọn ảnh mẫu này"
                        className="w-full h-full bg-white"
                      >
                        {renderImage(image, "Ảnh mẫu tham khảo trong lịch sử")}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteImage(image.id)}
                        title="Xóa ảnh mẫu này"
                        aria-label="Xóa ảnh mẫu"
                        className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white/80 hover:text-white"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-white/35 text-[10px]">
                  Ảnh mẫu không nằm trong lớp vẽ và không xuất cùng truyện.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          role="dialog"
          aria-label="Phóng to ảnh mẫu tham khảo"
          onClick={() => setZoomedId(null)}
        >
          <div
            className="max-w-full max-h-full"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => setZoomedId(null)}
                aria-label="Đóng phóng to"
                className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20"
              >
                <X size={14} />
              </button>
            </div>
            <div className="max-h-[80vh] aspect-[4/3] bg-white rounded-xl overflow-hidden">
              {renderImage(zoomed, "Ảnh mẫu tham khảo phóng to")}
            </div>
          </div>
        </div>
      )}
      {consentPending && consentNotice && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Đồng ý dữ liệu AI cho ảnh mẫu tham khảo"
        >
          <div className="max-w-md w-full bg-[#1c1430] border border-white/10 rounded-2xl p-4 space-y-3">
            <h3 className="text-white text-sm font-semibold">
              Trước khi sinh ảnh mẫu
            </h3>
            <p className="text-white/70 text-xs leading-relaxed whitespace-pre-line">
              {consentNotice.notice}
            </p>
            <label className="flex items-start gap-2 text-white/80 text-xs leading-relaxed cursor-pointer">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(event) => setAgeConfirmed(event.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <span>
                Tôi đã đủ 18 tuổi và đồng ý để bản vẽ và prompt của tôi được
                xử lý như văn bản trên.
              </span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!ageConfirmed}
                onClick={() => {
                  setAgeConfirmed(false);
                  onAcceptConsent();
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-500/25 border border-amber-400/50 text-amber-100 text-xs font-semibold transition-colors hover:bg-amber-500/35 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Đồng ý và sinh ảnh
              </button>
              <button
                type="button"
                onClick={() => {
                  setAgeConfirmed(false);
                  onDeclineConsent();
                }}
                className="py-2 px-3 rounded-xl bg-white/5 border border-white/10 text-white/70 text-xs transition-colors hover:bg-white/10"
              >
                Để sau
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
