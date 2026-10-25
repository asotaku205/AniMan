/**
 * Hiệu ứng hạt 2D (đợt 3): cùng toán hạt của 3D (spec + particleStateAt
 * trong effectFormula.ts) vẽ lên canvas 2D — trình dựng 2D, xem thử và
 * xuất phim dùng chung hàm này nên cùng thời điểm t cho cùng hình hạt.
 *
 * QUY ƯỚC TỌA ĐỘ 2D (khác 3D — đọc kỹ trước khi sửa):
 * - Vị trí event theo tọa độ khung hình: x 0..1 trái→phải, y 0..1
 *   trên→dưới, z bỏ qua (3D dùng tọa độ thế giới).
 * - Hạt 3D sống trong hệ y-hướng-lên (trọng lực âm = rơi xuống đất);
 *   canvas y-hướng-xuống nên y khung = y event − y thế giới: trọng lực
 *   âm vẫn rơi xuống dưới màn hình, dương vẫn bay lên trên màn hình.
 * - Tỉ lệ: 1 chiều cao khung = WORLD_H đơn vị thế giới (khớp hệ hạt nền
 *   ambient), cùng tỉ lệ cho cả 2 trục nên hạt luôn tròn dù khung 16:9
 *   hay dọc — độ lệch ngang chia thêm cho tỉ lệ khung (width/height).
 * - size trả về là ĐƯỜNG KÍNH theo tỉ lệ chiều cao khung (khớp gl_PointSize
 *   của 3D vốn cũng là đường kính điểm theo pixel).
 */

import {
  effectShakeFlash,
  layerParticles,
  layerTexture,
  particleStateAt,
  resolveActiveEffects,
  type EffectEvent,
  type EffectFormula,
  type EffectTexture,
  type ParticleSpec,
} from "./effectFormula";

/** Số đơn vị thế giới vừa 1 chiều cao khung hình. */
export const FX2D_WORLD_H = 11;

export interface FxParticle2d {
  /** Tọa độ khung 0..1 (có thể vượt ngoài khi hạt bay ra khỏi khung). */
  x: number;
  y: number;
  /** Đường kính hạt theo tỉ lệ chiều cao khung. */
  size: number;
  color: [number, number, number];
  alpha: number;
  /** Góc xoay hạt quanh tâm (radian). */
  rotation: number;
  texture: EffectTexture;
  glow: boolean;
  textureDataUrl?: string;
}

// Spec hạt rút từ seed — tính 1 lần cho mỗi object công thức, vì công
// thức trong thư viện được thay bằng object mới mỗi lần sửa.
const specCache = new WeakMap<EffectFormula, ParticleSpec[][]>();

function specsOf(formula: EffectFormula, layerIndex: number): ParticleSpec[] {
  let perLayer = specCache.get(formula);
  if (!perLayer) {
    perLayer = [];
    specCache.set(formula, perLayer);
  }
  let specs = perLayer[layerIndex];
  if (!specs) {
    specs = layerParticles(formula.layers[layerIndex], formula.seed, layerIndex);
    perLayer[layerIndex] = specs;
  }
  return specs;
}

/**
 * Hạt 2D của 1 event tại thời điểm t (giây trong cảnh). aspect =
 * width/height của khung vẽ. Trả [] khi event chưa tới hoặc đã tàn.
 */
export function fxParticlesAt(
  formula: EffectFormula,
  event: EffectEvent,
  t: number,
  aspect: number,
): FxParticle2d[] {
  const local = t - event.startSec;
  if (local < 0) return [];
  const out: FxParticle2d[] = [];
  const safeAspect = aspect > 0 ? aspect : 16 / 9;
  for (let li = 0; li < formula.layers.length; li += 1) {
    const layer = formula.layers[li];
    for (const spec of specsOf(formula, li)) {
      const st = particleStateAt(spec, layer, local, event.burst, event.durationSec);
      if (!st) continue;
      out.push({
        x: event.position.x + st.pos[0] / FX2D_WORLD_H / safeAspect,
        y: event.position.y - st.pos[1] / FX2D_WORLD_H,
        size: st.size / FX2D_WORLD_H,
        color: st.color,
        alpha: st.alpha,
        rotation: st.angle,
        texture: layerTexture(layer),
        glow: layer.glow,
        textureDataUrl: layer.textureDataUrl,
      });
    }
  }
  return out;
}

/** URL ảnh custom của mọi event trong cảnh (để caller nạp trước). */
export function fxCustomTextureUrls(
  events: EffectEvent[],
  formulas: EffectFormula[],
): string[] {
  const urls = new Set<string>();
  for (const event of events) {
    const formula = formulas.find((f) => f.id === event.effectId);
    if (!formula) continue;
    for (const layer of formula.layers) {
      if (layer.texture === "custom" && layer.textureDataUrl) {
        urls.add(layer.textureDataUrl);
      }
    }
  }
  return [...urls];
}

// Cache ảnh hạt custom (module-level để 3 nơi vẽ dùng chung).
const imageCache = new Map<string, HTMLImageElement>();

/** Ảnh custom đã nạp (null = chưa có/chưa xong — khung đó bỏ qua hạt). */
export function getFxImage(url: string): HTMLImageElement | null {
  const cached = imageCache.get(url);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
  if (typeof Image === "undefined") return null;
  const img = new Image();
  img.src = url;
  imageCache.set(url, img);
  return null;
}

/** Nạp trước ảnh custom — resolve cả khi lỗi (không kẹt xuất phim). */
export function loadFxImage(url: string): Promise<void> {
  const cached = imageCache.get(url);
  if (cached) {
    if (cached.complete) return Promise.resolve();
    return new Promise((resolve) => {
      cached.onload = () => resolve();
      cached.onerror = () => resolve();
    });
  }
  if (typeof Image === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
    imageCache.set(url, img);
  });
}

/**
 * Rung + chớp tại thời điểm t: rung lấy đúng độ mạnh effectShakeFlash
 * (giảm dần trong thời lượng event), chớp là độ mạnh gốc (caller nhân
 * 0.85 khi phủ trắng, khớp phim 3D). Rung dùng sin có seed theo t nên
 * cùng t cho cùng độ lệch ở mọi nơi vẽ.
 */
export function fxShakeFlashOffsets(
  events: EffectEvent[],
  t: number,
  width: number,
  height: number,
): { dx: number; dy: number; flash: number } {
  const { shake, flash } = effectShakeFlash(events, t);
  if (shake <= 0) return { dx: 0, dy: 0, flash };
  return {
    dx: Math.sin(t * 39.7) * shake * 0.02 * width,
    dy: Math.cos(t * 41.3) * shake * 0.02 * height,
    flash,
  };
}

/** Phủ trắng chớp sáng lên toàn khung (alpha = flash × 0.85 như phim 3D). */
export function drawFxFlash(
  ctx: CanvasRenderingContext2D,
  flash: number,
  width: number,
  height: number,
): void {
  if (flash <= 0) return;
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${Math.min(1, flash * 0.85)})`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function rgb(color: [number, number, number], alpha: number): string {
  return `rgba(${Math.round(color[0] * 255)},${Math.round(color[1] * 255)},${Math.round(color[2] * 255)},${alpha})`;
}

/**
 * Vẽ hạt 2D lên ctx (ctx đang ở hệ khung hình, chưa áp camera — caller
 * muốn áp camera thì tự save/transform trước, xem drawSceneFx).
 * getImage mặc định dùng cache module (lười nạp, khung chưa xong thì
 * bỏ qua hạt đó); caller có cache riêng thì truyền vào.
 */
export function drawFxParticles(
  ctx: CanvasRenderingContext2D,
  particles: FxParticle2d[],
  width: number,
  height: number,
  getImage: (url: string) => HTMLImageElement | null = getFxImage,
): void {
  for (const p of particles) {
    if (p.alpha <= 0.01 || p.size <= 0) continue;
    const px = p.x * width;
    const py = p.y * height;
    const r = (p.size * height) / 2;
    if (r < 0.4) continue;
    ctx.save();
    if (p.glow) ctx.globalCompositeOperation = "lighter";
    if (p.texture === "custom" && p.textureDataUrl) {
      const img = getImage(p.textureDataUrl);
      if (!img) {
        ctx.restore();
        continue;
      }
      const w = r * 2 * (img.naturalWidth / Math.max(1, img.naturalHeight));
      const h = r * 2;
      ctx.translate(px, py);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.alpha;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else if (p.texture === "star") {
      ctx.translate(px, py);
      ctx.rotate(p.rotation);
      ctx.fillStyle = rgb(p.color, p.alpha);
      ctx.beginPath();
      const inner = r * 0.28;
      for (let i = 0; i < 8; i += 1) {
        const rad = i % 2 === 0 ? r : inner;
        const a = (i * Math.PI) / 4;
        const x = Math.cos(a) * rad;
        const y = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    } else if (p.texture === "streak") {
      ctx.translate(px, py);
      ctx.rotate(p.rotation);
      ctx.fillStyle = rgb(p.color, p.alpha);
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(-r * 0.22, -r * 1.1, r * 0.44, r * 2.2, r * 0.22);
      } else {
        ctx.rect(-r * 0.22, -r * 1.1, r * 0.44, r * 2.2);
      }
      ctx.fill();
    } else {
      // Chấm tròn: gradient mờ dần từ tâm ra rìa (khớp shader 3D).
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, rgb(p.color, p.alpha));
      g.addColorStop(0.6, rgb(p.color, p.alpha * 0.6));
      g.addColorStop(1, rgb(p.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export interface DrawSceneFxOptions {
  /** Camera 2D (x, y, zoom) — áp đúng transform như layer trong renderFrame. */
  camera?: { x: number; y: number; zoom: number };
  getImage?: (url: string) => HTMLImageElement | null;
}

/**
 * Vẽ toàn bộ hiệu ứng 2D của cảnh tại thời điểm t — HÀM DUY NHẤT 3 nơi
 * vẽ dùng (sân khấu editor, xem thử, xuất phim). Event thiếu công thức
 * bị bỏ qua, không crash.
 */
export function drawSceneFx(
  ctx: CanvasRenderingContext2D,
  events: EffectEvent[],
  formulas: EffectFormula[],
  t: number,
  width: number,
  height: number,
  opts: DrawSceneFxOptions = {},
): void {
  const active = resolveActiveEffects(events, formulas, t);
  if (active.length === 0) return;
  const aspect = width > 0 && height > 0 ? width / height : 16 / 9;
  ctx.save();
  if (opts.camera) {
    ctx.translate(width / 2, height / 2);
    ctx.scale(opts.camera.zoom, opts.camera.zoom);
    ctx.translate(-opts.camera.x * width, -opts.camera.y * height);
  }
  for (const { event, formula } of active) {
    const particles = fxParticlesAt(formula, event, t, aspect);
    drawFxParticles(ctx, particles, width, height, opts.getImage);
  }
  ctx.restore();
}
