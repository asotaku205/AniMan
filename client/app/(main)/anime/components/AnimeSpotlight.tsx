import Link from "next/link";
import { Play, Star, Tv, Users } from "lucide-react";
import { ImageWithFallback } from "../../../components/ImageWithFallback";
import type { SpotlightAnime } from "../data";

type AnimeSpotlightProps = {
  spot: SpotlightAnime;
  spotlights: SpotlightAnime[];
  activeSpot: number;
  onSelectSpot: (index: number) => void;
};

export function AnimeSpotlight({ spot, spotlights, activeSpot, onSelectSpot }: AnimeSpotlightProps) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 transition-all duration-700">
        <ImageWithFallback src={spot.banner} alt={spot.t} className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0612] via-[#0b0612]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0612] via-transparent to-[#0b0612]/60" />
      </div>

      <div className="relative max-w-[1400px] mx-auto px-6 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="animate-fadeInUp">
            <div className="flex items-center gap-2 mb-4">
              <span className={`px-2.5 py-1 rounded text-white text-[10px] tracking-widest ${spot.badgeColor}`}>{spot.badge}</span>
              <span className="flex items-center gap-1 text-emerald-400 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Tập {spot.ep_new} MỚI
              </span>
            </div>
            <h1 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-4xl md:text-5xl lg:text-6xl leading-tight">
              {spot.t}
            </h1>
            <div className="flex items-center gap-4 mt-4 text-sm text-white/60">
              <span className="flex items-center gap-1.5 text-yellow-300"><Star className="w-4 h-4 fill-yellow-300" /><span className="text-white">{spot.score}</span></span>
              <span className="flex items-center gap-1.5"><Tv className="w-4 h-4" />{spot.ep} tập</span>
              <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{spot.studio}</span>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {spot.tags.map((t) => (
                <span key={t} className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/70 text-xs">{t}</span>
              ))}
            </div>
            <p className="mt-4 text-white/70 max-w-md leading-relaxed line-clamp-2">{spot.synopsis}</p>
            <div className="mt-6 flex gap-3">
              <Link href={`/anime/${spot.slug}/xem/1`} className="h-12 px-6 rounded-full bg-white text-black inline-flex items-center gap-2 hover:bg-pink-100 transition shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                <Play className="w-4 h-4 fill-black" /> Xem ngay
              </Link>
              <Link href={`/anime/${spot.slug}`} className="h-12 px-6 rounded-full bg-white/5 border border-white/20 text-white inline-flex items-center gap-2 hover:bg-white/10 transition">
                Chi tiết
              </Link>
            </div>
          </div>

          <div className="flex gap-3 justify-end animate-fadeInUp delay-200">
            {spotlights.map((s, i) => (
              <button
                key={s.slug}
                onClick={() => onSelectSpot(i)}
                className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${i === activeSpot ? "w-48 md:w-56 ring-2 ring-pink-400/60" : "w-20 opacity-60 hover:opacity-80"}`}
              >
                <div className="aspect-[2/3] relative">
                  <ImageWithFallback src={s.img} alt={s.t} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  {i === activeSpot && (
                    <div className="absolute inset-x-0 bottom-0 p-2">
                      <div className="text-white text-xs truncate">{s.t}</div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
