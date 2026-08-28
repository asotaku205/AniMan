"use client";

import { Check, Upload } from "lucide-react";
import { ImageWithFallback } from "@/app/components/ImageWithFallback";
import { mangaList, type Manga } from "@/app/components/data/mangas";

interface MangaSelectStepProps {
  selectedManga: string;
  onSelect: (slug: string) => void;
}

export function MangaSelectStep({ selectedManga, onSelect }: MangaSelectStepProps) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Chọn bộ manga để chuyển thể</div>
          <div className="text-xs text-white/50 mt-1">Có thể chọn cả tập hoặc từng chương riêng lẻ.</div>
        </div>
        <button className="flex items-center gap-2 px-3 h-9 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition">
          <Upload className="w-3.5 h-3.5" /> Tải lên trang riêng
        </button>
      </div>
      <div className="mt-5 grid grid-cols-4 gap-3">
        {mangaList.slice(0, 8).map((m: Manga) => {
          const active = m.slug === selectedManga;
          return (
            <button
              key={m.slug}
              onClick={() => onSelect(m.slug)}
              className={`relative rounded-xl overflow-hidden border transition ${active ? "border-pink-400 shadow-[0_0_24px_-4px_rgba(255,90,150,0.5)]" : "border-white/10 hover:border-white/25"}`}
            >
              <div className="aspect-[3/4]">
                <ImageWithFallback src={m.cover} alt={m.t} className="w-full h-full object-cover" />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                <div className="text-xs truncate font-medium">{m.t}</div>
              </div>
              {active && (
                <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-pink-500 grid place-items-center shadow">
                  <Check className="w-3.5 h-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
