"use client"
import Link from "next/link";

import { Play, Plus, Share2, Star, Calendar, Clock, Tv, Users, ThumbsUp, MessageCircle } from "lucide-react";
import { animeList, Title } from "../../../components/data/catalog";
import { ImageWithFallback } from "../../../components/ImageWithFallback";
import { useState } from "react";

export function AnimeDetailPage({anime}:{anime: Title}) {
  const a = anime;
  const [tab, setTab] = useState<"episodes" | "cast" | "reviews">("episodes");
  const related = animeList.filter((x) => x.slug !== a.slug && x.tags.some((t) => a.tags.includes(t))).slice(0, 4);

  return (
    <>
      {/* Cinematic banner */}
      <section className="relative h-[70vh] min-h-[520px] overflow-hidden">
        <ImageWithFallback src={a.banner} alt={a.t} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0612] via-[#0b0612]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0612] via-transparent to-transparent" />
        <div className="absolute bottom-12 inset-x-0">
          <div className="max-w-[1400px] mx-auto px-6 grid md:grid-cols-[260px_1fr] gap-8 items-end">
            <div className="hidden md:block w-[260px] aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
              <ImageWithFallback src={a.img} alt={a.t} className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="px-2 py-1 rounded bg-pink-500 text-white text-[10px] tracking-widest">{a.status.toUpperCase()}</span>
                {a.tags.map((t) => <span key={t} className="px-2 py-1 rounded bg-white/10 backdrop-blur border border-white/15 text-[10px] text-white/80">{t}</span>)}
              </div>
              <h1 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-5xl md:text-6xl leading-tight tracking-tight max-w-3xl">{a.t}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-white/70">
                <span className="flex items-center gap-1.5 text-yellow-300"><Star className="w-4 h-4 fill-yellow-300" /><span className="text-white">{a.score}</span> / 10</span>
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{a.year}</span>
                <span className="flex items-center gap-1.5"><Tv className="w-4 h-4" />{a.ep} tập</span>
                {a.studio && <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{a.studio}</span>}
                {a.director && <span>Đạo diễn: <span className="text-white">{a.director}</span></span>}
              </div>
              <p className="mt-5 text-white/70 max-w-2xl leading-relaxed">{a.synopsis}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={`/anime/${a.slug}/1`} className="h-12 px-6 rounded-full bg-white text-black inline-flex items-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:bg-pink-100 transition"><Play className="w-4 h-4 fill-black" /> Xem tập 1</Link>
                <button className="h-12 px-6 rounded-full bg-white/5 border border-white/20 text-white inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Danh sách</button>
                <button className="h-12 w-12 rounded-full bg-white/5 border border-white/20 text-white grid place-items-center"><Share2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="bg-[#0b0612] border-y border-white/5 sticky top-16 z-30 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-6 flex gap-6">
          {[
            { k: "episodes", l: "Danh sách tập" },
            { k: "cast", l: "Nhân vật" },
            { k: "reviews", l: "Bình luận" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as any)}
              className={`relative py-4 text-sm transition ${tab === t.k ? "text-white" : "text-white/50 hover:text-white"}`}
            >
              {t.l}
              {tab === t.k && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-400 to-rose-300" />}
            </button>
          ))}
        </div>
      </section>

      <section className="py-12 bg-[#0b0612]">
        <div className="max-w-[1400px] mx-auto px-6 grid lg:grid-cols-[1fr_320px] gap-10">
          <div>
            {tab === "episodes" && (
              <div className="grid sm:grid-cols-2 gap-3">
                {a.episodes?.map((e) => (
                  <Link key={e.n} href={`/anime/${a.slug}/${e.n}`} className="group flex gap-4 p-3 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition">
                    <div className="relative w-36 h-20 rounded-lg overflow-hidden shrink-0">
                      <ImageWithFallback src={e.img} alt={e.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 grid place-items-center opacity-0 group-hover:opacity-100 transition">
                        <Play className="w-5 h-5 fill-white text-white" />
                      </div>
                      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white flex items-center gap-1"><Clock className="w-3 h-3" />{e.runtime}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-pink-300 text-xs">Tập {e.n}</div>
                      <div className="text-white text-sm mt-0.5 truncate group-hover:text-pink-300 transition">{e.title}</div>
                      <div className="text-white/50 text-xs mt-1 line-clamp-2">{e.desc}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {tab === "cast" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {a.cast.map((c) => (
                  <div key={c.name} className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03]">
                    <div className="aspect-[4/5] relative">
                      <ImageWithFallback src={c.img} alt={c.name} className="absolute inset-0 w-full h-full object-cover" />
                    </div>
                    <div className="p-3">
                      <div className="text-white text-sm">{c.name}</div>
                      <div className="text-pink-300/70 text-xs">{c.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tab === "reviews" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 text-sm text-white/70"><MessageCircle className="w-4 h-4 text-pink-300" /> Viết bình luận</div>
                  <textarea className="mt-3 w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm outline-none placeholder:text-white/30" rows={3} placeholder="Chia sẻ cảm nhận của bạn..." />
                  <div className="mt-2 flex justify-end"><button className="px-4 h-9 rounded-full bg-gradient-to-r from-pink-500 to-rose-400 text-white text-sm">Đăng</button></div>
                </div>
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
                          <button className="flex items-center gap-1 hover:text-pink-300"><ThumbsUp className="w-3 h-3" /> 124</button>
                          <button className="flex items-center gap-1 hover:text-pink-300"><MessageCircle className="w-3 h-3" /> Trả lời</button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-white mb-3">Thông tin</div>
              <Info label="Trạng thái" value={a.status} />
              <Info label="Năm phát hành" value={String(a.year)} />
              <Info label="Số tập" value={`${a.ep}`} />
              {a.studio && <Info label="Studio" value={a.studio} />}
              {a.director && <Info label="Đạo diễn" value={a.director} />}
              <Info label="Thể loại" value={a.tags.join(", ")} />
            </div>
            <div className="rounded-2xl border border-pink-400/30 bg-gradient-to-br from-pink-500/10 via-fuchsia-500/5 to-transparent p-5">
              <div className="text-white">Mở Watch Party</div>
              <p className="text-white/60 text-sm mt-2">Xem cùng bạn bè trong phòng đồng bộ.</p>
              <Link href="/watch-party" className="mt-3 inline-block px-4 h-9 leading-9 rounded-full bg-white text-black text-sm">Tạo phòng</Link>
            </div>
          </aside>
        </div>

        {/* Related */}
        <div className="max-w-[1400px] mx-auto px-6 mt-16">
          <div className="text-pink-300/80 tracking-[0.4em] text-xs uppercase mb-4">Tương tự</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((r) => (
              <Link key={r.slug} href={`/anime/${r.slug}`} className="group relative aspect-[3/4] rounded-2xl overflow-hidden">
                <ImageWithFallback src={r.img} alt={r.t} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="text-white text-sm">{r.t}</div>
                  <div className="text-[10px] text-white/60">{r.ep} tập</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-white/5 last:border-0 text-sm">
      <span className="text-white/50">{label}</span>
      <span className="text-white text-right max-w-[60%]">{value}</span>
    </div>
  );
}