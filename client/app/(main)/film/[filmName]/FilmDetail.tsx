import Link from "next/link"
import { Play, Plus, Share2, Star, Calendar, Clock, Film, ThumbsUp, MessageCircle } from "lucide-react";
import { liveList,Title } from "../../../components/data/catalog";
import { ImageWithFallback } from "../../../components/ImageWithFallback";

export function FilmDetailPage({film}:{film: Title}) {
  const a = film;
  const related = liveList.filter((x) => x.slug !== a.slug && x.tags.some((t) => a.tags.includes(t))).slice(0, 4);

  return (
    <>
      {/* Cinematic 21:9 hero with simulated trailer */}
      <section className="relative aspect-[21/9] min-h-[480px] overflow-hidden">
        <ImageWithFallback src={a.banner} alt={a.t} className="absolute inset-0 w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0612] via-[#0b0612]/30 to-transparent" />
        <div className="absolute inset-0 bg-[linear-gradient(transparent_0%,transparent_92%,#0b0612_100%)]" />
        <button className="absolute inset-0 grid place-items-center group">
          <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur border border-white/30 grid place-items-center group-hover:bg-white/20 transition">
            <div className="w-16 h-16 rounded-full bg-white/90 grid place-items-center">
              <div className="w-0 h-0 border-l-[18px] border-l-black border-y-[12px] border-y-transparent ml-1" />
            </div>
          </div>
          <span className="absolute bottom-10 text-white/80 text-sm tracking-widest uppercase">Xem trailer · 1:42</span>
        </button>
        <div className="absolute top-8 left-8 px-2 py-1 rounded bg-black/60 backdrop-blur text-[10px] text-white tracking-widest">CINEMA · 4K HDR · DOLBY ATMOS</div>
      </section>

      {/* Title block */}
      <section className="relative -mt-24 pb-12 z-10">
        <div className="max-w-[1400px] mx-auto px-6 grid md:grid-cols-[200px_1fr] gap-8 items-end">
          <div className="hidden md:block w-[200px] aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
            <ImageWithFallback src={a.img} alt={a.t} className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-2 py-1 rounded bg-rose-500 text-white text-[10px] tracking-widest">PHIM ĐIỆN ẢNH</span>
              {a.tags.map((t) => <span key={t} className="px-2 py-1 rounded bg-white/10 backdrop-blur border border-white/15 text-[10px] text-white/80">{t}</span>)}
            </div>
            <h1 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-5xl md:text-7xl leading-[1] tracking-tight max-w-4xl">{a.t}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-white/70">
              <span className="flex items-center gap-1.5"><Star className="w-4 h-4 fill-yellow-300 text-yellow-300" /><span className="text-white">{a.score}</span></span>
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{a.year}</span>
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />1h 48m</span>
              <span className="flex items-center gap-1.5"><Film className="w-4 h-4" />Đạo diễn {a.director}</span>
            </div>
            <p className="mt-5 text-white/70 max-w-3xl leading-relaxed">{a.synopsis}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={`/film/${a.slug}/`} className="h-12 px-6 rounded-full bg-white text-black inline-flex items-center gap-2 hover:bg-pink-100 transition"><Play className="w-4 h-4 fill-black" /> Xem phim</Link>
              <button className="h-12 px-6 rounded-full bg-white/5 border border-white/20 text-white inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Lưu</button>
              <button className="h-12 w-12 rounded-full bg-white/5 border border-white/20 text-white grid place-items-center"><Share2 className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </section>

      {/* Cast strip */}
      <section className="py-12 bg-[#0b0612] border-t border-white/5">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-pink-300/80 tracking-[0.4em] text-xs uppercase mb-5">Diễn viên & ê-kíp</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {a.cast.map((c) => (
              <div key={c.name} className="text-center">
                <div className="aspect-square rounded-full overflow-hidden ring-2 ring-pink-400/20">
                  <ImageWithFallback src={c.img} alt={c.name} className="w-full h-full object-cover" />
                </div>
                <div className="text-white text-sm mt-2">{c.name}</div>
                <div className="text-pink-300/70 text-xs">{c.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews + Related */}
      <section className="py-12 bg-[#0b0612] grid lg:grid-cols-[1fr_360px] gap-10 max-w-[1400px] mx-auto px-6">
        <div>
          <div className="text-pink-300/80 tracking-[0.4em] text-xs uppercase mb-5">Bình luận</div>
          <div className="space-y-4">
            {a.reviews.map((r) => (
              <article key={r.user} className="rounded-2xl border border-white/10 bg-[#0d0817] p-5">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${r.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-white">{r.user}</span>
                      <span className="text-white/40 text-xs">· {r.time} trước</span>
                      <span className="ml-auto flex items-center gap-1 text-yellow-300"><Star className="w-3 h-3 fill-yellow-300" />{r.rating}</span>
                    </div>
                    <p className="mt-2 text-white/80">{r.comment}</p>
                    <div className="mt-3 flex items-center gap-4 text-xs text-white/50">
                      <button className="flex items-center gap-1 hover:text-pink-300"><ThumbsUp className="w-3 h-3" /> 86</button>
                      <button className="flex items-center gap-1 hover:text-pink-300"><MessageCircle className="w-3 h-3" /> Trả lời</button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
        <aside>
          <div className="text-pink-300/80 tracking-[0.4em] text-xs uppercase mb-5">Phim tương tự</div>
          <div className="space-y-3">
            {related.map((r) => (
              <Link key={r.slug} href={`film/${r.slug}`} className="flex gap-3 p-2 rounded-xl hover:bg-white/5">
                <div className="w-20 h-28 rounded-lg overflow-hidden">
                  <ImageWithFallback src={r.img} alt={r.t} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-white text-sm">{r.t}</div>
                  <div className="text-xs text-white/50 mt-1">{r.year}</div>
                  <div className="flex items-center gap-1 text-xs text-yellow-300 mt-1"><Star className="w-3 h-3 fill-yellow-300" />{r.score}</div>
                </div>
              </Link>
            ))}
          </div>
        </aside>
      </section>
    </>
  );
}