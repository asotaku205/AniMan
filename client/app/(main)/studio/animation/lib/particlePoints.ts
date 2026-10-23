/**
 * Hạt tự chế 3D (R3): THREE.Points cho hệ hạt của cảnh 3D — dùng chung
 * giữa trình dựng cảnh và bản xuất phim. Vị trí lấy từ cùng hàm thuần
 * `particlePointsAt` với bản 2D (ánh xạ toạ độ khung 0..1 sang mặt
 * phẳng thế giới trước sân khấu), nên thông số người dùng đặt ra hạt
 * giống nhau ở mọi nơi.
 */

import * as THREE from "three";
import {
  particlePointsAt,
  type ParticleSystemSettings,
} from "./particles";

const MAX = 400;
const WORLD_W = 26;
const WORLD_H = 11;

function depthOf(i: number): number {
  const x = Math.sin(i * 91.7 + 13.3) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 7;
}

export function createParticlePoints(
  sys: ParticleSystemSettings,
): THREE.Points {
  const positions = new Float32Array(MAX * 3);
  for (let i = 0; i < MAX; i++) positions[i * 3 + 1] = -50;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: sys.color,
    size: Math.max(0.04, sys.size * 0.03),
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.userData.sys = sys;
  points.frustumCulled = false;
  return points;
}

export function updateParticlePoints(points: THREE.Points, t: number): void {
  const sys = points.userData.sys as ParticleSystemSettings;
  const pts = particlePointsAt(sys, t);
  const attr = points.geometry.getAttribute(
    "position",
  ) as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  for (let i = 0; i < MAX; i++) {
    const p = pts[i];
    if (!p || p.alpha < 0.03) {
      arr[i * 3 + 1] = -50; // ẩn hạt thừa dưới mặt đất
      continue;
    }
    arr[i * 3] = (p.x - 0.5) * WORLD_W;
    arr[i * 3 + 1] = (1 - p.y) * WORLD_H + 0.15;
    arr[i * 3 + 2] = depthOf(i);
  }
  attr.needsUpdate = true;
  const mat = points.material as THREE.PointsMaterial;
  mat.color.set(sys.color);
  mat.size = Math.max(0.04, sys.size * 0.03);
}
