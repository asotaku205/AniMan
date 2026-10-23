/**
 * Hệ hạt TỰ CHẾ của cảnh (R3): khác thời tiết mẫu (S2), ở đây người
 * dùng tự đặt mọi tham số — nguồn phát ở đâu, hạt bay hướng nào, nhanh
 * bao nhiêu, trọng lực kéo ra sao, màu gì, sống bao lâu. Hàm thuần +
 * tất định theo t: cùng thông số + cùng thời điểm → cùng vị trí hạt ở
 * editor, phát thử và bản xuất (2D lẫn 3D dùng chung).
 */

export interface ParticleSystemSettings {
  /** Số hạt tối đa (0–400). */
  count: number;
  /** Màu hạt (hex). */
  color: string;
  /** Bán kính hạt — pixel theo khung cao 540. */
  size: number;
  /** Tốc độ bay (chiều cao khung/giây). */
  speed: number;
  /** Hướng bay chính, độ: 0 = xuống, 90 = sang phải, 180 = lên, 270 = sang trái. */
  directionDeg: number;
  /** Độ tản hướng ngẫu nhiên quanh hướng chính (độ). */
  spreadDeg: number;
  /** Trọng lực: >0 kéo hạt cong xuống, <0 nâng lên (đơn vị tương đối). */
  gravity: number;
  /** Tuổi thọ một hạt (giây) — hết tuổi là tái sinh tại nguồn phát. */
  lifetimeSec: number;
  /** Vị trí nguồn phát 0..1 theo khung. */
  emitterX: number;
  emitterY: number;
  /** Độ rộng vùng phát theo chiều ngang 0..1 (0 = một điểm). */
  emitterWidth: number;
}

export function defaultParticles(): ParticleSystemSettings {
  return {
    count: 90,
    color: "#ffd98a",
    size: 3,
    speed: 0.12,
    directionDeg: 0,
    spreadDeg: 40,
    gravity: 0,
    lifetimeSec: 4,
    emitterX: 0.5,
    emitterY: 0,
    emitterWidth: 1,
  };
}

export const PARTICLE_PRESETS: Array<{
  id: string;
  name: string;
  settings: ParticleSystemSettings;
}> = [
  {
    id: "dust",
    name: "Bụi sáng bay lên",
    settings: {
      count: 70, color: "#ffe9a8", size: 3, speed: 0.07, directionDeg: 180,
      spreadDeg: 50, gravity: -0.15, lifetimeSec: 6, emitterX: 0.5,
      emitterY: 1, emitterWidth: 1,
    },
  },
  {
    id: "snowfall",
    name: "Tuyết rơi nhẹ",
    settings: {
      count: 140, color: "#ffffff", size: 3.5, speed: 0.1, directionDeg: 0,
      spreadDeg: 24, gravity: 0.1, lifetimeSec: 7, emitterX: 0.5,
      emitterY: 0, emitterWidth: 1,
    },
  },
  {
    id: "downpour",
    name: "Mưa rào",
    settings: {
      count: 260, color: "#aacdFF", size: 2, speed: 0.85, directionDeg: 8,
      spreadDeg: 6, gravity: 0.4, lifetimeSec: 1.4, emitterX: 0.5,
      emitterY: 0, emitterWidth: 1,
    },
  },
  {
    id: "bubbles",
    name: "Bong bóng nổi",
    settings: {
      count: 60, color: "#bfe9ff", size: 6, speed: 0.12, directionDeg: 180,
      spreadDeg: 30, gravity: -0.3, lifetimeSec: 5, emitterX: 0.5,
      emitterY: 1, emitterWidth: 0.8,
    },
  },
  {
    id: "embers",
    name: "Tàn lửa bay",
    settings: {
      count: 110, color: "#ffab5e", size: 2.5, speed: 0.22, directionDeg: 165,
      spreadDeg: 60, gravity: -0.2, lifetimeSec: 3, emitterX: 0.5,
      emitterY: 1, emitterWidth: 0.7,
    },
  },
  {
    id: "fountain",
    name: "Phun từ một điểm",
    settings: {
      count: 160, color: "#9be7ff", size: 2.5, speed: 0.55, directionDeg: 180,
      spreadDeg: 36, gravity: 1.6, lifetimeSec: 2.2, emitterX: 0.5,
      emitterY: 0.85, emitterWidth: 0,
    },
  },
];

export interface ParticlePoint {
  x: number;
  y: number;
  /** Bán kính (pixel theo khung cao 540). */
  size: number;
  alpha: number;
}

function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Vị trí mọi hạt tại thời điểm t (toạ độ tỉ lệ 0..1 theo khung). */
export function particlePointsAt(
  sys: ParticleSystemSettings,
  t: number,
): ParticlePoint[] {
  const count = Math.max(0, Math.min(400, Math.round(sys.count)));
  const life = Math.max(0.2, sys.lifetimeSec);
  const out: ParticlePoint[] = [];
  for (let i = 0; i < count; i++) {
    const h1 = hash01(i * 3 + 11);
    const h2 = hash01(i * 7 + 23);
    const h3 = hash01(i * 13 + 37);
    const h4 = hash01(i * 17 + 41);
    const h5 = hash01(i * 19 + 53);
    const age = (t + h1 * life) % life;
    const p = age / life;
    const dirRad =
      ((sys.directionDeg + (h2 - 0.5) * sys.spreadDeg) * Math.PI) / 180;
    const vx = Math.sin(dirRad) * sys.speed;
    const vy = Math.cos(dirRad) * sys.speed;
    const sx = sys.emitterX + (h3 - 0.5) * sys.emitterWidth;
    const sy = sys.emitterY + (h4 - 0.5) * 0.06;
    const g = sys.gravity * 0.22;
    const x = sx + vx * age;
    const y = sy + vy * age + 0.5 * g * age * age;
    const alpha = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, p))), 0.8);
    out.push({
      x,
      y,
      size: sys.size * (0.6 + 0.8 * h5) * (1 - 0.25 * p),
      alpha,
    });
  }
  return out;
}
