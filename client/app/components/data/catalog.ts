export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export type Episode = { n: number; title: string; img: string; runtime: string; desc: string };
export type Character = { name: string; role: string; img: string };
export type Review = { user: string; color: string; rating: number; comment: string; time: string };

export type Title = {
  slug: string;
  t: string;
  img: string;
  banner: string;
  ep?: number;
  year: number;
  score: number;
  studio?: string;
  director?: string;
  status: "Đang chiếu" | "Đã hoàn thành" | "Sắp ra mắt";
  tags: string[];
  synopsis: string;
  episodes?: Episode[];
  cast: Character[];
  reviews: Review[];
  trailer?: string;
};

const sampleEps = (count: number, banner: string): Episode[] =>
  Array.from({ length: count }).map((_, i) => ({
    n: i + 1,
    title: [
      "Khởi nguyên",
      "Cánh cửa thứ hai",
      "Ánh sáng cuối hành lang",
      "Lời thì thầm trong gió",
      "Khúc bi ca tháng năm",
      "Ngày em không tới",
      "Bóng tối phía sau",
      "Mưa rào",
      "Ký ức mất ngủ",
      "Cuộc gặp gỡ",
      "Tâm tư giấu kín",
      "Hẹn ước",
      "Tiếng vọng",
      "Định mệnh đan xen",
      "Cánh hoa cuối cùng",
      "Trở về",
      "Người lạ thân quen",
      "Lằn ranh",
      "Trận chiến",
      "Hồi kết",
      "Bình minh mới",
      "Khởi đầu khác",
      "Lời nguyện",
      "Vĩ thanh",
    ][i % 24],
    img: banner,
    runtime: `${22 + (i % 3)} phút`,
    desc: "Tập phim mở ra một lớp mới của câu chuyện, khi nhân vật chính phải đối mặt với chính mình.",
  }));

const sampleCast = (seed: number): Character[] => {
  const all = [
    { name: "Aoi Hoshikawa", role: "Nhân vật chính", img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400" },
    { name: "Ren Aozora", role: "Bạn đồng hành", img: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400" },
    { name: "Hina Mori", role: "Đối thủ", img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400" },
    { name: "Kenji Takeda", role: "Người dẫn dắt", img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400" },
    { name: "Yuki Sato", role: "Đồng đội", img: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400" },
    { name: "Mio Kobayashi", role: "Em gái", img: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400" },
  ];
  return all.slice(0, 4 + (seed % 3));
};

const sampleReviews: Review[] = [
  { user: "tsuki_no_kage", color: "from-violet-500 to-fuchsia-500", rating: 9, comment: "Một tác phẩm khiến tôi rưng rưng từ tập đầu. Soundtrack quá đỉnh.", time: "2 ngày" },
  { user: "AoiInk", color: "from-pink-500 to-rose-400", rating: 10, comment: "Hình ảnh đẹp như một bức tranh tĩnh, từng khung hình đều có thể đóng khung.", time: "5 ngày" },
  { user: "ShiroEdit", color: "from-sky-500 to-cyan-400", rating: 8, comment: "Nhịp phim hơi chậm ở giữa nhưng cú twist cuối hồi 2 đáng đồng tiền.", time: "1 tuần" },
];

const make = (
  t: string,
  img: string,
  banner: string,
  opts: Partial<Title> & { score: number; year: number; ep?: number; tags: string[]; synopsis: string },
): Title => ({
  slug: slugify(t),
  t,
  img,
  banner,
  status: "Đang chiếu",
  cast: sampleCast(t.length),
  reviews: sampleReviews,
  ...opts,
  episodes: opts.ep ? sampleEps(opts.ep, banner) : undefined,
});

export const animeFeatured = {
  title: "Tokyo 2099 — Phố Neon",
  desc: "Một cyberpunk anime nguyên tác, theo chân nữ kỹ sư AI lạc giữa các tầng ký ức của thành phố. Độc quyền 4K HDR.",
  img: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=1600",
  tags: ["Sci-Fi", "Cyberpunk", "4K HDR", "Sub VI"],
  href: "/anime/tokyo-2099",
};

export const animeList: Title[] = [
  make("Kẻ Săn Quái Đêm", "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800", "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1600", { ep: 12, score: 9.4, year: 2026, tags: ["Action", "Supernatural"], studio: "Yumeiro Studio", director: "Naoko Sasaki", synopsis: "Trong một Tokyo nơi quái vật xuất hiện sau hoàng hôn, một thiếu niên thừa kế thanh kiếm bạc của cha và bước vào hội săn đêm." }),
  make("Học Viện Phép Thuật", "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800", "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1600", { ep: 24, score: 8.9, year: 2025, tags: ["Fantasy", "School"], studio: "Hoshi Animation", director: "Ryo Mura", synopsis: "Bốn học viên với bốn nguyên tố phải hợp sức trước lời tiên tri đã ngủ yên 300 năm." }),
  make("Tokyo 2099", "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=800", "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=1600", { ep: 8, score: 9.1, year: 2026, tags: ["Sci-Fi", "Cyberpunk"], studio: "Neon Cell", director: "Itsuki Hara", synopsis: "Một kỹ sư AI phát hiện thành phố đang ghi đè ký ức cư dân — và cô là người duy nhất nhận ra điều đó.", status: "Đang chiếu" }),
  make("Vũ Điệu Lụa", "https://images.unsplash.com/photo-1493514789931-586cb221d7a7?w=800", "https://images.unsplash.com/photo-1493514789931-586cb221d7a7?w=1600", { ep: 10, score: 8.6, year: 2025, tags: ["Drama", "Music"], studio: "Tsubaki Works", director: "Mei Ono", synopsis: "Câu chuyện về cô gái câm theo đuổi nghệ thuật múa truyền thống tại một ngôi đền cũ." }),
  make("Samurai Kim Tinh", "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800", "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1600", { ep: 16, score: 9.2, year: 2024, tags: ["Action", "Sci-Fi"], studio: "Akatsuki", director: "Goro Yamada", synopsis: "Một samurai bị đày lên Kim Tinh, và những kẻ giết thuê đến từ Trái Đất.", status: "Đã hoàn thành" }),
  make("Lời Thì Thầm Của Mưa", "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800", "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1600", { ep: 6, score: 8.4, year: 2026, tags: ["Slice of Life"], studio: "Ame Studio", director: "Yui Hatano", synopsis: "Sáu ngày mưa, sáu câu chuyện đan xen trong một thị trấn ven biển Kyushu." }),
  make("Ngọn Lửa Kitsune", "https://images.unsplash.com/photo-1554072675-66db59dba46f?w=800", "https://images.unsplash.com/photo-1554072675-66db59dba46f?w=1600", { ep: 13, score: 9.0, year: 2025, tags: ["Fantasy", "Mythology"], studio: "Inari Pictures", director: "Sora Kuroda", synopsis: "Linh hồn cáo chín đuôi tỉnh dậy sau giấc ngủ ngàn năm và nhận ra thế giới đã quên đi các vị thần." }),
  make("Bản Tình Ca Mecha", "https://images.unsplash.com/photo-1614583224978-f05ce51ef5fa?w=800", "https://images.unsplash.com/photo-1614583224978-f05ce51ef5fa?w=1600", { ep: 22, score: 8.7, year: 2024, tags: ["Mecha", "Romance"], studio: "Steel Heart", director: "Kazuya Inoue", synopsis: "Một mecha-pilot và cô ca sĩ thần tượng bị buộc phải chia sẻ chung một cabin chiến đấu.", status: "Đã hoàn thành" }),
];

export const liveFeatured = {
  title: "Hoa Anh Đào Cuối Mùa",
  desc: "Tác phẩm điện ảnh Nhật bản quyền 2026 — câu chuyện về tình yêu, hồi ức và một mùa xuân không quay trở lại.",
  img: "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1600",
  tags: ["Romance", "Drama", "4K", "Sub VI"],
  href: "/phim/hoa-anh-dao-cuoi-mua",
};

export const liveList: Title[] = [
  make("Hoa Anh Đào Cuối Mùa", "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=800", "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1600", { score: 9.3, year: 2026, tags: ["Romance", "Drama"], director: "Hiroshi Tanaka", synopsis: "Khi mùa hoa anh đào cuối cùng sắp tàn, hai người xa lạ tìm thấy nhau qua một chiếc ô đỏ bị bỏ quên." }),
  make("Phố Đèn Lồng", "https://images.unsplash.com/photo-1480796927426-f609979314bd?w=800", "https://images.unsplash.com/photo-1480796927426-f609979314bd?w=1600", { score: 8.8, year: 2025, tags: ["Drama"], director: "Mariko Saito", synopsis: "Tại con phố đèn lồng cổ ở Kyoto, mỗi đêm là một câu chuyện về những người đến và đi." }),
  make("Người Đưa Thư Cuối Cùng", "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800", "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1600", { score: 8.5, year: 2024, tags: ["Mystery"], director: "Akira Nishimura", synopsis: "Một bưu tá già khám phá ra rằng những lá thư anh giao mỗi sáng đến từ những người đã khuất.", status: "Đã hoàn thành" }),
  make("Tiệm Mì Đêm Khuya", "https://images.unsplash.com/photo-1493514789931-586cb221d7a7?w=800", "https://images.unsplash.com/photo-1493514789931-586cb221d7a7?w=1600", { score: 9.0, year: 2025, tags: ["Slice of Life"], director: "Yumi Watanabe", synopsis: "Quán mì chỉ mở từ nửa đêm đến rạng sáng, và mỗi vị khách đều mang theo một câu chuyện." }),
  make("Gió Mùa Hạ", "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800", "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1600", { score: 8.6, year: 2026, tags: ["Romance"], director: "Toru Kasai", synopsis: "Mùa hè cuối cùng của thời học sinh — và một lời hứa chưa bao giờ được thốt ra." }),
  make("Vết Mực Trên Giấy", "https://images.unsplash.com/photo-1518929458119-e5bf444c30f4?w=800", "https://images.unsplash.com/photo-1518929458119-e5bf444c30f4?w=1600", { score: 8.4, year: 2024, tags: ["Drama"], director: "Aiko Mori", synopsis: "Một thư ký già lưu giữ tất cả lá thư bị từ chối của các tác giả nổi tiếng." }),
  make("Tokyo Lúc 5 Giờ Sáng", "https://images.unsplash.com/photo-1554072675-66db59dba46f?w=800", "https://images.unsplash.com/photo-1554072675-66db59dba46f?w=1600", { score: 8.9, year: 2026, tags: ["Drama"], director: "Kenta Ishii", synopsis: "Năm câu chuyện đan xen trong khoảnh khắc thành phố chuyển giao giữa đêm và ngày." }),
  make("Chuyến Tàu Đêm Shinkansen", "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=800", "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=1600", { score: 8.7, year: 2025, tags: ["Thriller"], director: "Shun Hayashi", synopsis: "Trên chuyến Shinkansen đêm cuối cùng, một hành khách biến mất giữa hai ga." }),
];

export const findAnime = (slug: string) => animeList.find((a) => a.slug === slug);
export const findFilm = (slug: string) => liveList.find((a) => a.slug === slug);
