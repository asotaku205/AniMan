import Link from "next/link";
import { Crown, Star } from "lucide-react";
import { ImageWithFallback } from "../../../components/ImageWithFallback";
import type { Title } from "../../../components/data/catalog";

export function TopRatedAnime({ items }: { items: Title[] }) {
  return (
    <section className="py-10 bg-[#090511]">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-center gap-2 mb-5">
          <Crown className="w-5 h-5 text-yellow-400" />
          <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-xl">Đánh giá cao nhất mùa này</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...items].sort((a, b) => b.score - a.score).slice(0, 4).map((a, i) => (
            <Link key={a.slug} href={`/anime/${a.slug}`} className="group flex gap-3 p-3 rounded-2xl bg-white/[0.025] border border-white/8 hover:bg-white/[0.05] hover:border-yellow-400/20 transition">
              <div className="relative w-14 h-20 rounded-lg overflow-hidden shrink-0">
                <ImageWithFallback src={a.img} alt={a.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-1">
                  {i === 0 && <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                  <span className="text-white/40 text-xs">#{i + 1}</span>
                </div>
                <div className="text-white text-sm truncate group-hover:text-pink-300 transition">{a.t}</div>
                <div className="text-white/40 text-xs mt-0.5">{a.ep} tập · {a.studio}</div>
                <div className="flex items-center gap-1 mt-1.5 text-yellow-300 text-xs">
                  <Star className="w-3 h-3 fill-yellow-300" />{a.score}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
