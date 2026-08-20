import { liveList } from "../../components/data/catalog";

export const ALL_FILM_LABEL = "Tất cả";

export const genres = [ALL_FILM_LABEL, "Romance", "Drama", "Mystery", "Slice of Life", "Thriller"];
export const types = [ALL_FILM_LABEL, "Điện ảnh", "J-Drama", "Tài liệu"];

export const sortOptions = [
  { key: "newest", label: "Mới nhất" },
  { key: "score", label: "Đánh giá cao" },
  { key: "views", label: "Phổ biến" },
] as const;

export type FilmSortKey = (typeof sortOptions)[number]["key"];

export const DIRECTORS = liveList.filter((f) => f.director).slice(0, 4).map((f) => ({
  name: f.director!,
  film: f.t,
  img: f.img,
  score: f.score,
  slug: f.slug,
}));
