import { Flame, Star, TrendingUp } from 'lucide-react'
import React from 'react'
import Link from 'next/link'
import {ImageWithFallback} from '../../../components/ImageWithFallback'
import { mangaList } from '../../../components/data/mangas'
const WeeklyRanking = () => {
  return (
     <section className="py-10 bg-[#090511]">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center gap-2 mb-5">
            <Flame className="w-5 h-5 text-rose-400" />
            <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-xl">Top đọc nhiều nhất tuần</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[...mangaList].sort((a, b) => b.score - a.score).slice(0, 4).map((m, i) => (
              <Link
                key={m.slug}
                href={`/manga/${m.slug}`}
                className="group flex gap-3 p-3 rounded-2xl bg-white/[0.025] border border-white/8 hover:border-violet-400/20 transition"
              >
                <div className="relative w-14 h-20 rounded-lg overflow-hidden shrink-0">
                  <ImageWithFallback src={m.cover} alt={m.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  <div className={`absolute inset-x-0 bottom-0 py-0.5 text-center text-[9px] ${i === 0 ? "bg-yellow-400 text-black" : i === 1 ? "bg-gray-400 text-black" : i === 2 ? "bg-amber-700 text-white" : "bg-black/60 text-white/60"}`}>
                    #{i + 1}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm truncate group-hover:text-violet-300 transition">{m.t}</div>
                  <div className="text-white/40 text-xs mt-0.5">{m.author}</div>
                  <div className="flex items-center gap-1 mt-1.5 text-yellow-300 text-xs">
                    <Star className="w-3 h-3 fill-yellow-300" />{m.score}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-white/30 text-[10px]">
                    <TrendingUp className="w-3 h-3" /> {["3.2M","2.1M","1.8M","950K"][i]} lượt đọc
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
  )
}

export default WeeklyRanking