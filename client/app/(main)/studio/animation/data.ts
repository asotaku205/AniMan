export interface RecentProject {
  name: string;
  thumb: string;
  duration: string;
  updated: string;
}

export const recentProjects: RecentProject[] = [
  { name: "Cơn mưa rào tháng năm", thumb: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=600", duration: "02:14", updated: "2 giờ trước" },
  { name: "Chuyến tàu cuối", thumb: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=600", duration: "04:38", updated: "Hôm qua" },
  { name: "Lời nhắn từ Aoi", thumb: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600", duration: "01:52", updated: "3 ngày trước" },
  { name: "Mùa hoa anh đào", thumb: "https://images.unsplash.com/photo-1554072675-66db59dba46f?w=600", duration: "03:07", updated: "Tuần trước" },
];

export const cameraMoves = ["Ken Burns", "Pan trái", "Pan phải", "Zoom vào", "Zoom ra", "Parallax", "Tĩnh"] as const;
export type CameraMove = typeof cameraMoves[number];

export const subtitleLines = [
  { t: "00:04", src: "雨がまた降ってきた…", vi: "Mưa lại rơi rồi...", conf: 99 },
  { t: "00:09", src: "君はあの日のように立っていた。", vi: "Em vẫn đứng đó như ngày ấy.", conf: 97 },
  { t: "00:14", src: "もう一度君に会えるなら…", vi: "Nếu có thể gặp lại em một lần nữa...", conf: 96 },
  { t: "00:20", src: "この傘の下で。", vi: "Dưới chiếc dù này.", conf: 98 },
  { t: "00:26", src: "時間が止まればいいのに。", vi: "Ước gì thời gian dừng lại.", conf: 94 },
];

export const tracks = [
  { name: "Video gốc", color: "from-slate-500 to-slate-400", type: "film", blocks: [{ x: 0, w: 95 }] },
  { name: "Phụ đề VI", color: "from-yellow-500 to-orange-400", type: "subtitles", blocks: [{ x: 6, w: 20 }, { x: 30, w: 22 }, { x: 56, w: 18 }] },
  { name: "Phụ đề EN", color: "from-sky-500 to-cyan-400", type: "subtitles", blocks: [{ x: 6, w: 20 }, { x: 30, w: 22 }, { x: 56, w: 18 }] },
  { name: "Phụ đề JP", color: "from-rose-500 to-pink-400", type: "subtitles", blocks: [{ x: 6, w: 20 }, { x: 30, w: 22 }, { x: 56, w: 18 }] },
  { name: "Lồng tiếng VI · Yume", color: "from-pink-400 to-orange-300", type: "mic", blocks: [{ x: 6, w: 20 }, { x: 30, w: 22 }] },
  { name: "Nhạc nền", color: "from-indigo-500 to-blue-500", type: "music", blocks: [{ x: 0, w: 90 }] },
  { name: "Hiệu ứng · Mưa", color: "from-emerald-500 to-teal-400", type: "layers", blocks: [{ x: 0, w: 80 }] },
];

export const languages = ["Tiếng Việt", "English", "日本語", "한국어", "中文", "Español", "Français", "Deutsch", "Português", "Italiano", "Русский", "العربية"];

export type ToolKey = "frame" | "motion" | "pose" | "voice" | "foley" | "dialogue" | "vibe";
