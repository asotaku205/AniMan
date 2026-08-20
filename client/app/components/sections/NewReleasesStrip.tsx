import Link from "next/link";
import { Bell, Clock, Star } from "lucide-react";
import { ImageWithFallback } from "../ImageWithFallback";
import { NEW_RELEASES } from "../../(main)/data";

const TIMESTAMPS = ["2 giờ trước", "5 giờ trước", "Vừa xong", "1 ngày", "3 giờ trước", "6 giờ trước"];

export function NewReleasesStrip() {
  return (
    <section className="py-12 bg-[#090511]">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-pink-300/70 tracking-[0.4em] text-xs uppercase mb-2">
              <Bell className="w-3 h-3" /> Cập nhật mới nhất
            </div>
            <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-2xl md:text-3xl">
              Vừa <span className="bg-gradient-to-r from-pink-300 to-fuchsia-300 bg-clip-text text-transparent">cập nhật</span>
            </h2>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {NEW_RELEASES.map((item, i) => (
            <Link
              key={item.displayPath}
              href={item.displayPath}
              className={`group flex gap-4 p-4 rounded-2xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/15 transition-all animate-fadeInUp delay-${Math.min(i * 100, 500)}`}
            >
              <div className="relative w-16 shrink-0 rounded-xl overflow-hidden" style={{ height: "88px" }}>
                <ImageWithFallback src={item.img} alt={item.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xs ${item.color} mb-1 flex items-center gap-1`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {item.type} · {item.meta}
                </div>
                <div className="text-white text-sm group-hover:text-pink-300 transition truncate">{item.t}</div>
                <div className="flex items-center gap-1 mt-1.5 text-yellow-300 text-xs">
                  <Star className="w-3 h-3 fill-yellow-300" />
                  {item.score}
                </div>
                <div className="flex items-center gap-1 mt-1 text-white/30 text-[10px]">
                  <Clock className="w-3 h-3" />
                  {TIMESTAMPS[i]}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
