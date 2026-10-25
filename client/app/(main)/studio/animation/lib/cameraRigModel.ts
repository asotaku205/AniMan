/**
 * Mô hình máy quay (kiểu Blender/Maya: camera là vật thể trong scene) —
 * toán thuần, không WebGL, để khung chóp + kéo máy quay kiểm thử được.
 *
 * Quy ước: mô hình máy quay xây theo trục +Z (ống kính nhô về +Z);
 * component dùng Object3D.lookAt(điểm nhìn) để +Z chỉ về điểm nhìn.
 * Hệ tọa độ: Y lên, X phải khi nhìn theo hướng máy.
 */

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

const sub = (a: Vec3Like, b: Vec3Like): Vec3Like => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
const cross = (a: Vec3Like, b: Vec3Like): Vec3Like => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const dot = (a: Vec3Like, b: Vec3Like): number =>
  a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Vec3Like): number => Math.hypot(a.x, a.y, a.z);
const norm = (a: Vec3Like): Vec3Like => {
  const l = len(a);
  return l < 1e-9 ? { x: 0, y: 0, z: 0 } : { x: a.x / l, y: a.y / l, z: a.z / l };
};

export interface CameraBasis {
  /** Hướng nhìn (vị trí → điểm nhìn), đã chuẩn hoá. */
  forward: Vec3Like;
  /** Phải của máy (nhìn theo hướng máy), đã chuẩn hoá. */
  right: Vec3Like;
  /** Trên của máy, đã chuẩn hoá. */
  up: Vec3Like;
}

/** 3 trục trực chuẩn của máy quay tại vị trí, nhìn về điểm nhìn. */
export function cameraBasis(position: Vec3Like, target: Vec3Like): CameraBasis {
  let forward = norm(sub(target, position));
  if (len(forward) < 1e-9) forward = { x: 0, y: 0, z: -1 };
  let right = cross(forward, { x: 0, y: 1, z: 0 });
  if (len(right) < 1e-6) {
    // Nhìn thẳng lên/xuống: lấy trục X làm phải để không suy biến.
    right = { x: 1, y: 0, z: 0 };
  }
  right = norm(right);
  const up = norm(cross(right, forward));
  return { forward, right, up };
}

export interface FrustumRect {
  /** Góc theo thứ tự: trên-trái, trên-phải, dưới-phải, dưới-trái
   * (nhìn từ phía sau máy, theo hướng máy). */
  corners: [Vec3Like, Vec3Like, Vec3Like, Vec3Like];
}

function rectAt(
  position: Vec3Like,
  basis: CameraBasis,
  dist: number,
  halfW: number,
  halfH: number,
): FrustumRect {
  const c = {
    x: position.x + basis.forward.x * dist,
    y: position.y + basis.forward.y * dist,
    z: position.z + basis.forward.z * dist,
  };
  const off = (sx: number, sy: number): Vec3Like => ({
    x: c.x + basis.right.x * sx * halfW + basis.up.x * sy * halfH,
    y: c.y + basis.right.y * sx * halfW + basis.up.y * sy * halfH,
    z: c.z + basis.right.z * sx * halfW + basis.up.z * sy * halfH,
  });
  return { corners: [off(-1, 1), off(1, 1), off(1, -1), off(-1, -1)] };
}

/** 2 khung của chóp (gần + xa) từ fov (độ), tỉ lệ khung, khoảng gần/xa. */
export function frustumCorners(
  position: Vec3Like,
  target: Vec3Like,
  fovDeg: number,
  aspect: number,
  near: number,
  far: number,
): { near: FrustumRect; far: FrustumRect } {
  const basis = cameraBasis(position, target);
  const tanHalf = Math.tan(((fovDeg / 2) * Math.PI) / 180);
  return {
    near: rectAt(position, basis, near, tanHalf * near * aspect, tanHalf * near),
    far: rectAt(position, basis, far, tanHalf * far * aspect, tanHalf * far),
  };
}

/** 12 đoạn vẽ chóp: 4 cạnh khung gần + 4 cạnh khung xa + 4 đường nối. */
export function frustumLineSegments(
  position: Vec3Like,
  target: Vec3Like,
  fovDeg: number,
  aspect: number,
  near: number,
  far: number,
): Array<[Vec3Like, Vec3Like]> {
  const { near: n, far: f } = frustumCorners(
    position,
    target,
    fovDeg,
    aspect,
    near,
    far,
  );
  const segs: Array<[Vec3Like, Vec3Like]> = [];
  for (let i = 0; i < 4; i++) {
    segs.push([n.corners[i], n.corners[(i + 1) % 4]]);
    segs.push([f.corners[i], f.corners[(i + 1) % 4]]);
  }
  for (let i = 0; i < 4; i++) segs.push([n.corners[i], f.corners[i]]);
  // Sắp lại: 4 đoạn khung gần, 4 đoạn khung xa, rồi 4 đường nối — để
  // test và code vẽ không phải đoán thứ tự.
  const ordered: Array<[Vec3Like, Vec3Like]> = [];
  for (let i = 0; i < 4; i++) ordered.push(segs[i * 2]);
  for (let i = 0; i < 4; i++) ordered.push(segs[i * 2 + 1]);
  for (let i = 0; i < 4; i++) ordered.push(segs[8 + i]);
  return ordered;
}

/** Độ dài khung chóp hiển thị: xa hơn điểm nhìn 2m, tối thiểu 4m. */
export function frustumFar(position: Vec3Like, target: Vec3Like): number {
  return Math.max(4, len(sub(target, position)) + 2);
}

/** Giao của tia (gốc + hướng) với mặt phẳng; null khi song song/quay lưng. */
export function rayPlanePoint(
  origin: Vec3Like,
  direction: Vec3Like,
  planePoint: Vec3Like,
  planeNormal: Vec3Like,
): Vec3Like | null {
  const denom = dot(planeNormal, direction);
  if (Math.abs(denom) < 1e-9) return null;
  const t = dot(planeNormal, sub(planePoint, origin)) / denom;
  if (t < 0) return null;
  return {
    x: origin.x + direction.x * t,
    y: origin.y + direction.y * t,
    z: origin.z + direction.z * t,
  };
}

/** Kẹp vị trí máy quay khi kéo: x/z như kéo vật thể (±14), y 0.2..20m. */
export function clampCameraDrag(pos: Vec3Like): Vec3Like {
  return {
    x: Math.max(-14, Math.min(14, pos.x)),
    y: Math.max(0.2, Math.min(20, pos.y)),
    z: Math.max(-14, Math.min(14, pos.z)),
  };
}
