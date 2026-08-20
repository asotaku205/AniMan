import { ImageWithFallback } from '@/app/components/ImageWithFallback'
import { ChevronRight, Grid3x3, List, Star } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

const ProfileWatchList = ({ watchlistItems, watchlistView, setWatchlistView }: { watchlistItems: any[]; watchlistView: "grid" | "list"; setWatchlistView: (view: "grid" | "list") => void }) => {
  return (
    <div className="pb-16">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-white/50 text-sm">{watchlistItems.length} tác phẩm</div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setWatchlistView("grid")}
                      className={`p-2 rounded-lg transition ${watchlistView === "grid" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
                    >
                      <Grid3x3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setWatchlistView("list")}
                      className={`p-2 rounded-lg transition ${watchlistView === "list" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
    
                {watchlistView === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {watchlistItems.map((item) => (
                      <Link
                        key={item.slug}
                        href={item.link}
                        className="group relative rounded-xl overflow-hidden aspect-[3/4] block"
                      >
                        <ImageWithFallback
                          src={item.img}
                          alt={item.t}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <div className="text-[11px] text-pink-300 mb-0.5">{item.mediaType}</div>
                          <div className="text-white text-xs truncate">{item.t}</div>
                          <div className="flex items-center gap-1 text-yellow-300 text-[10px] mt-1">
                            <Star className="w-2.5 h-2.5 fill-yellow-300" /> {item.score}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {watchlistItems.map((item) => (
                      <Link
                        key={item.slug}
                        href={item.link}
                        className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition group"
                      >
                        <div className="w-14 h-20 rounded-lg overflow-hidden shrink-0">
                          <ImageWithFallback src={item.img} alt={item.t} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm group-hover:text-pink-300 transition truncate">{item.t}</div>
                          <div className="text-white/40 text-xs mt-1">{item.mediaType} · {item.year}</div>
                          <div className="flex items-center gap-1 text-yellow-300 text-xs mt-1">
                            <Star className="w-3 h-3 fill-yellow-300" /> {item.score}/10
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
  )
}

export default ProfileWatchList