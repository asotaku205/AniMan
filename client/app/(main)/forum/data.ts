
import type { Post, Comment, ReactionKey,Category,FilterTab,PostType } from "../types/forum";
export const INIT_POSTS: Post[] = [
  {
    id: 1, type: "theory",
    user: "tsuki_no_kage", color: "from-violet-500 to-fuchsia-500",
    badge: "Lý thuyết",
    title: "Tại sao chiếc ô đỏ lại là biểu tượng của định mệnh trong 'Hoa Anh Đào Cuối Mùa'?",
    body: "Tổng hợp 7 phân cảnh và sự đối xứng màu sắc giữa hồi 1 và hồi 3 cho thấy chiếc ô đỏ xuất hiện đúng mỗi khi hai nhân vật chính sắp có bước ngoặt lớn...",
    img: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1000",
    up: 2841, cm: 312, saves: 847, time: "2 giờ", category: "anime",
    tags: ["Hoa Anh Đào Cuối Mùa", "Lý thuyết màu sắc"],
  },
  {
    id: 2, type: "art",
    user: "AoiInk", color: "from-pink-500 to-rose-400",
    badge: "Tranh fan",
    title: "Mình vẽ Aoi-chan phiên bản kimono mùa hè 🌸",
    img: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1000",
    up: 1240, cm: 86, saves: 412, time: "4 giờ", category: "art",
    tags: ["Fan Art", "Kimono"],
  },
  {
    id: 3, type: "clip",
    user: "ShiroEdit", color: "from-sky-500 to-cyan-400",
    badge: "Cắt clip",
    title: "Edit 30 giây cảnh chia tay — chỉnh màu theo phong cách Makoto Shinkai",
    img: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=1000",
    up: 988, cm: 142, saves: 267, time: "6 giờ", category: "anime",
    tags: ["Edit", "Makoto Shinkai"],
  },
  {
    id: 4, type: "discussion",
    user: "RenAozora", color: "from-emerald-500 to-teal-400",
    badge: "Thảo luận",
    title: "Theo bạn, cái kết của 'Mùa Xuân Cuối' có thực sự thỏa mãn không? Mình cảm thấy chương 40 bị vội vàng...",
    body: "Tác giả đã xây dựng arc nhân vật quá tốt cho đến chương 38, nhưng phần kết dường như bị rush. Có ai cũng cảm thấy vậy không?",
    up: 654, cm: 231, saves: 89, time: "8 giờ", category: "novel",
    tags: ["Mùa Xuân Cuối", "Kết thúc"],
  },
  {
    id: 5, type: "review",
    user: "kyoto_dreamer", color: "from-orange-500 to-pink-400",
    badge: "Review",
    title: "Review không spoiler: 'Tokyo Neon Chronicles' tập 12 — đỉnh điểm của mùa này",
    body: "Sau 11 tập xây dựng nhân vật cẩn thận, tập 12 đã bùng nổ theo đúng nghĩa đen. Animation của studio rõ ràng đã giữ budget cho tập này...",
    img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1000",
    up: 1876, cm: 445, saves: 623, time: "1 ngày", category: "anime",
    tags: ["Tokyo Neon Chronicles", "Review", "No Spoiler"],
  },
  {
    id: 7, type: "poll",
    user: "SakuraStream Official", color: "from-pink-500 to-fuchsia-400",
    badge: "Bình chọn",
    title: "Bạn muốn studio chuyển thể tiếp tác phẩm nào trong mùa thu 2026?",
    up: 432, cm: 98, saves: 54, time: "3 giờ", category: "anime",
    tags: ["Bình chọn", "Mùa thu 2026"],
    reactions: { fire: 88, sakura: 42 },
    poll: {
      question: "Chọn 1 tác phẩm",
      options: [
        { id: "o1", text: "Lời nhắn từ Aoi (light novel)", votes: 1240 },
        { id: "o2", text: "Tokyo Neon — Season 2", votes: 2103 },
        { id: "o3", text: "Hoa Anh Đào Cuối Mùa — Movie", votes: 1678 },
        { id: "o4", text: "Kẻ Lãng Du (manga)", votes: 533 },
      ],
    },
  },
  {
    id: 6, type: "art",
    user: "HinaPixel", color: "from-yellow-400 to-orange-400",
    badge: "Tranh fan",
    title: "Vẽ lại bìa Manga 'Kẻ Lãng Du' theo phong cách pixel art 🎮",
    img: "https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=1000",
    up: 892, cm: 67, saves: 305, time: "1 ngày", category: "art",
    tags: ["Pixel Art", "Fan Art", "Kẻ Lãng Du"],
  },
];

export const COMMENTS_MAP: Record<number, Comment[]> = {
  1: [
    { id: 1, user: "RenAozora", color: "from-emerald-500 to-teal-400", text: "Phân tích cực kỳ chi tiết! Mình cũng để ý cái ô đỏ ở tập 3 nhưng không liên kết được. Cảm ơn bạn 🌸", time: "1 giờ", likes: 47, liked: false },
    { id: 2, user: "HinaPixel", color: "from-yellow-400 to-orange-400", text: "Đợi mình re-watch lại hết 12 tập để kiểm chứng cái này. Nếu đúng thì quá là tinh tế!", time: "45 phút", likes: 23, liked: false },
  ],
  4: [
    { id: 1, user: "tsuki_no_kage", color: "from-violet-500 to-fuchsia-500", text: "Đồng ý với bạn. Chương 39 rõ ràng là setup cho một kết thúc mở hơn, nhưng chương 40 lại đóng quá nhanh.", time: "7 giờ", likes: 38, liked: false },
    { id: 2, user: "AoiInk", color: "from-pink-500 to-rose-400", text: "Mình nghĩ tác giả đã bị áp lực deadline từ nhà xuất bản. Bản light novel gốc còn 2-3 chương nữa theo lịch ban đầu.", time: "6 giờ", likes: 52, liked: false },
  ],
};

export const CATEGORY_TABS: { key: Category; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "anime", label: "Anime" },
  { key: "manga", label: "Manga" },
  { key: "novel", label: "Tiểu thuyết" },
  { key: "film", label: "Phim" },
  { key: "art", label: "Fan Art" },
];

export const trends = [
  "#HoaAnhDaoCuoiMua",
  "#AISketchChallenge",
  "#NovelStudioBeta",
  "#TokyoNeonOST",
  "#LiveWatchTuanNay",
];

export const TOP_USERS = [
  { user: "tsuki_no_kage", color: "from-violet-500 to-fuchsia-500", posts: 142, followers: 2841 },
  { user: "AoiInk", color: "from-pink-500 to-rose-400", posts: 87, followers: 1240 },
  { user: "ShiroEdit", color: "from-sky-500 to-cyan-400", posts: 63, followers: 988 },
];
