import Link from "next/link";
import { ChevronRight, Eye, Play } from "lucide-react";
import { ImageWithFallback } from "../ImageWithFallback";
import { CONTINUE_WATCHING } from "../../(main)/data";

export function ContinueWatching() {
  return (
    <section className="py-12 bg-[#0b0612]">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-white">
            <Play className="w-4 h-4 text-pink-300 fill-pink-300" />
            <span style={{ fontFamily: "Shippori Mincho, serif" }} className="text-xl">
              Tiếp tục xem
            </span>
          </div>
          <Link href="/anime" className="text-white/40 text-sm hover:text-pink-300 transition flex items-center gap-1">
            Xem lịch sử <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {CONTINUE_WATCHING.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className="group relative shrink-0 w-56 rounded-2xl overflow-hidden bg-white/[0.025] border border-white/8 hover:border-pink-400/30 transition-all hover:shadow-[0_8px_30px_rgba(255,90,150,0.1)]"
            >
              <div className="relative aspect-video overflow-hidden">
                <ImageWithFallback src={item.img} alt={item.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                    <Play className="w-5 h-5 fill-white text-white" />
                  </div>
                </div>
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px]">
                  {item.type === "phim" ? "Phim" : `Tập ${item.epCurrent}`}
                </div>
                {/* Progress bar */}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                  <div className="h-full bg-gradient-to-r from-pink-400 to-rose-300" style={{ width: `${item.progress}%` }} />
                </div>
              </div>
              <div className="p-3">
                <div className="text-white text-sm truncate group-hover:text-pink-300 transition">{item.t}</div>
                <div className="text-white/40 text-xs mt-0.5 flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {item.progress}% đã xem
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
