import { slugify } from "./catalog";

export type Chapter = { n: number; title: string; pages: number; date: string };
export type Manga = {
  slug: string;
  t: string;
  cover: string;
  banner: string;
  author: string;
  artist?: string;
  publisher: string;
  status: "Đang ra" | "Đã hoàn thành" | "Tạm ngưng";
  year: number;
  score: number;
  tags: string[];
  synopsis: string;
  chapters: Chapter[];
  pagesPreview: string[];
};

const mkChapters = (n: number): Chapter[] =>
  Array.from({ length: n }).map((_, i) => ({
    n: n - i,
    title: ["Khởi đầu", "Lời mời", "Bóng tối", "Hứa hẹn", "Cánh hoa", "Hoàng hôn", "Tiếng vọng", "Lời từ biệt", "Mưa rào", "Trở về", "Định mệnh", "Bí mật", "Đêm dài", "Ánh sáng", "Cuộc gặp"][i % 15] + ` ${n - i}`,
    pages: 18 + ((i * 3) % 12),
    date: `${(i % 28) + 1}/${((i % 12) + 1)}/2026`,
  }));

const mkPreview = (banner: string) => [banner, banner, banner, banner];

const m = (t: string, cover: string, opts: Omit<Manga, "slug" | "t" | "cover" | "banner" | "chapters" | "pagesPreview"> & { chapters?: number }): Manga => ({
  slug: slugify(t),
  t,
  cover,
  banner: cover.replace("w=800", "w=1600"),
  ...opts,
  chapters: mkChapters(opts.chapters ?? 60),
  pagesPreview: mkPreview(cover.replace("w=800", "w=1200")),
});

export const mangaList: Manga[] = [
  m("Kẻ Săn Quái Đêm", "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800", { author: "Sora Tanaka", artist: "Sora Tanaka", publisher: "Shueisha", status: "Đang ra", year: 2024, score: 9.4, tags: ["Action", "Supernatural", "Seinen"], synopsis: "Tokyo về đêm bị cai trị bởi quái vật vô hình. Một thiếu niên thừa hưởng thanh kiếm bạc của cha và bước vào hội săn đêm.", chapters: 142 }),
  m("Học Viện Phép Thuật", "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800", { author: "Hina Kobayashi", publisher: "Kodansha", status: "Đang ra", year: 2023, score: 8.9, tags: ["Fantasy", "School"], synopsis: "Học viện nơi bốn nguyên tố hội tụ, và một lời tiên tri cổ đang thức tỉnh.", chapters: 88 }),
  m("Tokyo 2099", "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=800", { author: "Ren Aozora", publisher: "Shogakukan", status: "Đang ra", year: 2025, score: 9.1, tags: ["Sci-Fi", "Cyberpunk"], synopsis: "Thành phố đang ghi đè ký ức cư dân — và cô là người duy nhất nhận ra.", chapters: 56 }),
  m("Vũ Điệu Lụa", "https://images.unsplash.com/photo-1493514789931-586cb221d7a7?w=800", { author: "Aoi Mori", publisher: "Hakusensha", status: "Đã hoàn thành", year: 2022, score: 8.6, tags: ["Drama", "Music", "Josei"], synopsis: "Cô gái câm theo đuổi nghệ thuật múa truyền thống tại một ngôi đền cũ.", chapters: 34 }),
  m("Samurai Kim Tinh", "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800", { author: "Kenji Saito", publisher: "Shueisha", status: "Đang ra", year: 2020, score: 9.2, tags: ["Action", "Sci-Fi", "Shounen"], synopsis: "Một samurai bị đày lên Kim Tinh đối mặt sát thủ đến từ Trái Đất.", chapters: 210 }),
  m("Mưa Đêm Kyoto", "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800", { author: "Yuki Hoshino", publisher: "Kadokawa", status: "Đang ra", year: 2026, score: 8.4, tags: ["Romance", "Slice of Life"], synopsis: "Hai người lạ chia sẻ một chiếc ô tại Gion vào ngày mưa.", chapters: 28 }),
  m("Kitsune Hỏa", "https://images.unsplash.com/photo-1554072675-66db59dba46f?w=800", { author: "Mio Takeda", publisher: "Hakusensha", status: "Đang ra", year: 2024, score: 9.0, tags: ["Fantasy", "Mythology"], synopsis: "Linh hồn cáo chín đuôi tỉnh giấc sau ngàn năm.", chapters: 64 }),
  m("Bản Tình Ca Mecha", "https://images.unsplash.com/photo-1614583224978-f05ce51ef5fa?w=800", { author: "Daichi Ono", publisher: "Square Enix", status: "Đã hoàn thành", year: 2018, score: 8.7, tags: ["Mecha", "Romance"], synopsis: "Mecha-pilot và cô ca sĩ thần tượng phải chia sẻ chung cabin chiến đấu.", chapters: 120 }),
];

export const findManga = (slug: string) => mangaList.find((m) => m.slug === slug);
