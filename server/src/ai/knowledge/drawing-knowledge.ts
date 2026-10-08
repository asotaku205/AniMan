import { AiDrawingTask } from "../contracts/ai-drawing-request.dto.js";

export const DRAWING_KNOWLEDGE_VERSION = "1" as const;

export type DrawingKnowledgeTopic =
  | "composition"
  | "visual_flow"
  | "proportion"
  | "color"
  | "value_and_lighting"
  | "perspective"
  | "panel_storytelling";

export interface DrawingKnowledgeSource {
  id: string;
  title: string;
  authors: string[];
  url: string;
  license: "CC-BY-SA-4.0";
  licenseUrl: string;
}

export interface DrawingKnowledgeCard {
  id: string;
  version: typeof DRAWING_KNOWLEDGE_VERSION;
  title: string;
  topic: DrawingKnowledgeTopic;
  tasks: AiDrawingTask[];
  keywords: string[];
  guidance: string;
  exercise: string;
  source: DrawingKnowledgeSource;
  attribution: string;
}

const source: DrawingKnowledgeSource = {
  id: "sachant-introduction-to-art-2016",
  title: "Introduction to Art: Design, Context, and Meaning",
  authors: ["Pamela Sachant", "Peggy Blood", "Jeffery LeMieux", "Rita Tekippe"],
  url: "https://oer.galileo.usg.edu/arts-textbooks/3/",
  license: "CC-BY-SA-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};

const attribution =
  "Principles summarized independently in Vietnamese with manga drawing exercises; source credited under CC BY-SA 4.0. No source passages or images are reproduced.";

export const DRAWING_KNOWLEDGE_CARDS: readonly DrawingKnowledgeCard[] = [
  {
    id: "composition-focal-hierarchy",
    version: DRAWING_KNOWLEDGE_VERSION,
    title: "Điểm nhấn và thứ tự thị giác",
    topic: "composition",
    tasks: [AiDrawingTask.CompositionGuidance, AiDrawingTask.DrawingReview],
    keywords: [
      "điểm nhấn",
      "trọng tâm",
      "phân cấp",
      "tương phản",
      "kích thước",
      "focal point",
      "hierarchy",
    ],
    guidance:
      "Chọn một chủ thể hoặc hành động chính trước. Làm nó nổi bật hơn vùng phụ bằng một hoặc hai khác biệt dễ nhận ra như diện tích, độ sáng tối, màu sắc hoặc độ chi tiết; tránh tăng mọi khác biệt cùng lúc.",
    exercise:
      "Thu nhỏ panel thành hình xám đơn giản và kiểm tra xem mắt có tìm đến chủ thể chính trước khi đọc được chi tiết hay không.",
    source,
    attribution,
  },
  {
    id: "composition-balance-and-thirds",
    version: DRAWING_KNOWLEDGE_VERSION,
    title: "Cân bằng khung và điểm đặt chủ thể",
    topic: "composition",
    tasks: [AiDrawingTask.CompositionGuidance, AiDrawingTask.DrawingReview],
    keywords: [
      "bố cục",
      "cân bằng",
      "quy tắc một phần ba",
      "1/3",
      "đối trọng",
      "negative space",
      "khoảng trống",
    ],
    guidance:
      "Đặt chủ thể lệch tâm có thể tạo chuyển động hoặc chừa chỗ cho hướng nhìn, nhưng cần cân lại bằng khối hình, khoảng trống hoặc nền ở phía đối diện. Lưới một phần ba là gợi ý để thử, không phải luật bắt buộc.",
    exercise:
      "Vẽ ba thumbnail nhỏ: chủ thể ở giữa, gần một giao điểm một phần ba, và lệch mạnh; so sánh phiên bản nào phục vụ cảm xúc của cảnh tốt nhất.",
    source,
    attribution,
  },
  {
    id: "visual-flow-reading-direction",
    version: DRAWING_KNOWLEDGE_VERSION,
    title: "Đường dẫn mắt trong panel và trang",
    topic: "visual_flow",
    tasks: [AiDrawingTask.CompositionGuidance, AiDrawingTask.DrawingReview],
    keywords: [
      "đường dẫn mắt",
      "hướng nhìn",
      "ánh mắt",
      "chuyển động",
      "đọc trang",
      "reading flow",
      "flow",
    ],
    guidance:
      "Sắp xếp hướng cơ thể, ánh mắt, đường chuyển động và mảng sáng tối để dẫn mắt đến hành động cần đọc tiếp. Kiểm tra thứ tự đọc theo hướng trang mà dự án đã chọn; không để đường dẫn mạnh vô tình kéo mắt ra khỏi panel.",
    exercise:
      "Che chữ và chi tiết, chỉ giữ silhouette và mũi tên hướng nhìn; nhờ người khác chỉ thứ tự họ nhìn thấy.",
    source,
    attribution,
  },
  {
    id: "character-proportion-gesture",
    version: DRAWING_KNOWLEDGE_VERSION,
    title: "Tỷ lệ nhân vật và đường động tác",
    topic: "proportion",
    tasks: [AiDrawingTask.CompositionGuidance, AiDrawingTask.DrawingReview],
    keywords: [
      "tỷ lệ",
      "nhân vật",
      "đầu",
      "vai",
      "khớp",
      "gesture",
      "anatomy",
      "dáng",
    ],
    guidance:
      "Đối chiếu các khối lớn trước chi tiết: đầu, lồng ngực, chậu và chiều dài chi. Tỷ lệ phụ thuộc phong cách; ưu tiên tính nhất quán giữa các panel và độ rõ của tư thế hơn một tỷ lệ giải phẫu cố định.",
    exercise:
      "Vẽ đường động tác cùng các khối đầu-ngực-chậu trên lớp nháp, rồi kiểm tra trục vai/hông và điểm tựa trước khi thêm trang phục.",
    source,
    attribution,
  },
  {
    id: "color-palette-relationship",
    version: DRAWING_KNOWLEDGE_VERSION,
    title: "Quan hệ màu và giới hạn bảng màu",
    topic: "color",
    tasks: [AiDrawingTask.CompositionGuidance, AiDrawingTask.DrawingReview],
    keywords: [
      "màu sắc",
      "phối màu",
      "nóng",
      "lạnh",
      "bảng màu",
      "saturation",
      "hue",
      "color",
    ],
    guidance:
      "Chọn một quan hệ màu có chủ đích cho cảnh, sau đó giới hạn số màu nổi bật. Tách màu chủ đạo, màu hỗ trợ và màu nhấn; kiểm tra màu trong cùng điều kiện ánh sáng thay vì chọn từng màu riêng rẽ.",
    exercise:
      "Tạo ba ô màu nhỏ cho cảnh: bảng màu dịu, tương phản bổ sung và bảng màu gần nhau; chọn bảng giúp cảm xúc cảnh rõ nhất.",
    source,
    attribution,
  },
  {
    id: "value-light-shadow-planes",
    version: DRAWING_KNOWLEDGE_VERSION,
    title: "Sáng tối, mặt phẳng và bóng đổ",
    topic: "value_and_lighting",
    tasks: [AiDrawingTask.CompositionGuidance, AiDrawingTask.DrawingReview],
    keywords: [
      "sáng tối",
      "ánh sáng",
      "bóng đổ",
      "bóng",
      "khối",
      "value",
      "light",
      "shadow",
    ],
    guidance:
      "Xác định hướng nguồn sáng chính trước, rồi nhóm các mặt phẳng thành vùng sáng, trung gian và tối. Bóng đổ cần phù hợp với hướng sáng và mặt nhận bóng; giữ đủ tương phản để chủ thể đọc rõ mà không tô kín mọi vùng.",
    exercise:
      "Chuyển phác thảo thành ba mức xám và vẽ riêng hướng chiếu bóng bằng mũi tên; kiểm tra tính nhất quán giữa vật thể và bóng trên nền.",
    source,
    attribution,
  },
  {
    id: "perspective-overlap-scale",
    version: DRAWING_KNOWLEDGE_VERSION,
    title: "Chiều sâu bằng chồng lớp và phối cảnh",
    topic: "perspective",
    tasks: [AiDrawingTask.CompositionGuidance, AiDrawingTask.DrawingReview],
    keywords: [
      "phối cảnh",
      "điểm tụ",
      "đường chân trời",
      "chiều sâu",
      "chồng lớp",
      "overlap",
      "perspective",
      "foreshortening",
    ],
    guidance:
      "Tạo chiều sâu bằng chồng lấp trước-sau, thay đổi kích thước theo khoảng cách và thống nhất đường chân trời/điểm tụ khi cảnh cần phối cảnh tuyến tính. Rút ngắn phối cảnh mạnh nên được kiểm tra bằng silhouette để tư thế vẫn dễ đọc.",
    exercise:
      "Dùng ba khối đơn giản, xác định đường chân trời và thử hai điểm tụ; sau đó thay khối bằng nhân vật mà vẫn giữ trục chính.",
    source,
    attribution,
  },
  {
    id: "panel-storytelling-variation",
    version: DRAWING_KNOWLEDGE_VERSION,
    title: "Nhịp kể chuyện giữa các panel",
    topic: "panel_storytelling",
    tasks: [AiDrawingTask.CompositionGuidance, AiDrawingTask.DrawingReview],
    keywords: [
      "panel",
      "khung truyện",
      "nhịp",
      "cỡ cảnh",
      "toàn cảnh",
      "cận cảnh",
      "storytelling",
      "manga",
    ],
    guidance:
      "Mỗi panel nên bổ sung một thông tin hoặc nhịp cảm xúc. Thay đổi cỡ cảnh khi cần chuyển từ bối cảnh sang hành động hoặc phản ứng; giữ liên tục vị trí, hướng di chuyển và trục nhìn để người đọc không mất phương hướng.",
    exercise:
      "Tóm tắt một khoảnh khắc thành ba thumbnail: thiết lập không gian, hành động chính, phản ứng; bỏ chi tiết không làm rõ nhịp kể.",
    source,
    attribution,
  },
];

const MAX_QUERY_LENGTH = 800;
const MAX_RETRIEVAL_RESULTS = 5;
const MINIMUM_MATCH_SCORE = 1;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("vi")
    .replace(/đ/g, "d");
}

function queryTerms(value: string): string[] {
  return normalizeText(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 1);
}

function scoreCard(
  card: DrawingKnowledgeCard,
  terms: ReadonlySet<string>,
): number {
  let score = 0;
  for (const keyword of card.keywords) {
    const keywordTerms = queryTerms(keyword);
    if (
      keywordTerms.length > 0 &&
      keywordTerms.every((term) => terms.has(term))
    ) {
      score += 3;
    }
  }
  return score;
}

export function retrieveDrawingKnowledge(
  query: string,
  task: AiDrawingTask,
  limit = 3,
): DrawingKnowledgeCard[] {
  if (query.trim().length === 0 || query.length > MAX_QUERY_LENGTH) {
    throw new RangeError(
      `query must contain 1 to ${MAX_QUERY_LENGTH} characters`,
    );
  }
  if (!Object.values(AiDrawingTask).includes(task)) {
    throw new RangeError("task is not supported");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RETRIEVAL_RESULTS) {
    throw new RangeError(
      `limit must be between 1 and ${MAX_RETRIEVAL_RESULTS}`,
    );
  }

  const terms = new Set(queryTerms(query));

  return DRAWING_KNOWLEDGE_CARDS.map((card) => ({
    card,
    score: card.tasks.includes(task) ? scoreCard(card, terms) : 0,
  }))
    .filter(({ score }) => score >= MINIMUM_MATCH_SCORE)
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.card.id.localeCompare(second.card.id),
    )
    .slice(0, limit)
    .map(({ card }) => card);
}
