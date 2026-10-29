import { BookOpen, FileText, Film, Palette} from "lucide-react";
export type WorkType = "manga" | "novel" | "animation" | "fanart";

export type Feedback = {
  id: string;
  user: string;
  color: string;
  text: string;
  rating?: { story: number; art: number; pacing: number };
  time: string;
  likes: number;
  liked: boolean;
};

export type Work = {
  id: string;
  type: WorkType;
  title: string;
  author: string;
  authorColor: string;
  cover: string;
  excerpt: string;
  tags: string[];
  views: number;
  likes: number;
  saves: number;
  feedbackCount: number;
  time: string;
  rating: number; // 0..5
  liked?: boolean;
  saved?: boolean;
  /** Tác phẩm thật từ server (Lát 2A): file gốc để xem/tải. */
  serverFileUrl?: string;
  serverMimeType?: string;
};

export const TYPE_META: Record<WorkType, { label: string; icon: React.ReactNode; color: string }> = {
  manga: { label: "Manga", icon: <BookOpen className="w-3.5 h-3.5" />, color: "from-pink-500 to-rose-400" },
  novel: { label: "Tiểu thuyết", icon: <FileText className="w-3.5 h-3.5" />, color: "from-amber-500 to-orange-400" },
  animation: { label: "Hoạt hình", icon: <Film className="w-3.5 h-3.5" />, color: "from-violet-500 to-fuchsia-400" },
  fanart: { label: "Fan Art", icon: <Palette className="w-3.5 h-3.5" />, color: "from-sky-500 to-cyan-400" },
};

export const SEED_WORKS: Work[] = [
  {
    id: "w1", type: "manga", title: "Lá thư mùa hạ", author: "Aoi_94", authorColor: "from-pink-500 to-rose-400",
    cover: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=900",
    excerpt: "Một bộ truyện ngắn 12 khung kể về cô bé Hina nhặt được lá thư của chính mình từ tương lai.",
    tags: ["Slice of life", "Romance", "1-shot"], views: 4321, likes: 612, saves: 188, feedbackCount: 24, time: "2 giờ", rating: 4.7,
  },
  {
    id: "w2", type: "novel", title: "Đêm dài ở Kyoto", author: "RenAozora", authorColor: "from-emerald-500 to-teal-400",
    cover: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=900",
    excerpt: "Chương 1 — Một thám tử trẻ lạc vào một con hẻm chỉ tồn tại sau nửa đêm. 4200 từ.",
    tags: ["Mystery", "Urban fantasy"], views: 1890, likes: 240, saves: 96, feedbackCount: 18, time: "5 giờ", rating: 4.4,
  },
  {
    id: "w3", type: "animation", title: "Sakura · 30 giây loop", author: "ShiroEdit", authorColor: "from-violet-500 to-fuchsia-400",
    cover: "https://images.unsplash.com/photo-1554072675-66db59dba46f?w=900",
    excerpt: "Loop animation cảnh hoa anh đào rơi, dựng bằng Animation Lab + Motion Path.",
    tags: ["Loop", "Sakura", "Lo-fi"], views: 9821, likes: 1402, saves: 421, feedbackCount: 56, time: "1 ngày", rating: 4.8,
  },
  {
    id: "w4", type: "fanart", title: "Aoi-chan kimono bản đầy đủ", author: "HinaPixel", authorColor: "from-yellow-400 to-orange-400",
    cover: "https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=900",
    excerpt: "Bản phối màu cuối cùng sau 3 lần feedback từ cộng đồng. Cảm ơn mọi người 🌸",
    tags: ["Fan Art", "Kimono"], views: 2103, likes: 388, saves: 117, feedbackCount: 31, time: "1 ngày", rating: 4.6,
  },
  {
    id: "w5", type: "manga", title: "Bóng đèn cuối hành lang", author: "kyoto_dreamer", authorColor: "from-orange-500 to-pink-400",
    cover: "https://images.unsplash.com/photo-1493514789931-586cb221d7a7?w=900",
    excerpt: "Truyện kinh dị tâm lý 3 chương. Đang post chương 2, mong nhận góp ý về nhịp truyện.",
    tags: ["Horror", "Psychological"], views: 1340, likes: 156, saves: 62, feedbackCount: 12, time: "3 ngày", rating: 4.2,
  },
  {
    id: "w6", type: "novel", title: "Mưa rào tháng năm — phần ngoại truyện", author: "tsuki_no_kage", authorColor: "from-violet-500 to-fuchsia-500",
    cover: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=900",
    excerpt: "Phần ngoại truyện viết từ góc nhìn của Aoi. 6800 từ. Spoiler alert cho ai chưa xem anime gốc.",
    tags: ["Spin-off", "Slice of life"], views: 3567, likes: 489, saves: 201, feedbackCount: 42, time: "4 ngày", rating: 4.9,
  },
];

export const SEED_FEEDBACK: Record<string, Feedback[]> = {
  w1: [
    { id: "f1", user: "RenAozora", color: "from-emerald-500 to-teal-400", text: "Khung 7 chuyển cảnh hơi gấp, nếu thêm 1 khung lặng ở giữa thì cảm xúc sẽ thấm hơn nhiều.", rating: { story: 5, art: 4, pacing: 3 }, time: "1 giờ", likes: 18, liked: false },
    { id: "f2", user: "HinaPixel", color: "from-yellow-400 to-orange-400", text: "Mê nét vẽ quá! Cách bạn dùng tone xám-hồng rất Makoto Shinkai-vibe.", rating: { story: 4, art: 5, pacing: 4 }, time: "40 phút", likes: 11, liked: false },
  ],
  w3: [
    { id: "f1", user: "Aoi_94", color: "from-pink-500 to-rose-400", text: "Loop mượt nhưng chuyển khung từ giây 20 → 22 hơi giật. Có thể xem lại easing?", rating: { story: 4, art: 5, pacing: 4 }, time: "3 giờ", likes: 26, liked: false },
  ],
};

export type SortKey = "hot" | "new" | "top";