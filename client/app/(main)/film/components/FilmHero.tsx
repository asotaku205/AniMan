import Link from "next/link";
import { Calendar, Play, Star } from "lucide-react";
import { ImageWithFallback } from "../../../components/ImageWithFallback";
import type { Title } from "../../../components/data/catalog";

type FilmHeroProps = {
  hero: Title;
  heroFilms: Title[];
  heroIdx: number;
  onSelectHero: (index: number) => void;
};

export default function FilmHero({ hero, heroFilms, heroIdx, onSelectHero }: FilmHeroProps) {
  return (
    <section className="relative overflow-hidden h-[70vh] min-h-[520px]">
      <ImageWithFallback src={hero.banner} alt={hero.t} className="absolute inset-0 w-full h-full object-cover transition-all duration-700" />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0b0612] via-transparent to-transparent" />

      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-rose-500/30 via-pink-500/30 to-rose-500/30" />
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-rose-500/30 via-pink-500/30 to-rose-500/30" />

      <div className="relative h-full max-w-[1400px] mx-auto px-6 flex flex-col justify-end pb-16">
        <div className="max-w-2xl animate-fadeInUp">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2.5 py-1 rounded bg-rose-500 text-white text-[10px] tracking-widest">PREMIERE</span>
            {hero.tags.map((t) => (
              <span key={t} className="px-2 py-1 rounded bg-white/10 border border-white/15 text-white/80 text-[10px]">{t}</span>
            ))}
          </div>
          <h1 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-4xl md:text-6xl leading-tight">
            {hero.t}
          </h1>
          <div className="flex items-center gap-5 mt-3 text-sm text-white/60">
            <span className="flex items-center gap-1.5 text-yellow-300"><Star className="w-4 h-4 fill-yellow-300" /><span className="text-white">{hero.score}</span></span>
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{hero.year}</span>
            {hero.director && <span>Đạo diễn: <span className="text-white">{hero.director}</span></span>}
          </div>
          <p className="mt-3 text-white/60 max-w-md line-clamp-2">{hero.synopsis}</p>
          <div className="mt-6 flex gap-3">
            <Link href={`/film/${hero.slug}`} className="h-12 px-6 rounded-full bg-white text-black inline-flex items-center gap-2 hover:bg-rose-100 transition shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              <Play className="w-4 h-4 fill-black" /> Xem ngay
            </Link>
            <Link href={`/film/${hero.slug}`} className="h-12 px-6 rounded-full bg-white/5 border border-white/20 text-white inline-flex items-center gap-2 hover:bg-white/10 transition">
              Chi tiết
            </Link>
          </div>
        </div>

        <div className="mt-8 flex gap-2">
          {heroFilms.map((f, i) => (
            <button
              key={f.slug}
              onClick={() => onSelectHero(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition border text-left ${i === heroIdx ? "border-white/30 bg-white/10" : "border-white/10 bg-transparent hover:border-white/20"}`}
            >
              <div className="w-10 h-14 rounded-lg overflow-hidden shrink-0">
                <ImageWithFallback src={f.img} alt={f.t} className="w-full h-full object-cover" />
              </div>
              <div className="hidden sm:block">
                <div className="text-white text-xs truncate max-w-[100px]">{f.t}</div>
                <div className="text-white/40 text-[10px] flex items-center gap-1 mt-0.5"><Star className="w-2.5 h-2.5 fill-yellow-300 text-yellow-300" />{f.score}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
