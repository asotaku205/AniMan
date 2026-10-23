/**
 * Hậu kỳ bản xuất (Đợt Đ3): chuyển cảnh, chỉnh màu, màn hình tiêu đề —
 * áp ở bước hợp thành khung hình khi xuất (áp cho cả 2D lẫn 3D, không
 * đổi dữ liệu cảnh). Cài đặt lưu trên dự án (AnimProject.post).
 */

export type TransitionType = "none" | "fade" | "crossfade";
export type ColorGrade = "none" | "fresh" | "warm" | "cool" | "cinema";

export interface PostSettings {
  transition: TransitionType;
  grade: ColorGrade;
  titleCard: boolean;
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
export function drawTitleCard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  title: string,
  subtitle: string,
): void {
  ctx.save();
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#0d0817");
  bg.addColorStop(1, "#241032");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#f472b6";
  ctx.fillRect(width / 2 - 30, height / 2 - 78, 60, 4);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.round(height / 13)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, width / 2, height / 2 - 18, width - 120);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `400 ${Math.round(height / 30)}px sans-serif`;
  ctx.fillText(subtitle, width / 2, height / 2 + 34);
  ctx.restore();
}
