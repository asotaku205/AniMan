import { BookOpen, Clock, MessageCircle, Star } from "lucide-react";

export type Tab = "activity" | "watchlist" | "collections" | "about";

export const BADGES = [
  { icon: "🌸", label: "Đầu tiên 100 tập", color: "from-pink-500 to-rose-400" },
  { icon: "📖", label: "Mọt tiểu thuyết", color: "from-amber-500 to-orange-400" },
  { icon: "🎨", label: "Fan Art Creator", color: "from-violet-500 to-fuchsia-400" },
  { icon: "⭐", label: "Top Reviewer", color: "from-yellow-400 to-amber-400" },
  { icon: "🎭", label: "Watch Party Host", color: "from-blue-500 to-cyan-400" },
];

export const ACTIVITY_FEED = [
  {
    id: 1, type: "watched",
    text: "Đã xem tập 13 của",
    target: "Tokyo Neon Chronicles",
    link: "/anime/tokyo-neon-chronicles",
    time: "5 phút",
    img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200",
  },
  {
    id: 2, type: "posted",
    text: "Đã đăng bài viết:",
    target: "\"Tại sao cảnh mưa trong anime Nhật luôn buồn đến vậy?\"",
    link: "/forum",
    time: "1 giờ",
  },
  {
    id: 3, type: "read",
    text: "Đã đọc chương 8 của",
    target: "Mùa Xuân Cuối",
    link: "/tieu-thuyet/mua-xuan-cuoi",
    time: "2 giờ",
    img: "https://images.unsplash.com/photo-1533038590840-1cde6e668a91?w=200",
  },
  {
    id: 4, type: "liked",
    text: "Đã thích bài fanart của",
    target: "AoiInk",
    link: "/forum",
    time: "4 giờ",
  },
  {
    id: 5, type: "rated",
    text: "Đã đánh giá 9/10 cho",
    target: "Hoa Anh Đào Cuối Mùa",
    link: "/anime",
    time: "1 ngày",
    img: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=200",
  },
];

export const STATS = [
  { icon: <Clock className="w-4 h-4" />, value: "847h", label: "Đã xem", color: "text-pink-300" },
  { icon: <BookOpen className="w-4 h-4" />, value: "1.2M", label: "Chữ đã đọc", color: "text-amber-300" },
  { icon: <Star className="w-4 h-4" />, value: "127", label: "Đánh giá", color: "text-yellow-300" },
  { icon: <MessageCircle className="w-4 h-4" />, value: "89", label: "Bài đăng", color: "text-blue-300" },
];