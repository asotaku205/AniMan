/**
 * Mô hình nét vẽ cho khung vẽ trong Animation Studio (R4): mỗi nét là
 * một danh sách điểm theo toạ độ TƯƠNG ĐỐI 0..1 (theo khung vẽ) nên vẽ
 * lại được ở mọi kích thước. Lịch sử hoàn tác/làm lại là dữ liệu thuần
 * để kiểm thử được; phần tô lên canvas nằm ở renderDrawStrokes.
 */

export interface DrawPoint {
  x: number;
  y: number;
}

export type DrawTool = "pen" | "eraser";

export interface DrawStroke {
  id: string;
  tool: DrawTool;
  color: string;
  widthPx: number;
  points: DrawPoint[];
}

export interface DrawHistory {
  strokes: DrawStroke[];
  undone: DrawStroke[];
}

let strokeCounter = 0;
export function newDrawStrokeId(): string {
  strokeCounter += 1;
  return `stroke-${Date.now().toString(36)}-${strokeCounter.toString(36)}`;
}

export function createDrawHistory(): DrawHistory {
  return { strokes: [], undone: [] };
}

/** Thêm một nét mới — làm lại (redo) bị xoá như mọi trình vẽ chuẩn. */
export function pushDrawStroke(h: DrawHistory, s: DrawStroke): DrawHistory {
  if (s.points.length === 0) return h;
  return { strokes: [...h.strokes, s], undone: [] };
}

export function undoDrawStroke(h: DrawHistory): DrawHistory {
  const last = h.strokes[h.strokes.length - 1];
  if (!last) return h;
  return {
    strokes: h.strokes.slice(0, -1),
    undone: [...h.undone, last],
  };
}

export function redoDrawStroke(h: DrawHistory): DrawHistory {
  const next = h.undone[h.undone.length - 1];
  if (!next) return h;
  return {
    strokes: [...h.strokes, next],
    undone: h.undone.slice(0, -1),
  };
}

export function clearDrawHistory(): DrawHistory {
  return createDrawHistory();
}

/** Bảng màu nhanh cho khung vẽ. */
export const DRAW_PALETTE = [
  "#171717",
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#0ea5e9",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#92400e",
  "#78716c",
];

/** Vẽ một nét lên canvas (toạ độ tương đối → tuyệt đối theo khung). */
export function paintStroke(
  ctx: CanvasRenderingContext2D,
  stroke: DrawStroke,
  width: number,
  height: number,
): void {
  if (stroke.points.length === 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.widthPx;
  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke.color;
  }
  ctx.beginPath();
  const first = stroke.points[0];
  ctx.moveTo(first.x * width, first.y * height);
  if (stroke.points.length === 1) {
    ctx.lineTo(first.x * width + 0.01, first.y * height + 0.01);
  } else {
    for (const p of stroke.points.slice(1)) ctx.lineTo(p.x * width, p.y * height);
  }
  ctx.stroke();
  ctx.restore();
}

/** Vẽ lại toàn bộ: hình gốc (nếu có) rồi mọi nét theo thứ tự. */
export function renderDrawStrokes(
  ctx: CanvasRenderingContext2D,
  baseImage: HTMLImageElement | null,
  strokes: readonly DrawStroke[],
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  if (baseImage) ctx.drawImage(baseImage, 0, 0, width, height);
  for (const s of strokes) paintStroke(ctx, s, width, height);
}
