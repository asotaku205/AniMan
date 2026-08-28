"use client";

import { useState } from "react";
import { Download, Film, Play, Share2 } from "lucide-react";
import { ImageWithFallback } from "@/app/components/ImageWithFallback";

interface RenderStepProps {
  manga: string;
  totalSec: number;
}

export function RenderStep({ manga, totalSec }: RenderStepProps) {
  const [progress, setProgress] = useState(72);
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="text-lg font-semibold">Render & xuất bản</div>
        <div className="text-xs text-white/50 mt-1">Xem trước thành phẩm và chia sẻ lên SakuraStream hoặc tải xuống.</div>
      </div>
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-white/10">
        <ImageWithFallback src="https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1400" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
        <div className="absolute bottom-6 inset-x-0 text-center">
          <div className="inline-block px-4 py-2 rounded bg-black/70 backdrop-blur text-lg" style={{ fontFamily: "Shippori Mincho, serif" }}>"{manga}"</div>
        </div>
        <div className="absolute top-4 left-4 px-2 py-1 rounded bg-pink-500/90 text-[10px] tracking-widest animate-pulse font-medium">RENDER · {progress}%</div>
        <button className="absolute bottom-3 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-white text-black grid place-items-center shadow-lg hover:scale-105 transition"><Play className="w-5 h-5 fill-black" /></button>
      </div>
      <div>
        <div className="flex items-center justify-between text-xs text-white/60 mb-2"><span>Tiến trình render</span><span>{progress}%</span></div>
        <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-full accent-pink-500" />
        <div className="text-[11px] text-white/40 mt-2">Độ dài ước tính: {Math.floor(totalSec / 60)}:{String(totalSec % 60).padStart(2, "0")} · 1080p · 24fps</div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <button className="h-12 rounded-xl bg-gradient-to-r from-pink-500 to-rose-400 flex items-center justify-center gap-2 font-medium text-sm hover:opacity-90 transition"><Download className="w-4 h-4" /> Tải MP4</button>
        <button className="h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-sm hover:bg-white/10 transition"><Share2 className="w-4 h-4" /> Đăng SakuraStream</button>
        <button className="h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-sm hover:bg-white/10 transition"><Film className="w-4 h-4" /> Lưu nháp</button>
      </div>
    </div>
  );
}
