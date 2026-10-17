import { describe, expect, it } from "vitest";
import {
  drawWithSymmetry,
  symmetryGuides,
  symmetryHint,
  symmetryLabel,
  symmetryTransforms,
  SYMMETRY_MODES,
  transformSymmetryPoint,
  type SymmetryMatrix,
} from "../lib/symmetry";

const W = 200;
const H = 100;

/** Áp một ma trận canvas lên một điểm, đúng công thức `x' = ax + cy + e`. */
function apply(m: SymmetryMatrix, x: number, y: number): { x: number; y: number } {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

describe("symmetryTransforms (BRD T-1 #13)", () => {
  it("tắt → chỉ có nét gốc", () => {
    const list = symmetryTransforms("off", W, H);
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe("identity");
  });

  it("trục dọc: 2 nét, nét gương lật đúng qua trục giữa", () => {
    const list = symmetryTransforms("vertical", W, H);
    expect(list).toHaveLength(2);
    expect(apply(list[1], 30, 40)).toEqual({ x: W - 30, y: 40 });
  });

  it("trục ngang: 2 nét, lật đúng qua trục giữa", () => {
    const list = symmetryTransforms("horizontal", W, H);
    expect(list).toHaveLength(2);
    expect(apply(list[1], 30, 40)).toEqual({ x: 30, y: H - 40 });
  });

  it("dọc + ngang: 4 nét, nét thứ tư là quay 180°", () => {
    const list = symmetryTransforms("cross", W, H);
    expect(list).toHaveLength(4);
    expect(apply(list[3], 30, 40)).toEqual({ x: W - 30, y: H - 40 });
  });

  it("hai đường chéo: 4 nét, gương đúng qua hai đường chéo khung vuông", () => {
    const square = symmetryTransforms("diagonal", 100, 100);
    expect(square).toHaveLength(4);
    expect(apply(square[1], 10, 20)).toEqual({ x: 20, y: 10 });
    expect(apply(square[2], 10, 20)).toEqual({ x: 80, y: 90 });
    // Nét thứ tư = quay 180° (điểm đối tâm)
    expect(apply(square[3], 10, 20)).toEqual({ x: 90, y: 80 });
  });

  it("khung cỡ 0 → vẫn trả nét gốc (không chia cho 0)", () => {
    expect(symmetryTransforms("cross", 0, 0)).toHaveLength(1);
  });

  it("mọi chế độ đều có nhãn và câu giải thích", () => {
    for (const mode of SYMMETRY_MODES) {
      expect(symmetryLabel(mode).length).toBeGreaterThan(0);
      expect(symmetryHint(mode).length).toBeGreaterThan(0);
    }
  });
});

describe("drawWithSymmetry", () => {
  it("vẽ lặp đúng số nét, mỗi lượt tự save/restore và tự đặt ma trận", () => {
    const matrices: number[][] = [];
    let draws = 0;
    let saves = 0;
    let restores = 0;
    const ctx = {
      save: () => {
        saves += 1;
      },
      restore: () => {
        restores += 1;
      },
      setTransform: (...m: number[]) => {
        matrices.push(m);
      },
    };
    const count = drawWithSymmetry(ctx, "cross", W, H, () => {
      draws += 1;
    });
    expect(count).toBe(4);
    expect(draws).toBe(4);
    expect(matrices).toHaveLength(4);
    expect(matrices[0]).toEqual([1, 0, 0, 1, 0, 0]);
    expect(saves).toBe(4);
    expect(restores).toBe(4);
  });

  it("chế độ tắt → vẽ đúng một lần ở ma trận đơn vị", () => {
    const matrices: number[][] = [];
    let draws = 0;
    drawWithSymmetry(
      {
        save: () => {},
        restore: () => {},
        setTransform: (...m: number[]) => {
          matrices.push(m);
        },
      },
      "off",
      W,
      H,
      () => {
        draws += 1;
      },
    );
    expect(draws).toBe(1);
    expect(matrices[0]).toEqual([1, 0, 0, 1, 0, 0]);
  });
});

describe("symmetryGuides (đường trục vẽ trên lớp phủ)", () => {
  it("khớp với từng chế độ", () => {
    expect(symmetryGuides("off", W, H)).toEqual([]);
    expect(symmetryGuides("vertical", W, H)).toEqual([
      { x1: W / 2, y1: 0, x2: W / 2, y2: H },
    ]);
    expect(symmetryGuides("horizontal", W, H)).toEqual([
      { x1: 0, y1: H / 2, x2: W, y2: H / 2 },
    ]);
    expect(symmetryGuides("cross", W, H)).toHaveLength(2);
    expect(symmetryGuides("diagonal", W, H)).toEqual([
      { x1: 0, y1: 0, x2: W, y2: H },
      { x1: W, y1: 0, x2: 0, y2: H },
    ]);
  });
});

describe("transformSymmetryPoint (điểm ảnh gương cho công cụ hiệu ứng)", () => {
  it("là ảnh gương của điểm gốc qua trục", () => {
    const vertical = symmetryTransforms("vertical", W, H)[1];
    expect(transformSymmetryPoint({ x: 25, y: 10 }, vertical)).toEqual({
      x: W - 25,
      y: 10,
    });
  });

  it("ma trận đơn vị giữ nguyên điểm", () => {
    const identity = symmetryTransforms("off", W, H)[0];
    expect(transformSymmetryPoint({ x: 3, y: 4 }, identity)).toEqual({ x: 3, y: 4 });
  });
});
