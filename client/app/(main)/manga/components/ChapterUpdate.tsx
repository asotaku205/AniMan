import { ImageWithFallback } from '@/app/components/ImageWithFallback'
import { ChevronRight, Clock } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { NEW_CHAPTERS } from '../data'
export const ChapterUpdate = () => {
  return (
     <section className="py-10 bg-[#090511] border-y border-white/5">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-xl">Chương mới nhất</h2>
            </div>
            <Link href="/manga" className="text-violet-300/70 text-sm hover:text-violet-300 flex items-center gap-1 transition">
              Xem hết <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {NEW_CHAPTERS.map((m) => (
              <Link
                key={m.slug}
                href={`/manga/${m.slug}/${m.newChapter}`}
                className="group relative shrink-0 w-40 rounded-2xl overflow-hidden bg-white/[0.025] border border-white/8 hover:border-violet-400/30 transition"
              >
                <div className="relative aspect-[2/3]">
                  <ImageWithFallback src={m.cover} alt={m.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-emerald-500/80 text-white text-[9px]">
                    CH.{m.newChapter} MỚI
                  </div>
                </div>
                <div className="p-2.5">
                  <div className="text-white text-xs truncate group-hover:text-violet-300 transition">{m.t}</div>
                  <div className="text-white/40 text-[10px] mt-0.5 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />{m.timeAgo}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
  )
}
