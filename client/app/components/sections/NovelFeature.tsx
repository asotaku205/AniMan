import Link from "next/link";
import { Feather } from "lucide-react";
import { ImageWithFallback } from "../ImageWithFallback";
import { novelList } from "../../(main)/data";
import { SectionHeader } from "./SectionHeader";

export function NovelFeature() {
  const featured = novelList[0];
  const rest     = novelList.slice(1, 5);

  return (
    <section className="py-14 bg-gradient-to-b from-[#0b0612] to-[#1a0f06]">
      <div className="max-w-[1400px] mx-auto px-6">
        <SectionHeader eyebrow="Tiểu thuyết" title="Văn học & Tiểu thuyết" seeAll="/novel" />
        <div className="grid md:grid-cols-[260px_1fr] gap-8 items-center">
          {/* Featured book cover */}
          <Link
              href={`/novel/${featured.slug}`}
            className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)] block hover:shadow-[0_30px_80px_-20px_rgba(245,158,11,0.3)] transition-all"
          >
            <ImageWithFallback src={featured.cover} alt={featured.t} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/60 to-transparent" />
          </Link>

          {/* Info */}
          <div>
            <div className="text-amber-300/80 tracking-[0.4em] text-xs uppercase mb-2">Tác phẩm đặc sắc</div>
            <h3 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-3xl md:text-4xl">
              {featured.t}
            </h3>
            <div className="text-white/50 mt-1">— {featured.author}, {featured.publisher}</div>
            <p className="mt-4 text-white/70 max-w-2xl leading-relaxed italic" style={{ fontFamily: "Caveat, cursive", fontSize: "1.3rem" }}>
              "{featured.excerpt}"
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {featured.tags.map((t) => (
                <span key={t} className="px-3 h-7 leading-7 rounded-full bg-amber-400/10 border border-amber-400/20 text-xs text-amber-300/70">
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <Link href={`/novel/${featured.slug}/1`} className="px-5 h-11 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-black inline-flex items-center gap-2">
                <Feather className="w-4 h-4" /> Đọc thử
              </Link>
              <Link href={`/novel/${featured.slug}`} className="px-5 h-11 rounded-full bg-white/5 border border-white/15 text-white inline-flex items-center gap-2 hover:bg-white/10 transition">
                Xem chi tiết
              </Link>
            </div>

            {/* Other novels */}
            <div className="mt-6 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {rest.map((n) => (
                <Link key={n.slug} href={`/novel/${n.slug}`} className="group relative shrink-0 w-20">
                  <div className="aspect-[2/3] rounded-lg overflow-hidden ring-1 ring-white/10 group-hover:ring-amber-400/30 transition">
                    <ImageWithFallback src={n.cover} alt={n.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  </div>
                  <div className="text-white/50 text-[10px] mt-1 truncate group-hover:text-amber-300 transition">{n.t}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
