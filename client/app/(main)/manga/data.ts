import { mangaList } from "../../components/data/mangas";

export const genres = ["Tất cả", "Action", "Romance", "Fantasy", "Sci-Fi", "Drama", "Slice of Life", "Mecha", "Mythology", "Shounen", "Seinen", "Josei"];
export const sortOptions = [
  { key: "new", label: "Mới nhất" },
  { key: "score", label: "Đánh giá cao" },
  { key: "chapters", label: "Nhiều chương" },
];
export const readingModes = ["Tất cả", "Đang ra", "Đã hoàn thành", "Tạm ngưng"];

// New chapter updates
export const NEW_CHAPTERS = mangaList.map((m, i) => ({
  ...m,
  newChapter: m.chapters.length,
  timeAgo: ["1 giờ trước", "3 giờ trước", "Hôm nay", "Hôm qua", "2 ngày trước", "Vừa xong", "5 giờ trước", "12 giờ trước"][i % 8],
}));