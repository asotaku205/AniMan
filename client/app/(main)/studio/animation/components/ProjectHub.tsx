"use client";

import Link from "next/link";
import { BookOpen, Clock, Languages, Play, Plus } from "lucide-react";
import { ImageWithFallback } from "@/app/components/ImageWithFallback";
import { ModeCard } from "./ModeCard";
import { recentProjects } from "../data";

export function ProjectHub() {
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ModeCard
          href="/studio/animation/manga-to-anim"
          icon={<BookOpen className="w-6 h-6" />}
          eyebrow="Sáng tạo"
          title="Manga → Animation"
          desc="Biến những trang truyện tranh bạn vẽ thành một bộ phim hoạt hình hoàn chỉnh. AI sẽ tách panel, gán chuyển động camera, lồng tiếng nhân vật và nhạc nền."
          gradient="from-pink-500 via-rose-500 to-orange-400"
          glow="rgba(255,90,150,0.35)"
          steps={["Chọn manga nguồn", "Gán chuyển động", "Voice & SFX", "Render & xuất bản"]}
          cta="Bắt đầu chuyển thể"
        />
        <ModeCard
          href="/studio/animation/translate-edit"
          icon={<Languages className="w-6 h-6" />}
          eyebrow="Dịch & Biên tập"
          title="Translate & Edit"
          desc="Import phim hoạt hình có sẵn để dịch lời thoại sang 12 ngôn ngữ, gắn phụ đề chuẩn, lồng tiếng AI giữ nguyên cảm xúc gốc và cắt ghép tinh chỉnh."
          gradient="from-violet-500 via-fuchsia-500 to-pink-400"
          glow="rgba(180,120,255,0.35)"
          steps={["Phụ đề tự động", "Lồng tiếng AI", "Bản dịch song ngữ", "Cắt ghép timeline"]}
          cta="Mở workspace dịch"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] tracking-[0.3em] text-pink-300/70">DỰ ÁN GẦN ĐÂY</div>
            <div className="text-xl mt-1 font-semibold">Tiếp tục nơi bạn dừng lại</div>
          </div>
          <button className="flex items-center gap-2 px-4 h-10 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition">
            <Plus className="w-4 h-4" /> Dự án trống mới
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {recentProjects.map((p) => (
            <div key={p.name} className="group text-left rounded-2xl overflow-hidden border border-white/10 bg-[#0d0817] hover:border-pink-400/40 transition cursor-pointer">
              <div className="relative aspect-video overflow-hidden">
                <ImageWithFallback src={p.thumb} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur text-[10px] tracking-widest">{p.duration}</span>
                <span className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-pink-500 grid place-items-center opacity-0 group-hover:opacity-100 transition shadow-lg">
                  <Play className="w-4 h-4 fill-white" />
                </span>
              </div>
              <div className="p-3">
                <div className="text-sm truncate font-medium">{p.name}</div>
                <div className="text-[11px] text-white/40 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> {p.updated}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
