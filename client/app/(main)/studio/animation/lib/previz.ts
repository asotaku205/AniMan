/**
 * Previz 3D (Lớp A của workspace 3D) — mô hình thuần:
 *
 * Cảnh 3D gồm vật thể (nhân vật mannequin có pose, đạo cụ khối, tường,
 * sàn) và một camera phim có keyframe riêng; mọi thứ nội suy theo easing
 * dùng chung với timeline 2D (`lib/timeline.ts`) nên cảm giác chuyển
 * động nhất quán hai workspace. Việc dựng hình Three.js nằm ở component;
 * file này chỉ giữ dữ liệu + toán học (kiểm thử được, không WebGL).
 */

import { EASING_FNS, sortKeys, type EasingId } from "./timeline";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpVec = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
});

// ── Pose nhân vật (góc khớp tính bằng độ) ─────────────────────────────────────

export interface CharacterPose {
  armL: number;
  armR: number;
  legL: number;
  legR: number;
  headTilt: number;
  /** Gập người về trước (độ). */
  lean: number;
}

export const POSE_OPTIONS: Array<{ id: string; label: string; pose: CharacterPose }> = [
  { id: "stand", label: "Đứng thẳng", pose: { armL: 8, armR: 8, legL: 0, legR: 0, headTilt: 0, lean: 0 } },
  { id: "walk", label: "Đang đi (giữa bước)", pose: { armL: -25, armR: 25, legL: 28, legR: -28, headTilt: 0, lean: 4 } },
  { id: "run", label: "Đang chạy", pose: { armL: -55, armR: 55, legL: 55, legR: -45, headTilt: 0, lean: 14 } },
  { id: "sit", label: "Ngồi", pose: { armL: 20, armR: 20, legL: 85, legR: 85, headTilt: 0, lean: 2 } },
  { id: "wave", label: "Vẫy tay", pose: { armL: 8, armR: 165, legL: 0, legR: 0, headTilt: -6, lean: 0 } },
  { id: "bow", label: "Cúi chào", pose: { armL: 12, armR: 12, legL: 0, legR: 0, headTilt: 18, lean: 32 } },
  { id: "point", label: "Chỉ tay", pose: { armL: 8, armR: 88, legL: 0, legR: 6, headTilt: 0, lean: 2 } },
];

export function poseById(id: string): CharacterPose {
  return POSE_OPTIONS.find((p) => p.id === id)?.pose ?? POSE_OPTIONS[0].pose;
}

function lerpPose(a: CharacterPose, b: CharacterPose, t: number): CharacterPose {
  return {
    armL: lerp(a.armL, b.armL, t),
    armR: lerp(a.armR, b.armR, t),
    legL: lerp(a.legL, b.legL, t),
    legR: lerp(a.legR, b.legR, t),
    headTilt: lerp(a.headTilt, b.headTilt, t),
    lean: lerp(a.lean, b.lean, t),
  };
}

// ── Vật thể & keyframe ───────────────────────────────────────────────────────

export type PrevizObjectKind =
  | "character"
  | "box"
  | "cylinder"
  | "wall"
  | "model";

export interface PrevizKey {
  id: string;
  timeSec: number;
  position: Vec3;
  rotationY: number;
  /** Pose tại key này (chỉ nhân vật dùng). */
  poseId: string;
  /** Phát sáng tại key này (R3) — bỏ trống = dùng mức phát sáng chung
   * của vật thể; đặt số ở các key để phát sáng thay đổi theo thời gian. */
  glow?: number;
  easing: EasingId;
}

/** Một đoạn hành động trên timeline (Phase 4): phát clip xương của
 * model trong khoảng [startSec, startSec + durationSec). Clip lấy từ
 * file GLB của model, hoặc từ file khác gắn thêm (xem clipSources bên
 * dưới — ví dụ clip Mixamo đã khớp sang nhân vật này). */
export interface ActionSegment {
  id: string;
  clipName: string;
  startSec: number;
  durationSec: number;
  /** Lặp clip tới hết đoạn (mặc định lặp). */
  loop: boolean;
  /** Tốc độ phát (1 = đúng tốc độ gốc). */
  speed: number;
}

/** Chuyển động gắn thêm từ một file .glb khác (không phải file của model). */
export interface ClipSource {
  /** Mã tài sản file nguồn trong thư viện. */
  assetId: string;
  /** Tên chuyển động trong file nguồn. */
  clipName: string;
}

export interface PrevizObject {
  id: string;
  kind: PrevizObjectKind;
  name: string;
  /** Rãnh hành động (chỉ kind "model" dùng) — xem lib/actionTrack.ts. */
  actions?: ActionSegment[];
  /** Rãnh dáng mốc tự dựng (chỉ kind "model" dùng) — xem lib/poseTrack.ts.
   * Chỉ phát khi không có đoạn clip nào đang chạy tại thời điểm đó. */
  poseKeys?: import("./poseTrack").PoseKey[];
  /** Mã tài sản mô hình (chỉ kind "model" dùng) — trỏ vào thư viện tài sản. */
  modelAssetId?: string;
  /** Chuyển động gắn thêm từ file khác (chỉ kind "model" dùng) — lúc
   * nạp cảnh, mỗi nguồn được khớp sang xương nhân vật này rồi mới phát
   * (xem lib/clipRetarget). Lưu cùng dự án nên F5 vẫn còn. */
  clipSources?: ClipSource[];
  /** Phát sáng 0..1 (S2) — áp emissive cho vật thể 3D. */
  glow?: number;
  color: string;
  /** Kích thước cơ sở (mét) — nhân vật dùng chiều cao tổng. */
  size: number;
  keys: PrevizKey[];
}

export interface PrevizCameraKey {
  id: string;
  timeSec: number;
  position: Vec3;
  target: Vec3;
  easing: EasingId;
}

export interface PrevizScene {
  objects: PrevizObject[];
  cameraKeys: PrevizCameraKey[];
  /** Sự kiện hiệu ứng 3D gắn timeline (Phase 5). */
  effectEvents?: import("./effectFormula").EffectEvent[];
  /** Màu nền trời/sân khấu của cảnh. */
  backdrop: string;
}

let previzCounter = 0;
export function newPrevizId(prefix: string): string {
  previzCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${previzCounter.toString(36)}`;
}

export function createPrevizObject(
  kind: PrevizObjectKind,
  name: string,
): PrevizObject {
  const colors: Record<PrevizObjectKind, string> = {
    character: "#e8b4a0",
    box: "#8a6d4b",
    cylinder: "#5b7a99",
    wall: "#4a4360",
    model: "#9a8fb5",
  };
  return {
    id: newPrevizId("obj"),
    kind,
    name,
    color: colors[kind],
    size: kind === "character" ? 1.7 : 1,
    keys: [
      {
        id: newPrevizId("pkey"),
        timeSec: 0,
        position: vec3(0, 0, 0),
        rotationY: 0,
        poseId: "stand",
        easing: "ease-in-out",
      },
    ],
  };
}

export function createPrevizScene(): PrevizScene {
  const hero = createPrevizObject("character", "Nhân vật chính");
  return {
    objects: [hero],
    cameraKeys: [
      {
        id: newPrevizId("camkey"),
        timeSec: 0,
        position: vec3(0, 1.6, 6),
        target: vec3(0, 1.1, 0),
        easing: "ease-in-out",
      },
    ],
    backdrop: "#141126",
  };
}

export interface SampledObject {
  position: Vec3;
  rotationY: number;
  pose: CharacterPose;
  /** Mức phát sáng nội suy tại t (R3). */
  glow: number;
}

/** Nội suy một vật thể tại t: key đầu/cuối giữ nguyên, giữa hai key theo easing của key trước. */
export function samplePrevizObject(obj: PrevizObject, t: number): SampledObject {
  const keys = sortKeys(obj.keys);
  const glowOf = (k: PrevizKey): number => k.glow ?? obj.glow ?? 0;
  if (keys.length === 0) {
    return { position: vec3(), rotationY: 0, pose: poseById("stand"), glow: obj.glow ?? 0 };
  }
  if (t <= keys[0].timeSec) {
    return {
      position: { ...keys[0].position },
      rotationY: keys[0].rotationY,
      pose: poseById(keys[0].poseId),
      glow: glowOf(keys[0]),
    };
  }
  const last = keys[keys.length - 1];
  if (t >= last.timeSec) {
    return {
      position: { ...last.position },
      rotationY: last.rotationY,
      pose: poseById(last.poseId),
      glow: glowOf(last),
    };
  }
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t >= a.timeSec && t <= b.timeSec) {
      const span = b.timeSec - a.timeSec;
      const local = span <= 0 ? 1 : (t - a.timeSec) / span;
      const e = EASING_FNS[a.easing](local);
      return {
        position: lerpVec(a.position, b.position, e),
        rotationY: lerp(a.rotationY, b.rotationY, e),
        pose: lerpPose(poseById(a.poseId), poseById(b.poseId), e),
        glow: lerp(glowOf(a), glowOf(b), e),
      };
    }
  }
  return {
    position: { ...last.position },
    rotationY: last.rotationY,
    pose: poseById(last.poseId),
    glow: glowOf(last),
  };
}

export interface SampledCamera {
  position: Vec3;
  target: Vec3;
}

export function samplePrevizCamera(
  keys: readonly PrevizCameraKey[],
  t: number,
): SampledCamera {
  const sorted = sortKeys(keys);
  if (sorted.length === 0) {
    return { position: vec3(0, 1.6, 6), target: vec3(0, 1.1, 0) };
  }
  if (t <= sorted[0].timeSec) {
    return { position: { ...sorted[0].position }, target: { ...sorted[0].target } };
  }
  const last = sorted[sorted.length - 1];
  if (t >= last.timeSec) {
    return { position: { ...last.position }, target: { ...last.target } };
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (t >= a.timeSec && t <= b.timeSec) {
      const span = b.timeSec - a.timeSec;
      const local = span <= 0 ? 1 : (t - a.timeSec) / span;
      const e = EASING_FNS[a.easing](local);
      return {
        position: lerpVec(a.position, b.position, e),
        target: lerpVec(a.target, b.target, e),
      };
    }
  }
  return { position: { ...last.position }, target: { ...last.target } };
}

/** Ghi đè/thêm key vật thể tại thời điểm (cùng timeSec → thay thế). */
export function upsertPrevizKey(
  keys: readonly PrevizKey[],
  key: PrevizKey,
): PrevizKey[] {
  const rest = keys.filter((k) => Math.abs(k.timeSec - key.timeSec) > 1e-6);
  return sortKeys([...rest, key]);
}

export function upsertPrevizCameraKey(
  keys: readonly PrevizCameraKey[],
  key: PrevizCameraKey,
): PrevizCameraKey[] {
  const rest = keys.filter((k) => Math.abs(k.timeSec - key.timeSec) > 1e-6);
  return sortKeys([...rest, key]);
}
