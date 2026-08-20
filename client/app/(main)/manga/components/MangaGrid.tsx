import React from 'react'
import Link from 'next/link'
import {ImageWithFallback} from '../../../components/ImageWithFallback'
import { BookOpen, Star, ChevronRight, ArrowRight } from 'lucide-react'
import { Manga } from '../../../components/data/mangas'
export const MangaGrid = ({ filtered, genre, view }: { filtered: Manga[], genre: string, view: string }) => {
  return (
     <section className="py-10 bg-[#0b0612]">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center justify-between mb-5">
            <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-2xl">
              {filtered.length} manga {genre !== "Tất cả" ? `· ${genre}` : ""}
            </h2>
          </div>

          {view === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map((m, i) => (
                <Link
                  href={`/manga/${m.slug}`}
                  key={m.slug}
                  className={`group rounded-2xl overflow-hidden bg-white/[0.03] border border-white/10 hover:border-violet-400/40 hover:shadow-[0_8px_30px_rgba(139,92,246,0.15)] transition-all animate-fadeInUp delay-${Math.min((i % 5) * 100, 400)}`}
                >
                  <div className="relative aspect-[3/4]">
                    <ImageWithFallback src={m.cover} alt={m.t} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    {/* Score */}
                    <div className="absolute top-2 right-2 flex items-center gap-0.5 px-2 py-1 rounded-full bg-black/60 backdrop-blur">
                      <Star className="w-3 h-3 fill-yellow-300 text-yellow-300" /><span className="text-yellow-200 text-xs">{m.score}</span>
                    </div>
                    {/* Status */}
                    <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] tracking-wider ${m.status === "Đang ra" ? "bg-emerald-500/80 text-white" : m.status === "Tạm ngưng" ? "bg-amber-500/80 text-white" : "bg-white/20 text-white"}`}>
                      {m.status}
                    </div>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-violet-600/15 opacity-0 group-hover:opacity-100 transition" />
                    <div className="absolute inset-x-0 bottom-10 flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200">
                      <div className="flex items-center gap-1 h-8 px-4 rounded-full bg-violet-500/80 backdrop-blur text-white text-xs">
                        <BookOpen className="w-3 h-3" /> Đọc ngay
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <div style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-sm group-hover:text-violet-300 transition">{m.t}</div>
                    <div className="text-xs text-white/50 mt-0.5 truncate">{m.author}</div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-white/50 flex items-center gap-1"><BookOpen className="w-3 h-3" />{m.chapters.length} ch.</span>
                      <span className="text-violet-300 flex items-center gap-0.5">Đọc <ArrowRight className="w-3 h-3" /></span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((m, i) => (
                <Link
                  href={`/manga/${m.slug}`}
                  key={m.slug}
                  className="group flex gap-4 p-3 rounded-2xl bg-white/[0.025] border border-white/8 hover:border-violet-400/30 hover:bg-white/[0.045] transition animate-fadeInUp"
                >
                  <div className="relative w-16 h-22 shrink-0 rounded-xl overflow-hidden" style={{ height: "88px" }}>
                    <ImageWithFallback src={m.cover} alt={m.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white group-hover:text-violet-300 transition">{m.t}</div>
                      <div className="flex items-center gap-1 text-yellow-300 text-sm shrink-0">
                        <Star className="w-3.5 h-3.5 fill-yellow-300" />{m.score}
                      </div>
                    </div>
                    <div className="text-white/50 text-xs mt-0.5">{m.author} · {m.publisher}</div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-white/50 text-xs"><BookOpen className="w-3 h-3" />{m.chapters.length} chương</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] ${m.status === "Đang ra" ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50"}`}>{m.status}</span>
                    </div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {m.tags.slice(0, 3).map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300/70 text-[10px]">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end justify-between">
                    <span className="text-emerald-400 text-xs">CH.{m.chapters[0].n} MỚI</span>
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-violet-300 transition" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
  )
}
