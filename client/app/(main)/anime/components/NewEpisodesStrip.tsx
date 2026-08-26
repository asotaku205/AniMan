import Link from "next/link";
import { ChevronRight, Play } from "lucide-react";
import { ImageWithFallback } from "../../../components/ImageWithFallback";
import type { NewEpisodeAnime } from "../data";

export function NewEpisodesStrip({ episodes }: { episodes: NewEpisodeAnime[] }) {
  return (
    <section className="py-10 bg-[#0b0612] border-y border-white/5">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
            <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-xl">Tập mới hôm nay</h2>
          </div>
          <Link href="/anime" className="text-pink-300/70 text-sm hover:text-pink-300 flex items-center gap-1 transition">
            Xem hết <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {episodes.slice(0, 7).map((a) => (
            <Link key={a.slug} href={`/anime/${a.slug}/${a.epNew}`} className="group relative shrink-0 w-48 rounded-2xl overflow-hidden">
              <div className="relative h-28">
                <ImageWithFallback src={a.banner} alt={a.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-pink-500 text-white text-[9px] tracking-wider">
                  TẬP {a.epNew} MỚI
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                    <Play className="w-5 h-5 fill-white text-white" />
                  </div>
                </div>
              </div>
              <div className="p-3 bg-[#130d20]">
                <div className="text-white text-sm truncate group-hover:text-pink-300 transition">{a.t}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-white/40 text-xs">{a.studio}</span>
                  <span className="text-white/30 text-[10px]">{a.timeAgo}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
