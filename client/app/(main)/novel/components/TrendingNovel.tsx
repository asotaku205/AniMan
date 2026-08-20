import { novelList } from '@/app/components/data/novels'
import { ImageWithFallback } from '@/app/components/ImageWithFallback'
import { Star, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

const TrendingNovel = () => {
  return (
      <section className="py-12 bg-[#090511]">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-xl">Được đọc nhiều nhất</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {novelList.map((n, i) => (
              <Link key={n.slug} href={`/novel/${n.slug}`} className="group">
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden ring-1 ring-white/10 group-hover:ring-amber-400/30 transition mb-2">
                  <ImageWithFallback src={n.cover} alt={n.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-yellow-300 flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5 fill-yellow-300" />{n.score}
                  </div>
                  <div className="absolute top-1 left-1 w-5 h-5 rounded bg-black/60 flex items-center justify-center text-[9px] text-white/60">{i + 1}</div>
                </div>
                <div className="text-white text-xs truncate group-hover:text-amber-300 transition" style={{ fontFamily: "Shippori Mincho, serif" }}>{n.t}</div>
                <div className="text-white/40 text-[10px] mt-0.5 truncate">{n.author}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>
  )
}

export default TrendingNovel