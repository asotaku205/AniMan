import { BookOpen, Feather, Film, MessageSquare, PenLine, Search, Tv, Users, Wand2 } from "lucide-react";
import { animeFeatured, animeList, liveFeatured, liveList } from "../components/data/catalog";
import { mangaList } from "../components/data/mangas";
import { novelList } from "../components/data/novels";
import type { ReactElement } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuickCat = {
  to: string;
  icon: ReactElement;
  label: string;
  color: string;
  glow: string;
};

export type ContinueWatchingItem = {
  slug: string;
  t: string;
  img: string;
  score: number;
  tags: string[];
  ep?: number;
  progress: number;
  epCurrent: number;
  type: string;
  path: string;
};

export type NewReleaseItem = {
  slug: string;
  t: string;
  img: string;
  score: number;
  displayPath: string;
  type: string;
  meta: string;
  color: string;
};

// ─── Quick category pills ─────────────────────────────────────────────────────

export const QUICK_CATS: QuickCat[] = [
  { to: "/anime",           icon: <Tv className="w-4 h-4" />,             label: "Anime",        color: "from-pink-500 to-rose-400",    glow: "hover:shadow-[0_0_20px_rgba(255,90,150,0.5)]"  },
  { to: "/film",            icon: <Film className="w-4 h-4" />,           label: "Phim",         color: "from-rose-500 to-orange-400",  glow: "hover:shadow-[0_0_20px_rgba(255,100,50,0.5)]"  },
  { to: "/manga",           icon: <BookOpen className="w-4 h-4" />,       label: "Manga",        color: "from-violet-500 to-purple-400",glow: "hover:shadow-[0_0_20px_rgba(139,92,246,0.5)]"  },
  { to: "/novel",     icon: <Feather className="w-4 h-4" />,        label: "Tiểu thuyết", color: "from-amber-500 to-yellow-400", glow: "hover:shadow-[0_0_20px_rgba(245,158,11,0.5)]"  },
  { to: "/studio/manga-ai", icon: <Wand2 className="w-4 h-4" />,          label: "Manga AI",    color: "from-fuchsia-500 to-pink-400", glow: "hover:shadow-[0_0_20px_rgba(217,70,239,0.5)]"  },
  { to: "/my-works",       icon: <PenLine className="w-4 h-4" />,         label: "Sáng tác của tôi", color: "from-sky-500 to-indigo-400", glow: "hover:shadow-[0_0_20px_rgba(56,189,248,0.5)]"  },
  { to: "/watch-party",     icon: <Users className="w-4 h-4" />,          label: "Watch Party",  color: "from-cyan-500 to-blue-400",    glow: "hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]"   },
  { to: "/forum",           icon: <MessageSquare className="w-4 h-4" />,  label: "Diễn đàn",    color: "from-emerald-500 to-teal-400", glow: "hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]"  },
  { to: "/search",          icon: <Search className="w-4 h-4" />,         label: "Tìm kiếm",    color: "from-slate-500 to-gray-400",   glow: "hover:shadow-[0_0_20px_rgba(100,116,139,0.4)]" },
];

// ─── Continue watching (mock) ─────────────────────────────────────────────────

export const CONTINUE_WATCHING: ContinueWatchingItem[] = [
  { ...animeList[0], progress: 65, epCurrent: 8, type: "anime", path: `/anime/${animeList[0].slug}/8` },
  { ...animeList[2], progress: 30, epCurrent: 3, type: "anime", path: `/anime/${animeList[2].slug}/3` },
  { ...liveList[0],  progress: 80, epCurrent: 1, type: "phim",  path: `/film/${liveList[0].slug}/1`     },
  { ...animeList[6], progress: 15, epCurrent: 2, type: "anime", path: `/anime/${animeList[6].slug}/2` },
];

// ─── Mixed new releases ───────────────────────────────────────────────────────

export const NEW_RELEASES: NewReleaseItem[] = [
  { ...animeList[0], displayPath: `/anime/${animeList[0].slug}`, type: "Anime", meta: "Tập 8 MỚI",        color: "text-pink-300",   img: animeList[0].img   },
  { ...animeList[2], displayPath: `/anime/${animeList[2].slug}`, type: "Anime", meta: "Tập 7 MỚI",        color: "text-cyan-300",   img: animeList[2].img   },
  { ...liveList[0],  displayPath: `/film/${liveList[0].slug}`,   type: "Phim",  meta: "Vừa ra mắt",       color: "text-rose-300",   img: liveList[0].img    },
  { ...animeList[6], displayPath: `/anime/${animeList[6].slug}`, type: "Anime", meta: "Tập 10 MỚI",       color: "text-violet-300", img: animeList[6].img   },
  { ...mangaList[0], displayPath: `/manga/${mangaList[0].slug}`, type: "Manga", meta: "Ch.142 MỚI",       color: "text-amber-300",  img: mangaList[0].cover },
  { ...liveList[6],  displayPath: `/film/${liveList[6].slug}`,   type: "Phim",  meta: "Premiere hôm nay", color: "text-orange-300", img: liveList[6].img    },
];

// ─── Re-export shared catalog data used by HomePage ──────────────────────────

export { animeFeatured, animeList, liveFeatured, liveList, mangaList, novelList };
