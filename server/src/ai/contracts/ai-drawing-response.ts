import { AiDrawingTask } from "./ai-drawing-request.dto.js";

export const AI_DRAWING_RESPONSE_SCHEMA_VERSION = "1" as const;
export const MAX_AI_RESPONSE_SUMMARY_LENGTH = 600;
export const MAX_AI_RECOMMENDATIONS = 6;
export const MAX_AI_FINDINGS = 8;
export const MAX_AI_OVERLAY_PRIMITIVES = 12;
export const AI_OVERLAY_OPACITY_MIN = 0.05;
export const AI_OVERLAY_OPACITY_MAX = 0.3;
export const MAX_AI_SOURCE_IDS = 8;
export const MAX_AI_EXPLANATION_LENGTH = 400;
/**
 * Trần độ dài tên model trong phản hồi (Phase 5E). Tên model thật do provider điền
 * (`gemini-flash-latest`, `gemini-2.5-flash`, …) nên 80 ký tự là thừa sức.
 */
export const MAX_AI_MODEL_LENGTH = 80;

export type AiDrawingPrinciple =
  | "composition"
  | "proportion"
  | "color"
  | "flow"
  | "perspective"
  | "lighting"
  | "shadow";

export type AiOverlayStyle = AiDrawingPrinciple;

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface NormalizedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AiOverlayLine {
  kind: "line";
  from: NormalizedPoint;
  to: NormalizedPoint;
  style: AiOverlayStyle;
  opacity: number;
}

export interface AiOverlayEllipse {
  kind: "ellipse";
  region: NormalizedRegion;
  style: AiOverlayStyle;
  opacity: number;
}

export interface AiOverlayRectangle {
  kind: "rectangle";
  region: NormalizedRegion;
  style: AiOverlayStyle;
  opacity: number;
}

export type AiOverlayPrimitive =
  AiOverlayLine | AiOverlayEllipse | AiOverlayRectangle;

export interface AiDrawingResponseBase {
  schemaVersion: typeof AI_DRAWING_RESPONSE_SCHEMA_VERSION;
  task: AiDrawingTask;
  summary: string;
  sourceIds: string[];
  /**
   * Tên model **thật đã phục vụ** lần gọi (Phase 5E), do provider điền sau khi gọi thành
   * công — kể cả khi đã rơi sang model dự phòng. Tùy chọn: bản ghi cũ và test dựng tay
   * có thể thiếu, khi đó client hiện hằng `AI_DRAWING_MODEL_LABEL` của nó.
   */
  model?: string;
}

export interface AiCompositionRecommendation {
  principle: AiDrawingPrinciple;
  explanation: string;
  overlay: AiOverlayPrimitive[];
}

export interface AiCompositionGuidanceResponse extends AiDrawingResponseBase {
  task: AiDrawingTask.CompositionGuidance;
  recommendations: AiCompositionRecommendation[];
}

export interface AiDrawingFinding {
  principle: AiDrawingPrinciple;
  region: NormalizedRegion;
  issue: string;
  recommendation: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  /**
   * Đánh dấu finding là **vùng nét thừa có thể tẩy** (Slice 3 — dọn nét thừa,
   * 22/10/2026). Có mặt = `region` khoanh sát nét thừa; `overlapRisk` = true
   * khi vùng còn chứa nét quan trọng dễ bị tẩy nhầm (client phải cảnh báo và
   * chừa đường tự tẩy tay). Thiếu = finding góp ý thường, không tẩy được.
   * AI chỉ đề xuất — người dùng bấm mới tẩy, luôn hoàn tác được.
   */
  cleanup?: { overlapRisk: boolean };
  /**
   * Phép chỉnh bố cục đề xuất cho nội dung trong `region` (Slice 4 — chỉnh
   * bố cục, 22/10/2026): dời theo `dx`/`dy` (normalized theo khung, dương =
   * sang phải/xuống) và phóng tỉ lệ `scale` quanh tâm vùng (1 = giữ nguyên).
   * Client áp bằng máy vùng chọn sẵn có = đúng một bước hoàn tác; AI không
   * tự di chuyển nét của người dùng.
   */
  fix?: { dx: number; dy: number; scale: number };
}

export interface AiDrawingReviewResponse extends AiDrawingResponseBase {
  task: AiDrawingTask.DrawingReview;
  findings: AiDrawingFinding[];
}

// ─── Ghost stroke response (StrokeGuidance / CompositionOverlay / PoseGuidance) ──

export const MAX_AI_GHOST_STROKES = 60;
export const MAX_AI_STROKE_POINTS = 120;
export const AI_STROKE_OPACITY_MIN = 0.15;
export const AI_STROKE_OPACITY_MAX = 0.9;
export const AI_STROKE_WIDTH_MIN = 0.0015;
export const AI_STROKE_WIDTH_MAX = 0.025;
export const MAX_AI_STROKE_LABEL_LENGTH = 60;

/**
 * Nhóm nội dung của một nét AI (Phase 5A). Thứ tự trong mảng **cũng là thứ tự vẽ**
 * (nền trước, hiệu ứng sau) nên client vẽ theo đúng thứ tự này để nét chủ thể
 * không bị nét nền đè.
 */
export const AI_STROKE_GROUPS = [
  "background",
  "midground",
  "subject",
  "detail",
  "effects",
  "guide",
] as const;

export type AiStrokeGroup = (typeof AI_STROKE_GROUPS)[number];

/** Trường chung của mọi nét; cộng thêm trường riêng theo `kind`. */
export const AI_STROKE_BASE_KEYS = [
  "kind",
  "style",
  "group",
  "label",
  "opacity",
  "strokeWidth",
  "dashed",
  "closed",
  "fill",
] as const;

const STROKE_FILL_NONE = "none";
const STROKE_FILL_PATTERN = /^#[0-9a-f]{6}$/;

// ─── Scene blueprint (Phase 5B) ───────────────────────────────────────────────
/** Blueprint phải có tối thiểu 5 lớp nội dung (BR-A2.1/AC-A2.1). */
export const MIN_AI_BLUEPRINT_LAYERS = 5;
/** Mỗi nhóm nội dung chỉ được một lớp ⇒ trần bằng số nhóm. */
export const MAX_AI_BLUEPRINT_LAYERS = AI_STROKE_GROUPS.length;
/** Mỗi lớp phải có tối thiểu 3 nét để đọc ra hình. */
export const MIN_AI_BLUEPRINT_LAYER_STROKES = 3;
/**
 * Trần nét một lớp = trần nét chung chia cho số lớp tối thiểu, để blueprint
 * đông nét nhất vẫn còn đủ 5 lớp trong ngân sách `MAX_AI_GHOST_STROKES`.
 */
export const MAX_AI_BLUEPRINT_LAYER_STROKES = Math.floor(
  MAX_AI_GHOST_STROKES / MIN_AI_BLUEPRINT_LAYERS,
);
export const MAX_AI_BLUEPRINT_TITLE_LENGTH = 80;
export const MAX_AI_BLUEPRINT_DESCRIPTION_LENGTH = 180;
export const MAX_AI_BLUEPRINT_CAMERA_LENGTH = 120;

/**
 * Một nét vẽ gợi ý do AI sinh ra — được render dưới dạng SVG mờ,
 * không ghi vào canvas của người dùng.
 */
export interface AiStrokePath {
  /** Loại primitive SVG */
  kind: "path" | "line" | "ellipse" | "rectangle";
  /** Với "path": mảng điểm normalized (cubic bezier / polyline) */
  points?: NormalizedPoint[];
  /** Với "line": điểm đầu */
  from?: NormalizedPoint;
  /** Với "line": điểm cuối */
  to?: NormalizedPoint;
  /** Với "ellipse"/"rectangle": vùng bao */
  region?: NormalizedRegion;
  /** Nguyên lý mỹ thuật liên quan */
  style: AiDrawingPrinciple;
  /** Nhóm nội dung — quyết định thứ tự vẽ (Phase 5A) */
  group: AiStrokeGroup;
  /** Nhãn tiếng Việt ngắn hiện khi trỏ chuột; rỗng khi model không đặt tên */
  label: string;
  /** Độ trong suốt (0.15..0.9) */
  opacity: number;
  /** Chiều rộng nét (normalized, 0.0015..0.025) */
  strokeWidth: number;
  /** true nếu là guide phụ (đường đứt) */
  dashed?: boolean;
  /** Với "path": đã khép kín chưa — chỉ path khép kín mới được `fill` */
  closed?: boolean;
  /** Màu tô kín: "#rrggbb" hoặc "none" */
  fill?: string;
}

export interface AiGhostStrokeResponse extends AiDrawingResponseBase {
  task:
    | AiDrawingTask.StrokeGuidance
    | AiDrawingTask.CompositionOverlay
    | AiDrawingTask.PoseGuidance;
  strokes: AiStrokePath[];
}

// ─── Scene blueprint response (A-2, Phase 5B) ────────────────────────────────

/** Phần "bức tranh toàn cảnh bằng lời" — mô tả chứ không phải ảnh (C3). */
export interface AiSceneBlueprintSpec {
  /** Tiêu đề ngắn cho toàn cảnh */
  title: string;
  /** Mô tả bố cục: chủ thể ở đâu, đường dẫn mắt, khoảng trống */
  composition: string;
  /** Mô tả ánh sáng: nguồn, hướng, độ tương phản */
  lighting: string;
  /** Góc máy và tiêu cự gợi ý */
  camera: string;
}

/**
 * Một lớp nội dung của blueprint. `group` trùng với nhóm của nét AI nên thứ tự
 * lớp cũng là thứ tự vẽ (nền trước, hiệu ứng sau).
 */
export interface AiBlueprintLayer {
  group: AiStrokeGroup;
  /** Tên lớp hiển thị, ví dụ "Bối cảnh — thành phố về đêm" */
  name: string;
  /** Mô tả nội dung lớp bằng tiếng Việt */
  description: string;
  strokes: AiStrokePath[];
}

export interface AiSceneBlueprintResponse extends AiDrawingResponseBase {
  task: AiDrawingTask.SceneBlueprint;
  blueprint: AiSceneBlueprintSpec;
  /** 5-6 lớp, mỗi nhóm chỉ một lần */
  layers: AiBlueprintLayer[];
  /** Trải phẳng đúng bằng `layers[].strokes` (để renderer cũ dùng được) */
  strokes: AiStrokePath[];
}

// ─── Page story flow response (D-1) ─────────────────────────────────────────

export const MAX_AI_STORY_FLOW_PANELS = 12;
export const MAX_AI_FLOW_LENGTH = 200;
export const MAX_AI_PANEL_HINT_LENGTH = 160;
export const MAX_AI_PANEL_ORDER = 99;

/** Bốn cỡ cảnh hợp lệ cho gợi ý từng khung. */
export const AI_PANEL_CAMERAS = [
  "toàn cảnh",
  "trung cảnh",
  "cận cảnh",
  "chuyển động",
] as const;

export type AiPanelCamera = (typeof AI_PANEL_CAMERAS)[number];

export interface AiPageStoryFlowPanelHint {
  /** "p1".."pN" — phải khớp id khung của layout (client đối chiếu lần cuối). */
  panelId: string;
  order: number;
  hint: string;
  camera: AiPanelCamera;
}

export interface AiPageStoryFlowResponse extends AiDrawingResponseBase {
  task: AiDrawingTask.PageStoryFlow;
  /** Chuỗi mạch truyện "A → B → C" cho cả trang. */
  flow: string;
  /** Gợi ý cho từng khung theo đúng thứ tự đọc. */
  panels: AiPageStoryFlowPanelHint[];
}

export type AiDrawingResponse =
  | AiCompositionGuidanceResponse
  | AiDrawingReviewResponse
  | AiGhostStrokeResponse
  | AiPageStoryFlowResponse
  | AiSceneBlueprintResponse;

export class AiDrawingResponseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiDrawingResponseValidationError";
  }
}

const PRINCIPLES = new Set<AiDrawingPrinciple>([
  "composition",
  "proportion",
  "color",
  "flow",
  "perspective",
  "lighting",
  "shadow",
]);

const RESPONSE_KEYS = new Set([
  "schemaVersion",
  "task",
  "summary",
  "sourceIds",
  "model",
  "recommendations",
  "findings",
  "strokes",
  "flow",
  "panels",
  "blueprint",
  "layers",
]);

const BASE_RESPONSE_KEYS = [
  "schemaVersion",
  "task",
  "summary",
  "sourceIds",
] as const;

/**
 * Trường tùy chọn dùng chung cho mọi task: có thì phải đúng kiểu, thiếu thì bỏ qua.
 * `requireTaskKeys` tự thêm chúng vào danh sách khoá bắt buộc khi chúng có mặt.
 */
const OPTIONAL_RESPONSE_KEYS = ["model"] as const;

/**
 * Như `requireExactKeys` nhưng cho phép thiếu trường tùy chọn. Nhờ vậy hợp đồng vẫn
 * **chặt** (thừa trường lạ là lỗi) mà bản ghi cũ không mang `model` vẫn đọc được.
 */
function requireTaskKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
): void {
  const present = OPTIONAL_RESPONSE_KEYS.filter((key) => key in value);
  requireExactKeys(value, [...keys, ...present], path);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function requireExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
): void {
  if (
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !(key in value))
  ) {
    throw new AiDrawingResponseValidationError(
      `${path} must contain exactly: ${keys.join(", ")}`,
    );
  }
}

function requireString(
  value: unknown,
  path: string,
  maximumLength: number,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maximumLength
  ) {
    throw new AiDrawingResponseValidationError(
      `${path} must be a non-empty string of at most ${maximumLength} characters`,
    );
  }
}

function requirePrinciple(
  value: unknown,
  path: string,
): asserts value is AiDrawingPrinciple {
  if (
    typeof value !== "string" ||
    !PRINCIPLES.has(value as AiDrawingPrinciple)
  ) {
    throw new AiDrawingResponseValidationError(`${path} is not supported`);
  }
}

function requireUnitCoordinate(value: unknown, path: string): void {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new AiDrawingResponseValidationError(
      `${path} must be a finite number between 0 and 1`,
    );
  }
}

function validateRegion(value: unknown, path: string): void {
  if (!isRecord(value)) {
    throw new AiDrawingResponseValidationError(`${path} must be an object`);
  }
  requireExactKeys(value, ["x", "y", "width", "height"], path);

  for (const key of ["x", "y", "width", "height"] as const) {
    requireUnitCoordinate(value[key], `${path}.${key}`);
  }

  const { x, y, width, height } = value;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number" ||
    width <= 0 ||
    height <= 0 ||
    x + width > 1 ||
    y + height > 1
  ) {
    throw new AiDrawingResponseValidationError(
      `${path} must have positive dimensions and remain inside the canvas`,
    );
  }
}

function validateOverlay(value: unknown, path: string): void {
  if (!isRecord(value)) {
    throw new AiDrawingResponseValidationError(`${path} must be an object`);
  }

  if (value.kind === "line") {
    requireExactKeys(value, ["kind", "from", "to", "style", "opacity"], path);
    for (const pointKey of ["from", "to"] as const) {
      const point = value[pointKey];
      if (!isRecord(point)) {
        throw new AiDrawingResponseValidationError(
          `${path}.${pointKey} must be an object`,
        );
      }
      requireExactKeys(point, ["x", "y"], `${path}.${pointKey}`);
      requireUnitCoordinate(point.x, `${path}.${pointKey}.x`);
      requireUnitCoordinate(point.y, `${path}.${pointKey}.y`);
    }
  } else if (value.kind === "ellipse" || value.kind === "rectangle") {
    requireExactKeys(value, ["kind", "region", "style", "opacity"], path);
    validateRegion(value.region, `${path}.region`);
  } else {
    throw new AiDrawingResponseValidationError(
      `${path}.kind is not a supported overlay primitive`,
    );
  }

  requirePrinciple(value.style, `${path}.style`);
  if (
    typeof value.opacity !== "number" ||
    !Number.isFinite(value.opacity) ||
    value.opacity < AI_OVERLAY_OPACITY_MIN ||
    value.opacity > AI_OVERLAY_OPACITY_MAX
  ) {
    throw new AiDrawingResponseValidationError(
      `${path}.opacity must be between ${AI_OVERLAY_OPACITY_MIN} and ${AI_OVERLAY_OPACITY_MAX}`,
    );
  }
}

function validateSourceIds(
  value: unknown,
  availableSourceIds: ReadonlySet<string>,
): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.length > MAX_AI_SOURCE_IDS ||
    value.some(
      (sourceId) =>
        typeof sourceId !== "string" ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(sourceId) ||
        !availableSourceIds.has(sourceId),
    )
  ) {
    throw new AiDrawingResponseValidationError(
      "sourceIds must only reference retrieved knowledge sources",
    );
  }
}

function validateCompositionRecommendation(
  value: unknown,
  index: number,
): asserts value is AiCompositionRecommendation {
  const path = `recommendations[${index}]`;
  if (!isRecord(value)) {
    throw new AiDrawingResponseValidationError(`${path} must be an object`);
  }
  requireExactKeys(value, ["principle", "explanation", "overlay"], path);
  requirePrinciple(value.principle, `${path}.principle`);
  requireString(
    value.explanation,
    `${path}.explanation`,
    MAX_AI_EXPLANATION_LENGTH,
  );
  if (
    !Array.isArray(value.overlay) ||
    value.overlay.length > MAX_AI_OVERLAY_PRIMITIVES
  ) {
    throw new AiDrawingResponseValidationError(
      `${path}.overlay must contain at most ${MAX_AI_OVERLAY_PRIMITIVES} primitives`,
    );
  }
  value.overlay.forEach((primitive, primitiveIndex) =>
    validateOverlay(primitive, `${path}.overlay[${primitiveIndex}]`),
  );
}

function validateRecommendations(
  value: unknown,
): asserts value is AiCompositionRecommendation[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_AI_RECOMMENDATIONS
  ) {
    throw new AiDrawingResponseValidationError(
      `recommendations must contain between 1 and ${MAX_AI_RECOMMENDATIONS} items`,
    );
  }
  value.forEach(validateCompositionRecommendation);
}

function validateFinding(
  value: unknown,
  index: number,
): asserts value is AiDrawingFinding {
  const path = `findings[${index}]`;
  if (!isRecord(value)) {
    throw new AiDrawingResponseValidationError(`${path} must be an object`);
  }
  requireExactKeys(
    value,
    [
      "principle",
      "region",
      "issue",
      "recommendation",
      "severity",
      "confidence",
      ...("cleanup" in value ? ["cleanup"] : []),
      ...("fix" in value ? ["fix"] : []),
    ],
    path,
  );
  if ("fix" in value) {
    const fix = value.fix;
    if (!isRecord(fix)) {
      throw new AiDrawingResponseValidationError(
        `${path}.fix must be an object`,
      );
    }
    requireExactKeys(fix, ["dx", "dy", "scale"], `${path}.fix`);
    for (const axis of ["dx", "dy"] as const) {
      const v = fix[axis];
      if (typeof v !== "number" || !Number.isFinite(v) || v < -1 || v > 1) {
        throw new AiDrawingResponseValidationError(
          `${path}.fix.${axis} must be between -1 and 1`,
        );
      }
    }
    if (
      typeof fix.scale !== "number" ||
      !Number.isFinite(fix.scale) ||
      fix.scale < 0.25 ||
      fix.scale > 4
    ) {
      throw new AiDrawingResponseValidationError(
        `${path}.fix.scale must be between 0.25 and 4`,
      );
    }
  }
  if ("cleanup" in value) {
    const cleanup = value.cleanup;
    if (!isRecord(cleanup)) {
      throw new AiDrawingResponseValidationError(
        `${path}.cleanup must be an object`,
      );
    }
    requireExactKeys(cleanup, ["overlapRisk"], `${path}.cleanup`);
    if (typeof cleanup.overlapRisk !== "boolean") {
      throw new AiDrawingResponseValidationError(
        `${path}.cleanup.overlapRisk must be a boolean`,
      );
    }
  }
  requirePrinciple(value.principle, `${path}.principle`);
  validateRegion(value.region, `${path}.region`);
  requireString(value.issue, `${path}.issue`, MAX_AI_EXPLANATION_LENGTH);
  requireString(
    value.recommendation,
    `${path}.recommendation`,
    MAX_AI_EXPLANATION_LENGTH,
  );
  if (
    value.severity !== "low" &&
    value.severity !== "medium" &&
    value.severity !== "high"
  ) {
    throw new AiDrawingResponseValidationError(
      `${path}.severity is not supported`,
    );
  }
  if (
    typeof value.confidence !== "number" ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1
  ) {
    throw new AiDrawingResponseValidationError(
      `${path}.confidence must be between 0 and 1`,
    );
  }
}

function validateFindings(value: unknown): asserts value is AiDrawingFinding[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_AI_FINDINGS
  ) {
    throw new AiDrawingResponseValidationError(
      `findings must contain between 1 and ${MAX_AI_FINDINGS} items`,
    );
  }
  value.forEach(validateFinding);
}

// ─── Ghost stroke validation ────────────────────────────────────────────────

const STROKE_GROUPS = new Set<string>(AI_STROKE_GROUPS);

function requireFiniteNumber(
  value: unknown,
  path: string,
  min: number,
  max: number,
): void {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw new AiDrawingResponseValidationError(
      `${path} must be a finite number between ${min} and ${max}`,
    );
  }
}

/** Chuỗi được phép rỗng (nhãn hiển thị), chỉ chặn sai kiểu hoặc quá dài. */
function requireShortText(
  value: unknown,
  path: string,
  maximumLength: number,
): void {
  if (typeof value !== "string" || value.length > maximumLength) {
    throw new AiDrawingResponseValidationError(
      `${path} must be a string of at most ${maximumLength} characters`,
    );
  }
}

/** Trường thừa là lỗi: hợp đồng nói rõ "không thêm trường". */
function requireAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
): void {
  const allowed = new Set(allowedKeys);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new AiDrawingResponseValidationError(
      `${path} must not contain: ${unknown.join(", ")}`,
    );
  }
}

function validateNormalizedPoint(value: unknown, path: string): void {
  if (!isRecord(value)) {
    throw new AiDrawingResponseValidationError(`${path} must be an object`);
  }
  requireExactKeys(value, ["x", "y"], path);
  requireUnitCoordinate(value.x, `${path}.x`);
  requireUnitCoordinate(value.y, `${path}.y`);
}

function validateStrokePath(value: unknown, path: string): void {
  if (!isRecord(value)) {
    throw new AiDrawingResponseValidationError(`${path} must be an object`);
  }

  const kind = value.kind;
  if (
    kind !== "path" &&
    kind !== "line" &&
    kind !== "ellipse" &&
    kind !== "rectangle"
  ) {
    throw new AiDrawingResponseValidationError(
      `${path}.kind must be path, line, ellipse or rectangle`,
    );
  }

  const kindKeys =
    kind === "path"
      ? (["points"] as const)
      : kind === "line"
        ? (["from", "to"] as const)
        : (["region"] as const);
  requireAllowedKeys(value, [...AI_STROKE_BASE_KEYS, ...kindKeys], path);

  if (kind === "path") {
    if (!Array.isArray(value.points) || value.points.length === 0 || value.points.length > MAX_AI_STROKE_POINTS) {
      throw new AiDrawingResponseValidationError(
        `${path}.points must be an array of 1..${MAX_AI_STROKE_POINTS} points`,
      );
    }
    value.points.forEach((pt: unknown, pi: number) =>
      validateNormalizedPoint(pt, `${path}.points[${pi}]`),
    );
  } else if (kind === "line") {
    if (!isRecord(value.from) || !isRecord(value.to)) {
      throw new AiDrawingResponseValidationError(
        `${path}.from and ${path}.to must be objects for kind=line`,
      );
    }
    validateNormalizedPoint(value.from, `${path}.from`);
    validateNormalizedPoint(value.to, `${path}.to`);
  } else {
    // ellipse or rectangle
    validateRegion(value.region, `${path}.region`);
  }

  requirePrinciple(value.style, `${path}.style`);
  if (
    typeof value.group !== "string" ||
    !STROKE_GROUPS.has(value.group as AiStrokeGroup)
  ) {
    throw new AiDrawingResponseValidationError(
      `${path}.group is not one of the supported stroke groups`,
    );
  }
  requireShortText(value.label, `${path}.label`, MAX_AI_STROKE_LABEL_LENGTH);
  requireFiniteNumber(value.opacity, `${path}.opacity`, AI_STROKE_OPACITY_MIN, AI_STROKE_OPACITY_MAX);
  requireFiniteNumber(value.strokeWidth, `${path}.strokeWidth`, AI_STROKE_WIDTH_MIN, AI_STROKE_WIDTH_MAX);

  if (value.dashed !== undefined && typeof value.dashed !== "boolean") {
    throw new AiDrawingResponseValidationError(`${path}.dashed must be boolean`);
  }
  if (value.closed !== undefined && typeof value.closed !== "boolean") {
    throw new AiDrawingResponseValidationError(`${path}.closed must be boolean`);
  }
  if (value.fill !== undefined && value.fill !== STROKE_FILL_NONE) {
    if (
      typeof value.fill !== "string" ||
      !STROKE_FILL_PATTERN.test(value.fill)
    ) {
      throw new AiDrawingResponseValidationError(
        `${path}.fill must be "none" or a "#rrggbb" colour`,
      );
    }
    // Ellipse/rectangle vốn đã khép kín; path thì phải khai báo `closed`.
    if (kind === "path" && value.closed !== true) {
      throw new AiDrawingResponseValidationError(
        `${path}.fill requires a closed path`,
      );
    }
  }
}

function validateStrokes(value: unknown): asserts value is AiStrokePath[] {
  if (!Array.isArray(value) || value.length > MAX_AI_GHOST_STROKES) {
    throw new AiDrawingResponseValidationError(
      `strokes must be an array of at most ${MAX_AI_GHOST_STROKES} items`,
    );
  }
  value.forEach((stroke, index) =>
    validateStrokePath(stroke, `strokes[${index}]`),
  );
}

const GHOST_STROKE_TASKS = new Set<AiDrawingTask>([
  AiDrawingTask.StrokeGuidance,
  AiDrawingTask.CompositionOverlay,
  AiDrawingTask.PoseGuidance,
]);

// ─── Page story flow validation ─────────────────────────────────────────────

/**
 * Một trang chỉ có thể chia tối đa `MAX_AI_STORY_FLOW_PANELS` khung, nên `p1..p12`
 * là toàn bộ id hợp lệ. Việc khớp **đúng layout đang dùng** được client đối chiếu
 * lần cuối (nó là bên duy nhất biết layout nào đang mở).
 */
const PANEL_ID_PATTERN = /^p(?:[1-9]|1[0-2])$/;
const PANEL_CAMERAS = new Set<string>(AI_PANEL_CAMERAS);

export function isValidStoryFlowPanelId(value: unknown): value is string {
  return typeof value === "string" && PANEL_ID_PATTERN.test(value);
}

function validateStoryFlowPanelHint(
  value: unknown,
  index: number,
): asserts value is AiPageStoryFlowPanelHint {
  const path = `panels[${index}]`;
  if (!isRecord(value)) {
    throw new AiDrawingResponseValidationError(`${path} must be an object`);
  }
  requireExactKeys(value, ["panelId", "order", "hint", "camera"], path);

  if (!isValidStoryFlowPanelId(value.panelId)) {
    throw new AiDrawingResponseValidationError(
      `${path}.panelId must match the layout panel ids (p1..pN)`,
    );
  }
  if (
    typeof value.order !== "number" ||
    !Number.isInteger(value.order) ||
    value.order < 1 ||
    value.order > MAX_AI_PANEL_ORDER
  ) {
    throw new AiDrawingResponseValidationError(
      `${path}.order must be an integer between 1 and ${MAX_AI_PANEL_ORDER}`,
    );
  }
  requireString(value.hint, `${path}.hint`, MAX_AI_PANEL_HINT_LENGTH);
  if (typeof value.camera !== "string" || !PANEL_CAMERAS.has(value.camera)) {
    throw new AiDrawingResponseValidationError(
      `${path}.camera is not one of the supported camera scales`,
    );
  }
}

function validateStoryFlowPanels(
  value: unknown,
): asserts value is AiPageStoryFlowPanelHint[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_AI_STORY_FLOW_PANELS
  ) {
    throw new AiDrawingResponseValidationError(
      `panels must contain between 1 and ${MAX_AI_STORY_FLOW_PANELS} items`,
    );
  }
  value.forEach(validateStoryFlowPanelHint);
}

// ─── Scene blueprint validation (A-2) ───────────────────────────────────────

function validateBlueprintSpec(
  value: unknown,
): asserts value is AiSceneBlueprintSpec {
  if (!isRecord(value)) {
    throw new AiDrawingResponseValidationError(
      "blueprint must be an object",
    );
  }
  requireExactKeys(
    value,
    ["title", "composition", "lighting", "camera"],
    "blueprint",
  );
  requireString(value.title, "blueprint.title", MAX_AI_BLUEPRINT_TITLE_LENGTH);
  requireString(
    value.composition,
    "blueprint.composition",
    MAX_AI_BLUEPRINT_DESCRIPTION_LENGTH,
  );
  requireString(
    value.lighting,
    "blueprint.lighting",
    MAX_AI_BLUEPRINT_DESCRIPTION_LENGTH,
  );
  requireString(
    value.camera,
    "blueprint.camera",
    MAX_AI_BLUEPRINT_CAMERA_LENGTH,
  );
}

function validateBlueprintLayer(
  value: unknown,
  index: number,
): asserts value is AiBlueprintLayer {
  const path = `layers[${index}]`;
  if (!isRecord(value)) {
    throw new AiDrawingResponseValidationError(`${path} must be an object`);
  }
  requireExactKeys(value, ["group", "name", "description", "strokes"], path);

  if (
    typeof value.group !== "string" ||
    !STROKE_GROUPS.has(value.group as AiStrokeGroup)
  ) {
    throw new AiDrawingResponseValidationError(
      `${path}.group is not one of the supported stroke groups`,
    );
  }
  requireString(value.name, `${path}.name`, MAX_AI_BLUEPRINT_TITLE_LENGTH);
  requireString(
    value.description,
    `${path}.description`,
    MAX_AI_BLUEPRINT_DESCRIPTION_LENGTH,
  );

  const layerGroup = value.group as AiStrokeGroup;
  const strokes = value.strokes;
  if (
    !Array.isArray(strokes) ||
    strokes.length < MIN_AI_BLUEPRINT_LAYER_STROKES ||
    strokes.length > MAX_AI_BLUEPRINT_LAYER_STROKES
  ) {
    throw new AiDrawingResponseValidationError(
      `${path}.strokes must contain between ${MIN_AI_BLUEPRINT_LAYER_STROKES} and ${MAX_AI_BLUEPRINT_LAYER_STROKES} items`,
    );
  }
  strokes.forEach((stroke, strokeIndex) => {
    validateStrokePath(stroke, `${path}.strokes[${strokeIndex}]`);
    // Nét phải nằm đúng lớp của nó, nếu không thứ tự vẽ theo lớp sẽ nói dối.
    if ((stroke as AiStrokePath).group !== layerGroup) {
      throw new AiDrawingResponseValidationError(
        `${path}.strokes[${strokeIndex}].group must match the layer group`,
      );
    }
  });
}

function validateBlueprintLayers(
  value: unknown,
): asserts value is AiBlueprintLayer[] {
  if (
    !Array.isArray(value) ||
    value.length < MIN_AI_BLUEPRINT_LAYERS ||
    value.length > MAX_AI_BLUEPRINT_LAYERS
  ) {
    throw new AiDrawingResponseValidationError(
      `layers must contain between ${MIN_AI_BLUEPRINT_LAYERS} and ${MAX_AI_BLUEPRINT_LAYERS} items`,
    );
  }

  const seenGroups = new Set<string>();
  value.forEach((layer, index) => {
    validateBlueprintLayer(layer, index);
    if (seenGroups.has(layer.group)) {
      throw new AiDrawingResponseValidationError(
        `layers[${index}].group is duplicated`,
      );
    }
    seenGroups.add(layer.group);
  });
}

export function parseAiDrawingResponse(
  value: unknown,
  expectedTask: AiDrawingTask,
  availableSourceIds: ReadonlySet<string>,
): AiDrawingResponse {
  if (!isRecord(value) || !hasOnlyKeys(value, RESPONSE_KEYS)) {
    throw new AiDrawingResponseValidationError(
      "AI response must be an object using only the application response fields",
    );
  }

  const summary = value.summary;
  requireString(summary, "summary", MAX_AI_RESPONSE_SUMMARY_LENGTH);
  if (value.schemaVersion !== AI_DRAWING_RESPONSE_SCHEMA_VERSION) {
    throw new AiDrawingResponseValidationError(
      "AI response schema version is not supported",
    );
  }
  if (value.task !== expectedTask) {
    throw new AiDrawingResponseValidationError(
      "AI response task does not match the request task",
    );
  }
  const sourceIds = value.sourceIds;
  validateSourceIds(sourceIds, availableSourceIds);

  const model = value.model;
  if (model !== undefined) {
    requireString(model, "model", MAX_AI_MODEL_LENGTH);
  }
  const modelField = model === undefined ? {} : { model };

  if (expectedTask === AiDrawingTask.CompositionGuidance) {
    requireTaskKeys(
      value,
      [...BASE_RESPONSE_KEYS, "recommendations"],
      "response",
    );
    const recommendations = value.recommendations;
    validateRecommendations(recommendations);
    return {
      schemaVersion: AI_DRAWING_RESPONSE_SCHEMA_VERSION,
      task: AiDrawingTask.CompositionGuidance,
      summary,
      sourceIds,
      ...modelField,
      recommendations,
    };
  }

  if (expectedTask === AiDrawingTask.DrawingReview) {
    requireTaskKeys(value, [...BASE_RESPONSE_KEYS, "findings"], "response");
    const findings = value.findings;
    validateFindings(findings);
    return {
      schemaVersion: AI_DRAWING_RESPONSE_SCHEMA_VERSION,
      task: AiDrawingTask.DrawingReview,
      summary,
      sourceIds,
      ...modelField,
      findings,
    };
  }

  // Ghost stroke tasks: StrokeGuidance, CompositionOverlay, PoseGuidance
  if (GHOST_STROKE_TASKS.has(expectedTask)) {
    requireTaskKeys(value, [...BASE_RESPONSE_KEYS, "strokes"], "response");
    const strokes = value.strokes;
    validateStrokes(strokes);
    return {
      schemaVersion: AI_DRAWING_RESPONSE_SCHEMA_VERSION,
      task: expectedTask as
        | AiDrawingTask.StrokeGuidance
        | AiDrawingTask.CompositionOverlay
        | AiDrawingTask.PoseGuidance,
      summary,
      sourceIds,
      ...modelField,
      strokes,
    };
  }

  if (expectedTask === AiDrawingTask.PageStoryFlow) {
    requireTaskKeys(value, [...BASE_RESPONSE_KEYS, "flow", "panels"], "response");
    const flow = value.flow;
    requireString(flow, "flow", MAX_AI_FLOW_LENGTH);
    const panels = value.panels;
    validateStoryFlowPanels(panels);
    return {
      schemaVersion: AI_DRAWING_RESPONSE_SCHEMA_VERSION,
      task: AiDrawingTask.PageStoryFlow,
      summary,
      sourceIds,
      ...modelField,
      flow,
      panels,
    };
  }

  if (expectedTask === AiDrawingTask.SceneBlueprint) {
    requireTaskKeys(
      value,
      [...BASE_RESPONSE_KEYS, "blueprint", "layers", "strokes"],
      "response",
    );
    const blueprint = value.blueprint;
    validateBlueprintSpec(blueprint);
    const layers = value.layers;
    validateBlueprintLayers(layers);
    const strokes = value.strokes;
    validateStrokes(strokes);

    // `strokes` là bản trải phẳng của `layers[].strokes`; lệch nhau nghĩa là model
    // trả hai nguồn sự thật khác nhau nên không thể tin bên nào.
    const flattened = layers.flatMap((layer) => layer.strokes);
    if (flattened.length !== strokes.length) {
      throw new AiDrawingResponseValidationError(
        "strokes must flatten every layer stroke",
      );
    }
    if (JSON.stringify(flattened) !== JSON.stringify(strokes)) {
      throw new AiDrawingResponseValidationError(
        "strokes must match the layer strokes exactly",
      );
    }
    if (flattened.length > MAX_AI_GHOST_STROKES) {
      throw new AiDrawingResponseValidationError(
        `strokes must be an array of at most ${MAX_AI_GHOST_STROKES} items`,
      );
    }

    return {
      schemaVersion: AI_DRAWING_RESPONSE_SCHEMA_VERSION,
      task: AiDrawingTask.SceneBlueprint,
      summary,
      sourceIds,
      ...modelField,
      blueprint,
      layers,
      strokes,
    };
  }

  throw new AiDrawingResponseValidationError(
    `Unsupported AI drawing task: ${String(expectedTask)}`,
  );
}

