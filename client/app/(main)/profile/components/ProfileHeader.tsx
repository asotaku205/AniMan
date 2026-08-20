import { Check, Edit3, Settings, Share2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import React from 'react'
type ProfileHeaderProps = {
    isOwnProfile: boolean;
    username: string;
    following: boolean;
    setFollowing: (following: boolean) => void;
}
const ProfileHeader = ({ isOwnProfile, username, following, setFollowing }: ProfileHeaderProps) => {
  return (
     <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-14 sm:-mt-16 mb-6 relative z-10">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-violet-500 via-pink-500 to-rose-400 ring-4 ring-[#07040e] overflow-hidden">
              <div className="w-full h-full flex items-center justify-center text-white text-3xl">
                🌸
              </div>
            </div>
            {isOwnProfile && (
              <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#07040e] border border-white/20 flex items-center justify-center text-white/60 hover:text-white transition">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Name + actions */}
          <div className="flex-1 min-w-0 sm:pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="min-w-0">
                <h1
                  className="text-white text-xl sm:text-2xl truncate"
                  style={{ fontFamily: "Shippori Mincho, serif" }}
                >
                  Nguyễn Minh
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-white/40 text-sm">@{username}</span>
                  <span className="px-2 py-0.5 rounded bg-pink-500/20 border border-pink-400/30 text-pink-300 text-[11px]">
                    Premium
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                {isOwnProfile ? (
                  <Link
                    href="/settings"
                    className="flex items-center gap-1.5 px-4 h-9 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white text-sm transition hover:bg-white/10"
                  >
                    <Settings className="w-3.5 h-3.5" /> Chỉnh sửa
                  </Link>
                ) : (
                  <button
                    onClick={() => setFollowing(!following)}
                    className={`flex items-center gap-1.5 px-4 h-9 rounded-full text-sm transition ${
                      following
                        ? "bg-white/5 border border-white/10 text-white/70 hover:bg-rose-500/10 hover:border-rose-400/30 hover:text-rose-300"
                        : "bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-[0_0_20px_rgba(255,90,150,0.3)]"
                    }`}
                  >
                    {following ? (
                      <><Check className="w-3.5 h-3.5" /> Đang theo dõi</>
                    ) : (
                      <><UserPlus className="w-3.5 h-3.5" /> Theo dõi</>
                    )}
                  </button>
                )}
                <button className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition hover:bg-white/10">
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bio */}
            <p className="text-white/60 text-sm mt-3 leading-relaxed max-w-xl">
              Anime fan từ 2014. Đam mê những câu chuyện về ký ức và sự mất mát. Đang viết fanfic tại Novel Studio. 🌸
            </p>

            {/* Follower stats */}
            <div className="flex items-center gap-6 mt-3">
              <div className="text-center">
                <div className="text-white text-sm">1.247</div>
                <div className="text-white/40 text-xs">Người theo dõi</div>
              </div>
              <div className="text-center">
                <div className="text-white text-sm">342</div>
                <div className="text-white/40 text-xs">Đang theo dõi</div>
              </div>
            </div>
          </div>
        </div>
  )
}

export default ProfileHeader