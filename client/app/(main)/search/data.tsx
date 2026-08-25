
import { animeList, liveList } from "../../components/data/catalog";
import { mangaList } from "../../components/data/mangas";
import { novelList } from "../../components/data/novels";
export type ContentType = "all" | "anime" | "phim" | "manga" | "tieu-thuyet";
export type SortType = "relevance" | "score" | "newest" | "oldest";

export const ALL_GENRES = ["Action", "Romance", "Fantasy", "Sci-Fi", "Drama", "Slice of Life", "Mystery", "Thriller", "Mecha", "Mythology", "Supernatural", "Music", "School", "Đương đại", "Tâm lý", "Light Novel", "Văn học", "Lịch sử", "Phiêu lưu", "Huyền bí"];

export type UnifiedItem = {
  slug: string;
  title: string;
  img: string;
  score: number;
  tags: string[];
  year: number;
  type: ContentType;
  path: string;
  meta: string;
  author?: string;
};

export const allItems: UnifiedItem[] = [
  ...animeList.map((a) => ({ slug: a.slug, title: a.t, img: a.img, score: a.score, tags: a.tags, year: a.year, type: "anime" as const, path: `/anime/${a.slug}`, meta: `${a.ep} tập`, author: a.studio })),
  ...liveList.map((a) => ({ slug: a.slug, title: a.t, img: a.img, score: a.score, tags: a.tags, year: a.year, type: "phim" as const, path: `/phim/${a.slug}`, meta: `${a.year}`, author: a.director })),
  ...mangaList.map((m) => ({ slug: m.slug, title: m.t, img: m.cover, score: m.score, tags: m.tags, year: m.year, type: "manga" as const, path: `/manga/${m.slug}`, meta: `${m.chapters.length} chương`, author: m.author })),
  ...novelList.map((n) => ({ slug: n.slug, title: n.t, img: n.cover, score: n.score, tags: n.tags, year: n.year, type: "tieu-thuyet" as const, path: `/tieu-thuyet/${n.slug}`, meta: n.words, author: n.author })),
];

export const TYPE_LABELS: Record<ContentType, string> = {
  all: "Tất cả",
  anime: "Anime",
  phim: "Phim",
  manga: "Manga",
  "tieu-thuyet": "Tiểu thuyết",
};

export const TYPE_COLORS: Record<string, string> = {
  anime: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  phim: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  manga: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "tieu-thuyet": "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

export const SORT_LABELS: Record<SortType, string> = {
  relevance: "Phù hợp nhất",
  score: "Đánh giá cao",
  newest: "Mới nhất",
  oldest: "Cũ nhất",
};

// Popular searches
export const HOT_SEARCHES = ["Tokyo 2099", "Kẻ Săn Quái", "Ngọn Lửa Kitsune", "Hoa Anh Đào", "Bóng Của Mặt Trăng"];
