import { novelList } from "../../components/data/novels";

export const tags = ["Tất cả", "Đương đại", "Tâm lý", "Light Novel", "Fantasy", "Văn học", "Lịch sử", "Đời thường", "Phiêu lưu", "Huyền bí"];
export const sortOptions = [
  { key: "score", label: "Đánh giá cao" },
  { key: "newest", label: "Mới nhất" },
  { key: "words", label: "Dài nhất" },
];

// Mock reading counts
export const READING_COUNTS = novelList.map((n, i) => ({
  slug: n.slug,
  count: `${(n.score * 10000 + i * 1500).toFixed(0)}`,
}));
