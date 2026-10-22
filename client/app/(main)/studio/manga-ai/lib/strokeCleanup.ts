import type {
  AiDrawingFinding,
  NormalizedRegion,
} from "@/lib/ai-drawing-api";

/**
 * Dọn nét thừa (Slice 3) — phần logic thuần của luồng: AI đề xuất vùng nét
 * thừa qua `drawing_review` (finding mang cờ `cleanup`), người dùng chọn
 * tẩy từng vùng hoặc tự tẩy tay. Module này chỉ tính toán; thao tác pixel
 * nằm ở hook (`eraseStrokeRegion`).
 */

/** Một vùng nét thừa ứng viên, giữ vị trí của finding gốc để đối chiếu UI. */
export interface CleanupCandidate {
  /** Chỉ số của finding trong mảng findings gốc. */
  index: number;
  region: NormalizedRegion;
  issue: string;
  /** Vùng có thể chứa nét quan trọng — UI phải cảnh báo trước khi tẩy. */
  overlapRisk: boolean;
}

/** Lọc các finding là nét thừa, giữ nguyên thứ tự và chỉ số gốc. */
export function cleanupCandidates(
  findings: readonly AiDrawingFinding[],
): CleanupCandidate[] {
  const out: CleanupCandidate[] = [];
  findings.forEach((finding, index) => {
    if (!finding.cleanup) return;
    out.push({
      index,
      region: finding.region,
      issue: finding.issue,
      overlapRisk: finding.cleanup.overlapRisk === true,
    });
  });
  return out;
}

/**
 * Vùng normalized → hình chữ nhật pixel của canvas đích, kẹp trong khung và
 * làm tròn ra ngoài (tẩy thừa một chút ở biên còn hơn sót nét). Canvas suy
 * biến (cạnh ≤ 0) cho hình rỗng.
 */
export function regionToPixelRect(
  region: NormalizedRegion,
  w: number,
  h: number,
): { x: number; y: number; width: number; height: number } {
  if (!(w > 0) || !(h > 0)) return { x: 0, y: 0, width: 0, height: 0 };
  const x = Math.max(0, Math.floor(region.x * w));
  const y = Math.max(0, Math.floor(region.y * h));
  const right = Math.min(w, Math.ceil((region.x + region.width) * w));
  const bottom = Math.min(h, Math.ceil((region.y + region.height) * h));
  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}
