import Link from "next/link";
import { ChevronRight, Radio, Star, TrendingUp } from "lucide-react";
import { ImageWithFallback } from "../ImageWithFallback";
import { animeList } from "../../(main)/data";

export function TrendingStrip() {
  return (
    <section className="py-12 bg-[#090511]">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-white">
            <TrendingUp className="w-5 h-5 text-pink-300" />
            <span style={{ fontFamily: "Shippori Mincho, serif" }} className="text-xl">
              Đang xem nhiều nhất
            </span>
          </div>
          <Link href="/anime" className="text-pink-300/70 text-sm hover:text-pink-300 transition flex items-center gap-1">
            Tất cả <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide">
          {animeList.slice(0, 7).map((a, i) => (
            <Link key={a.slug} href={`/anime/${a.slug}`} className="group relative shrink-0 w-40 rounded-2xl overflow-hidden">
              <div className="relative h-56">
                <ImageWithFallback src={a.img} alt={a.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                <div className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center text-xs text-white/60">
                  {i + 1}
                </div>
                <div className="absolute top-2 right-2 flex items-center gap-0.5 text-yellow-300 text-xs">
                  <Star className="w-3 h-3 fill-yellow-300" />{a.score}
                </div>
                {i < 2 && (
                  <div className="absolute bottom-14 left-2 flex items-center gap-1 text-rose-300 text-[10px]">
                    <Radio className="w-2.5 h-2.5" />
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                    LIVE
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <div className="text-white text-sm truncate group-hover:text-pink-300 transition">{a.t}</div>
                <div className="text-white/40 text-xs mt-0.5">{a.ep} tập · {a.studio}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
