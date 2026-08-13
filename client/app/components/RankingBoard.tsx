"use client"
import { useState } from "react";
import Link from "next/link";
import { Star, TrendingUp, Flame, ChevronRight, Crown, Eye, MessageCircle } from "lucide-react";
import { animeList, liveList } from "./data/catalog";
import { mangaList } from "./data/mangas";
import { ImageWithFallback } from "./ImageWithFallback";

type Period = "week" | "month" | "all";
type Category = "anime" | "phim" | "manga";

// Mock extended stats
const weekViews = ["4.2M", "3.8M", "3.1M", "2.7M", "2.2M", "1.9M", "1.4M", "1.1M"];
const monthViews = ["18M", "14M", "12M", "9.6M", "8.1M", "6.5M", "5.2M", "4.0M"];
const trends: Array<"up" | "down" | "same"> = ["up","up","up","same","down","up","same","down"];
const trendDelta = [3, 1, 2, 0, -2, 4, 0, -1];

function getViews(period: Period, idx: number) {
  return period === "week" ? weekViews[idx % weekViews.length]
       : period === "month" ? monthViews[idx % monthViews.length]
       : "—";
}

// Genre accent colors
const GENRE_COLORS: Record<string, string> = {
  Action:"from-red-500 to-orange-400", Fantasy:"from-violet-500 to-purple-400",
  "Sci-Fi":"from-cyan-500 to-blue-400", Romance:"from-pink-500 to-rose-400",
  Drama:"from-amber-400 to-yellow-300", "Slice of Life":"from-emerald-500 to-teal-400",
  Supernatural:"from-indigo-500 to-violet-500", Mecha:"from-sky-500 to-indigo-400",
  Cyberpunk:"from-cyan-600 to-blue-600", Mythology:"from-orange-500 to-amber-400",
};
function getAccent(tags: string[]) {
  for (const t of tags) if (GENRE_COLORS[t]) return GENRE_COLORS[t];
  return "from-pink-500 to-fuchsia-500";
}

// Podium card for top-3
function PodiumCard({
  rank, title, img, score, tags, path, period, idx, meta
}: {
  rank: number; title: string; img: string; score: number;
  tags: string[]; path: string; period: Period; idx: number; meta: string;
}) {
  const accent = getAccent(tags);
  const isFirst = rank === 1;

  const podiumStyle =
    rank === 1 ? { ring: "ring-2 ring-yellow-400/60", badge: "bg-gradient-to-r from-amber-400 to-yellow-300 text-black", shadow: "shadow-[0_0_30px_rgba(251,191,36,0.25)]", scale: "scale-105" }
  : rank === 2 ? { ring: "ring-1 ring-gray-400/40", badge: "bg-gradient-to-r from-gray-300 to-gray-400 text-black", shadow: "shadow-[0_0_20px_rgba(156,163,175,0.15)]", scale: "scale-100" }
               : { ring: "ring-1 ring-amber-700/40", badge: "bg-gradient-to-r from-amber-700 to-amber-600 text-white", shadow: "shadow-[0_0_20px_rgba(180,83,9,0.15)]", scale: "scale-100" };

  return (
    <Link href={path} className={`group relative rounded-2xl overflow-hidden ${podiumStyle.ring} ${podiumStyle.shadow} ${podiumStyle.scale} transition-all hover:scale-[1.03]`}>
      {/* Image */}
      <div className="relative aspect-[2/3]">
        <ImageWithFallback src={img} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

        {/* Rank badge */}
        <div className={`absolute top-3 left-3 w-9 h-9 rounded-xl flex items-center justify-center text-sm ${podiumStyle.badge} shadow-lg`}>
          {rank === 1 ? <Crown className="w-4 h-4" /> : rank}
        </div>

        {/* Score badge */}
        <div className="absolute top-3 right-3 flex items-center gap-0.5 px-2 py-1 rounded-full bg-black/60 backdrop-blur">
          <Star className="w-3 h-3 fill-yellow-300 text-yellow-300" />
          <span className="text-yellow-200 text-xs">{score}</span>
        </div>

        {/* Genre pill */}
        <div className="absolute top-14 left-3">
          <span className={`px-2 py-0.5 rounded-full text-[10px] text-white bg-gradient-to-r ${accent}`}>{tags[0]}</span>
        </div>
      </div>

      {/* Info */}
      <div className={`p-3 bg-[#0d0817] border-t ${rank === 1 ? "border-yellow-400/20" : "border-white/5"}`}>
        <div className="text-white text-sm truncate">{title}</div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-white/40 text-xs">{meta}</span>
          <div className="flex items-center gap-1 text-xs text-white/40">
            <Eye className="w-3 h-3" />
            {getViews(period, idx)}
          </div>
        </div>
        {/* Score bar */}
        <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full bg-gradient-to-r ${accent} rounded-full`} style={{ width: `${(score/10)*100}%` }} />
        </div>
      </div>
    </Link>
  );
}

// List row for rank 4–10
function RankRow({
  rank, title, img, score, tags, path, period, idx, meta, reviews
}: {
  rank: number; title: string; img: string; score: number;
  tags: string[]; path: string; period: Period; idx: number;
  meta: string; reviews: number;
}) {
  const accent = getAccent(tags);
  const trend = trends[idx % trends.length];
  const delta = trendDelta[idx % trendDelta.length];

  return (
    <Link href={path} className="group flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 transition-all">
      {/* Rank */}
      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-xs text-white/50 shrink-0">{rank}</div>

      {/* Thumbnail */}
      <div className="relative w-11 h-16 rounded-lg overflow-hidden shrink-0">
        <ImageWithFallback src={img} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition" />
        <div className={`absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b ${accent}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm truncate group-hover:text-pink-300 transition">{title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-white/40 text-xs">{meta}</span>
          <span className="text-white/20 text-xs">·</span>
          <span className="text-white/40 text-xs">{tags[0]}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 w-20 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full bg-gradient-to-r ${accent} rounded-full`} style={{ width: `${(score/10)*100}%` }} />
          </div>
          <span className="text-yellow-300 text-xs flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-yellow-300" />{score}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="shrink-0 text-right hidden sm:flex flex-col items-end gap-1">
        <div className="text-white/40 text-xs flex items-center gap-1">
          <Eye className="w-3 h-3" />{getViews(period, idx)}
        </div>
        <div className="text-white/30 text-[10px] flex items-center gap-0.5">
          <MessageCircle className="w-3 h-3" />{(reviews + idx * 127).toLocaleString()}
        </div>
        <div className={`text-[10px] flex items-center gap-0.5 ${trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-white/20"}`}>
          {trend === "up" ? <><TrendingUp className="w-3 h-3" />+{delta}</> :
           trend === "down" ? <>↓{Math.abs(delta)}</> : "—"}
        </div>
      </div>
    </Link>
  );
}

// Main RankingBoard component
export function RankingBoard() {
  const [category, setCategory] = useState<Category>("anime");
  const [period, setPeriod] = useState<Period>("week");

  // Sorted data per category
  const data = {
    anime: [...animeList].sort((a, b) => b.score - a.score).map((a, i) => ({
      slug: a.slug, title: a.t, img: a.img, score: a.score, tags: a.tags,
      path: `/anime/${a.slug}`, meta: `${a.ep} tập`, reviews: 384 + i * 89,
    })),
    phim: [...liveList].sort((a, b) => b.score - a.score).map((a, i) => ({
      slug: a.slug, title: a.t, img: a.img, score: a.score, tags: a.tags,
      path: `/phim/${a.slug}`, meta: `${a.year}`, reviews: 210 + i * 63,
    })),
    manga: [...mangaList].sort((a, b) => b.score - a.score).map((a, i) => ({
      slug: a.slug, title: a.t, img: a.cover, score: a.score, tags: a.tags,
      path: `/manga/${a.slug}`, meta: `${a.chapters.length} chương`, reviews: 567 + i * 142,
    })),
  };

  const items = data[category];
  const top3 = items.slice(0, 3);
  const rest = items.slice(3);

  const catLabels: Record<Category, string> = { anime: "Anime", phim: "Phim", manga: "Manga" };
  const periodLabels: Record<Period, string> = { week: "Tuần này", month: "Tháng này", all: "Mọi thời" };

  return (
    <section className="py-16 bg-[#07040e]">
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Header */}
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-pink-300/80 tracking-[0.35em] text-xs uppercase mb-2">
              <Flame className="w-3.5 h-3.5" />
              Bảng xếp hạng
            </div>
            <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-3xl md:text-4xl">
              Top <span className="bg-gradient-to-r from-pink-300 to-fuchsia-300 bg-clip-text text-transparent">thịnh hành</span>
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Category tabs */}
            <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/8">
              {(Object.keys(catLabels) as Category[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-4 py-2 rounded-lg text-sm transition-all ${category === c ? "bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-sm" : "text-white/60 hover:text-white"}`}
                >
                  {catLabels[c]}
                </button>
              ))}
            </div>

            {/* Period tabs */}
            <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/8">
              {(Object.keys(periodLabels) as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-2 rounded-lg text-xs transition-all ${period === p ? "bg-white/15 text-white" : "text-white/50 hover:text-white"}`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8">
          {/* Podium top 3 */}
          <div>
            <div className="text-white/40 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
              <Crown className="w-3.5 h-3.5 text-yellow-400" /> Top 3 bảng vàng
            </div>
            <div className="grid grid-cols-3 gap-3 items-end">
              {/* #2 — left, slightly lower */}
              {top3[1] && (
                <div className="mt-6">
                  <PodiumCard rank={2} {...top3[1]} period={period} idx={1} />
                </div>
              )}
              {/* #1 — center, tallest */}
              {top3[0] && (
                <PodiumCard rank={1} {...top3[0]} period={period} idx={0} />
              )}
              {/* #3 — right, lowest */}
              {top3[2] && (
                <div className="mt-10">
                  <PodiumCard rank={3} {...top3[2]} period={period} idx={2} />
                </div>
              )}
            </div>
          </div>

          {/* Rank 4–8 list */}
          <div>
            <div className="text-white/40 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-pink-400" /> Xếp hạng tiếp theo
            </div>
            <div className="space-y-2">
              {rest.slice(0, 5).map((item, i) => (
                <RankRow
                  key={item.slug}
                  rank={i + 4}
                  {...item}
                  period={period}
                  idx={i + 3}
                />
              ))}
            </div>

            {/* View all */}
            <Link
              href={`/${category}`}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/8 bg-white/[0.02] text-white/50 hover:text-white hover:border-white/15 hover:bg-white/5 transition text-sm"
            >
              Xem toàn bộ bảng xếp hạng <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}