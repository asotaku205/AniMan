import Link from "next/link";
import { Award, ChevronRight, Star } from "lucide-react";
import { ImageWithFallback } from "../../../components/ImageWithFallback";
import type { Title } from "../../../components/data/catalog";

export function CompletedAnime({ items }: { items: Title[] }) {
  return (
    <section className="py-10 bg-[#0b0612]">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-xl">Đã hoàn thành</h2>
          </div>
          <Link href="/anime" className="text-pink-300/70 text-sm hover:text-pink-300 flex items-center gap-1 transition">
            Xem thêm <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.filter((a) => a.status === "Đã hoàn thành").slice(0, 4).map((a) => (
            <Link key={a.slug} href={`/anime/${a.slug}`} className="group relative aspect-video rounded-2xl overflow-hidden">
              <ImageWithFallback src={a.banner} alt={a.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              <div className="absolute inset-0 p-3 flex flex-col justify-end">
                <div className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[9px] w-fit tracking-wider">HOÀN THÀNH</div>
                <div className="text-white text-sm mt-1 group-hover:text-pink-300 transition">{a.t}</div>
                <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                  <Star className="w-3 h-3 fill-yellow-300 text-yellow-300" />{a.score}
                  <span>·</span>{a.ep} tập
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
