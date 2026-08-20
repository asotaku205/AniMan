export type NotifType = "episode" | "reply" | "like" | "follow" | "system" | "event" | "chapter";

export type Notification = {
  id: number;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  read: boolean;
  img?: string;
  link?: string;
  user?: string;
  userColor?: string;
};

export const INIT_NOTIFICATIONS: Notification[] = [
  {
    id: 1, type: "episode",
    title: "Tập mới phát hành",
    body: "Tokyo Neon Chronicles — Tập 13: Ký ức mất ngủ vừa được cập nhật",
    time: "5 phút", read: false,
    img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200",
    link: "/anime/tokyo-neon-chronicles/xem/13",
  },
  {
    id: 2, type: "reply",
    title: "tsuki_no_kage đã trả lời bình luận của bạn",
    body: "\"Bạn cũng nhận ra chi tiết chiếc ô đỏ ở tập 7 đấy sao? Mình cũng thắc mắc điều này từ lâu...\"",
    time: "32 phút", read: false,
    user: "tsuki_no_kage", userColor: "from-violet-500 to-fuchsia-500",
    link: "/forum",
  },
  {
    id: 3, type: "like",
    title: "24 người đã thích bài viết của bạn",
    body: "\"Tại sao cảnh mưa trong anime Nhật luôn buồn đến vậy?\"",
    time: "1 giờ", read: false,
    link: "/forum",
  },
  {
    id: 4, type: "chapter",
    title: "Chương mới — Tiểu thuyết",
    body: "Mùa Xuân Cuối — Chương 8: Lời nguyện vừa được cập nhật (2.100 chữ)",
    time: "2 giờ", read: true,
    img: "https://images.unsplash.com/photo-1533038590840-1cde6e668a91?w=200",
    link: "/tieu-thuyet/mua-xuan-cuoi/doc/8",
  },
  {
    id: 5, type: "follow",
    title: "AoiInk vừa theo dõi bạn",
    body: "Fan art creator · 1.2k người theo dõi",
    time: "3 giờ", read: true,
    user: "AoiInk", userColor: "from-pink-500 to-rose-400",
    link: "/ho-so/aoiink",
  },
  {
    id: 6, type: "event",
    title: "Sakura Festival 2026 — Đăng ký mở!",
    body: "Cuộc thi Sketch-to-Manga toàn cầu. Hạn đăng ký: 15/06/2026. Giải thưởng tổng trị giá 500 triệu VNĐ.",
    time: "1 ngày", read: true,
    link: "/studio",
  },
  {
    id: 7, type: "episode",
    title: "Hoa Anh Đào Cuối Mùa — Tập 12 ra mắt",
    body: "\"Cánh hoa cuối cùng\" — Tập cuối của mùa 1 đã được phát hành",
    time: "1 ngày", read: true,
    img: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=200",
    link: "/anime",
  },
  {
    id: 8, type: "system",
    title: "Tài khoản Premium đã được kích hoạt",
    body: "Bạn đã nâng cấp lên Premium thành công. Truy cập không giới hạn đến 04/05/2027.",
    time: "3 ngày", read: true,
  },
  {
    id: 9, type: "like",
    title: "ShiroEdit thích bình luận của bạn",
    body: "Trong bài: \"Edit 30 giây cảnh chia tay — chỉnh màu theo phong cách Makoto Shinkai\"",
    time: "4 ngày", read: true,
    user: "ShiroEdit", userColor: "from-sky-500 to-cyan-400",
    link: "/forum",
  },
  {
    id: 10, type: "reply",
    title: "kyoto_dreamer đã đề cập đến bạn",
    body: "@you Mình nghĩ bạn sẽ thích phần phân tích này — cùng quan điểm với comment bạn đăng tuần trước",
    time: "5 ngày", read: true,
    user: "kyoto_dreamer", userColor: "from-emerald-500 to-teal-400",
    link: "/forum",
  },
];

export const FILTER_TABS = [
  { key: "all", label: "Tất cả" },
  { key: "update", label: "Cập nhật nội dung" },
  { key: "social", label: "Cộng đồng" },
  { key: "system", label: "Hệ thống" },
];
