import type { AiDrawingFinding } from "@/lib/ai-drawing-api";

/**
 * Chỉnh bố cục theo gợi ý AI (Slice 4) — phần logic thuần: diễn giải phép
 * biến đổi `fix` của finding thành câu tiếng Việt để người dùng đọc trước
 * khi quyết định áp dụng. Thao tác pixel (vùng chọn + vật đang bay) nằm ở
 * hook (`applyCompositionFix`).
 */

export type CompositionFix = NonNullable<AiDrawingFinding["fix"]>;

/** Ngưỡng coi như "không dời" — model hay trả số lẻ rất nhỏ thay vì 0. */
const EPSILON = 0.005;

function percent(value: number): string {
  return `${Math.round(Math.abs(value) * 100)}%`;
}

/**
 * Câu mô tả phép chỉnh, ví dụ "dời sang phải 8% · dời lên 4% · thu nhỏ 10%".
 * Phép chỉnh rỗng (không dời, scale 1) trả "giữ nguyên vị trí và kích thước".
 */
export function describeFix(fix: CompositionFix): string {
  const parts: string[] = [];
  if (Math.abs(fix.dx) > EPSILON) {
    parts.push(
      fix.dx > 0
        ? `dời sang phải ${percent(fix.dx)}`
        : `dời sang trái ${percent(fix.dx)}`,
    );
  }
  if (Math.abs(fix.dy) > EPSILON) {
    parts.push(
      fix.dy > 0
        ? `dời xuống ${percent(fix.dy)}`
        : `dời lên ${percent(fix.dy)}`,
    );
  }
  if (Math.abs(fix.scale - 1) > EPSILON) {
    parts.push(
      fix.scale > 1
        ? `phóng to ${percent(fix.scale - 1)}`
        : `thu nhỏ ${percent(fix.scale - 1)}`,
    );
  }
  return parts.length > 0
    ? parts.join(" · ")
    : "giữ nguyên vị trí và kích thước";
}
