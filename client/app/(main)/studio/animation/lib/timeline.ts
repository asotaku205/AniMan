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

// ── Layer & timeline của một cảnh ────────────────────────────────────────────

export interface SceneLayer {
  id: string;
  name: string;
  /** Màu nền của layer khi chưa có hình (thẻ màu để dựng bố cục). */
  color: string;
  /** Hình của layer (data URL) — panel manga nạp ở slice sau, upload tay cũng vào đây. */
  imageDataUrl: string | null;
  visible: boolean;
  keys: TransformKey[];
  motions: LayerMotion[];
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

/** Transform hiệu dụng của layer tại t = keyframe nội suy + chuyển động tham số. */
export function sampleLayerTransform(layer: SceneLayer, t: number): Transform {
  return applyLayerMotions(sampleTransform(layer.keys, t), layer.motions, t);
}
