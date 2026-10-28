// ─── Types ─────────────────────────────────────────────────────────────────────

export type StudioMode   = "projects" | "draw" | "storyboard" | "publish";
export type SceneType    = "auto" | "action" | "dialogue" | "landscape" | "closeup" | "wide";
export type RightTab     = "ai" | "layout" | "layers";
export type DrawTool     = "pen" | "brush" | "eraser" | "fill" | "select" | "shape" | "text" | "pan" | "eyedropper"
  // Bộ công cụ mở rộng (Phase 3 slice D — BRD T-1 #10–#16)
  | "line" | "gradient" | "airbrush" | "symmetry" | "curve" | "effect";
export type GuideId      = "thirds" | "horizon" | "proportions" | "vanishing";
export type PoseCategory = "stand" | "sit" | "action" | "emotion";
export type DrawingPlaceholderId = "clean-lines" | "screentone" | "speech-bubble" | "speed-lines";

export interface PanelDef { id: string; x: number; y: number; w: number; h: number }
export interface LayoutDef { id: string; label: string; panels: PanelDef[] }

export interface CompSuggestion { id: string; name: string; desc: string; guides: GuideId[] }
export interface PoseItem { id: string; label: string; category: PoseCategory }

/** Loại layer: do người dùng vẽ hay do AI tạo (BR-L01) */
export type LayerKind = "user" | "ai";
/** Chế độ trộn layer — map thẳng với CanvasRenderingContext2D.globalCompositeOperation */
export type LayerBlend =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten";

/**
 * Layer v2 (Spec 02 §2.1).
 * Mọi nơi khởi tạo layer phải dùng `createUserLayer` để không bỏ sót `kind`,
 * `blend`, `createdAt`. `kind: "ai"` chỉ còn để đọc ngăn xếp đã lưu cũ.
 */
export interface LayerItem {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  locked: boolean;
  /** 0..100, mặc định 100 */
  opacity: number;
  /** mặc định "normal" */
  blend: LayerBlend;
  createdAt: number;
  /** true nếu layer do AI tạo — chỉ đọc, không đổi tên, không ghi pixel */
  readOnly?: boolean;
}

/** Dạng layer trước v2 — chỉ dùng để đọc dữ liệu đã lưu cũ (Schema v1). */
export interface LegacyLayerItem {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity?: number;
}

let userLayerSeq = 0;

/** Tạo layer người dùng với mọi trường v2 được điền đủ. */
export function createUserLayer(
  name: string,
  overrides: Partial<LayerItem> = {},
): LayerItem {
  userLayerSeq += 1;
  return {
    id: overrides.id ?? `l${Date.now().toString(36)}-${userLayerSeq}`,
    name,
    visible: true,
    locked: false,
    opacity: 100,
    blend: "normal",
    createdAt: Date.now(),
    ...overrides,
    // Factory người dùng: không cho override sang kind AI.
    kind: "user",
  };
}

/**
 * Tạo layer AI (vector/ảo): luôn `readOnly`, mặc định ẩn chip ghi pixel.
 *
 * CHỈ DÙNG ĐỂ ĐỌC DỮ LIỆU CŨ: từ khi gỡ nét mờ AI (28/10/2026), không còn
 * đường code nào tạo layer AI mới. Hàm này còn lại để `normalizeLayer` đọc
 * được ngăn xếp đã lưu trước đó; layer AI cũ được lọc bỏ khi chuẩn hóa
 * ngăn xếp v2 (xem `normalizePanelStacks`).
 */
export function createAiLayer(
  name = "AI (Gợi ý)",
  overrides: Partial<LayerItem> = {},
): LayerItem {
  return {
    id: overrides.id ?? `ai-${Date.now().toString(36)}`,
    name,
    visible: true,
    opacity: 100,
    blend: "normal",
    createdAt: Date.now(),
    ...overrides,
    // Bất biến: layer AI luôn là kind "ai", readOnly và bị khóa — không cho override.
    kind: "ai",
    readOnly: true,
    locked: true,
  };
}

/**
 * Chuẩn hoá 1 layer đọc từ IndexedDB/JSON về dạng v2.
 * Dữ liệu Schema v1 thiếu `kind`/`blend`/`createdAt` → tự suy ra.
 */
export function normalizeLayer(raw: unknown): LayerItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;
  if (r.kind === "ai") {
    return createAiLayer(r.name, {
      id: r.id,
      visible: r.visible !== false,
      opacity: typeof r.opacity === "number" ? r.opacity : 100,
      blend: (r.blend as LayerBlend) ?? "normal",
      createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
    });
  }
  return {
    id: r.id,
    name: r.name,
    kind: "user",
    visible: r.visible !== false,
    locked: r.locked === true,
    opacity: typeof r.opacity === "number" ? r.opacity : 100,
    blend: (r.blend as LayerBlend) ?? "normal",
    createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
    readOnly: r.readOnly === true ? true : undefined,
  };
}

/** Đọc mảng layer cũ (hoặc không hợp lệ) về mảng v2 đã chuẩn hoá. */
export function normalizeLayers(raw: unknown): LayerItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeLayer)
    .filter((l): l is LayerItem => l !== null);
}

/**
 * Ngăn xếp layer của **MỘT khung** (spec 02 §2.2) — mỗi panel có bộ layer riêng.
 * Chỉ layer người dùng được tạo mới; `kind: "ai"` trong dữ liệu cũ được lọc
 * bỏ khi chuẩn hóa (xem `normalizePanelStacks`).
 */
export interface PanelLayerStack {
  panelId: string;
  layers: LayerItem[];
  activeLayerId: string;
  /**
   * Bitmap đã nén của từng layer **người dùng**, key = layerId.
   * Layer `kind:"ai"` không có entry ở đây (layer ảo/vector — RC-5).
   */
  pixels: Record<string, string>; // dataURL (image/png)
}

/** Toàn bộ ngăn xếp của một trang: panelId → stack. */
export type PanelStacks = Record<string, PanelLayerStack>;

/** Bộ layer mặc định khi mở khung chưa từng vẽ (giống khởi tạo của studio). */
export function createDefaultPanelStack(panelId: string): PanelLayerStack {
  const layers = [
    createUserLayer("Sketch (Phác thảo)", { id: "l1" }),
    createUserLayer("Ink (Đi nét)", { id: "l2" }),
    createUserLayer("Tone (Đổ bóng)", { id: "l3" }),
    createUserLayer("Text (Thoại)", { id: "l4" }),
  ];
  return { panelId, layers, activeLayerId: layers[0].id, pixels: {} };
}

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
  auto: [
    { id: "aut-c1", name: "AI Tự Cân Bằng", desc: "Quy tắc 1/3 và điểm tụ tự nhiên", guides: ["thirds", "vanishing"] },
    { id: "aut-c2", name: "Tỷ Lệ Vàng",     desc: "Hài hòa giữa nhân vật và cảnh",   guides: ["proportions"] },
    { id: "aut-c3", name: "Đường Dẫn Mắt",  desc: "Hướng nhìn mượt mà qua các khung", guides: ["thirds"] },
    { id: "aut-c4", name: "Khung Trọng Tâm", desc: "Tập trung điểm nhấn thị giác",   guides: ["horizon"] },
  ],
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

export const SCENE_TYPE_LABEL: Record<SceneType, string> = {
  auto: "Tự động (AI)",
  action: "Hành động", dialogue: "Đối thoại",
  landscape: "Phong cảnh", closeup: "Cận cảnh", wide: "Tổng thể",
};

/**
 * Hướng dẫn dùng từng công cụ vẽ (tooltip ở thanh công cụ trái). `summary` là
 * một câu "công cụ này để làm gì", `hints` là các thao tác cụ thể theo thứ tự
 * người dùng hay cần.
 */
export const TOOL_HELP: Record<DrawTool, { summary: string; hints: string[] }> = {
  pen: {
    summary: "Nét bút mảnh, đều — dùng cho line art và viền khung.",
    hints: [
      "Kéo chuột để vẽ; cả nét là một bước hoàn tác duy nhất (Ctrl+Z xoá cả nét vừa vẽ).",
      "Độ to nét, độ mờ và độ cứng chỉnh ở thanh thuộc tính phía trên.",
    ],
  },
  brush: {
    summary: "Nét cọ mềm, đầu nét nhoè — dùng cho mảng tối, tóc, nền.",
    hints: [
      "Độ to nét là bề rộng thật của đầu cọ (mặc định 16px).",
      "Độ chảy (flow) thấp thì chồng nhiều nhát lên nhau nét mới đậm dần.",
      "Độ cứng (hardness) thấp cho viền nét mềm, tán màu.",
    ],
  },
  eraser: {
    summary: "Tẩy nét trên layer đang chọn.",
    hints: [
      "Chế độ Xóa sạch: xoá hẳn pixel. Chế độ Xóa mờ: chỉ nhạt dần theo độ mờ nét.",
      "Tẩy sạch nét ở lớp trên sẽ lộ nét của lớp dưới ra.",
    ],
  },
  fill: {
    summary: "Đổ màu loang một vùng cùng màu, giống xô sơn.",
    hints: [
      "Bấm vào vùng cần đổ; màu loang dừng ở chỗ đổi màu (viền nét).",
      "Đang có vùng chọn thì chỉ đổ bên trong vùng đó.",
    ],
  },
  eyedropper: {
    summary: "Lấy màu ở một điểm trên bức vẽ để dùng làm màu vẽ.",
    hints: [
      "Màu lấy từ ảnh đang hiển thị (đã trộn mọi layer trên nền giấy trắng).",
      "Chỉ đọc màu, không sửa gì nên không vào lịch sử hoàn tác.",
    ],
  },
  select: {
    summary: "Khoanh vùng để dời, xoay, sao chép hoặc xoá riêng phần đó.",
    hints: [
      "Kéo ra ngoài vùng: khoanh vùng mới (chữ nhật hoặc lasso tự do).",
      "Kéo bên trong vùng: dời nét trong vùng đó (nét vắt qua viền bị cắt ở viền).",
      "Ctrl+C rồi Ctrl+V: dán bản sao ra chỗ khác; bản dán đang “bay” nên kéo riêng được, Enter hoặc Esc để chốt.",
      "Delete: xoá nội dung trong vùng · Ctrl+Shift+I: đảo vùng chọn · Esc: bỏ chọn.",
      "Nút trên thanh thuộc tính: xoay ±15°, lật ngang/dọc, phóng to/thu nhỏ theo tỉ lệ.",
    ],
  },
  shape: {
    summary: "Vẽ hình chữ nhật, ellipse, đa giác, ngôi sao hoặc đường thẳng.",
    hints: [
      "Kéo chuột để vẽ; thấy trước hình khi đang kéo.",
      "Giữ Shift khi kéo: chữ nhật/ellipse thành vuông/tròn đều.",
      "Chọn loại hình ở bảng bên cạnh; đa giác và ngôi sao có thêm ô chọn số cạnh (3–12).",
      "Bật Đổ đặc nền nếu muốn tô kín; độ to nét = độ dày viền hình.",
    ],
  },
  text: {
    summary: "Chèn lời thoại hoặc chữ vào khung.",
    hints: [
      "Bấm vào vị trí muốn đặt chữ, gõ nội dung rồi Enter.",
      "Chữ được vẽ vào layer đang chọn nên xoá được bằng Ctrl+Z.",
    ],
  },
  pan: {
    summary: "Dịch khung nhìn để xem phần khác của khung tranh.",
    hints: [
      "Kéo chuột để dịch; giữ phím Space để tạm dùng công cụ này ở bất kỳ công cụ nào.",
      "Dùng chip ở góc phải trên để phóng to/thu nhỏ hoặc về khung vừa khít.",
    ],
  },
  line: {
    summary: "Vẽ đường thẳng hoặc mũi tên một nhát kéo.",
    hints: [
      "Kéo từ điểm đầu tới điểm cuối; nhả chuột là nét nằm xuống layer.",
      "Giữ Shift khi kéo: khoá hướng về bội số 45°.",
      "Chọn Đường thẳng hay Mũi tên ở bảng bên cạnh; đầu mũi tự to theo độ dày nét.",
      "Độ to nét = độ dày đường; muốn mũi tên dài dày hơn thì tăng độ to nét.",
    ],
  },
  gradient: {
    summary: "Tô chuyển sắc từ màu đang vẽ sang đầu màu kia.",
    hints: [
      "Kéo từ chỗ bắt đầu tới chỗ kết thúc: cú kéo chính là trục chuyển sắc.",
      "Đầu kia chọn ở thanh thuộc tính: Trong suốt (mặc định), Trắng hoặc Đen.",
      "Kiểu Ngang dọc trải màu theo đường kéo; Toả tròn loang từ điểm bắt đầu ra.",
      "Đang có vùng chọn thì dải màu chỉ trải bên trong vùng đó.",
    ],
  },
  airbrush: {
    summary: "Cọ phun hạt li ti, phun liên tục cả khi đứng yên.",
    hints: [
      "Giữ chuột là mực phun ra liên tục; càng giữ lâu chỗ đó càng đậm.",
      "Độ to nét = vùng phun; Độ chảy (flow) = số hạt mỗi nhịp và độ đậm.",
      "Một lần giữ chuột là một bước hoàn tác duy nhất (Ctrl+Z xoá cả mảng vừa phun).",
    ],
  },
  symmetry: {
    summary: "Cọ vẽ có trục đối xứng: nét hiện đồng thời ở các ô gương.",
    hints: [
      "Kéo như vẽ bình thường; nét được vẽ lặp ở mọi ô gương của trục đang bật.",
      "Chọn trục ở thanh thuộc tính: Trục dọc, Trục ngang, Dọc + ngang (4 ô) hay Hai đường chéo (4 ô).",
      "Trục hiện thành đường đứt nét trong khung; đường này không lọt vào ảnh xuất.",
      "Đối xứng cũng đặt được cho các công cụ nét khác ở thanh thuộc tính của chúng.",
    ],
  },
  curve: {
    summary: "Vẽ đường cong Bézier hai nút điều khiển.",
    hints: [
      "Kéo từ điểm đầu tới điểm cuối như vẽ đường thẳng.",
      "Trượt “Độ cong” ở thanh thuộc tính để uốn đường về hai phía (-100…+100).",
      "Giữ Shift khi kéo: khoá hướng dây cung về bội số 45°.",
    ],
  },
  effect: {
    summary: "Cọ hiệu ứng: làm mờ hoặc làm sắc nét vùng đi qua.",
    hints: [
      "Chọn chế độ Làm mờ hay Làm sắc nét ở thanh thuộc tính.",
      "Độ to nét = vùng tác động; Độ mạnh = mức mờ/nét mỗi nhát.",
      "Đưa đi đưa lại nhiều lần thì vùng đó mờ (hoặc nét) thêm dần.",
      "Chỉ tác động lên layer đang chọn, các layer khác giữ nguyên.",
    ],
  },
};

// Contextual drawing tips shown inside the in-panel suggestion widget
export const PANEL_DRAWING_TIPS: Record<SceneType, string> = {
  auto:
    "AI tự động phân tích khung tranh và đưa ra gợi ý bố cục mượt mà nhất theo ý tưởng của bạn.",
  action:
    "Nghiêng người về phía trước tạo lực. Đường chéo = chuyển động. Để trống vùng phía trước hướng di chuyển.",
  dialogue:
    "Mắt ở đường 1/3 trên khung. Người đang nói chiếm nhiều diện tích hơn. Nhân vật luôn nhìn vào nhau.",
  landscape:
    "Chân trời không bao giờ ở giữa — chọn 1/3 trên hoặc 1/3 dưới. Thêm nhân vật nhỏ để tạo quy mô.",
  closeup:
    "Vẽ mắt trước — quyết định 80% cảm xúc. Vị trí mắt thực ở giữa đầu, không phải giữa mặt.",
  wide:
    "Nhân vật phải rất nhỏ so với bối cảnh. Điểm tụ luôn nằm trên đường chân trời.",
};

export const PRINCIPLE_LABELS: Record<string, string> = {
  composition: "Bố cục",
  proportion: "Tỷ lệ",
  color: "Màu sắc",
  flow: "Đường dẫn mắt",
  perspective: "Phối cảnh",
  lighting: "Ánh sáng",
  shadow: "Bóng đổ",
};

export const KNOWLEDGE_SOURCE_TITLES: Record<string, string> = {
  "sachant-introduction-to-art-2016":
    "Introduction to Art (Sachant et al., CC BY-SA 4.0)",
  "composition-focal-hierarchy": "Điểm nhấn & thứ tự thị giác",
  "composition-balance-and-thirds": "Cân bằng khung & tỷ lệ 1/3",
  "visual-flow-reading-direction": "Đường dẫn mắt trong manga",
  "character-proportion-gesture": "Tỷ lệ nhân vật & đường động tác",
  "color-palette-relationship": "Phối màu & bảng màu",
  "value-light-shadow-planes": "Sáng tối & bóng đổ",
  "perspective-overlap-scale": "Phối cảnh & chiều sâu",
  "panel-storytelling-variation": "Nhịp kể chuyện giữa các panel",
};
