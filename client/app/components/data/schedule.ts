import { animeList, liveList } from "./catalog";

export type ScheduleItem = {
  id: string;
  time: string;
  title: string;
  ep: number;
  totalEp: number | string;
  img: string;
  slug: string;
  type: "anime" | "phim";
  studio?: string;
  isNew?: boolean;
  isPremiere?: boolean;
  tags: string[];
};

export type DaySchedule = {
  dayKey: string;
  label: string;
  shortLabel: string;
  date: string;
  isToday?: boolean;
  items: ScheduleItem[];
};

// Today: Wednesday May 6 2026 = index offset 0
// We'll generate Mon-Sun of that week
const days: Array<{ label: string; shortLabel: string; offset: number }> = [
  { label: "Thứ Hai", shortLabel: "T2", offset: -2 },
  { label: "Thứ Ba", shortLabel: "T3", offset: -1 },
  { label: "Thứ Tư", shortLabel: "T4", offset: 0 },   // today
  { label: "Thứ Năm", shortLabel: "T5", offset: 1 },
  { label: "Thứ Sáu", shortLabel: "T6", offset: 2 },
  { label: "Thứ Bảy", shortLabel: "T7", offset: 3 },
  { label: "Chủ Nhật", shortLabel: "CN", offset: 4 },
];

const getDate = (offset: number) => {
  const d = new Date(2026, 4, 6); // May 6
  d.setDate(d.getDate() + offset);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

const rawSchedule: Record<string, ScheduleItem[]> = {
  T2: [
    { id: "t2-1", time: "00:30", title: "Kẻ Săn Quái Đêm", ep: 7, totalEp: 12, img: animeList[0].img, slug: animeList[0].slug, type: "anime", studio: "Yumeiro Studio", tags: ["Action", "Supernatural"] },
    { id: "t2-2", time: "16:00", title: "Học Viện Phép Thuật", ep: 14, totalEp: 24, img: animeList[1].img, slug: animeList[1].slug, type: "anime", studio: "Hoshi Animation", tags: ["Fantasy"] },
    { id: "t2-3", time: "18:30", title: "Phố Đèn Lồng", ep: 1, totalEp: 1, img: liveList[1].img, slug: liveList[1].slug, type: "phim", tags: ["Drama"] },
    { id: "t2-4", time: "22:00", title: "Ngọn Lửa Kitsune", ep: 9, totalEp: 13, img: animeList[6].img, slug: animeList[6].slug, type: "anime", studio: "Inari Pictures", tags: ["Fantasy", "Mythology"] },
  ],
  T3: [
    { id: "t3-1", time: "01:00", title: "Vũ Điệu Lụa", ep: 8, totalEp: 10, img: animeList[3].img, slug: animeList[3].slug, type: "anime", studio: "Tsubaki Works", tags: ["Drama", "Music"] },
    { id: "t3-2", time: "14:00", title: "Tiệm Mì Đêm Khuya", ep: 1, totalEp: 1, img: liveList[3].img, slug: liveList[3].slug, type: "phim", tags: ["Slice of Life"], isPremiere: true },
    { id: "t3-3", time: "20:00", title: "Tokyo 2099", ep: 7, totalEp: 8, img: animeList[2].img, slug: animeList[2].slug, type: "anime", studio: "Neon Cell", tags: ["Sci-Fi", "Cyberpunk"] },
    { id: "t3-4", time: "23:30", title: "Lời Thì Thầm Của Mưa", ep: 5, totalEp: 6, img: animeList[5].img, slug: animeList[5].slug, type: "anime", studio: "Ame Studio", tags: ["Slice of Life"] },
  ],
  T4: [
    { id: "t4-1", time: "00:00", title: "Kẻ Săn Quái Đêm", ep: 8, totalEp: 12, img: animeList[0].img, slug: animeList[0].slug, type: "anime", studio: "Yumeiro Studio", tags: ["Action"], isNew: true },
    { id: "t4-2", time: "12:00", title: "Hoa Anh Đào Cuối Mùa", ep: 1, totalEp: 1, img: liveList[0].img, slug: liveList[0].slug, type: "phim", tags: ["Romance", "Drama"], isPremiere: true },
    { id: "t4-3", time: "16:30", title: "Bản Tình Ca Mecha", ep: 20, totalEp: 22, img: animeList[7].img, slug: animeList[7].slug, type: "anime", studio: "Steel Heart", tags: ["Mecha"] },
    { id: "t4-4", time: "21:00", title: "Samurai Kim Tinh", ep: 15, totalEp: 16, img: animeList[4].img, slug: animeList[4].slug, type: "anime", studio: "Akatsuki", tags: ["Action", "Sci-Fi"], isNew: true },
    { id: "t4-5", time: "23:00", title: "Gió Mùa Hạ", ep: 1, totalEp: 1, img: liveList[4].img, slug: liveList[4].slug, type: "phim", tags: ["Romance"] },
  ],
  T5: [
    { id: "t5-1", time: "02:00", title: "Học Viện Phép Thuật", ep: 15, totalEp: 24, img: animeList[1].img, slug: animeList[1].slug, type: "anime", studio: "Hoshi Animation", tags: ["Fantasy"] },
    { id: "t5-2", time: "15:00", title: "Người Đưa Thư Cuối Cùng", ep: 1, totalEp: 1, img: liveList[2].img, slug: liveList[2].slug, type: "phim", tags: ["Mystery"] },
    { id: "t5-3", time: "19:00", title: "Ngọn Lửa Kitsune", ep: 10, totalEp: 13, img: animeList[6].img, slug: animeList[6].slug, type: "anime", studio: "Inari Pictures", tags: ["Fantasy"], isNew: true },
    { id: "t5-4", time: "22:30", title: "Tokyo 2099", ep: 8, totalEp: 8, img: animeList[2].img, slug: animeList[2].slug, type: "anime", studio: "Neon Cell", tags: ["Sci-Fi"], isNew: true },
  ],
  T6: [
    { id: "t6-1", time: "00:30", title: "Vũ Điệu Lụa", ep: 9, totalEp: 10, img: animeList[3].img, slug: animeList[3].slug, type: "anime", studio: "Tsubaki Works", tags: ["Drama"], isNew: true },
    { id: "t6-2", time: "17:00", title: "Chuyến Tàu Đêm Shinkansen", ep: 1, totalEp: 1, img: liveList[7].img, slug: liveList[7].slug, type: "phim", tags: ["Thriller"], isPremiere: true },
    { id: "t6-3", time: "21:00", title: "Lời Thì Thầm Của Mưa", ep: 6, totalEp: 6, img: animeList[5].img, slug: animeList[5].slug, type: "anime", studio: "Ame Studio", tags: ["Slice of Life"] },
    { id: "t6-4", time: "23:30", title: "Kẻ Săn Quái Đêm", ep: 9, totalEp: 12, img: animeList[0].img, slug: animeList[0].slug, type: "anime", studio: "Yumeiro Studio", tags: ["Action"] },
  ],
  T7: [
    { id: "t7-1", time: "10:00", title: "Samurai Kim Tinh", ep: 16, totalEp: 16, img: animeList[4].img, slug: animeList[4].slug, type: "anime", studio: "Akatsuki", tags: ["Action", "Sci-Fi"], isNew: true },
    { id: "t7-2", time: "14:00", title: "Tokyo Lúc 5 Giờ Sáng", ep: 1, totalEp: 1, img: liveList[6].img, slug: liveList[6].slug, type: "phim", tags: ["Drama"], isPremiere: true },
    { id: "t7-3", time: "18:00", title: "Bản Tình Ca Mecha", ep: 21, totalEp: 22, img: animeList[7].img, slug: animeList[7].slug, type: "anime", studio: "Steel Heart", tags: ["Mecha"] },
    { id: "t7-4", time: "22:00", title: "Học Viện Phép Thuật", ep: 16, totalEp: 24, img: animeList[1].img, slug: animeList[1].slug, type: "anime", tags: ["Fantasy"] },
  ],
  CN: [
    { id: "cn-1", time: "12:00", title: "Hoa Anh Đào Cuối Mùa", ep: 1, totalEp: 1, img: liveList[0].img, slug: liveList[0].slug, type: "phim", tags: ["Romance", "Drama"] },
    { id: "cn-2", time: "16:00", title: "Ngọn Lửa Kitsune", ep: 11, totalEp: 13, img: animeList[6].img, slug: animeList[6].slug, type: "anime", tags: ["Fantasy"], isNew: true },
    { id: "cn-3", time: "19:30", title: "Vết Mực Trên Giấy", ep: 1, totalEp: 1, img: liveList[5].img, slug: liveList[5].slug, type: "phim", tags: ["Drama"] },
    { id: "cn-4", time: "22:00", title: "Kẻ Săn Quái Đêm", ep: 10, totalEp: 12, img: animeList[0].img, slug: animeList[0].slug, type: "anime", tags: ["Action"] },
    { id: "cn-5", time: "23:30", title: "Tokyo 2099", ep: 8, totalEp: 8, img: animeList[2].img, slug: animeList[2].slug, type: "anime", studio: "Neon Cell", tags: ["Sci-Fi"] },
  ],
};

export const weekSchedule: DaySchedule[] = days.map((d) => ({
  dayKey: d.shortLabel,
  label: d.label,
  shortLabel: d.shortLabel,
  date: getDate(d.offset),
  isToday: d.offset === 0,
  items: rawSchedule[d.shortLabel] ?? [],
}));

export const todaySchedule = weekSchedule.find((d) => d.isToday)!;
