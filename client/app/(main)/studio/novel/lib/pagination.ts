/**
 * Phân trang theo hàm đo thật của trình duyệt. Mỗi trang là một lát cắt
 * liên tiếp của chuỗi gốc nên ghép các trang lại sẽ không làm mất ký tự.
 */
export function paginateTextToFit(
  text: string,
  fits: (candidate: string) => boolean,
): string[] {
  if (!text) return [""];

  const tokens = [...text.matchAll(/\S+|\s+/gu)].map((match) => ({
    end: (match.index ?? 0) + match[0].length,
  }));
  if (tokens.length === 0) return [text];

  const pages: string[] = [];
  let start = 0;
  let tokenIndex = 0;
  while (start < text.length) {
    while (tokenIndex < tokens.length && tokens[tokenIndex].end <= start) tokenIndex++;
    if (tokenIndex >= tokens.length) break;
    let low = tokenIndex;
    let high = tokens.length - 1;
    let bestEnd = start;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const end = tokens[mid].end;
      if (end <= start) {
        low = mid + 1;
      } else if (fits(text.slice(start, end))) {
        bestEnd = end;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // Một từ dài hơn cả trang: tìm điểm cắt an toàn theo code point.
    if (bestEnd === start) {
      let chunk = "";
      let firstPointLength = 1;
      for (const point of text.slice(start)) {
        if (!chunk) firstPointLength = point.length;
        if (chunk && !fits(chunk + point)) break;
        chunk += point;
      }
      bestEnd = start + Math.max(chunk.length, firstPointLength);
    }

    pages.push(text.slice(start, bestEnd));
    start = bestEnd;
  }
  return pages.length ? pages : [text];
}

/**
 * Ghép nội dung hai ô của một cảnh; chỉ thêm dấu cách nếu điểm nối chưa có.
 */
export function joinSceneText(left: string, right: string): string {
  if (!left) return right;
  if (!right) return left;
  const needsSpace = !/\s$/.test(left) && !/^\s/.test(right);
  return left + (needsSpace ? " " : "") + right;
}
