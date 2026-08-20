import Link from "next/link";
import { ChevronRight, Clapperboard, Play, Star } from "lucide-react";
import { ImageWithFallback } from "../../../components/ImageWithFallback";
import { liveFeatured } from "../../../components/data/catalog";
import type { Title } from "../../../components/data/catalog";

export default function FeaturedFilmSection({ films }: { films: Title[] }) {
  return (
    <section className="py-10 bg-[#0b0612]">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-6">
          <Link href={liveFeatured.href ?? "/phim"} className="relative rounded-3xl overflow-hidden h-80 group">
            <ImageWithFallback src={liveFeatured.img} alt={liveFeatured.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute inset-0 p-6 flex flex-col justify-end">
              <div className="flex gap-2 mb-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-rose-500 text-white text-[10px] tracking-widest">4K HDR</span>
                {liveFeatured.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded bg-white/10 text-white/80 text-[10px]">{t}</span>
                ))}
              </div>
              <h3 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-2xl md:text-3xl">{liveFeatured.title}</h3>
              <p className="text-white/60 text-sm mt-2 line-clamp-2">{liveFeatured.desc}</p>
              <div className="mt-4 inline-flex items-center gap-2 h-10 px-5 rounded-full bg-white text-black text-sm w-fit hover:bg-rose-100 transition">
                <Play className="w-3.5 h-3.5 fill-black" /> Xem ngay
              </div>
            </div>
          </Link>

          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <div className="flex items-center gap-2 mb-4 text-white/80">
              <Clapperboard className="w-4 h-4 text-rose-300" />
              <span>Premiere tuần này</span>
            </div>
            <div className="space-y-3">
              {films.slice(0, 5).map((f) => (
                <Link
                  key={f.slug}
                  href={`/phim/${f.slug}`}
                  className="flex gap-3 items-center group hover:bg-white/5 rounded-xl p-2 -mx-2 transition"
                >
                  <div className="relative w-14 h-20 rounded-lg overflow-hidden shrink-0">
                    <ImageWithFallback src={f.img} alt={f.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm truncate group-hover:text-rose-300 transition">{f.t}</div>
                    {f.director && <div className="text-white/40 text-xs mt-0.5">Đạo diễn: {f.director}</div>}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="flex items-center gap-1 text-yellow-300 text-xs"><Star className="w-3 h-3 fill-yellow-300" />{f.score}</span>
                      <span className="text-white/30 text-xs">· {f.year}</span>
                      <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-white/50">{f.tags[0]}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-rose-300 transition shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
