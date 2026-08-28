export type TerrainType = "sea" | "plains" | "forest" | "mountain" | "city" | "desert" | "snow" | "magic";
export type WorldMode = "map" | "characters" | "capture";

export interface HexCell {
  col: number;
  row: number;
  terrain: TerrainType;
  name?: string;
}

export interface WorldCharacter {
  id: string;
  name: string;
  role: string;
  traits: string[];
  backstory: string;
  hexCol: number;
  hexRow: number;
  color: string;
  faction?: string;
}

export interface CaptureFrame {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const COLS = 14;
export const ROWS = 9;
export const HEX_R = 30;

export const TERRAIN: Record<TerrainType, { label: string; fill: string; stroke: string; dark: string; emoji: string }> = {
  sea:      { label: "Biển",        fill: "#0ea5e9", stroke: "#0284c7", dark: "#075985", emoji: "🌊" },
  plains:   { label: "Đồng bằng",  fill: "#86efac", stroke: "#4ade80", dark: "#166534", emoji: "🌾" },
  forest:   { label: "Rừng",        fill: "#15803d", stroke: "#14532d", dark: "#052e16", emoji: "🌲" },
  mountain: { label: "Núi",         fill: "#a8a29e", stroke: "#78716c", dark: "#44403c", emoji: "⛰️" },
  city:     { label: "Thành phố",  fill: "#fb923c", stroke: "#f97316", dark: "#9a3412", emoji: "🏙️" },
  desert:   { label: "Sa mạc",     fill: "#fde68a", stroke: "#fbbf24", dark: "#92400e", emoji: "🏜️" },
  snow:     { label: "Băng tuyết", fill: "#e0f2fe", stroke: "#7dd3fc", dark: "#075985", emoji: "❄️" },
  magic:    { label: "Phép thuật", fill: "#c084fc", stroke: "#a855f7", dark: "#581c87", emoji: "✨" },
};

export const TERRAIN_LIST: TerrainType[] = ["sea", "plains", "forest", "mountain", "city", "desert", "snow", "magic"];

export const DEFAULT_MAP: TerrainType[][] = [
  Array(14).fill("sea") as TerrainType[],
  ["sea","sea","sea","sea","sea","sea","sea","sea","snow","snow","sea","sea","sea","sea"],
  ["sea","forest","plains","mountain","plains","plains","sea","sea","mountain","snow","sea","magic","magic","sea"],
  ["sea","plains","plains","mountain","city","plains","forest","sea","sea","sea","sea","sea","sea","sea"],
  ["sea","plains","plains","plains","plains","plains","forest","forest","sea","sea","sea","desert","desert","sea"],
  ["sea","plains","mountain","plains","plains","plains","plains","sea","sea","sea","sea","sea","desert","sea"],
  ["sea","sea","plains","plains","plains","plains","sea","sea","sea","sea","sea","sea","sea","sea"],
  ["sea","sea","sea","plains","plains","sea","sea","sea","sea","sea","sea","sea","sea","sea"],
  Array(14).fill("sea") as TerrainType[],
];

export const REGION_NAMES: Record<string, string> = {
  "4-3": "Ardwyn", "3-2": "Thanh Đỉnh", "3-3": "Thanh Đỉnh",
  "1-2": "Rừng Cổ Thụ", "6-3": "Rừng Cổ Thụ", "6-4": "Rừng Cổ Thụ",
  "8-1": "Bắc Băng", "9-1": "Bắc Băng", "8-2": "Bắc Băng",
  "11-4": "Sa Mạc Phong Vân", "12-4": "Sa Mạc Phong Vân",
  "11-2": "Phép Thuật Cổ Đại", "12-2": "Phép Thuật Cổ Đại",
};

export const DEFAULT_CHARACTERS: WorldCharacter[] = [
  { id: "c1", name: "Kira", role: "Chiến binh", color: "#ef4444", hexCol: 3, hexRow: 4, faction: "Liên minh Ánh Sáng",
    traits: ["Dũng cảm", "Bướng bỉnh", "Trung thành"], backstory: "Xuất thân từ gia đình kiếm sĩ ở vùng đồng bằng. Mất gia đình trong cuộc tấn công của quân phản loạn, thề trả thù và bảo vệ người yếu đuối." },
  { id: "c2", name: "Thane", role: "Đại pháp sư", color: "#8b5cf6", hexCol: 5, hexRow: 5, faction: "Hội Pháp Thuật",
    traits: ["Thông minh", "Lạnh lùng", "Bí ẩn"], backstory: "Học trò của đại pháp sư huyền thoại. Sau khi thầy mất tích trong Vùng Phép Thuật Cổ Đại, Thane dành cả đời tìm kiếm sự thật." },
  { id: "c3", name: "Luna", role: "Thương nhân", color: "#f59e0b", hexCol: 4, hexRow: 3, faction: "Hội Buôn Bán",
    traits: ["Khôn ngoan", "Táo bạo", "Đa mưu"], backstory: "Ái nữ của gia tộc buôn bán giàu có nhất thành phố Ardwyn. Dùng mạng lưới thương nhân rộng lớn để thu thập tin tức bí mật." },
  { id: "c4", name: "Eira", role: "Trinh sát tuyết", color: "#60a5fa", hexCol: 9, hexRow: 1, faction: "Bộ Lạc Bắc",
    traits: ["Kiên cường", "Cô đơn", "Chính trực"], backstory: "Lớn lên trong bộ lạc Bắc Băng, Eira là người duy nhất sống sót sau trận tuyết lở. Giờ đây làm trinh sát giao liên giữa các vùng miền." },
];

export const AI_REGION_DESCRIPTIONS: Record<TerrainType, string[]> = {
  sea: ["Vùng biển rộng lớn với những luồng gió thương mại. Hải tặc và thuyền buôn cùng tranh giành quyền kiểm soát các tuyến đường biển huyết mạch.", "Đại dương sâu thẳm ẩn chứa bí mật của nền văn minh cổ đại chìm xuống đáy. Ngư dân kể về những sinh vật khổng lồ đã từng thấy."],
  plains: ["Đồng bằng phì nhiêu trải dài, nơi những vụ mùa bội thu nuôi sống cả vùng. Làng mạc bình yên xen kẽ với đồn điền của các lãnh chúa.", "Thảo nguyên gió thổi với bầy ngựa hoang chạy tự do. Đây là vùng đất tranh chấp giữa ba gia tộc quyền lực."],
  forest: ["Rừng già huyền bí, tán cây cao vút che khuất ánh mặt trời. Những sinh vật kỳ lạ ẩn náu và truyền thuyết kể về một ngôi đền cổ ở trung tâm.", "Khu rừng rậm rạp với thảo mộc quý hiếm. Thợ săn và dược sĩ cạnh tranh nhau tìm kiếm nguyên liệu bí dược."],
  mountain: ["Dãy núi hùng vĩ với đỉnh phủ tuyết quanh năm. Trong lòng núi có những mỏ khoáng sản quý giá mà nhiều thế lực tranh giành.", "Núi đá cheo leo với những con đường mòn nguy hiểm. Nơi ẩn dật của đạo sĩ tu luyện và những kẻ trốn tránh pháp luật."],
  city: ["Đô thị sầm uất với kiến trúc hàng thế kỷ. Trung tâm chính trị và thương mại của cả vùng, nơi quyền lực và tiền bạc tranh nhau thống trị.", "Thành phố cổ kính với mê cung những con hẻm tối. Bên dưới những đường phố chính là hệ thống cống ngầm — lãnh địa của các hội kín."],
  desert: ["Sa mạc khô cằn với bão cát hung dữ và ánh mặt trời thiêu đốt. Dưới lớp cát là tàn tích của nền văn minh cổ đại đã mất.", "Ốc đảo là nơi nghỉ chân quý giá trong hành trình băng sa mạc. Những đoàn lữ hành bí mật chở hàng hóa cấm vận qua vùng đất này."],
  snow: ["Vùng đất băng giá với gió lạnh cắt da cắt thịt. Bộ lạc gan dạ đã thích nghi hàng nghìn năm và giữ gìn những bí mật cổ xưa.", "Thảo nguyên băng giá với cực quang rực rỡ vào đêm. Ẩn trong những cơn bão tuyết là các sinh vật huyền thoại cổ đại."],
  magic: ["Vùng đất phép thuật bất ổn — quy tắc vật lý không còn áp dụng. Tháp pha lê lơ lửng trong không trung và cổng dẫn đến chiều không gian khác.", "Khu vực nhiễm năng lượng ma thuật cổ đại. Cây cối phát sáng, bầu trời tím kỳ lạ. Các pháp sư đến đây để nghiên cứu và... đôi khi không trở về."],
};

export const EXAMPLE_DESCS = [
  "Dãy núi hùng vĩ ở phía bắc, rừng già bí ẩn ở phía tây. Kinh thành cổ kính ở trung tâm, sa mạc cát vàng ở phía đông. Phía nam là biển cả mênh mông.",
  "Thế giới băng tuyết phủ kín phía bắc, dần chuyển sang đồng cỏ xanh ở miền trung. Vùng phép thuật huyền bí ở tây bắc, thành phố cảng ở đông nam.",
  "Một đại lục với núi lửa ở trung tâm, rừng nhiệt đới bao quanh. Phía đông là sa mạc khô cằn, phía tây là biển sâu thẳm.",
];

export const hexCenter = (col: number, row: number, r: number = HEX_R) => {
  const w = r * 2, h = r * Math.sqrt(3);
  return { cx: col * w * 0.75 + r, cy: row * h + (col % 2 === 1 ? h / 2 : 0) + h / 2 };
};

export const hexPolygon = (cx: number, cy: number, r: number = HEX_R) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");

export const svgWidth = () => COLS * HEX_R * 1.5 + HEX_R * 0.5;
export const svgHeight = () => ROWS * HEX_R * Math.sqrt(3) + HEX_R * Math.sqrt(3) / 2;

export function parseWorldDescription(desc: string): TerrainType[][] {
  const text = desc.toLowerCase();

  const map: TerrainType[][] = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => {
      const isEdge = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1;
      return isEdge ? "sea" : "plains";
    })
  );

  const RULES: { terrain: TerrainType; keywords: string[] }[] = [
    { terrain: "desert",   keywords: ["sa mạc", "hoang mạc", "cát vàng", "khô hạn", "nóng bỏng", "cát"] },
    { terrain: "forest",   keywords: ["rừng", "cánh rừng", "rừng già", "thâm rừng", "cây cối", "rừng sâu", "rừng nhiệt đới"] },
    { terrain: "mountain", keywords: ["núi", "dãy núi", "núi cao", "đỉnh núi", "cao nguyên", "núi lửa", "triền núi"] },
    { terrain: "city",     keywords: ["thành phố", "kinh thành", "đô thị", "thành trì", "kinh đô", "thị trấn", "thành phố cảng"] },
    { terrain: "snow",     keywords: ["băng tuyết", "tuyết", "băng giá", "lạnh giá", "cực bắc", "vùng băng", "phủ tuyết"] },
    { terrain: "magic",    keywords: ["phép thuật", "ma thuật", "huyền bí", "kỳ lạ", "ma pháp", "huyền ảo", "phù phép"] },
    { terrain: "sea",      keywords: ["biển", "đại dương", "biển cả", "hải cảng", "vùng biển", "sông lớn", "biển sâu"] },
    { terrain: "plains",   keywords: ["đồng bằng", "thảo nguyên", "đồng cỏ", "bình nguyên", "cánh đồng", "đồng cỏ xanh"] },
  ];

  const DIRS: { keywords: string[]; fn: (c: number, r: number) => boolean }[] = [
    { keywords: ["đông bắc", "phía đông bắc", "tây bắc", "phía tây bắc"], fn: (c, r) =>
        text.includes("tây bắc") ? c <= 4 && r <= 3 : c >= 9 && r <= 3 },
    { keywords: ["đông nam", "phía đông nam", "tây nam", "phía tây nam"], fn: (c, r) =>
        text.includes("tây nam") ? c <= 4 && r >= 5 : c >= 9 && r >= 5 },
    { keywords: ["phía đông", "vùng đông", "miền đông", "bên đông", "đông phần"], fn: (c, r) => c >= 9 },
    { keywords: ["phía tây", "vùng tây", "miền tây", "bên tây", "tây phần"], fn: (c, r) => c <= 4 },
    { keywords: ["phía bắc", "vùng bắc", "miền bắc", "phương bắc", "cực bắc"], fn: (c, r) => r <= 3 },
    { keywords: ["phía nam", "vùng nam", "miền nam", "phương nam", "nam phần"], fn: (c, r) => r >= 5 },
    { keywords: ["trung tâm", "vùng trung", "vùng giữa", "giữa", "trung nguyên"], fn: (c, r) => c >= 4 && c <= 9 && r >= 2 && r <= 6 },
  ];

  const painted = new Set<string>();

  RULES.forEach(({ terrain, keywords }) => {
    const positions = keywords.map(k => text.indexOf(k)).filter(i => i >= 0);
    if (positions.length === 0) return;
    const firstIdx = Math.min(...positions);
    const context = text.substring(Math.max(0, firstIdx - 100), Math.min(text.length, firstIdx + 100));

    let regionFn: (c: number, r: number) => boolean = (c, r) => c > 0 && c < COLS - 1 && r > 0 && r < ROWS - 1;

    for (const dir of DIRS) {
      if (dir.keywords.some(d => context.includes(d))) {
        regionFn = dir.fn;
        break;
      }
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const key = `${c}-${r}`;
        if (regionFn(c, r) && !painted.has(key) && Math.random() < 0.68) {
          map[r][c] = terrain;
          painted.add(key);
        }
      }
    }
  });

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) map[r][c] = "sea";
    }
  }
  return map;
}
