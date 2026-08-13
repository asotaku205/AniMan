import { Play, Star, Tv, BookOpen, Clock, TrendingUp } from "lucide-react";
import Link from "next/link";
import { ImageWithFallback } from "./ImageWithFallback";

// Genre accent colors
const GENRE_COLORS: Record<string, string> = {
  Action:        "from-red-500 to-orange-400",
  Fantasy:       "from-violet-500 to-purple-400",
  "Sci-Fi":      "from-cyan-500 to-blue-400",
  Romance:       "from-pink-500 to-rose-400",
  Drama:         "from-amber-400 to-yellow-300",
  "Slice of Life":"from-emerald-500 to-teal-400",
  Supernatural:  "from-indigo-500 to-violet-500",
  Mecha:         "from-sky-500 to-indigo-400",
  Mystery:       "from-gray-400 to-slate-300",
  Mythology:     "from-orange-500 to-amber-400",
  Thriller:      "from-red-700 to-rose-500",
  Horror:        "from-purple-900 to-red-900",
  Music:         "from-fuchsia-500 to-pink-400",
  School:        "from-lime-500 to-green-400",
  Shounen:       "from-orange-400 to-yellow-400",
  Seinen:        "from-blue-600 to-indigo-500",
  Josei:         "from-rose-400 to-pink-300",
  Cyberpunk:     "from-cyan-600 to-blue-600",
};

function getAccent(tags: string[]): string {
  for (const t of tags) {
    if (GENRE_COLORS[t]) return GENRE_COLORS[t];
  }
  return "from-pink-500 to-fuchsia-500";
}

export type MediaCardVariant = "anime" | "phim" | "manga";

interface MediaCardProps {
  slug: string;
  title: string;
  img: string;
  score: number;
  tags: string[];
  meta: string;          // e.g. "12 tập" or "2026" or "142 chương"
  status?: string;
  isNew?: boolean;
  variant: MediaCardVariant;
  rank?: number;
  views?: string;
}

const basePath: Record<MediaCardVariant, string> = {
  anime: "/anime",
  phim:  "/phim",
  manga: "/manga",
};

export function MediaCard({
  slug, title, img, score, tags, meta, status, isNew, variant, rank, views,
}: MediaCardProps) {
  const accent = getAccent(tags);
  const path = `${basePath[variant]}/${slug}`;

  return (
    <Link href={path} className="group block relative rounded-2xl overflow-hidden aspect-[2/3] cursor-pointer">
      {/* Background image */}
      <ImageWithFallback
        src={img}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.06] group-hover:brightness-90"
      />

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

      {/* Left accent stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b ${accent} opacity-0 group-hover:opacity-100 transition-opacity`} />

      {/* Top-left rank badge */}
      {rank !== undefined && (
        <div
          className="absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-lg"
          style={{
            background: rank === 1 ? "linear-gradient(135deg,#f59e0b,#d97706)" :
                        rank === 2 ? "linear-gradient(135deg,#9ca3af,#6b7280)" :
                        rank === 3 ? "linear-gradient(135deg,#b45309,#92400e)" :
                                     "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span className={`text-xs ${rank <= 3 ? "text-white" : "text-white/70"}`}>{rank}</span>
        </div>
      )}

      {/* Top-right score badge */}
      <div className="absolute top-3 right-3 flex items-center gap-0.5 px-2 py-1 rounded-full bg-black/60 backdrop-blur border border-yellow-300/20">
        <Star className="w-3 h-3 fill-yellow-300 text-yellow-300" />
        <span className="text-yellow-200 text-xs">{score}</span>
      </div>

      {/* Status / NEW badges */}
      <div className="absolute top-10 right-3 flex flex-col gap-1 items-end">
        {isNew && (
          <span className="px-2 py-0.5 rounded bg-pink-500 text-white text-[9px] tracking-widest shadow-[0_0_10px_rgba(255,90,150,0.5)]">
            MỚI
          </span>
        )}
        {status === "Đang chiếu" && !isNew && (
          <span className="px-2 py-0.5 rounded bg-emerald-500/80 text-white text-[9px] tracking-widest flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      {/* Genre pill */}
      <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">
        {rank === undefined && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] text-white bg-gradient-to-r ${accent} shadow-sm`}>
            {tags[0]}
          </span>
        )}
      </div>

      {/* Bottom info panel */}
      <div className="absolute inset-x-0 bottom-0 p-3.5">
        {/* Views hint */}
        {views && (
          <div className="flex items-center gap-1 mb-1 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 duration-200">
            <TrendingUp className="w-3 h-3 text-pink-300" />
            <span className="text-[10px] text-white/50">{views} lượt xem</span>
          </div>
        )}

        <div className="text-white leading-tight" style={{ fontSize: "clamp(12px,1.1vw,15px)" }}>{title}</div>

        <div className="flex items-center gap-2 mt-1 text-[10px] text-white/50">
          <span className="flex items-center gap-0.5">
            {variant === "anime" ? <Tv className="w-3 h-3" /> :
             variant === "manga" ? <BookOpen className="w-3 h-3" /> :
             <Clock className="w-3 h-3" />}
            {meta}
          </span>
          {tags.slice(1, 2).map((t) => (
            <span key={t} className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">· {t}</span>
          ))}
        </div>

        {/* Play/Read CTA - on hover */}
        <div className="mt-2 overflow-hidden h-0 group-hover:h-8 transition-all duration-300">
          <div className={`flex items-center justify-center gap-1.5 h-8 rounded-full bg-gradient-to-r ${accent} text-white text-xs shadow-lg`}>
            {variant === "manga" ? (
              <><BookOpen className="w-3 h-3" /> Đọc ngay</>
            ) : (
              <><Play className="w-3 h-3 fill-white" /> Xem ngay</>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// Wide/Landscape variant for lists
interface MediaCardWideProps {
  slug: string;
  title: string;
  img: string;
  score: number;
  tags: string[];
  meta: string;
  author?: string;
  variant: MediaCardVariant;
  rank: number;
  trend?: "up" | "down" | "same";
  views?: string;
  reviews?: number;
}

export function MediaCardWide({
  slug, title, img, score, tags, meta, author, variant, rank, trend = "same", views, reviews = 0,
}: MediaCardWideProps) {
  const accent = getAccent(tags);
  const path = `${basePath[variant]}/${slug}`;

  const trendEl = trend === "up"
    ? <span className="text-emerald-400 text-xs flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> +{Math.ceil(rank * 0.5)}</span>
    : trend === "down"
    ? <span className="text-red-400 text-xs">↓</span>
    : <span className="text-white/30 text-xs">—</span>;

  const rankStyle =
    rank === 1 ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-black" :
    rank === 2 ? "bg-gradient-to-r from-gray-300 to-gray-400 text-black" :
    rank === 3 ? "bg-gradient-to-r from-amber-700 to-amber-600 text-white" :
                 "bg-white/5 border border-white/10 text-white/60";

  return (
    <Link href={path} className="group flex items-center gap-4 p-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 transition-all">
      {/* Rank */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm transition ${rankStyle}`}>
        {rank}
      </div>

      {/* Thumbnail */}
      <div className="relative w-14 h-20 rounded-lg overflow-hidden shrink-0">
        <ImageWithFallback src={img} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition" />
        <div className={`absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b ${accent}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm truncate group-hover:text-pink-300 transition">{title}</div>
        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-white/40">
          <span>{author ?? tags[0]}</span>
          <span>·</span>
          <span>{meta}</span>
        </div>
        {/* Score bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${accent} rounded-full`}
              style={{ width: `${(score / 10) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-0.5 text-yellow-300 text-xs shrink-0">
            <Star className="w-3 h-3 fill-yellow-300" />
            <span>{score}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="shrink-0 text-right hidden sm:block">
        <div className="text-white/50 text-xs">{views ?? "—"}</div>
        <div className="text-white/30 text-[10px] mt-0.5">{reviews.toLocaleString()} reviews</div>
        <div className="mt-1">{trendEl}</div>
      </div>
    </Link>
  );
}
