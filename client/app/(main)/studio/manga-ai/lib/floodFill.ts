/**
 * floodFill — thuật toán đổ màu loang (BR-T10). Tách khỏi hook để chạy được
 * trên `Uint8ClampedArray` thuần: không canvas, không DOM, test trực tiếp.
 *
 * BR-T10: **tôn trọng vùng chọn** nếu đang có; không có vùng chọn thì loang
 * toàn khung. Vùng chọn được truyền vào dưới dạng `mask` (1 = được đổ).
 */

/** Ngưỡng lệch màu mặc định cho mỗi kênh (giữ nguyên như bản gốc). */
export const FLOOD_TOLERANCE = 36;

export interface FloodFillOptions {
  /** Lệch màu tối đa mỗi kênh để coi là "cùng một vùng". */
  tolerance?: number;
  /**
   * Mặt nạ vùng chọn, dài `width * height`; `1` = pixel được phép đổ.
   * Không truyền → đổ mọi pixel cùng vùng màu.
   */
  mask?: Uint8Array | null;
}

/**
 * Đổ màu tại chỗ vào `data` (RGBA, `width * height * 4`). Trả về **số pixel đã
 * đổi** (0 = không đổ gì: điểm bắt đầu ngoài khung, ngoài vùng chọn, đã trùng
 * màu đổ, hoặc bị chặn).
 */
export function floodFillPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  rgba: readonly [number, number, number, number],
  options: FloodFillOptions = {},
): number {
  if (width <= 0 || height <= 0) return 0;
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return 0;
  const tolerance = options.tolerance ?? FLOOD_TOLERANCE;
  const mask = options.mask ?? null;
  const startPos = startX + startY * width;
  if (mask && mask[startPos] !== 1) return 0;

  const startIdx = startPos * 4;
  const startR = data[startIdx];
  const startG = data[startIdx + 1];
  const startB = data[startIdx + 2];
  const startA = data[startIdx + 3];

  // Điểm bấm đã đúng màu đổ → không làm gì (tránh 1 bước undo rỗng)
  if (
    Math.abs(startR - rgba[0]) < 6 &&
    Math.abs(startG - rgba[1]) < 6 &&
    Math.abs(startB - rgba[2]) < 6 &&
    Math.abs(startA - rgba[3]) < 6
  ) {
    return 0;
  }

  function matchesStart(idx: number): boolean {
    return (
      Math.abs(data[idx] - startR) <= tolerance &&
      Math.abs(data[idx + 1] - startG) <= tolerance &&
      Math.abs(data[idx + 2] - startB) <= tolerance &&
      Math.abs(data[idx + 3] - startA) <= tolerance
    );
  }

  const visited = new Uint8Array(width * height);
  const queue: number[] = [startPos];
  visited[startPos] = 1;
  let painted = 0;

  while (queue.length > 0) {
    const pos = queue.pop()!;
    const px = pos % width;
    const py = Math.floor(pos / width);
    const idx = pos * 4;

    data[idx] = rgba[0];
    data[idx + 1] = rgba[1];
    data[idx + 2] = rgba[2];
    data[idx + 3] = rgba[3];
    painted += 1;

    const neighbors = [
      [px + 1, py],
      [px - 1, py],
      [px, py + 1],
      [px, py - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const npos = nx + ny * width;
      if (visited[npos]) continue;
      visited[npos] = 1;
      // Pixel ngoài vùng chọn vừa không được đổ, vừa chặn loang (BR-T10)
      if (mask && mask[npos] !== 1) continue;
      if (matchesStart(npos * 4)) queue.push(npos);
    }
  }

  return painted;
}

/** Mặt nạ vùng chọn từ dữ liệu alpha (mỗi pixel 4 byte): alpha > 0 → 1. */
export function maskFromAlpha(
  data: Uint8ClampedArray | Uint8Array,
  pixelCount: number,
): Uint8Array {
  const mask = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i += 1) {
    mask[i] = data[i * 4 + 3] > 0 ? 1 : 0;
  }
  return mask;
}
