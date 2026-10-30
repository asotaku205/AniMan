/**
 * Lõi timeline 2D — module sâu của workspace 2D: toàn bộ toán học keyframe
 * nằm ở đây dưới dạng hàm thuần (component chỉ gọi vào):
 *
 * - `sampleTransform`/`sampleCamera`: nội suy giữa 2 key theo easing của
 *   key trước — thời gian là tham số, không đọc clock → deterministic,
 *   phát thử và xuất bản cho kết quả giống hệt nhau.
 * - Chuyển động tham số (`applyLayerMotions`): các chuyển động nhỏ kiểu
 *   nhân vật (thở, lay, nhấp nhô) cộng dồn lên transform theo tham số
 *   cường độ/tốc độ/pha — người dùng tinh chỉnh bằng slider, không cần AI.
 * - Chuyển động lặp (`MotionInstance`) + đường đi vẽ tay (`MotionPath`):
 *   đánh giá SAU keyframe + chuyển động tham số trong sampleLayerTransform,
 *   nên xem thử, xuất phim và thumbnail dùng chung một kết quả. Instance
 *   lặp chiếm quyền layer từ thời điểm bắt đầu của nó; đường đi chỉ ghi
 *   đè vị trí (và xoay khi orientToPath) trong đoạn thời gian của nó.
 * - Camera là một track keyframe riêng (pan/zoom), độc lập với layer.
 */

export type EasingId =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "back"
  | "bounce"
  | "elastic";

export const EASING_OPTIONS: Array<{ id: EasingId; label: string }> = [
  { id: "linear", label: "Đều (linear)" },
  { id: "ease-in", label: "Chậm → nhanh" },
  { id: "ease-out", label: "Nhanh → chậm" },
  { id: "ease-in-out", label: "Mềm hai đầu" },
  { id: "back", label: "Lấy đà (back)" },
  { id: "bounce", label: "Nảy (bounce)" },
  { id: "elastic", label: "Đàn hồi (elastic)" },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const EASING_FNS: Record<EasingId, (t: number) => number> = {
  linear: (t) => clamp01(t),
  "ease-in": (t) => t * t * t,
  "ease-out": (t) => 1 - Math.pow(1 - t, 3),
  "ease-in-out": (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  back: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  bounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  elastic: (t) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

/** Điểm đồ thị easing (cho SVG xem trước) — 25 mẫu từ 0..1. */
export function easingCurvePoints(id: EasingId, samples = 25): Array<{ x: number; y: number }> {
  const fn = EASING_FNS[id];
  return Array.from({ length: samples + 1 }, (_, i) => {
    const x = i / samples;
    return { x, y: fn(x) };
  });
}

// ── Transform & keyframe ─────────────────────────────────────────────────────

export interface Transform {
  /** Tâm của layer, normalized theo sân khấu (0..1). */
  x: number;
  y: number;
  scale: number;
  /** Độ, xoay quanh tâm. */
  rotation: number;
  opacity: number;
}

export const IDENTITY_TRANSFORM: Transform = {
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
  opacity: 1,
};

export interface TransformKey {
  id: string;
  timeSec: number;
  transform: Transform;
  /** Easing áp cho đoạn TỪ key này TỚI key sau. */
  easing: EasingId;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function lerpTransform(a: Transform, b: Transform, t: number): Transform {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    scale: lerp(a.scale, b.scale, t),
    rotation: lerp(a.rotation, b.rotation, t),
    opacity: lerp(a.opacity, b.opacity, t),
  };
}

/** Sắp xếp key theo thời gian (không sửa mảng gốc). */
export function sortKeys<T extends { timeSec: number }>(keys: readonly T[]): T[] {
  return [...keys].sort((a, b) => a.timeSec - b.timeSec);
}

/**
 * Dời một key sang thời điểm mới, giữ thứ tự thời gian (không sửa mảng
 * gốc). Dùng chung cho dải timeline 2D và 3D khi kéo key bằng chuột.
 */
export function retimeKey<T extends { id: string; timeSec: number }>(
  keys: readonly T[],
  keyId: string,
  timeSec: number,
): T[] {
  return sortKeys(
    keys.map((k) => (k.id === keyId ? { ...k, timeSec } : k)),
  );
}

/** Xóa một key theo id (không sửa mảng gốc). */
export function removeKey<T extends { id: string }>(
  keys: readonly T[],
  keyId: string,
): T[] {
  return keys.filter((k) => k.id !== keyId);
}

/**
 * Nội suy transform tại thời điểm t: trước key đầu → giữ key đầu, sau key
 * cuối → giữ key cuối, giữa hai key → easing của key trước.
 */
export function sampleTransform(keys: readonly TransformKey[], t: number): Transform {
  if (keys.length === 0) return { ...IDENTITY_TRANSFORM };
  const sorted = sortKeys(keys);
  if (t <= sorted[0].timeSec) return { ...sorted[0].transform };
  const last = sorted[sorted.length - 1];
  if (t >= last.timeSec) return { ...last.transform };
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (t >= a.timeSec && t <= b.timeSec) {
      const span = b.timeSec - a.timeSec;
      const local = span <= 0 ? 1 : (t - a.timeSec) / span;
      return lerpTransform(a.transform, b.transform, EASING_FNS[a.easing](local));
    }
  }
  return { ...last.transform };
}

/** Thêm/ghi đè key tại cùng thời điểm (cùng timeSec → thay thế). */
export function upsertTransformKey(
  keys: readonly TransformKey[],
  key: TransformKey,
): TransformKey[] {
  const rest = keys.filter((k) => Math.abs(k.timeSec - key.timeSec) > 1e-6);
  return sortKeys([...rest, key]);
}

export function removeTransformKey(
  keys: readonly TransformKey[],
  keyId: string,
): TransformKey[] {
  return keys.filter((k) => k.id !== keyId);
}

// ── Camera ───────────────────────────────────────────────────────────────────

export interface CameraState {
  /** Tâm khung nhìn, normalized theo sân khấu. */
  x: number;
  y: number;
  zoom: number;
}

export const IDENTITY_CAMERA: CameraState = { x: 0.5, y: 0.5, zoom: 1 };

export interface CameraKey {
  id: string;
  timeSec: number;
  camera: CameraState;
  easing: EasingId;
}

export function sampleCamera(keys: readonly CameraKey[], t: number): CameraState {
  if (keys.length === 0) return { ...IDENTITY_CAMERA };
  const sorted = sortKeys(keys);
  if (t <= sorted[0].timeSec) return { ...sorted[0].camera };
  const last = sorted[sorted.length - 1];
  if (t >= last.timeSec) return { ...last.camera };
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (t >= a.timeSec && t <= b.timeSec) {
      const span = b.timeSec - a.timeSec;
      const local = span <= 0 ? 1 : (t - a.timeSec) / span;
      const e = EASING_FNS[a.easing](local);
      return {
        x: lerp(a.camera.x, b.camera.x, e),
        y: lerp(a.camera.y, b.camera.y, e),
        zoom: lerp(a.camera.zoom, b.camera.zoom, e),
      };
    }
  }
  return { ...last.camera };
}

export function upsertCameraKey(
  keys: readonly CameraKey[],
  key: CameraKey,
): CameraKey[] {
  const rest = keys.filter((k) => Math.abs(k.timeSec - key.timeSec) > 1e-6);
  return sortKeys([...rest, key]);
}

// ── Chuyển động tham số (nhân vật) ───────────────────────────────────────────

export type LayerMotionKind = "breath" | "sway" | "bob" | "pulse";

export const LAYER_MOTION_OPTIONS: Array<{ id: LayerMotionKind; label: string }> = [
  { id: "breath", label: "Thở nhè nhẹ" },
  { id: "sway", label: "Lay ngang (tóc/váy)" },
  { id: "bob", label: "Nhấp nhô" },
  { id: "pulse", label: "Phồng nhịp (nhấn mạnh)" },
];

export interface LayerMotion {
  id: string;
  kind: LayerMotionKind;
  /** 0..1 — biên độ chuyển động. */
  intensity: number;
  /** Chu kỳ mỗi giây (Hz). */
  speed: number;
  /** Lệch pha 0..1 (để các layer không chuyển động đồng loạt như robot). */
  phase: number;
}

/**
 * Cộng chuyển động tham số vào transform tại thời điểm t. Thuần sin theo
 * (t × speed + phase) — deterministic tuyệt đối, chỉnh bằng slider.
 */
export function applyLayerMotions(
  base: Transform,
  motions: readonly LayerMotion[],
  t: number,
): Transform {
  let out = { ...base };
  for (const m of motions) {
    const wave = Math.sin((t * m.speed + m.phase) * Math.PI * 2);
    const amp = Math.min(1, Math.max(0, m.intensity));
    switch (m.kind) {
      case "breath":
        out = { ...out, scale: out.scale * (1 + wave * 0.02 * amp) };
        break;
      case "sway":
        out = { ...out, x: out.x + wave * 0.012 * amp, rotation: out.rotation + wave * 1.2 * amp };
        break;
      case "bob":
        out = { ...out, y: out.y + wave * 0.015 * amp };
        break;
      case "pulse":
        out = { ...out, scale: out.scale * (1 + Math.max(0, wave) * 0.05 * amp) };
        break;
    }
  }
  return out;
}

// ── Chuyển động gắn thêm: lặp + đường đi ────────────────────────────────

export type MotionLoop = "once" | "loop" | "pingpong";
export type MotionDirection = "left" | "right" | "bottom";

export interface MotionParams {
  startSec: number;
  durationSec: number;
  direction: MotionDirection;
  strength: number;
  easing: EasingId;
  loop: MotionLoop;
}

/** Một mẫu chuyển động đang chạy lặp trên layer (loop/pingpong). */
export interface MotionInstance {
  id: string;
  presetId: string;
  name: string;
  params: MotionParams;
  /** Keys của MỘT chu kỳ, thời gian TƯƠNG ĐỐI 0..durationSec. */
  cycleKeys: TransformKey[];
}

/** Đường đi vẽ tay gắn trên layer (tọa độ thế giới, normalized 0..1). */
export interface MotionPath {
  id: string;
  points: Array<{ x: number; y: number }>;
  startSec: number;
  durationSec: number;
  orientToPath: boolean;
  easing: EasingId;
}

/**
 * Thay các key nằm trong đoạn [startSec, endSec] bằng keys mới sinh —
 * áp mẫu không để 2 key cùng thời điểm gây nội suy giật, key ngoài đoạn
 * giữ nguyên. Dung sai 1e-6 như upsertTransformKey.
 */
export function replaceKeysInRange(
  keys: readonly TransformKey[],
  startSec: number,
  endSec: number,
  generated: readonly TransformKey[],
): TransformKey[] {
  let out = keys.filter(
    (k) => k.timeSec < startSec - 1e-6 || k.timeSec > endSec + 1e-6,
  );
  for (const g of generated) out = upsertTransformKey(out, g);
  return sortKeys(out);
}

/**
 * Đánh giá instance lặp tại t: trước startSec → null (chưa chiếm quyền);
 * loop → lặp chu kỳ, pingpong → đi rồi về trong chu kỳ kép 2×duration.
 * Instance "once" không tồn tại ở runtime (đã bake thành keys) nhưng nếu
 * có thì kẹp ở cuối chu kỳ thay vì lặp.
 */
export function sampleMotionInstance(
  inst: MotionInstance,
  t: number,
): Transform | null {
  const dur = Math.max(0.05, inst.params.durationSec);
  const local0 = t - inst.params.startSec;
  if (local0 < 0) return null;
  let local: number;
  if (inst.params.loop === "loop") {
    local = local0 % dur;
  } else if (inst.params.loop === "pingpong") {
    const period = dur * 2;
    const m = local0 % period;
    local = m <= dur ? m : period - m;
  } else {
    local = Math.min(local0, dur);
  }
  return sampleTransform(inst.cycleKeys, local);
}

/** Điểm trên đường cong Catmull-Rom đều đi qua các điểm user bấm. */
export function catmullRomPoint(
  points: readonly { x: number; y: number }[],
  u: number,
): { x: number; y: number } {
  if (points.length === 0) return { x: 0.5, y: 0.5 };
  if (points.length === 1) return { ...points[0] };
  const clamped = clamp01(u);
  const segs = points.length - 1;
  const f = clamped * segs;
  const i = Math.min(Math.floor(f), segs - 1);
  const local = f - i;
  const p0 = points[Math.max(0, i - 1)];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[Math.min(points.length - 1, i + 2)];
  const t2 = local * local;
  const t3 = t2 * local;
  const blend = (a: number, b: number, c: number, d: number) =>
    0.5 *
    (2 * b +
      (-a + c) * local +
      (2 * a - 5 * b + 4 * c - d) * t2 +
      (-a + 3 * b - 3 * c + d) * t3);
  return { x: blend(p0.x, p1.x, p2.x, p3.x), y: blend(p0.y, p1.y, p2.y, p3.y) };
}

/** Góc tiếp tuyến của đường tại u (độ, hệ trục màn hình: y hướng xuống,
 *  khớp chiều xoay dương của ctx.rotate). */
export function catmullRomAngle(
  points: readonly { x: number; y: number }[],
  u: number,
): number {
  const e = 0.01;
  const a = catmullRomPoint(points, Math.max(0, u - e));
  const b = catmullRomPoint(points, Math.min(1, u + e));
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/** Vị trí (+ góc xoay nếu orientToPath) trên đường tại t; ngoài đoạn → null. */
export function sampleMotionPath(
  path: MotionPath,
  t: number,
): { x: number; y: number; rotation: number | null } | null {
  const dur = Math.max(0.05, path.durationSec);
  if (t < path.startSec || t > path.startSec + dur) return null;
  const progress = EASING_FNS[path.easing]((t - path.startSec) / dur);
  const pt = catmullRomPoint(path.points, progress);
  return {
    x: pt.x,
    y: pt.y,
    rotation: path.orientToPath ? catmullRomAngle(path.points, progress) : null,
  };
}

// ── Layer & timeline của một cảnh ────────────────────────────────────────────

export interface SceneLayer {
  id: string;
  name: string;
  /** Màu nền của layer khi chưa có hình (thẻ màu để dựng bố cục). */
  color: string;
  /** Hình của layer (data URL) — panel manga nạp ở slice sau, upload tay cũng vào đây. */
  imageDataUrl: string | null;
  /** Cách khớp ảnh vào sân khấu; ảnh tải lên mới mặc định giữ trọn ảnh. */
  imageFit?: "cover" | "contain";
  visible: boolean;
  keys: TransformKey[];
  motions: LayerMotion[];
  /** Mẫu chuyển động đang chạy lặp (loop/pingpong) — xem sampleMotionInstance. */
  motionInstances?: MotionInstance[];
  /** Đường đi vẽ tay — xem sampleMotionPath. */
  motionPath?: MotionPath | null;
  /** Hiệu ứng của layer (S2) — xem lib/layerEffects.ts. */
  effects?: Partial<import("./layerEffects").LayerEffects>;
  /** Mốc hiệu ứng theo thời gian (R3) — khi có, các giá trị rung/phát
   * sáng/phồng/độ mờ nội suy theo mốc thay cho giá trị tĩnh ở trên. */
  effectKeys?: import("./layerEffects").LayerEffectKey[];
}

export interface SceneTimeline {
  layers: SceneLayer[];
  cameraKeys: CameraKey[];
}

export function createSceneLayer(name: string, color = "#3b2d5c"): SceneLayer {
  return {
    id: `layer-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    name,
    color,
    imageDataUrl: null,
    visible: true,
    keys: [],
    motions: [],
  };
}

export function createSceneTimeline(): SceneTimeline {
  return { layers: [createSceneLayer("Lớp 1", "#3b2d5c")], cameraKeys: [] };
}

/**
 * Transform hiệu dụng của layer tại t, theo thứ tự: keyframe nội suy →
 * instance lặp chiếm quyền (nếu đang hoạt động) → chuyển động tham số →
 * đường đi ghi đè vị trí/xoay (nếu trong đoạn của nó). Thứ tự này giữ
 * nguyên hành vi cũ khi layer không có instance/đường.
 */
export function sampleLayerTransform(layer: SceneLayer, t: number): Transform {
  let base = sampleTransform(layer.keys, t);
  const instances = layer.motionInstances ?? [];
  for (let i = instances.length - 1; i >= 0; i--) {
    const s = sampleMotionInstance(instances[i], t);
    if (s) {
      base = s;
      break;
    }
  }
  let tr = applyLayerMotions(base, layer.motions, t);
  if (layer.motionPath) {
    const p = sampleMotionPath(layer.motionPath, t);
    if (p) {
      tr = {
        ...tr,
        x: p.x,
        y: p.y,
        ...(p.rotation !== null ? { rotation: p.rotation } : {}),
      };
    }
  }
  return tr;
}
