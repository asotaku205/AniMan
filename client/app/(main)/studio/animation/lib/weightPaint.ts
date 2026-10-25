/**
 * Cọ tô trọng số (thuần toán): quét cọ lên lưới để quyết định vùng thịt
 * nào đi theo xương nào. Không phụ thuộc Three — test được trực tiếp.
 *
 * Mỗi đỉnh giữ tối đa 4 xương; sau mỗi nét cọ, hàng trọng số được chuẩn
 * hoá tổng = 1. Xương chưa có trong đỉnh sẽ chiếm slot nhẹ nhất.
 */

import type { Vec3 } from "./ik";

export type BrushMode = "add" | "subtract" | "smooth";

export interface BrushStrokeInput {
  /** Toạ độ đỉnh, 3 số/đỉnh. */
  positions: ArrayLike<number>;
  /** Mỗi đỉnh: tối đa 4 index xương. */
  skinIndex: number[][];
  /** Mỗi đỉnh: trọng số tương ứng (chưa cần chuẩn hoá). */
  skinWeight: number[][];
  /** Index xương đang tô. */
  boneIndex: number;
  /** Điểm chạm của cọ (cùng hệ toạ độ với positions). */
  hit: Vec3;
  /** Bán kính cọ (mét). */
  radius: number;
  /** Độ mạnh 0–1. */
  strength: number;
  mode: BrushMode;
}

export interface BrushStrokeOutput {
  skinIndex: number[][];
  skinWeight: number[][];
}

/** Chuẩn hoá từng hàng về tổng = 1 (hàng toàn 0 → dồn về slot đầu). */
export function normalizeWeights(weights: number[][]): number[][] {
  return weights.map((row) => {
    const sum = row.reduce((a, b) => a + b, 0);
    if (sum <= 0) {
      const out = row.map(() => 0);
      out[0] = 1;
      return out;
    }
    return row.map((w) => w / sum);
  });
}

export function applyBrushStroke(input: BrushStrokeInput): BrushStrokeOutput {
  const { positions, boneIndex, hit, radius, strength, mode } = input;
  const count = Math.floor(positions.length / 3);
  const skinIndex = input.skinIndex.map((row) => [...row]);
  const raw = input.skinWeight.map((row) => [...row]);

  // Vùng ảnh hưởng: đỉnh trong bán kính + hệ số mờ dần theo khoảng cách.
  const affected: Array<{ v: number; falloff: number }> = [];
  for (let v = 0; v < count; v += 1) {
    const dx = positions[v * 3] - hit[0];
    const dy = positions[v * 3 + 1] - hit[1];
    const dz = positions[v * 3 + 2] - hit[2];
    const dist = Math.hypot(dx, dy, dz);
    if (dist <= radius) affected.push({ v, falloff: 1 - dist / radius });
  }
  if (affected.length === 0) {
    return { skinIndex, skinWeight: normalizeWeights(raw) };
  }

  // Trung bình trọng số của xương đích trong vùng cọ (chế độ làm mịn).
  let avg = 0;
  if (mode === "smooth") {
    let sum = 0;
    for (const { v } of affected) {
      const slot = skinIndex[v].indexOf(boneIndex);
      sum += slot >= 0 ? raw[v][slot] : 0;
    }
    avg = sum / affected.length;
  }

  for (const { v, falloff } of affected) {
    let slot = skinIndex[v].indexOf(boneIndex);
    if (slot < 0) {
      if (mode === "smooth") continue; // Làm mịn không thêm xương mới.
      // Chiếm slot nhẹ nhất.
      slot = 0;
      for (let k = 1; k < skinIndex[v].length; k += 1) {
        if (raw[v][k] < raw[v][slot]) slot = k;
      }
      skinIndex[v][slot] = boneIndex;
      raw[v][slot] = 0;
    }
    const w = raw[v][slot];
    const f = strength * falloff;
    if (mode === "add") raw[v][slot] = w + f * (1 - w);
    else if (mode === "subtract") raw[v][slot] = w * (1 - f);
    else raw[v][slot] = w + (avg - w) * f;
  }
  return { skinIndex, skinWeight: normalizeWeights(raw) };
}
