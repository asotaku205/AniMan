import { slugify } from "@/app/components/data/catalog";

export type NovelChapter = { n: number; title: string; words: number };
export type Novel = {
  slug: string;
  t: string;
  cover: string;
  author: string;
  publisher: string;
  status: "Đang viết" | "Đã hoàn thành";
  year: number;
  score: number;
  words: string;
  tags: string[];
  synopsis: string;
  excerpt: string;
  chapters: NovelChapter[];
};

const mkCh = (n: number): NovelChapter[] =>
  Array.from({ length: n }).map((_, i) => ({
    n: i + 1,
    title: ["Mưa xuân", "Tiếng chuông gió", "Cánh hoa cuối", "Hồ vắng", "Trà thất", "Đèn lồng", "Người lạ", "Lời hứa", "Đêm sáng trăng", "Bến sông", "Ngọn núi cũ", "Bức thư"][i % 12] + ` ${i + 1}`,
    words: 3000 + ((i * 137) % 3000),
  }));

const n = (t: string, cover: string, opts: Omit<Novel, "slug" | "t" | "cover" | "chapters"> & { chapters?: number }): Novel => ({
  slug: slugify(t),
  t,
  cover,
  ...opts,
  chapters: mkCh(opts.chapters ?? 24),
});

export const novelList: Novel[] = [
  n("Bóng Của Mặt Trăng Trên Hồ", "https://images.unsplash.com/photo-1518929458119-e5bf444c30f4?w=800", { author: "Mizuki Aoyama", publisher: "Shinchosha", status: "Đang viết", year: 2026, score: 9.3, words: "182k", tags: ["Đương đại", "Tâm lý"], synopsis: "Một biên tập viên trở về quê và bắt gặp lại bóng dáng của người đã mất, in trên mặt hồ vào những đêm trăng tròn.", excerpt: "Tôi nhớ buổi chiều ấy, mưa rơi rất khẽ trên mái ngói cong của ngôi đền cũ. Em đứng đó, ô giấy nghiêng nghiêng, ánh mắt lạc giữa những cánh hoa anh đào cuối cùng còn sót lại của mùa xuân...", chapters: 36 }),
  n("Tôi Đã Trở Thành Cây Hoa Anh Đào", "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=800", { author: "Hanako Sumire", publisher: "Kadokawa", status: "Đã hoàn thành", year: 2024, score: 9.0, words: "94k", tags: ["Light Novel", "Fantasy"], synopsis: "Một cô gái thức dậy và phát hiện linh hồn mình đã chuyển vào thân cây hoa anh đào trước cổng trường.", excerpt: "Tôi không còn cảm thấy đôi chân của mình. Chỉ có gió, và những cánh hoa rời khỏi tôi, mỗi cánh mang theo một tên người tôi từng yêu...", chapters: 18 }),
  n("Người Đan Sương Mù", "https://images.unsplash.com/photo-1554072675-66db59dba46f?w=800", { author: "Toru Kasai", publisher: "Bungeishunju", status: "Đang viết", year: 2025, score: 8.7, words: "240k", tags: ["Huyền bí", "Văn học"], synopsis: "Tại một làng chài bị sương mù nuốt chửng mỗi tối, một bà lão dệt sương thành áo cho những người đã khuất.", excerpt: "Sương mù đêm nay đặc đến mức tôi không nhìn thấy bàn tay mình. Bà ngoại bảo: 'Đừng sợ. Sương cũng cần một ai đó để ôm.'", chapters: 48 }),
  n("Quán Trà Lúc 3 Giờ Sáng", "https://images.unsplash.com/photo-1493514789931-586cb221d7a7?w=800", { author: "Yumi Watanabe", publisher: "Shinchosha", status: "Đang viết", year: 2025, score: 8.9, words: "120k", tags: ["Đời thường", "Ấm áp"], synopsis: "Quán trà nhỏ chỉ mở cửa từ 3 đến 5 giờ sáng. Khách của nó là những người mất ngủ — và đôi khi, là cả những hồn ma.", excerpt: "Cô ấy đẩy cửa bước vào lúc 3 giờ 17 phút. Tôi rót cho cô tách hojicha, và cô bắt đầu kể về một mùa hè đã rất xa...", chapters: 24 }),
  n("Ký Ức Của Cánh Hạc Giấy", "https://images.unsplash.com/photo-1480796927426-f609979314bd?w=800", { author: "Aiko Mori", publisher: "Iwanami", status: "Đã hoàn thành", year: 2023, score: 9.1, words: "67k", tags: ["Văn học", "Lịch sử"], synopsis: "1.000 con hạc giấy được gấp bởi một cô bé ở Hiroshima — và những lá thư giấu bên trong chúng.", excerpt: "Bà nội gấp con hạc thứ 998. Tôi hỏi: 'Còn hai con nữa thì sao?' Bà cười: 'Hai con đó là của hai người chưa biết tên.'", chapters: 12 }),
  n("Đường Đi Của Gió Mùa", "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800", { author: "Kenta Ishii", publisher: "Kodansha", status: "Đang viết", year: 2026, score: 8.5, words: "310k", tags: ["Phiêu lưu", "Đương đại"], synopsis: "Một nhiếp ảnh gia đi theo đường đi của gió mùa từ Okinawa lên Hokkaido, ghi lại từng người anh gặp.", excerpt: "Gió mùa đi đâu, tôi đi đó. Nó ghé qua Nagasaki vào tháng năm, và mang theo mùi muối, mùi mực in báo cũ...", chapters: 60 }),
];

export const findNovel = (slug: string) => novelList.find((n) => n.slug === slug);
