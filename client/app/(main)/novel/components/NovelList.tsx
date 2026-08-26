import React from 'react'
import { READING_COUNTS } from '../data'
import { BookMarked, Clock, Feather, Star, Users } from 'lucide-react'
import Link from 'next/link'
import { ImageWithFallback } from '@/app/components/ImageWithFallback'
import { Novel } from '@/app/components/data/novels'

const NovelList = ({ filtered }: { filtered: Novel[] }) => {
  return (
      <section className="py-12 bg-[#0b0612]">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-white/40 text-sm mb-5">{filtered.length} tác phẩm</div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((n, i) => (
              <div
                key={n.slug}
                className={`group rounded-2xl border border-white/10 bg-gradient-to-br from-amber-50/[0.03] to-transparent overflow-hidden hover:border-amber-400/30 hover:shadow-[0_8px_30px_rgba(245,158,11,0.08)] transition-all animate-fadeInUp delay-${Math.min((i % 6) * 100, 500)}`}
              >
                <div className="flex">
                  {/* Book cover */}
                  <div className="w-32 shrink-0 relative">
                    <ImageWithFallback src={n.cover} alt={n.t} className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-y-0 right-0 w-2 bg-gradient-to-r from-transparent to-black/60" />
                  </div>

                  {/* Info */}
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex-1">
                      <div style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-base leading-tight group-hover:text-amber-200 transition">{n.t}</div>
                      <div className="text-xs text-white/50 mt-1">— {n.author}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-white/40 mt-2">
                        <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-yellow-300 text-yellow-300" />{n.score}</span>
                        <span className="flex items-center gap-1"><BookMarked className="w-3 h-3" />{n.words}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] ${n.status === "Đang viết" ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-white/50"}`}>{n.status}</span>
                      </div>
                      <p className="text-white/60 text-xs mt-2 line-clamp-2 leading-relaxed">{n.synopsis}</p>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {n.tags.slice(0, 2).map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/15 text-[10px] text-amber-300/60">{t}</span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Link
                        href={`/novel/${n.slug}/1`}
                        className="flex-1 h-8 rounded-full bg-gradient-to-r from-amber-400/80 to-orange-400/80 text-black text-xs flex items-center justify-center gap-1 hover:from-amber-400 hover:to-orange-400 transition"
                      >
                        <Feather className="w-3 h-3" /> Đọc thử
                      </Link>
                      <Link
                        href={`/novel/${n.slug}`}
                        className="h-8 px-3 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs flex items-center gap-1 hover:text-white hover:border-white/20 transition"
                      >
                        Chi tiết
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Progress hint */}
                <div className="px-4 pb-3 flex items-center justify-between text-[10px] text-white/30">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />~{Math.ceil(parseInt(n.words) * 1000 / 250 / 60)}h đọc</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{READING_COUNTS.find((r) => r.slug === n.slug)?.count} đọc giả</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

  )
}

export default NovelList