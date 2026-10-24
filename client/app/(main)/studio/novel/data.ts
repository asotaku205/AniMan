export interface FontOption {
  id: string;
  label: string;
  family: string;
}

export const FONTS: FontOption[] = [
  { id: "caveat", label: "Caveat (viết tay)", family: "Caveat, cursive" },
  { id: "shippori", label: "Shippori Mincho", family: "Shippori Mincho, serif" },
  { id: "georgia", label: "Georgia", family: "Georgia, serif" },
  { id: "playfair", label: "Playfair Display", family: "Playfair Display, serif" },
  { id: "noto", label: "Noto Serif", family: "Noto Serif, serif" },
];



export interface Note {
  id: number;
  text: string;
  top: number;
  expanded: boolean;
}

export const INITIAL_NOTES: Note[] = [
  { id: 1, text: "Nhân vật Aoi cần thêm một đoạn hồi tưởng về bố.", top: 8, expanded: true },
  { id: 2, text: "Cảnh mưa — đổi sang góc nhìn thứ nhất?", top: 38, expanded: false },
  { id: 3, text: "Kiểm tra mạch cảm xúc chương 1 → 2.", top: 64, expanded: false },
];

export type SideTabKey = "font" | "timer" | "stats";
