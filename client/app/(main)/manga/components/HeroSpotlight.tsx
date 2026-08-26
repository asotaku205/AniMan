import { Manga } from '@/app/components/data/mangas';
import { ImageWithFallback } from '@/app/components/ImageWithFallback'
import { BookOpen, Crown, Star, Zap } from 'lucide-react'
import Link from 'next/link'
type HeroSpotlightProps = {
  top: Manga[];
  spotItem: Manga;
  spotIdx: number;
  setSpotIdx: (idx: number) => void;
}
const HeroSpotlight = ({ top, spotItem, spotIdx, setSpotIdx }: HeroSpotlightProps) => {
  return (
    <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <ImageWithFallback src={spotItem.banner} alt={spotItem.t} className="absolute inset-0 w-full h-full object-cover opacity-20 scale-110 blur-sm" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b0612] via-[#0b0612]/85 to-[#0b0612]/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0612] via-transparent to-transparent" />
        </div>

        <div className="relative max-w-[1400px] mx-auto px-6 pt-14 pb-16">
          <div className="grid md:grid-cols-[1fr_380px] gap-8 items-center">
            {/* Left: info */}
            <div className="animate-fadeInUp">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs tracking-widest">
                  MANGA BẢN QUYỀN
                </span>
                <span className="flex items-center gap-1 text-emerald-400 text-xs">
                  <Zap className="w-3 h-3" /> Cập nhật hàng tuần
                </span>
              </div>
              <h1 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-4xl md:text-5xl leading-tight">
                {spotItem.t}
              </h1>
              <div className="flex items-center gap-4 mt-3 text-sm text-white/60">
                <span className="text-white">{spotItem.author}</span>
                <span className="flex items-center gap-1.5 text-yellow-300">
                  <Star className="w-4 h-4 fill-yellow-300" />
                  <span className="text-white">{spotItem.score}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />{spotItem.chapters.length} chương
                </span>
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                {spotItem.tags.map((t) => (
                  <span key={t} className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/70 text-xs">{t}</span>
                ))}
              </div>
              <p className="mt-4 text-white/70 max-w-lg line-clamp-2 leading-relaxed">{spotItem.synopsis}</p>
              <div className="mt-6 flex gap-3">
                <Link
                  href={`/manga/${spotItem.slug}/${spotItem.chapters[0].n}`}
                  className="h-11 px-5 rounded-full bg-white text-black inline-flex items-center gap-2 hover:bg-violet-100 transition shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                >
                  <BookOpen className="w-4 h-4" /> Đọc ngay
                </Link>
                <Link
                  href={`/manga/${spotItem.slug}`}
                  className="h-11 px-5 rounded-full bg-white/5 border border-white/20 text-white inline-flex items-center gap-2 hover:bg-white/10 transition"
                >
                  Chi tiết
                </Link>
              </div>
            </div>

            {/* Right: top 3 selector */}
            <div className="flex flex-col gap-3 animate-fadeInUp delay-200">
              {top.map((m, i) => (
                <button
                  key={m.slug}
                  onClick={() => setSpotIdx(i)}
                  className={`relative group flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${i === spotIdx ? "border-violet-400/50 bg-gradient-to-r from-violet-500/15 to-purple-500/5" : "border-white/8 bg-white/[0.025] hover:border-white/15"}`}
                >
                  <div className="relative w-12 h-16 rounded-xl overflow-hidden shrink-0">
                    <ImageWithFallback src={m.cover} alt={m.t} className="w-full h-full object-cover" />
                    <div className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent`} />
                    <div className="absolute inset-x-0 bottom-1 text-center text-[9px] text-white/80">#{i+1}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm truncate ${i === spotIdx ? "text-violet-200" : "text-white"} group-hover:text-violet-300 transition`}>{m.t}</div>
                    <div className="text-white/40 text-xs mt-0.5">{m.author}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="flex items-center gap-1 text-yellow-300 text-xs"><Star className="w-3 h-3 fill-yellow-300" />{m.score}</span>
                      <span className="text-white/30 text-[10px]">{m.chapters.length} ch.</span>
                    </div>
                  </div>
                  {i === 0 && <Crown className="w-4 h-4 text-yellow-400 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
  )
}

export default HeroSpotlight