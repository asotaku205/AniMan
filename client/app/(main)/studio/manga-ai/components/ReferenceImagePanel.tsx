"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Maximize2, Trash2, X } from "lucide-react";
import {
  MAX_REFERENCE_IMAGES,
  REFERENCE_IMAGE_SOURCE_LABELS,
  type ReferenceImageItem,
  type ReferenceImageSource,
} from "../lib/referenceImages";

interface Props {
  /** Lịch sử ảnh mẫu của khung đang mở, tối đa 3 ảnh, mới nhất trước. */
  images: ReferenceImageItem[];
  source: ReferenceImageSource;
  onSourceChange: (source: ReferenceImageSource) => void;
  onDeleteImage: (id: string) => void;
}

/**
 * Panel "Ảnh mẫu tham khảo" (mockup đã duyệt 28/10/2026).
 *
 * Panel là một mục trong cột phải, đứng cạnh khung vẽ, KHÔNG BAO GIỜ phủ
 * lên khung vẽ. Sinh ảnh đang TẮT: nút "Sinh ảnh mẫu" bị vô hiệu hóa và
 * không gọi API nào, vì chưa có model ảnh miễn phí nào được nối vào.
 * Ảnh mẫu chỉ để nhìn theo và vẽ lại, không phải bản chính của truyện.
 */
export function ReferenceImagePanel({
  images,
  source,
  onSourceChange,
  onDeleteImage,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareOn, setCompareOn] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [zoomedId, setZoomedId] = useState<string | null>(null);

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

          <div className="space-y-1.5">
            <span className="text-white/60 text-[10px] font-semibold">
              Nguồn sinh ảnh mẫu
            </span>
            <div className="grid grid-cols-3 gap-1.5">
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
              disabled
              title="Chưa có mô hình ảnh miễn phí nào được nối vào"
              className="w-full py-2 px-3 rounded-xl bg-white/5 border border-white/10 text-white/40 text-xs font-semibold cursor-not-allowed"
            >
              Sinh ảnh mẫu
            </button>
            <p className="text-white/40 text-[10px] leading-relaxed">
              Chưa có mô hình ảnh miễn phí nào được nối vào, nên nút này đang
              tắt và không gọi API nào.
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
                Chưa có ảnh mẫu nào cho khung này. Khi sinh ảnh được bật, tối
                đa 3 ảnh gần nhất sẽ hiện ở đây để bạn vừa nhìn theo vừa vẽ.
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
    </section>
  );
}
