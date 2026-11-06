/**
 * Nét vẽ theo từng khung hình (frame-by-frame) cho Animation Studio 2D.
 *
 * Khác với vệt `SceneStroke` (lưu theo cảnh, hiện dần theo thời gian),
 * frame drawing gắn nét vẽ với một frame rời rạc: vẽ ở frame nào thì
 * nét thuộc frame đó, phát thử đổi nét theo từng frame. Mỗi frame
 * drawing thuộc đúng một layer (`layerId` bắt buộc) để áp transform
 * của layer đó khi phát, và để onion skin chỉ vẽ bóng của layer đang vẽ.
 *
 * Thời gian của frame suy ra từ số frame và fps: frame bắt đầu ở
 * `frame / fps`. Số frame của cảnh là `ceil(durationSec * fps)`, tính
 * trên thời gian nội dung của cảnh (không tính wall-clock khi `speed`
 * khác 1). Toàn bộ hàm ở đây đều thuần, không chạm IndexedDB.
 */

import {
  newDrawStrokeId,
  type DrawStroke,
} from "./drawStrokes";

/** Ngưỡng mềm cảnh báo khi tổng số nét trong cảnh vượt quá. */
export const MAX_FRAME_DRAWING_STROKES = 2000;

export interface FrameDrawing {
  id: string;
  /** Số frame nguyên, bắt đầu từ 0, trong phạm vi cảnh. */
  frame: number;
  /** Layer mà nét vẽ thuộc về. */
  layerId: string;
  /** Nét vẽ của frame, theo thứ tự vẽ. */
  strokes: DrawStroke[];
  /** True khi frame là tư thế chính (key pose, luồng pose-to-pose). */
  isKeyPose: boolean;
  /** Tên tư thế, chỉ dùng khi là key pose (ví dụ "giơ tay"). */
  note?: string;
}

let frameCounter = 0;
export function newFrameDrawingId(): string {
  frameCounter += 1;
  return `frame-${Date.now().toString(36)}-${frameCounter.toString(36)}`;
}

/** Số frame của cảnh (ít nhất 1), tính trên thời gian nội dung. */
export function frameCount(durationSec: number, fps: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 1;
  if (!Number.isFinite(fps) || fps <= 0) return 1;
  return Math.max(1, Math.ceil(durationSec * fps));
}

/** Frame chứa thời điểm t (giây trong cảnh), kẹp trong phạm vi cảnh. */
export function frameIndex(t: number, fps: number, durationSec: number): number {
  const count = frameCount(durationSec, fps);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.min(count - 1, Math.floor(t * fps));
}

/** Thời điểm bắt đầu của một frame (giây trong cảnh). */
export function frameTime(frame: number, fps: number): number {
  if (!Number.isFinite(fps) || fps <= 0) return 0;
  return Math.max(0, frame) / fps;
}

/**
 * Chuẩn hóa dữ liệu frame drawing đọc từ kho lưu: bỏ mục sai (frame
 * không phải số nguyên >= 0, layerId rỗng, strokes không phải mảng),
 * gộp các mục trùng (cùng layer, cùng frame) thành một, sắp xếp theo
 * layer rồi frame. Dữ liệu cũ không có trường này thì coi như rỗng.
 */
export function normalizeFrameDrawings(value: unknown): FrameDrawing[] {
  if (!Array.isArray(value)) return [];
  const merged = new Map<string, FrameDrawing>();
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const frame = e.frame;
    const layerId = e.layerId;
    const strokes = e.strokes;
    if (
      typeof frame !== "number" ||
      !Number.isInteger(frame) ||
      frame < 0 ||
      typeof layerId !== "string" ||
      layerId.length === 0 ||
      !Array.isArray(strokes)
    ) {
      continue;
    }
    const cleanStrokes = (strokes as unknown[]).filter(
      (s): s is DrawStroke =>
        typeof s === "object" &&
        s !== null &&
        Array.isArray((s as Record<string, unknown>).points),
    );
    // Frame trống (strokes rỗng) thì giữ lại: frame trống có ý nghĩa
    // riêng, cắt mạch giữ hình để frame đó hiện không có nét. Chỉ bỏ
    // mục có nét nhưng toàn nét sai định dạng (lọc hết còn rỗng).
    const hadStrokes = (strokes as unknown[]).length > 0;
    if (cleanStrokes.length === 0 && hadStrokes) continue;
    const key = `${layerId}:${frame}`;
    const prev = merged.get(key);
    if (prev) {
      prev.strokes = [...prev.strokes, ...cleanStrokes];
      if (e.isKeyPose === true) prev.isKeyPose = true;
      if (typeof e.note === "string" && e.note.trim().length > 0) {
        prev.note = e.note;
      }
      continue;
    }
    merged.set(key, {
      id: typeof e.id === "string" && e.id.length > 0 ? e.id : newFrameDrawingId(),
      frame,
      layerId,
      strokes: cleanStrokes,
      isKeyPose: e.isKeyPose === true,
      note:
        typeof e.note === "string" && e.note.trim().length > 0
          ? e.note
          : undefined,
    });
  }
  return [...merged.values()].sort(
    (a, b) =>
      a.layerId.localeCompare(b.layerId) || a.frame - b.frame,
  );
}

/** Frame drawing của một (layer, frame), không có thì undefined. */
export function findFrameDrawing(
  drawings: readonly FrameDrawing[],
  layerId: string,
  frame: number,
): FrameDrawing | undefined {
  return drawings.find((d) => d.layerId === layerId && d.frame === frame);
}

/**
 * Nét vẽ của một layer tại thời điểm t.
 * - `hold = true` (mặc định, kiểu cel truyền thống): lấy nét của frame
 *   có drawing gần nhất mà không sau frame hiện tại, nét giữ tới frame
 *   có drawing tiếp theo.
 * - `hold = false`: chỉ frame hiện tại có vẽ mới hiện nét.
 */
export function frameStrokesAt(
  drawings: readonly FrameDrawing[],
  layerId: string,
  t: number,
  fps: number,
  durationSec: number,
  hold = true,
): DrawStroke[] {
  const index = frameIndex(t, fps, durationSec);
  const exact = findFrameDrawing(drawings, layerId, index);
  if (exact) return exact.strokes;
  if (!hold) return [];
  let best: FrameDrawing | undefined;
  for (const d of drawings) {
    if (d.layerId !== layerId || d.frame > index) continue;
    if (!best || d.frame > best.frame) best = d;
  }
  return best ? best.strokes : [];
}

/** Thêm một nét vào frame (tạo frame mới nếu chưa có). */
export function addStrokeToFrame(
  drawings: readonly FrameDrawing[],
  layerId: string,
  frame: number,
  stroke: DrawStroke,
): FrameDrawing[] {
  const existing = findFrameDrawing(drawings, layerId, frame);
  if (existing) {
    return drawings.map((d) =>
      d === existing ? { ...d, strokes: [...d.strokes, stroke] } : d,
    );
  }
  return [
    ...drawings,
    {
      id: newFrameDrawingId(),
      frame,
      layerId,
      strokes: [stroke],
      isKeyPose: false,
    },
  ];
}

/** Tạo một frame trống tại playhead (chưa vẽ ngay). Frame trống cắt
 * mạch giữ hình: khi phát tới frame đó thì không hiện nét. */
export function addEmptyFrameDrawing(
  drawings: readonly FrameDrawing[],
  layerId: string,
  frame: number,
): FrameDrawing[] {
  if (findFrameDrawing(drawings, layerId, frame)) return [...drawings];
  return [
    ...drawings,
    {
      id: newFrameDrawingId(),
      frame,
      layerId,
      strokes: [],
      isKeyPose: false,
    },
  ];
}

/** Xóa toàn bộ nét của một frame (không dời thời gian frame khác). */
export function removeFrameDrawing(
  drawings: readonly FrameDrawing[],
  layerId: string,
  frame: number,
): FrameDrawing[] {
  return drawings.filter((d) => !(d.layerId === layerId && d.frame === frame));
}

/**
 * Nhân đôi frame: copy toàn bộ nét sang frame đích (ghi đè frame đích
 * nếu đã có), nét copy mang id mới để không trùng với nét gốc.
 */
export function duplicateFrameDrawing(
  drawings: readonly FrameDrawing[],
  layerId: string,
  fromFrame: number,
  toFrame: number,
): FrameDrawing[] {
  if (fromFrame === toFrame) return [...drawings];
  const source = findFrameDrawing(drawings, layerId, fromFrame);
  if (!source) return [...drawings];
  const copied: FrameDrawing = {
    id: newFrameDrawingId(),
    frame: toFrame,
    layerId,
    strokes: source.strokes.map((s) => ({ ...s, id: newDrawStrokeId() })),
    isKeyPose: false,
  };
  return [
    ...drawings.filter((d) => !(d.layerId === layerId && d.frame === toFrame)),
    copied,
  ];
}

/** Đánh dấu hoặc bỏ đánh dấu key pose cho một frame (kèm tên tư thế). */
export function setFrameKeyPose(
  drawings: readonly FrameDrawing[],
  layerId: string,
  frame: number,
  isKeyPose: boolean,
  note?: string,
): FrameDrawing[] {
  const existing = findFrameDrawing(drawings, layerId, frame);
  if (existing) {
    return drawings.map((d) =>
      d === existing
        ? {
            ...d,
            isKeyPose,
            note: isKeyPose
              ? (note?.trim() ?? d.note)
              : undefined,
          }
        : d,
    );
  }
  if (!isKeyPose) return [...drawings];
  return [
    ...drawings,
    {
      id: newFrameDrawingId(),
      frame,
      layerId,
      strokes: [],
      isKeyPose: true,
      note: note?.trim() ? note.trim() : undefined,
    },
  ];
}

/**
 * Các frame có drawing gần nhất trước frame hiện tại (mới nhất trước),
 * tối đa `count` frame. Dùng cho onion skin luồng straight-ahead.
 */
export function ghostFramesBefore(
  drawings: readonly FrameDrawing[],
  layerId: string,
  frame: number,
  count: number,
): number[] {
  if (count <= 0) return [];
  return drawings
    .filter((d) => d.layerId === layerId && d.frame < frame)
    .map((d) => d.frame)
    .sort((a, b) => b - a)
    .slice(0, count);
}

/**
 * Các frame có drawing gần nhất sau frame hiện tại (gần nhất trước),
 * tối đa `count` frame. Dùng cho onion skin luồng straight-ahead.
 */
export function ghostFramesAfter(
  drawings: readonly FrameDrawing[],
  layerId: string,
  frame: number,
  count: number,
): number[] {
  if (count <= 0) return [];
  return drawings
    .filter((d) => d.layerId === layerId && d.frame > frame)
    .map((d) => d.frame)
    .sort((a, b) => a - b)
    .slice(0, count);
}

/**
 * Hai key pose kẹp giữa một frame (luồng pose-to-pose): key pose gần
 * nhất trước và gần nhất sau. Đứng đúng ở một key pose thì chỉ còn key
 * pose phía kia; ngoài khoảng key pose thì chỉ có một phía.
 */
export function bracketingKeyPoses(
  drawings: readonly FrameDrawing[],
  layerId: string,
  frame: number,
): { prev: number | null; next: number | null } {
  let prev: number | null = null;
  let next: number | null = null;
  for (const d of drawings) {
    if (d.layerId !== layerId || !d.isKeyPose) continue;
    if (d.frame < frame && (prev === null || d.frame > prev)) prev = d.frame;
    if (d.frame > frame && (next === null || d.frame < next)) next = d.frame;
  }
  return { prev, next };
}

/** Tổng số nét trong toàn bộ frame drawing của cảnh. */
export function countFrameStrokes(drawings: readonly FrameDrawing[]): number {
  return drawings.reduce((n, d) => n + d.strokes.length, 0);
}

/** Bỏ các frame drawing không còn nét nào (dọn dẹp), giữ key pose. */
export function removeEmptyFrameDrawings(
  drawings: readonly FrameDrawing[],
): FrameDrawing[] {
  return drawings.filter((d) => d.strokes.length > 0 || d.isKeyPose);
}

/**
 * Chỉ lấy nét bút (pen) để vẽ bóng onion skin: nét tẩy là hiệu chỉnh
 * trên chính frame của nó, vẽ bóng mà mang theo tẩy sẽ đục thủng cả
 * lớp dưới. Bóng chỉ là tham khảo mờ nên bỏ qua nét tẩy là đủ.
 */
export function penStrokesOnly(strokes: readonly DrawStroke[]): DrawStroke[] {
  return strokes.filter((s) => s.tool === "pen");
}

/**
 * Tư thế của layer / camera, chỉ lấy phần ảnh hưởng tới vị trí
 * (bỏ opacity, hiệu ứng). Dùng cho chuyển đổi tọa độ sân khấu <->
 * tọa độ local của layer (xem stagePointToLayerPoint).
 */
export interface LayerPose {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface CameraPose {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Đổi điểm sân khấu (tương đối 0..1 theo khung 16:9) sang tọa độ local
 * của layer (tương đối 0..1 theo hình chữ nhật cỡ sân khấu, gốc ở tâm
 * layer), để nét vẽ dính theo layer khi layer chuyển động. Chuỗi
 * transform ngược với cách drawLayer/drawSceneFrame dựng transform:
 * bỏ translate tâm, bỏ zoom camera, cộng lại tâm camera, trừ vị trí
 * layer, xoay ngược, chia scale. Khi layer đứng yên ở mặc định thì
 * điểm local bằng đúng điểm sân khấu.
 */
export function stagePointToLayerPoint(
  stage: { x: number; y: number },
  tr: LayerPose,
  cam: CameraPose,
  stageW: number,
  stageH: number,
): { x: number; y: number } {
  const px = stage.x * stageW;
  const py = stage.y * stageH;
  const zoom = cam.zoom === 0 ? 1 : cam.zoom;
  const scale = tr.scale === 0 ? 1 : tr.scale;
  const x1 = (px - stageW / 2) / zoom;
  const y1 = (py - stageH / 2) / zoom;
  const x2 = x1 + cam.x * stageW;
  const y2 = y1 + cam.y * stageH;
  const x3 = x2 - tr.x * stageW;
  const y3 = y2 - tr.y * stageH;
  const rad = (-tr.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const x4 = x3 * cos - y3 * sin;
  const y4 = x3 * sin + y3 * cos;
  const lx = x4 / scale;
  const ly = y4 / scale;
  return { x: (lx + stageW / 2) / stageW, y: (ly + stageH / 2) / stageH };
}

/**
 * Ngược lại: điểm local của layer sang điểm sân khấu (tương đối 0..1),
 * dùng để vẽ lại nét nháp đang vẽ dở lên trên mọi layer. Vòng đi-về
 * stage -> local -> stage phải trả đúng điểm ban đầu.
 */
export function layerPointToStagePoint(
  local: { x: number; y: number },
  tr: LayerPose,
  cam: CameraPose,
  stageW: number,
  stageH: number,
): { x: number; y: number } {
  const lx = (local.x - 0.5) * stageW;
  const ly = (local.y - 0.5) * stageH;
  const rad = (tr.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const x1 = (lx * cos - ly * sin) * tr.scale;
  const y1 = (lx * sin + ly * cos) * tr.scale;
  const x2 = x1 + tr.x * stageW;
  const y2 = y1 + tr.y * stageH;
  const x3 = x2 - cam.x * stageW;
  const y3 = y2 - cam.y * stageH;
  const x4 = x3 * cam.zoom;
  const y4 = y3 * cam.zoom;
  const px = x4 + stageW / 2;
  const py = y4 + stageH / 2;
  return { x: px / stageW, y: py / stageH };
}
