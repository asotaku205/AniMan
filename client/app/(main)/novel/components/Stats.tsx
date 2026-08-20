import { novelList } from '@/app/components/data/novels'
import { BookMarked, BookOpen, Feather, Users } from 'lucide-react'
import React from 'react'

const Stats = () => {
  return (
          <div className="bg-[#0b0612] border-y border-amber-400/10 py-5">
            <div className="max-w-[1400px] mx-auto px-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                {[
                  { k: `${novelList.length}`, v: "Tác phẩm", icon: <BookOpen className="w-4 h-4" /> },
                  { k: "1.2M+", v: "Độc giả", icon: <Users className="w-4 h-4" /> },
                  { k: "48+", v: "Nhà xuất bản", icon: <BookMarked className="w-4 h-4" /> },
                  { k: "100%", v: "Bản quyền", icon: <Feather className="w-4 h-4" /> },
                ].map((s) => (
                  <div key={s.v} className="flex flex-col items-center gap-1">
                    <div className="text-amber-300/60 mb-1">{s.icon}</div>
                    <div className="text-white text-xl" style={{ fontFamily: "Kaisei Decol, serif" }}>{s.k}</div>
                    <div className="text-white/50 text-xs">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
  );
}

export default Stats