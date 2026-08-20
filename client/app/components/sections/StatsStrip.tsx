import Link from "next/link";
import { BookOpen, Tv, Users, Wand2 } from "lucide-react";

const STATS = [
  { k: "12,400+", v: "Anime & Phim",          icon: <Tv className="w-4 h-4" />       },
  { k: "85,000+", v: "Manga bản quyền",        icon: <BookOpen className="w-4 h-4" /> },
  { k: "320K",    v: "Sáng tác viên",           icon: <Wand2 className="w-4 h-4" />   },
  { k: "2.4M",    v: "Thành viên cộng đồng",    icon: <Users className="w-4 h-4" />   },
];

export function StatsStrip() {
  return (
    <div className="bg-[#08050f] border-y border-white/5 py-5">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {STATS.map((s) => (
            <div key={s.v} className="flex flex-col items-center gap-1">
              <div className="text-pink-300/60 mb-1">{s.icon}</div>
              <div className="text-white text-xl" style={{ fontFamily: "Kaisei Decol, serif" }}>{s.k}</div>
              <div className="text-white/50 text-xs">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
