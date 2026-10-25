/**
 * Hậu kỳ bản xuất (Đợt Đ3): chuyển cảnh, chỉnh màu, màn hình tiêu đề —
 * áp ở bước hợp thành khung hình khi xuất (áp cho cả 2D lẫn 3D, không
 * đổi dữ liệu cảnh). Cài đặt lưu trên dự án (AnimProject.post).
 */

export type TransitionType =
  | "none"
  | "fade"
  | "crossfade"
  | "wipe-left"
  | "wipe-right"
  | "wipe-up"
  | "wipe-down"
  | "zoom"
  | "iris-open"
  | "iris-close";

export type WipeDirection = "wipe-left" | "wipe-right" | "wipe-up" | "wipe-down";
export type ColorGrade = "none" | "fresh" | "warm" | "cool" | "cinema";

export interface PostSettings {
  transition: TransitionType;
  grade: ColorGrade;
  titleCard: boolean;
  /** Chữ tiêu đề riêng (mặc định lấy tên phim). */
  titleText?: string;
  /** Dòng phụ dưới tiêu đề (mặc định "Một bộ phim làm bằng AniMan"). */
  titleSubtitle?: string;
  /** Hệ số cỡ chữ tiêu đề (mặc định 1). */
  titleSize?: number;
  /** Vị trí khối chữ tiêu đề. */
  titlePosition?: "center" | "top" | "bottom";
  /** Các dòng chạy cuối phim (rỗng = không có credit roll). */
  creditsLines?: string[];
  /** Tốc độ cuộn credit (pixel/giây, mặc định 60). */
  creditsSpeed?: number;
}

export const DEFAULT_POST: PostSettings = {
  transition: "crossfade",
  grade: "none",
  titleCard: true,
};

export const TITLE_CARD_SEC = 2.2;
/** Thời lượng cửa sổ chuyển cảnh (giây). */
export const TRANSITION_SEC = 0.6;

export const GRADE_FILTERS: Record<ColorGrade, string> = {
  none: "none",
  fresh: "saturate(1.25) contrast(1.05) brightness(1.04)",
  warm: "sepia(0.28) saturate(1.15) brightness(1.03)",
  cool: "saturate(0.92) hue-rotate(12deg) brightness(1.02)",
  cinema: "contrast(1.14) saturate(0.88) brightness(0.98)",
};

/**
 * Độ mờ đen (0..1) cần phủ tại thời điểm `elapsed` trong cảnh — chỉ dùng
 * cho chuyển cảnh kiểu "fade": mờ vào ở đầu cảnh (trừ cảnh đầu khi không
 * có màn hình tiêu đề thì vẫn mờ nhẹ cho có nhịp) và mờ ra ở cuối cảnh
 * (trừ cảnh cuối).
 */
export function fadeBlackAlpha(
  elapsed: number,
  duration: number,
  isFirst: boolean,
  isLast: boolean,
  post: PostSettings,
): number {
  if (post.transition !== "fade") return 0;
  let alpha = 0;
  if (!isFirst && elapsed < TRANSITION_SEC)
    alpha = Math.max(alpha, 1 - elapsed / TRANSITION_SEC);
  if (!isLast && duration - elapsed < TRANSITION_SEC)
    alpha = Math.max(alpha, 1 - (duration - elapsed) / TRANSITION_SEC);
  return Math.min(1, Math.max(0, alpha));
}

/**
 * Hệ số hoà tan khung cuối của cảnh trước lên đầu cảnh hiện tại
 * (1 = toàn khung cũ, 0 = toàn khung mới). Chỉ cảnh từ thứ hai trở đi.
 */
export function crossfadeBlend(
  elapsed: number,
  sceneIndex: number,
  post: PostSettings,
): number {
  if (post.transition !== "crossfade" || sceneIndex === 0) return 0;
  if (elapsed >= TRANSITION_SEC) return 0;
  return 1 - elapsed / TRANSITION_SEC;
}

/** Vẽ màn hình tiêu đề lên canvas hợp thành. */
export interface TitleCardOptions {
  /** Hệ số cỡ chữ (1 = cỡ cũ). */
  sizeScale?: number;
  /** Vị trí khối chữ: giữa (cũ), trên, dưới. */
  position?: "center" | "top" | "bottom";
}

export function drawTitleCard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  title: string,
  subtitle: string,
  opts: TitleCardOptions = {},
): void {
  ctx.save();
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#0d0817");
  bg.addColorStop(1, "#241032");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  const size = opts.sizeScale && opts.sizeScale > 0 ? opts.sizeScale : 1;
  const cy =
    opts.position === "top"
      ? height * 0.32
      : opts.position === "bottom"
        ? height * 0.68
        : height / 2;
  ctx.fillStyle = "#f472b6";
  ctx.fillRect(width / 2 - 30 * size, cy - 78, 60 * size, 4);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.round((height / 13) * size)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, width / 2, cy - 18, width - 120);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `400 ${Math.round((height / 30) * size)}px sans-serif`;
  ctx.fillText(subtitle, width / 2, cy + 34);
  ctx.restore();
}

/**
 * Độ phủ của khung cảnh trước trong cửa sổ chuyển cảnh (1 = khung cũ
 * che kín, 0 = toàn khung mới). Dùng chung cho mọi kiểu chuyển cảnh
 * dạng phủ khung (hoà tan, quét, phóng to, vòng tròn); kiểu "mờ qua
 * đen" không phủ khung cũ nên luôn trả 0.
 */
export function transitionCover(
  elapsed: number,
  sceneIndex: number,
  post: PostSettings,
): number {
  if (
    post.transition === "none" ||
    post.transition === "fade" ||
    sceneIndex === 0
  )
    return 0;
  if (elapsed >= TRANSITION_SEC) return 0;
  return Math.min(1, Math.max(0, 1 - elapsed / TRANSITION_SEC));
}

/** Vùng khung cũ còn thấy được khi quét (progress 1 = đủ khung, 0 = hết). */
export function wipeRect(
  progress: number,
  direction: WipeDirection,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const p = Math.min(1, Math.max(0, progress));
  switch (direction) {
    case "wipe-left":
      return { x: 0, y: 0, w: width * p, h: height };
    case "wipe-right":
      return { x: width * (1 - p), y: 0, w: width * p, h: height };
    case "wipe-up":
      return { x: 0, y: 0, w: width, h: height * p };
    case "wipe-down":
      return { x: 0, y: height * (1 - p), w: width, h: height * p };
  }
}

/** Bán kính vòng tròn phủ khung cũ (đủ lớn để che kín khung lúc đầu). */
export function irisRadius(progress: number, width: number, height: number): number {
  return Math.min(1, Math.max(0, progress)) * (Math.hypot(width, height) / 2);
}

/** Phóng to + mờ dần của khung cũ trong chuyển cảnh zoom. */
export function zoomTransform(progress: number): { scale: number; alpha: number } {
  const p = Math.min(1, Math.max(0, progress));
  return { scale: 1 + (1 - p) * 0.6, alpha: p };
}

/**
 * Vẽ khung cảnh trước lên trên khung hiện tại theo kiểu chuyển cảnh.
 * Trả false khi kiểu không dùng phủ khung (không chuyển cảnh, mờ qua
 * đen, hoà tan — hoà tan do code gọi tự phủ alpha) hoặc không có khung
 * trước. Khung hiện tại phải đã vẽ trước khi gọi hàm này.
 */
export function drawTransitionOverlay(
  ctx: CanvasRenderingContext2D,
  prev: HTMLCanvasElement | null,
  width: number,
  height: number,
  type: TransitionType,
  progress: number,
): boolean {
  if (!prev) return false;
  const p = Math.min(1, Math.max(0, progress));
  if (p <= 0) return false;
  switch (type) {
    case "wipe-left":
    case "wipe-right":
    case "wipe-up":
    case "wipe-down": {
      const r = wipeRect(p, type, width, height);
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      ctx.drawImage(prev, 0, 0, width, height);
      ctx.restore();
      return true;
    }
    case "iris-close": {
      ctx.save();
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, irisRadius(p, width, height), 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(prev, 0, 0, width, height);
      ctx.restore();
      return true;
    }
    case "iris-open": {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.arc(width / 2, height / 2, irisRadius(1 - p, width, height), 0, Math.PI * 2, true);
      ctx.clip("evenodd");
      ctx.drawImage(prev, 0, 0, width, height);
      ctx.restore();
      return true;
    }
    case "zoom": {
      const { scale, alpha } = zoomTransform(p);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(width / 2, height / 2);
      ctx.scale(scale, scale);
      ctx.drawImage(prev, -width / 2, -height / 2, width, height);
      ctx.restore();
      return true;
    }
    default:
      return false;
  }
}

// ── Chữ chạy dưới (lower-third) ─────────────────────────────────────────

export interface LowerThird {
  name: string;
  role: string;
  position: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  /** Mốc bắt đầu trong cảnh (giây, theo thời gian nội dung). */
  startSec: number;
  /** Thời lượng hiện (giây). */
  durationSec: number;
}

/** Trạng thái hiện của chữ chạy dưới tại thời điểm t (null = đang ẩn). */
export function lowerThirdState(
  t: number,
  lt: LowerThird,
): { alpha: number; offsetX: number; offsetY: number } | null {
  if (t < lt.startSec || t >= lt.startSec + lt.durationSec) return null;
  const SLIDE = 0.3;
  const local = t - lt.startSec;
  let alpha = 1;
  if (local < SLIDE) alpha = local / SLIDE;
  else if (local > lt.durationSec - SLIDE)
    alpha = Math.max(0, (lt.durationSec - local) / SLIDE);
  const slide = 1 - alpha;
  // Chữ dưới trượt từ dưới lên, chữ trên trượt từ trên xuống.
  const fromBelow = lt.position.startsWith("bottom");
  return {
    alpha: Math.min(1, Math.max(0, alpha)),
    offsetX: 0,
    offsetY: (fromBelow ? 1 : -1) * 24 * slide,
  };
}

/** Vẽ chữ chạy dưới lên khung hình; trả false khi ngoài khung giờ. */
export function drawLowerThird(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lt: LowerThird,
  t: number,
): boolean {
  const st = lowerThirdState(t, lt);
  if (!st) return false;
  const w = Math.min(420, width * 0.5);
  const h = 64;
  const x =
    lt.position === "bottom-left" || lt.position === "top-left"
      ? 24 + st.offsetX
      : width - 24 - w + st.offsetX;
  const y =
    lt.position.startsWith("bottom") ? height - 24 - h + st.offsetY : 24 + st.offsetY;
  ctx.save();
  ctx.globalAlpha = st.alpha;
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#f472b6";
  ctx.fillRect(x, y, 4, h);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 20px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(lt.name, x + 16, y + 22);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "400 14px sans-serif";
  ctx.fillText(lt.role, x + 16, y + 46);
  ctx.restore();
  return true;
}

// ── Credit roll ────────────────────────────────────────────────────────────

export const CREDIT_LINE_HEIGHT = 44;
export const CREDIT_SPEED_DEFAULT = 60;

/** Thời lượng credit roll (giây) cho số dòng, cao dòng, cao khung, tốc độ. */
export function creditRollDuration(
  lineCount: number,
  lineHeight: number,
  height: number,
  speed: number,
): number {
  if (lineCount <= 0 || speed <= 0) return 0;
  return (height + lineCount * lineHeight) / speed;
}

/** Vị trí cuộn (pixel) tại thời điểm t. */
export function creditRollOffset(t: number, speed: number): number {
  return Math.max(0, t) * speed;
}

/** Vẽ credit roll lên khung hình (dòng đầu bắt đầu ở mép dưới, cuộn lên). */
export function drawCreditRoll(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lines: string[],
  t: number,
  opts: { speed?: number; lineHeight?: number } = {},
): void {
  const speed = opts.speed && opts.speed > 0 ? opts.speed : CREDIT_SPEED_DEFAULT;
  const lh = opts.lineHeight && opts.lineHeight > 0 ? opts.lineHeight : CREDIT_LINE_HEIGHT;
  const offset = creditRollOffset(t, speed);
  ctx.save();
  ctx.fillStyle = "#0d0817";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, height - offset + i * lh);
  });
  ctx.restore();
}
