/**
 * Nhân vật 2D tự tạo (R4): một nhân vật gồm BỘ BIỂU CẢM — mỗi biểu cảm
 * là một hình vẽ riêng (nền trong suốt) do người dùng tự vẽ trong app.
 * Đưa nhân vật vào cảnh = thêm một lớp hình với biểu cảm đang chọn;
 * đổi biểu cảm giữa các cảnh là cách làm hoạt hình đổi nét mặt kinh
 * điển của motion comic. Hàm thuần, thao tác trên Character2DAsset.
 */

import { newAssetId, type Character2DAsset } from "./animAssets";

export interface CharacterExpression {
  label: string;
  /** Hình vẽ của biểu cảm (PNG nền trong suốt) — null là chưa vẽ. */
  dataUrl: string | null;
}

export const DEFAULT_EXPRESSION_LABELS = [
  "Bình thường",
  "Vui",
  "Buồn",
  "Giận",
  "Ngạc nhiên",
] as const;

export function createCharacter2D(name: string): Character2DAsset {
  return {
    kind: "character2d",
    id: newAssetId("char2d"),
    name: name.trim() || "Nhân vật mới",
    expressions: DEFAULT_EXPRESSION_LABELS.map((label) => ({
      label,
      dataUrl: null,
    })),
    createdAt: Date.now(),
  };
}

/** Gán hình cho một biểu cảm (tạo mới biểu cảm nếu chưa có). */
export function setExpressionImage(
  char: Character2DAsset,
  label: string,
  dataUrl: string | null,
): Character2DAsset {
  const exists = char.expressions.some((e) => e.label === label);
  const expressions = exists
    ? char.expressions.map((e) => (e.label === label ? { ...e, dataUrl } : e))
    : [...char.expressions, { label, dataUrl }];
  return { ...char, expressions };
}

/** Thêm biểu cảm tự đặt tên (trùng tên thì bỏ qua). */
export function addExpression(
  char: Character2DAsset,
  label: string,
): Character2DAsset {
  const clean = label.trim();
  if (!clean || char.expressions.some((e) => e.label === clean)) return char;
  return {
    ...char,
    expressions: [...char.expressions, { label: clean, dataUrl: null }],
  };
}

/** Xoá một biểu cảm — luôn giữ ít nhất 1 biểu cảm cho nhân vật. */
export function removeExpression(
  char: Character2DAsset,
  label: string,
): Character2DAsset {
  if (char.expressions.length <= 1) return char;
  return {
    ...char,
    expressions: char.expressions.filter((e) => e.label !== label),
  };
}

/** Số biểu cảm đã vẽ / tổng số — hiển thị tiến độ hoàn thiện nhân vật. */
export function expressionProgress(char: Character2DAsset): {
  drawn: number;
  total: number;
} {
  return {
    drawn: char.expressions.filter((e) => e.dataUrl).length,
    total: char.expressions.length,
  };
}
