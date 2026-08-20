import { ImageWithFallback } from '@/app/components/ImageWithFallback'
import React from 'react'

const ProfileCollection = ({ collectionItems, isOwnProfile, animeList }: { collectionItems: any[]; isOwnProfile: boolean; animeList: any[] }) => {
  return (
     <div className="pb-16">
            <div className="grid sm:grid-cols-2 gap-4">
              {collectionItems.map((col) => (
                <div
                  key={col.name}
                  className="group relative rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.04] transition cursor-pointer overflow-hidden"
                >
                  <div
                    className={`absolute top-0 right-0 w-24 h-24 rounded-full bg-gradient-to-br ${col.color} opacity-10 -translate-x-4 -translate-y-4 blur-2xl`}
                  />
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-white text-sm">{col.name}</div>
                      <div className="text-white/40 text-xs mt-1">{col.type}</div>
                    </div>
                    <div
                      className={`w-8 h-8 rounded-xl bg-gradient-to-br ${col.color} flex items-center justify-center text-white text-sm shrink-0`}
                    >
                      {col.count}
                    </div>
                  </div>
                  <div className="flex gap-1 mt-4">
                    {[...animeList.slice(0, 3)].map((a, i) => (
                      <div key={i} className="w-10 h-14 rounded-lg overflow-hidden">
                        <ImageWithFallback src={a.img} alt={a.t} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {col.count > 3 && (
                      <div className="w-10 h-14 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 text-xs">
                        +{col.count - 3}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isOwnProfile && (
                <button className="rounded-2xl border border-dashed border-white/15 p-5 hover:border-pink-400/30 hover:bg-pink-500/5 transition flex flex-col items-center justify-center gap-2 min-h-[140px]">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40">
                    +
                  </div>
                  <span className="text-white/30 text-sm">Tạo bộ sưu tập mới</span>
                </button>
              )}
            </div>
          </div>
  )
}

export default ProfileCollection