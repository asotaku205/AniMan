/**
 * Track thoại/phụ đề của một cảnh — logic thuần.
 *
 * Nguồn gốc: chữ trong bóng thoại của panel manga (TextItem) được trích
 * thành các dòng thoại; **thời lượng đọc ước lượng theo số ký tự** để gợi
 * ý thời lượng cảnh — người dùng kéo/sửa lại từng dòng sau đó. Đây là
 * TOOL (luật cứng, không AI); bản dịch có ngữ cảnh là slice AI sau cùng.
 */

/** Metadata một bản thu giọng cho dòng thoại — file tiếng nằm ở kho Blob
 * (`voiceBlobs` trong animStorage), key = chính `id` của take. */
export interface DialogueTakeMeta {
  id: string;
  durationSec: number;
  /** Âm lượng phát 0–1.5 (mặc định 1). */
  volume: number;
  createdAt: number;
  note?: string;
}

export interface DialogueLine {
  id: string;
  text: string;
  startSec: number;
  durationSec: number;
  /** Tên nhân vật nói (tuỳ chọn, điền tay hoặc từ World Builder sau này). */
  speaker?: string;
  /** Các bản thu giọng của dòng này (Slice B1 — khép kín tiếng cho phim). */
  takes?: DialogueTakeMeta[];
  /** Take được chọn để đưa vào bản xuất phim. */
  selectedTakeId?: string;
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

let takeCounter = 0;
export function newTakeId(): string {
  takeCounter += 1;
  return `take-${Date.now().toString(36)}-${takeCounter.toString(36)}`;
}

/** Thêm một bản thu vào dòng thoại; bản thu đầu tiên tự được chọn để xuất. */
export function addDialogueTake(
  line: DialogueLine,
  take: DialogueTakeMeta,
): DialogueLine {
  const takes = [...(line.takes ?? []), take];
  return {
    ...line,
    takes,
    selectedTakeId: line.selectedTakeId ?? take.id,
  };
}

/** Xoá một bản thu; nếu xoá đúng bản đang chọn thì chọn bản còn lại đầu tiên. */
export function removeDialogueTake(
  line: DialogueLine,
  takeId: string,
): DialogueLine {
  const takes = (line.takes ?? []).filter((t) => t.id !== takeId);
  return {
    ...line,
    takes,
    selectedTakeId:
      line.selectedTakeId === takeId ? takes[0]?.id : line.selectedTakeId,
  };
}

export function selectDialogueTake(
  line: DialogueLine,
  takeId: string,
): DialogueLine {
  if (!(line.takes ?? []).some((t) => t.id === takeId)) return line;
  return { ...line, selectedTakeId: takeId };
}

export function setDialogueTakeVolume(
  line: DialogueLine,
  takeId: string,
  volume: number,
): DialogueLine {
  return {
    ...line,
    takes: (line.takes ?? []).map((t) =>
      t.id === takeId
        ? { ...t, volume: Math.min(1.5, Math.max(0, volume)) }
        : t,
    ),
  };
}

/** Bản thu đang được chọn của dòng (null = dòng chưa có tiếng để xuất). */
export function selectedDialogueTake(
  line: DialogueLine,
): DialogueTakeMeta | null {
  if (!line.selectedTakeId) return null;
  return (line.takes ?? []).find((t) => t.id === line.selectedTakeId) ?? null;
}

export function lineHasSelectedVoice(line: DialogueLine): boolean {
  return selectedDialogueTake(line) !== null;
}
