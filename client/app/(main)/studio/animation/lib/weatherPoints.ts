/**
 * Hạt thời tiết 3D (S2): mưa/tuyết/lấp lánh dạng THREE.Points cho cảnh
 * 3D — dùng chung giữa trình dựng cảnh và bản xuất phim. Vị trí hạt tất
 * định theo thời gian t (hàm thuần theo chỉ số hạt) nên hai nơi khớp nhau.
 */

import * as THREE from "three";
import type { SceneWeather } from "./layerEffects";

const COUNT = 260;
const AREA = 15;
const HEIGHT = 12;

function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function createWeatherPoints(weather: SceneWeather): THREE.Points {
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (hash01(i * 3 + 1) - 0.5) * AREA * 2;
    positions[i * 3 + 1] = hash01(i * 7 + 2) * HEIGHT;
    positions[i * 3 + 2] = (hash01(i * 11 + 3) - 0.5) * AREA * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const color =
    weather.type === "rain"
      ? "#aacdFF"
      : weather.type === "snow"
        ? "#ffffff"
        : "#ffe9a8";
  const mat = new THREE.PointsMaterial({
    color,
    size: weather.type === "rain" ? 0.07 : 0.1,
    transparent: true,
    opacity: 0.35 + weather.intensity * 0.45,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.userData.weather = weather;
  points.userData.base = positions.slice();
  points.frustumCulled = false;
  return points;
}

export function updateWeatherPoints(points: THREE.Points, t: number): void {
  const weather = points.userData.weather as SceneWeather;
  const base = points.userData.base as Float32Array;
  const attr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  const visible = Math.round(COUNT * Math.max(0, Math.min(1, weather.intensity)));
  for (let i = 0; i < COUNT; i++) {
    const bx = base[i * 3];
    const by = base[i * 3 + 1];
    const bz = base[i * 3 + 2];
    if (i >= visible) {
      arr[i * 3 + 1] = -50; // ẩn hạt thừa dưới mặt đất
      continue;
    }
    if (weather.type === "rain") {
      const y = HEIGHT - ((HEIGHT - by + t * 7.5) % HEIGHT);
      arr[i * 3] = bx + (HEIGHT - y) * 0.06;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = bz;
    } else if (weather.type === "snow") {
      const y = HEIGHT - ((HEIGHT - by + t * 0.8) % HEIGHT);
      arr[i * 3] = bx + Math.sin(t * 0.9 + i * 1.3) * 0.35;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = bz;
    } else {
      arr[i * 3] = bx;
      arr[i * 3 + 1] = by;
      arr[i * 3 + 2] = bz;
    }
  }
  attr.needsUpdate = true;
  if (weather.type === "sparkles") {
    (points.material as THREE.PointsMaterial).opacity =
      0.3 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.4));
  }
}
