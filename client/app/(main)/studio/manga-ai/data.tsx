// ─── Types ─────────────────────────────────────────────────────────────────────

export type StudioMode   = "draw" | "storyboard" | "publish";
export type SceneType    = "action" | "dialogue" | "landscape" | "closeup" | "wide";
export type RightTab     = "ai" | "layout" | "layers";
export type DrawTool     = "pen" | "brush" | "eraser" | "fill" | "select" | "shape" | "text" | "pan";
export type GuideId      = "thirds" | "horizon" | "proportions" | "vanishing";
export type PoseCategory = "stand" | "sit" | "action" | "emotion";

export interface PanelDef { id: string; x: number; y: number; w: number; h: number }
export interface LayoutDef { id: string; label: string; panels: PanelDef[] }

export interface CompSuggestion { id: string; name: string; desc: string; guides: GuideId[] }
export interface PageCompletion { id: string; name: string; flow: string; hints: string[]; compIds: string[] }
export interface PoseItem { id: string; label: string; category: PoseCategory }

export interface LayerItem { id: string; name: string; visible: boolean; locked: boolean }

// ─── Layout Definitions ────────────────────────────────────────────────────────

export const LAYOUTS: LayoutDef[] = [
  {
    id: "classic-5", label: "Classic 5",
    panels: [
      { id: "p1", x: 0, y: 0,  w: 100, h: 38 },
      { id: "p2", x: 0, y: 40, w: 48,  h: 28 },
      { id: "p3", x: 50,y: 40, w: 50,  h: 28 },
      { id: "p4", x: 0, y: 70, w: 60,  h: 30 },
      { id: "p5", x: 62,y: 70, w: 38,  h: 30 },
    ],
  },
  {
    id: "action-4", label: "Action 4",
    panels: [
      { id: "p1", x: 0,  y: 0,  w: 60, h: 50 },
      { id: "p2", x: 62, y: 0,  w: 38, h: 50 },
      { id: "p3", x: 0,  y: 52, w: 38, h: 48 },
      { id: "p4", x: 40, y: 52, w: 60, h: 48 },
    ],
  },
  {
    id: "splash-3", label: "Splash 3",
    panels: [
      { id: "p1", x: 0,  y: 0,  w: 100, h: 60 },
      { id: "p2", x: 0,  y: 62, w: 48,  h: 38 },
      { id: "p3", x: 50, y: 62, w: 50,  h: 38 },
    ],
  },
  {
    id: "manga-6", label: "Manga 6",
    panels: [
      { id: "p1", x: 0,  y: 0,  w: 50, h: 33 },
      { id: "p2", x: 52, y: 0,  w: 48, h: 33 },
      { id: "p3", x: 0,  y: 35, w: 100,h: 30 },
      { id: "p4", x: 0,  y: 67, w: 32, h: 33 },
      { id: "p5", x: 34, y: 67, w: 32, h: 33 },
      { id: "p6", x: 68, y: 67, w: 32, h: 33 },
    ],
  },
];

// ─── Comp Suggestions ──────────────────────────────────────────────────────────

export const COMP_SUGGESTIONS: Record<SceneType, CompSuggestion[]> = {
  action: [
    { id: "act-c1", name: "Đường chéo",   desc: "Năng lượng chuyển động",    guides: ["thirds"] },
    { id: "act-c2", name: "Quy tắc 1/3",  desc: "Cân bằng bố cục",           guides: ["thirds","horizon"] },
    { id: "act-c3", name: "Điểm tụ",      desc: "Tạo chiều sâu không gian",  guides: ["vanishing"] },
    { id: "act-c4", name: "Khung trong khung", desc: "Tập trung chủ thể",    guides: ["proportions"] },
  ],
  dialogue: [
    { id: "dia-c1", name: "Đối xứng",     desc: "Hai nhân vật cân bằng",     guides: ["thirds"] },
    { id: "dia-c2", name: "Over shoulder", desc: "Góc nhìn chủ quan",        guides: ["horizon"] },
    { id: "dia-c3", name: "Cận cảnh mắt", desc: "Nhấn cảm xúc nội tâm",     guides: ["proportions"] },
    { id: "dia-c4", name: "Không gian âm", desc: "Khoảng lặng drama",        guides: ["thirds","vanishing"] },
  ],
  landscape: [
    { id: "lan-c1", name: "Đường chân trời", desc: "Bố cục thiên nhiên",     guides: ["horizon"] },
    { id: "lan-c2", name: "Tỷ lệ vàng",   desc: "Vẻ đẹp cổ điển",           guides: ["proportions"] },
    { id: "lan-c3", name: "Dẫn đường",    desc: "Con đường dẫn mắt",         guides: ["vanishing"] },
    { id: "lan-c4", name: "Phân lớp",     desc: "Tiền cảnh - hậu cảnh",     guides: ["thirds","horizon"] },
  ],
  closeup: [
    { id: "clo-c1", name: "Chính giữa",   desc: "Nhấn mạnh đối tượng",       guides: ["proportions"] },
    { id: "clo-c2", name: "Lệch 1/3",     desc: "Tạo căng thẳng tự nhiên",  guides: ["thirds"] },
    { id: "clo-c3", name: "Cắt táo bạo",  desc: "Phong cách manga hiện đại", guides: [] },
    { id: "clo-c4", name: "Micro chi tiết", desc: "Tập trung vào cảm xúc",   guides: ["proportions"] },
  ],
  wide: [
    { id: "wid-c1", name: "Không gian rộng", desc: "Cảm giác cô đơn",        guides: ["horizon","thirds"] },
    { id: "wid-c2", name: "Tương phản kích thước", desc: "Nhân vật vs thế giới", guides: ["proportions"] },
    { id: "wid-c3", name: "Điểm tụ đơn",  desc: "Chiều sâu tối đa",          guides: ["vanishing"] },
    { id: "wid-c4", name: "Panoramic",    desc: "Khung cảnh toàn diện",       guides: ["horizon"] },
  ],
};

// ─── Page Completions ──────────────────────────────────────────────────────────

export const PAGE_COMPLETIONS: Record<SceneType, PageCompletion[]> = {
  action: [
    { id: "a1", name: "Leo thang căng thẳng", flow: "Thiết lập → Leo thang → Đỉnh điểm → Hậu quả",
      hints: ["Cảnh thiết lập", "Nhân vật tiến lại", "Cú đánh cận cảnh", "Phản ứng sau đòn", "Hậu quả"],
      compIds: ["act-c2","act-c1","act-c3","act-c4","act-c1"] },
    { id: "a2", name: "Đa góc nhìn", flow: "Trên cao → Ngang → Dưới → Toàn",
      hints: ["Góc chim nhìn", "Góc mắt nhân", "Góc ếch ngước", "Toàn cảnh"],
      compIds: ["act-c3","act-c2","act-c1","act-c4"] },
    { id: "a3", name: "Phản chiếu nhân vật", flow: "A tấn → B phòng → Giao → Kết",
      hints: ["Nhân vật A tấn công", "Nhân vật B phòng", "Hai bên giao đấu", "Người thắng lộ"],
      compIds: ["act-c1","act-c2","act-c3","act-c4"] },
    { id: "a4", name: "Flash sequence", flow: "Chậm → Nhanh → Khoảnh khắc → Dư âm",
      hints: ["Slow motion", "Chuyển động nhanh", "Khoảnh khắc quyết định", "Dư âm cảm xúc"],
      compIds: ["act-c4","act-c1","act-c2","act-c3"] },
  ],
  dialogue: [
    { id: "d1", name: "Hội thoại chuẩn", flow: "Giới thiệu → A nói → B đáp → Phản ứng",
      hints: ["Hai nhân vật", "Nhân vật A", "Nhân vật B", "Phản ứng cuối"],
      compIds: ["dia-c1","dia-c2","dia-c2","dia-c3"] },
    { id: "d2", name: "Bước ngoặt bất ngờ", flow: "Bình thường → Gợi → Tiết lộ → Sốc",
      hints: ["Cảnh bình thường", "Gợi ý điều gì", "Tiết lộ bất ngờ", "Cảm xúc bùng"],
      compIds: ["dia-c4","dia-c1","dia-c3","dia-c3"] },
    { id: "d3", name: "Đối đầu căng thẳng", flow: "Xa → Gần → Đối mặt → Đỉnh",
      hints: ["Khoảng cách", "Tiến gần", "Khuôn mặt đối", "Ánh mắt sắc"],
      compIds: ["dia-c4","dia-c1","dia-c2","dia-c3"] },
    { id: "d4", name: "Nội tâm bộc phát", flow: "Bên ngoài → Nội → Ký ức → Quyết",
      hints: ["Vẻ bình thản", "Suy nghĩ nội tâm", "Ký ức hiện", "Quyết định"],
      compIds: ["dia-c1","dia-c3","dia-c4","dia-c2"] },
  ],
  landscape: [
    { id: "l1", name: "Từ xa đến gần", flow: "Toàn → Trung → Cận → Chi tiết",
      hints: ["Bối cảnh rộng", "Nhân vật trong khung", "Cận cảnh địa điểm", "Chi tiết đặc biệt"],
      compIds: ["lan-c1","lan-c4","lan-c2","lan-c2"] },
    { id: "l2", name: "Khám phá bối cảnh", flow: "Bí ẩn → Hé lộ → Khám phá → Phát hiện",
      hints: ["Bí ẩn mờ", "Hé lộ phần", "Khám phá", "Phát hiện"],
      compIds: ["lan-c3","lan-c1","lan-c4","lan-c2"] },
    { id: "l3", name: "Thay đổi thời gian", flow: "Bình minh → Trưa → Hoàng hôn → Đêm",
      hints: ["Bình minh nhẹ", "Nắng trưa gay", "Hoàng hôn đỏ", "Đêm tĩnh"],
      compIds: ["lan-c1","lan-c1","lan-c1","lan-c1"] },
    { id: "l4", name: "Theo dõi hành trình", flow: "Xuất phát → Đường → Chướng → Đích",
      hints: ["Điểm xuất phát", "Con đường dài", "Chướng ngại", "Đến đích"],
      compIds: ["lan-c3","lan-c4","lan-c2","lan-c1"] },
  ],
  closeup: [
    { id: "c1", name: "Bùng nổ cảm xúc", flow: "Kìm → Rạn → Bùng → Vỡ",
      hints: ["Kìm nén mặt", "Cảm xúc vỡ", "Biểu cảm mạnh", "Vỡ oà"],
      compIds: ["clo-c1","clo-c2","clo-c3","clo-c4"] },
    { id: "c2", name: "Tiết lộ dần", flow: "Che → Hé → Gần → Toàn",
      hints: ["Che khuôn mặt", "Hé lộ phần", "Gần hơn", "Tiết lộ hết"],
      compIds: ["clo-c4","clo-c2","clo-c1","clo-c3"] },
    { id: "c3", name: "Tương phản cảm xúc", flow: "Vui → Buồn → Giận → Bình",
      hints: ["Vui tươi", "Nỗi buồn", "Cơn giận", "Bình thản"],
      compIds: ["clo-c1","clo-c2","clo-c3","clo-c4"] },
    { id: "c4", name: "Micro-expressions", flow: "Trung → Mắt → Môi → Toàn",
      hints: ["Trung tính", "Mắt thay đổi", "Môi hé", "Khuôn mặt đủ"],
      compIds: ["clo-c1","clo-c4","clo-c2","clo-c3"] },
  ],
  wide: [
    { id: "w1", name: "Thiết lập thế giới", flow: "Vũ trụ → Khu vực → Địa điểm → Nhân",
      hints: ["Thế giới rộng", "Thu hẹp khu", "Địa điểm cụ thể", "Nhân lộ diện"],
      compIds: ["wid-c1","wid-c3","wid-c2","wid-c4"] },
    { id: "w2", name: "Sức mạnh không gian", flow: "Đơn độc → Tương phản → Áp → Vươn",
      hints: ["Nhỏ bé trong không", "Tương phản kích", "Thế lực áp đảo", "Vươn lên"],
      compIds: ["wid-c1","wid-c2","wid-c2","wid-c3"] },
    { id: "w3", name: "Trước và sau", flow: "Bình → Xáo → Tàn → Hy vọng",
      hints: ["Bình yên trước", "Xáo trộn bắt", "Sau tàn phá", "Tia hy vọng"],
      compIds: ["wid-c4","wid-c1","wid-c1","wid-c3"] },
    { id: "w4", name: "Theo dõi hành trình", flow: "A → Giữa → Gần → B",
      hints: ["Bắt đầu", "Giữa chặng", "Sắp đến đích", "Điểm đến"],
      compIds: ["wid-c3","wid-c4","wid-c2","wid-c1"] },
  ],
};

// ─── Poses ─────────────────────────────────────────────────────────────────────

export const POSES: Record<PoseCategory, PoseItem[]> = {
  stand: [
    { id: "stand-neutral", label: "Đứng thẳng",  category: "stand" },
    { id: "stand-cross",   label: "Khoanh tay",  category: "stand" },
    { id: "stand-hand",    label: "Chống hông",  category: "stand" },
  ],
  sit: [
    { id: "sit-chair",  label: "Ngồi ghế",   category: "sit" },
    { id: "sit-floor",  label: "Ngồi sàn",   category: "sit" },
    { id: "sit-kneel",  label: "Quỳ gối",    category: "sit" },
  ],
  action: [
    { id: "run",   label: "Chạy",       category: "action" },
    { id: "jump",  label: "Nhảy",       category: "action" },
    { id: "fight", label: "Chiến đấu",  category: "action" },
  ],
  emotion: [
    { id: "cry",   label: "Khóc",      category: "emotion" },
    { id: "point", label: "Chỉ tay",   category: "emotion" },
    { id: "reach", label: "Với tay",   category: "emotion" },
  ],
};
// ─── AI Tools Data ─────────────────────────────────────────────────────────────

export const AI_TOOLS = [
  { id: "clean-lines",   label: "Ink sạch nét",    desc: "Làm sạch nét vẽ tay",     dot: "bg-indigo-500" },
  { id: "screentone",    label: "Tô screentone",    desc: "Thêm lưới tone manga",     dot: "bg-sky-500"    },
  { id: "speech-bubble", label: "Tạo bubble thoại", desc: "Thêm hộp thoại tự động",  dot: "bg-pink-500"   },
  { id: "speed-lines",   label: "Thêm speed lines", desc: "Hiệu ứng chuyển động",    dot: "bg-emerald-500"},
  { id: "fix-comp",      label: "Sửa bố cục",       desc: "Tối ưu bố cục theo AI",   dot: "bg-amber-500"  },
];

export const SCENE_TYPE_LABEL: Record<SceneType, string> = {
  action: "Hành động", dialogue: "Đối thoại",
  landscape: "Phong cảnh", closeup: "Cận cảnh", wide: "Tổng thể",
};

// Contextual drawing tips shown inside the in-panel suggestion widget
export const PANEL_DRAWING_TIPS: Record<SceneType, string> = {
  action:    "Nghiêng người về phía trước tạo lực. Đường chéo = chuyển động. Để trống vùng phía trước hướng di chuyển.",
  dialogue:  "Mắt ở đường 1/3 trên khung. Người đang nói chiếm nhiều diện tích hơn. Nhân vật luôn nhìn vào nhau.",
  landscape: "Chân trời không bao giờ ở giữa — chọn 1/3 trên hoặc 1/3 dưới. Thêm nhân vật nhỏ để tạo quy mô.",
  closeup:   "Vẽ mắt trước — quyết định 80% cảm xúc. Vị trí mắt thực ở giữa đầu, không phải giữa mặt.",
  wide:      "Nhân vật phải rất nhỏ so với bối cảnh. Điểm tụ luôn nằm trên đường chân trời.",
};
