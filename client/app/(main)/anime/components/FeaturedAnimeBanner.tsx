import Link from "next/link";
import { Play, Zap } from "lucide-react";
import { animeFeatured } from "../../../components/data/catalog";
import { ImageWithFallback } from "../../../components/ImageWithFallback";

export function FeaturedAnimeBanner() {
  return (
    <section className="py-10 bg-[#090511]">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 text-pink-300/70 text-xs uppercase tracking-[0.4em] mb-1">
              <Zap className="w-3.5 h-3.5" /> Simulcast
            </div>
            <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-2xl">Đang chiếu mùa này</h2>
          </div>
        </div>

        <div className="relative rounded-3xl overflow-hidden h-72 md:h-96 mb-4 group">
          <ImageWithFallback src={animeFeatured.img} alt={animeFeatured.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute inset-0 p-8 flex flex-col justify-end">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-1 rounded bg-pink-500 text-white text-[10px] tracking-widest">SIMULCAST</span>
              {animeFeatured.tags.map((t) => (
                <span key={t} className="px-2 py-1 rounded bg-white/10 border border-white/15 text-white/80 text-[10px]">{t}</span>
              ))}
            </div>
            <h3 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-3xl md:text-5xl max-w-xl">
              {animeFeatured.title}
            </h3>
            <p className="mt-3 text-white/60 max-w-lg text-sm line-clamp-2">{animeFeatured.desc}</p>
            <div className="mt-5 flex gap-3">
              <Link href={animeFeatured.href ?? "/anime"} className="h-11 px-5 rounded-full bg-white text-black flex items-center gap-2 hover:bg-pink-100 transition">
                <Play className="w-4 h-4 fill-black" /> Xem ngay
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
