/**
 * effects — toán học của công cụ "Làm mờ / Làm sắc nét" (BRD T-1 #16).
 *
 * Hai phép xử lý ảnh thuần trên `ImageData.data` (RGBA, 8 bit/kênh):
 * - `boxBlurRGBA`: làm mờ bằng cửa sổ trượt **tách rời** ngang/dọc, chạy nhiều
 *   lượt để xấp xỉ Gaussian.
 * - `sharpenRGBA`: làm sắc nét bằng unsharp mask (gốc + (gốc - mờ) × lượng).
 *
 * **Nhân trước alpha (premultiply) trước khi mờ, chia lại sau**: nếu mờ thẳng
 * RGBA thì pixel trong suốt (0,0,0,0) kéo màu về đen, viền nét bị quầng xám.
 */

/** Kẹp một kênh về 0–255 rồi ghi lại vào mảng. */
function write(data: Uint8ClampedArray, index: number, value: number): void {
  data[index] = value < 0 ? 0 : value > 255 ? 255 : value;
}

/**
 * Một lượt trung bình trượt 1 chiều có kẹp biên (`clamp to edge`).
 * `src` và `dst` phải cùng cỡ, không được trùng nhau.
 */
function blurAxis(
  src: Float32Array,
  dst: Float32Array,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
): void {
  const win = radius * 2 + 1;
  const outer = horizontal ? height : width;
  const inner = horizontal ? width : height;
  const step = horizontal ? 4 : width * 4;

  for (let o = 0; o < outer; o += 1) {
    const base = horizontal ? o * width * 4 : o * 4;
    const at = (i: number) => base + Math.min(inner - 1, Math.max(0, i)) * step;

    let sum0 = 0;
    let sum1 = 0;
    let sum2 = 0;
    let sum3 = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const idx = at(k);
      sum0 += src[idx];
      sum1 += src[idx + 1];
      sum2 += src[idx + 2];
      sum3 += src[idx + 3];
    }

    for (let i = 0; i < inner; i += 1) {
      const out = at(i);
      dst[out] = sum0 / win;
      dst[out + 1] = sum1 / win;
      dst[out + 2] = sum2 / win;
      dst[out + 3] = sum3 / win;

      const add = at(i + radius + 1);
      const sub = at(i - radius);
      sum0 += src[add] - src[sub];
      sum1 += src[add + 1] - src[sub + 1];
      sum2 += src[add + 2] - src[sub + 2];
      sum3 += src[add + 3] - src[sub + 3];
    }
  }
}

/**
 * Làm mờ vùng ảnh **tại chỗ**. `radius` là bán kính cửa sổ (px, ≥ 1);
 * `passes` là số lượt (2 lượt xấp xỉ Gaussian đủ mượt cho nét vẽ).
 */
export function boxBlurRGBA(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  passes = 2,
): void {
  if (width < 1 || height < 1 || radius < 1) return;
  const count = width * height;
  const a = new Float32Array(count * 4);
  const b = new Float32Array(count * 4);

  for (let i = 0; i < count; i += 1) {
    const alpha = data[i * 4 + 3] / 255;
    a[i * 4] = data[i * 4] * alpha;
    a[i * 4 + 1] = data[i * 4 + 1] * alpha;
    a[i * 4 + 2] = data[i * 4 + 2] * alpha;
    a[i * 4 + 3] = data[i * 4 + 3];
  }

  const rounds = Math.max(1, Math.round(passes));
  for (let p = 0; p < rounds; p += 1) {
    blurAxis(a, b, width, height, radius, true);
    blurAxis(b, a, width, height, radius, false);
  }

  for (let i = 0; i < count; i += 1) {
    const alpha = a[i * 4 + 3];
    if (alpha <= 0.5) {
      data[i * 4] = 0;
      data[i * 4 + 1] = 0;
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 0;
      continue;
    }
    const f = 255 / alpha;
    write(data, i * 4, a[i * 4] * f);
    write(data, i * 4 + 1, a[i * 4 + 1] * f);
    write(data, i * 4 + 2, a[i * 4 + 2] * f);
    write(data, i * 4 + 3, alpha);
  }
}

/**
 * Làm sắc nét vùng ảnh **tại chỗ** bằng unsharp mask.
 * `amount = 0` → không đổi; `amount = 1` → mạnh gấp đôi phần chênh với bản mờ.
 */
export function sharpenRGBA(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
): void {
  if (width < 1 || height < 1 || !(amount > 0)) return;
  const blurred = new Uint8ClampedArray(data);
  boxBlurRGBA(blurred, width, height, 1, 1);
  for (let i = 0; i < data.length; i += 1) {
    write(data, i, data[i] + (data[i] - blurred[i]) * amount);
  }
}

/**
 * Bán kính blur (px) cho một cỡ nét: nét càng to thì làm mờ càng mạnh, nhưng
 * luôn ≥ 1 và bị chặn trần để một nhát không xoá sạch chi tiết.
 */
export function blurRadiusForSize(size: number): number {
  const s = Number.isFinite(size) && size > 0 ? size : 1;
  return Math.min(24, Math.max(1, Math.round(s / 8)));
}

/** Lượng unsharp theo thanh trượt độ mạnh (0–100). */
export function sharpenAmountForStrength(strength: number): number {
  const v = Number.isFinite(strength) ? Math.min(100, Math.max(0, strength)) : 0;
  return (v / 100) * 1.5;
}
