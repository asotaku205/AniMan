import { animeList, type Title } from "../../components/data/catalog";

export const ALL_GENRES_LABEL = "Tất cả";

export const genres = [ALL_GENRES_LABEL, "Action", "Romance", "Sci-Fi", "Fantasy", "Slice of Life", "Mecha", "Drama", "Music", "Supernatural", "Mythology"];
export const seasons = ["Xuân 2026", "Đông 2025", "Thu 2025", "Hè 2025"];

export const sortOptions = [
  { key: "newest", label: "Mới nhất" },
  { key: "score", label: "Đánh giá cao" },
  { key: "views", label: "Xem nhiều" },
] as const;

export type AnimeSortKey = (typeof sortOptions)[number]["key"];
export type SpotlightAnime = Title & {
  badge: string;
  badgeColor: string;
  ep_new: number;
};
export type NewEpisodeAnime = Title & {
  epNew: number;
  timeAgo: string;
};

export const SPOTLIGHTS: SpotlightAnime[] = animeList.slice(0, 4).map((a, i) => ({
  ...a,
  badge: ["SIMULCAST", "MỚI", "4K HDR", "ORIGINAL"][i],
  badgeColor: ["bg-pink-500", "bg-emerald-500", "bg-cyan-500", "bg-violet-500"][i],
  ep_new: [8, 7, 3, 10][i],
}));

export const NEW_EPS: NewEpisodeAnime[] = animeList.map((a, i) => ({
  ...a,
  epNew: i + 1 > 5 ? i - 4 : i + 1,
  timeAgo: ["2 giờ trước", "5 giờ trước", "Vừa xong", "1 ngày", "3 giờ trước", "Hôm qua", "4 giờ trước", "12 giờ trước"][i % 8],
}));
