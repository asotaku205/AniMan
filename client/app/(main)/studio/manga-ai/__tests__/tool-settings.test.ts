import { describe, expect, it } from "vitest";
import {
  adjustSize,
  clampPercent,
  clampSize,
  defaultSettingsFor,
  DEFAULT_SETTINGS,
  isValidHex,
  MANGA_PALETTE,
  normalizeHex,
  SIZE_MAX,
  SIZE_MIN,
  SIZE_PRESETS,
} from "../lib/toolSettings";
import type { DrawTool } from "../data";

const ALL_TOOLS: DrawTool[] = [
  "pen",
  "brush",
  "eraser",
  "fill",
  "select",
  "shape",
  "text",
  "pan",
  "eyedropper",
  // Bộ công cụ mở rộng (Phase 3 slice D)
  "line",
  "gradient",
  "airbrush",
  "symmetry",
  "curve",
  "effect",
];

const HEX6 = /^#[0-9a-f]{6}$/;

describe("clampSize (BR-T02: 1–200px)", () => {
  it("kẹp về 1 và 200", () => {
    expect(clampSize(0)).toBe(SIZE_MIN);
    expect(clampSize(-10)).toBe(SIZE_MIN);
    expect(clampSize(999)).toBe(SIZE_MAX);
  });

  it("làm tròn và giữ giá trị hợp lệ", () => {
    expect(clampSize(4.4)).toBe(4);
    expect(clampSize(4.6)).toBe(5);
    expect(clampSize(1)).toBe(1);
    expect(clampSize(200)).toBe(200);
  });

  it("giá trị không hợp lệ → biên dưới", () => {
    expect(clampSize(NaN)).toBe(SIZE_MIN);
    expect(clampSize(Infinity)).toBe(SIZE_MIN);
  });
});

describe("clampPercent (opacity / flow / hardness / smoothing 0–100)", () => {
  it("kẹp và làm tròn", () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(120)).toBe(100);
    expect(clampPercent(34.6)).toBe(35);
    expect(clampPercent(NaN)).toBe(0);
  });
});

describe("adjustSize (AC-T2.4: [ ] ±2, Shift ±10)", () => {
  it("cộng/trừ đúng bước", () => {
    expect(adjustSize(10, 2)).toBe(12);
    expect(adjustSize(10, -2)).toBe(8);
    expect(adjustSize(10, 10)).toBe(20);
  });

  it("không vượt biên", () => {
    expect(adjustSize(SIZE_MAX, 10)).toBe(SIZE_MAX);
    expect(adjustSize(SIZE_MIN, -2)).toBe(SIZE_MIN);
  });

  it("size hỏng → vẫn ra giá trị hợp lệ", () => {
    expect(adjustSize(NaN, 2)).toBe(3);
  });
});

describe("size presets (AC-T2.5)", () => {
  it("đúng 6 mức 1 / 4 / 8 / 16 / 32 / 64", () => {
    expect([...SIZE_PRESETS]).toEqual([1, 4, 8, 16, 32, 64]);
  });
});

describe("bảng màu nhanh (AC-T2.3: 16 màu manga)", () => {
  it("đúng 16 màu, đều là hex 6 ký tự", () => {
    expect(MANGA_PALETTE).toHaveLength(16);
    for (const c of MANGA_PALETTE) expect(c).toMatch(HEX6);
  });

  it("có đen, trắng và 5 bậc xám ở đầu bảng", () => {
    expect(MANGA_PALETTE[0]).toBe("#000000");
    expect(MANGA_PALETTE[6]).toBe("#ffffff");
    const greys = MANGA_PALETTE.slice(1, 6);
    expect(greys).toHaveLength(5);
    for (const g of greys) {
      expect(g[1]).toBe(g[3]);
      expect(g[3]).toBe(g[5]);
    }
  });
});

describe("nhập HEX tay (AC-T2.3)", () => {
  it("nhận có/không dấu # và tự chuẩn hoá", () => {
    expect(normalizeHex("#AbC123")).toBe("#abc123");
    expect(normalizeHex("abc123")).toBe("#abc123");
    expect(normalizeHex("  #000000  ")).toBe("#000000");
  });

  it("sai định dạng → null", () => {
    expect(normalizeHex("#abc12")).toBeNull();
    expect(normalizeHex("red")).toBeNull();
    expect(normalizeHex("")).toBeNull();
    expect(normalizeHex("#gggggg")).toBeNull();
  });

  it("isValidHex khớp với normalizeHex", () => {
    expect(isValidHex("ffffff")).toBe(true);
    expect(isValidHex("#FFFFFF")).toBe(true);
    expect(isValidHex("#ffff")).toBe(false);
  });
});

describe("mặc định từng công cụ (BR-T01, BR-T03, BR-T04)", () => {
  it("mọi công cụ đều có bộ thuộc tính hợp lệ", () => {
    for (const tool of ALL_TOOLS) {
      const s = DEFAULT_SETTINGS[tool];
      expect(s).toBeDefined();
      expect(s.size).toBeGreaterThanOrEqual(SIZE_MIN);
      expect(s.size).toBeLessThanOrEqual(SIZE_MAX);
      for (const v of [s.opacity, s.flow, s.hardness, s.smoothing]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
      expect(["clear", "alpha"]).toContain(s.eraserMode);
      // Thuộc tính của bộ công cụ mở rộng (3D) cũng phải hợp lệ
      expect(["off", "vertical", "horizontal", "cross", "diagonal"]).toContain(
        s.symmetry,
      );
      expect(["transparent", "white", "black"]).toContain(s.gradientEnd);
      expect(["linear", "radial"]).toContain(s.gradientShape);
      expect(["blur", "sharpen"]).toContain(s.effectMode);
      expect(s.curveBow).toBeGreaterThanOrEqual(-100);
      expect(s.curveBow).toBeLessThanOrEqual(100);
      expect(s.effectStrength).toBeGreaterThanOrEqual(0);
      expect(s.effectStrength).toBeLessThanOrEqual(100);
    }
  });

  it("smoothing mặc định 35 cho công cụ vẽ tay (BR-T03)", () => {
    expect(DEFAULT_SETTINGS.pen.smoothing).toBe(35);
    expect(DEFAULT_SETTINGS.brush.smoothing).toBe(35 + 10);
  });

  it("tẩy mặc định chế độ clear (BR-T04)", () => {
    expect(DEFAULT_SETTINGS.eraser.eraserMode).toBe("clear");
  });

  it("mỗi công cụ có mặc định riêng, không dùng chung một bộ (BR-T01)", () => {
    expect(DEFAULT_SETTINGS.pen.size).not.toBe(DEFAULT_SETTINGS.brush.size);
    expect(DEFAULT_SETTINGS.brush.hardness).not.toBe(
      DEFAULT_SETTINGS.pen.hardness,
    );
  });

  it("defaultSettingsFor trả bản sao, sửa không ảnh hưởng bảng gốc", () => {
    const s = defaultSettingsFor("pen");
    s.size = 199;
    expect(DEFAULT_SETTINGS.pen.size).toBe(3);
    expect(defaultSettingsFor("pen").size).toBe(3);
  });

  it("công cụ Đối xứng mặc định bật trục dọc, các công cụ khác tắt (BRD T-1 #13)", () => {
    expect(DEFAULT_SETTINGS.symmetry.symmetry).toBe("vertical");
    expect(DEFAULT_SETTINGS.pen.symmetry).toBe("off");
    expect(DEFAULT_SETTINGS.brush.symmetry).toBe("off");
    expect(DEFAULT_SETTINGS.airbrush.symmetry).toBe("off");
  });

  it("cọ phun nhẹ tay hơn cọ thường, công cụ hiệu ứng mặc định làm mờ (3D)", () => {
    expect(DEFAULT_SETTINGS.airbrush.size).toBeGreaterThan(
      DEFAULT_SETTINGS.brush.size,
    );
    expect(DEFAULT_SETTINGS.airbrush.flow).toBeLessThan(
      DEFAULT_SETTINGS.brush.flow,
    );
    expect(DEFAULT_SETTINGS.effect.effectMode).toBe("blur");
    expect(DEFAULT_SETTINGS.gradient.gradientEnd).toBe("transparent");
    expect(DEFAULT_SETTINGS.gradient.gradientShape).toBe("linear");
  });

  it("mỗi công cụ mới cũng có mặc định riêng, không dùng chung tham chiếu (BR-T01)", () => {
    const a = defaultSettingsFor("effect");
    a.size = 7;
    expect(DEFAULT_SETTINGS.effect.size).toBe(40);
    expect(defaultSettingsFor("effect").size).toBe(40);
  });
});
