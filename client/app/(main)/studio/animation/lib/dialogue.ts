/**
 * Track thoại/phụ đề của một cảnh — logic thuần.
 *
 * Nguồn gốc: chữ trong bóng thoại của panel manga (TextItem) được trích
 * thành các dòng thoại; **thời lượng đọc ước lượng theo số ký tự** để gợi
 * ý thời lượng cảnh — người dùng kéo/sửa lại từng dòng sau đó. Đây là
 * TOOL (luật cứng, không AI); bản dịch có ngữ cảnh là slice AI sau cùng.
 */

export interface DialogueLine {
  id: string;
  text: string;
  startSec: number;
  durationSec: number;
  /** Tên nhân vật nói (tuỳ chọn, điền tay hoặc từ World Builder sau này). */
  speaker?: string;
}

let lineCounter = 0;
export function newDialogueId(): string {
  lineCounter += 1;
  return `dlg-${Date.now().toString(36)}-${lineCounter.toString(36)}`;
}

/**
 * Ước lượng thời lượng đọc một câu thoại (giây): tốc độ đọc phụ đề tiếng
 * Việt ~13 ký tự/giây, sàn 1.2s, trần 8s cho một dòng.
 */
export function estimateLineDurationSec(text: string): number {
  const chars = text.trim().length;
  return Math.min(8, Math.max(1.2, chars / 13));
}

/**
 * Dựng track thoại liên tiếp từ danh sách câu (bắt đầu 0.3s, nghỉ 0.15s
 * giữa các câu) và gợi ý thời lượng cảnh tối thiểu chứa hết thoại.
 */
export function buildDialogueTrack(texts: string[]): {
  lines: DialogueLine[];
  suggestedSceneDurationSec: number;
} {
  const lines: DialogueLine[] = [];
  let cursor = 0.3;
  for (const raw of texts) {
    const text = raw.trim();
    if (!text) continue;
    const durationSec = estimateLineDurationSec(text);
    lines.push({ id: newDialogueId(), text, startSec: cursor, durationSec });
    cursor += durationSec + 0.15;
  }
  return {
    lines,
    suggestedSceneDurationSec: Math.max(3, Math.ceil((cursor + 0.25) * 2) / 2),
  };
}

/** Dòng thoại đang hiệu lực tại thời điểm t (để vẽ phụ đề khi phát thử). */
export function dialogueLineAt(
  lines: readonly DialogueLine[],
  t: number,
): DialogueLine | null {
  for (const line of lines) {
    if (t >= line.startSec && t < line.startSec + line.durationSec) return line;
  }
  return null;
}
