import { Award, Grid3x3, PlayCircle, TrendingUp } from 'lucide-react';
import React from 'react'
import { Tab } from '../data';

const ProfileTab = ({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) => {
  return (
    <div className="flex gap-1 border-b border-white/10 mb-6 overflow-x-auto [scrollbar-width:none]">
          {(
            [
              { key: "activity", label: "Hoạt động", icon: <TrendingUp className="w-3.5 h-3.5" /> },
              { key: "watchlist", label: "Đang xem", icon: <PlayCircle className="w-3.5 h-3.5" /> },
              { key: "collections", label: "Bộ sưu tập", icon: <Grid3x3 className="w-3.5 h-3.5" /> },
              { key: "about", label: "Giới thiệu", icon: <Award className="w-3.5 h-3.5" /> },
            ] as { key: Tab; label: string; icon: React.ReactNode }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-1.5 px-4 py-3 text-sm whitespace-nowrap transition shrink-0 ${
                tab === t.key ? "text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              {t.icon}
              {t.label}
              {tab === t.key && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-pink-400 to-rose-300" />
              )}
            </button>
          ))}
        </div>
  )
}

export default ProfileTab