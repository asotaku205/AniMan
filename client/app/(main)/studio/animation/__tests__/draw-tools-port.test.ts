/**
 * Test cho bộ công cụ vẽ port từ Manga Studio sang Animation Studio
 * (lib/drawTools). Chạy ở môi trường node nên canvas thật được thay bằng
 * ctx ghi giả: ghi lại mọi lệnh vẽ và giữ ImageData để kiểm chứng pixel.
 */
import { describe, expect, it } from "vitest";
import {
  ANIM_SHORTCUT_TO_TOOL,
  ANIM_TOOL_GROUPS,
  ANIM_TOOL_LABELS,
  ANIM_TOOL_SHORTCUTS,
  animToolDefaults,
  commitAirbrushOp,
  commitBubbleOp,
  commitCurveOp,
  commitEffectOp,
  commitEraseOp,
  commitFillOp,
  commitFreeOp,
  commitGradientOp,
  commitMoveOp,
  commitShapeOp,
  commitTextOp,
  createDrawOpHistory,
  exportPngDataUrl,
  hexToRgba,
  isEmptyDrawOp,
  moveSelectionBy,
  paintDrawOp,
  paintFillOp,
  pushDrawOp,
  redoDrawOp,
  renderDrawOps,
  rgbaToHex,
  selectionFromDrag,
  undoDrawOp,
  type DrawOp,
} from "../lib/drawTools";

interface Call {
  name: string;
  args: unknown[];
}

interface FakeGradient {
  stops: Array<[number, string]>;
  addColorStop(offset: number, color: string): void;
}

class FakeCtx {
  calls: Call[] = [];
  gradients: Array<{ type: string; args: number[]; stops: Array<[number, string]> }> =
    [];
  putCalls: Array<{ x: number; y: number }> = [];
  data: Uint8ClampedArray;
  globalAlpha = 1;
  globalCompositeOperation = "source-over";
  fillStyle: string | FakeGradient = "";
  strokeStyle = "";
  lineWidth = 1;
  lineCap = "butt";
  lineJoin = "miter";
  shadowBlur = 0;
  shadowColor = "";
  font = "";
  textAlign = "left";
  textBaseline = "alphabetic";

  constructor(width: number, height: number, fill?: (x: number, y: number) => number[]) {
    this.data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const px = fill ? fill(x, y) : [255, 255, 255, 255];
        const i = (y * width + x) * 4;
        this.data[i] = px[0];
        this.data[i + 1] = px[1];
        this.data[i + 2] = px[2];
        this.data[i + 3] = px[3];
      }
    }
  }

  private log(name: string, args: unknown[]) {
    this.calls.push({ name, args });
  }

  save() {
    this.log("save", []);
  }
  restore() {
    this.log("restore", []);
  }
  beginPath() {
    this.log("beginPath", []);
  }
  moveTo(x: number, y: number) {
    this.log("moveTo", [x, y]);
  }
  lineTo(x: number, y: number) {
    this.log("lineTo", [x, y]);
  }
  closePath() {
    this.log("closePath", []);
  }
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rotation: number,
    start: number,
    end: number,
  ) {
    this.log("ellipse", [x, y, rx, ry, rotation, start, end]);
  }
  bezierCurveTo(
    c1x: number,
    c1y: number,
    c2x: number,
    c2y: number,
    x: number,
    y: number,
  ) {
    this.log("bezierCurveTo", [c1x, c1y, c2x, c2y, x, y]);
  }
  arc(x: number, y: number, r: number, start: number, end: number) {
    this.log("arc", [x, y, r, start, end]);
  }
  fill() {
    this.log("fill", []);
  }
  stroke() {
    this.log("stroke", []);
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.log("fillRect", [x, y, w, h]);
  }
  clearRect(x: number, y: number, w: number, h: number) {
    this.log("clearRect", [x, y, w, h]);
  }
  drawImage() {
    this.log("drawImage", []);
  }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.log("setTransform", [a, b, c, d, e, f]);
  }
  roundRect(x: number, y: number, w: number, h: number) {
    this.log("roundRect", [x, y, w, h]);
  }
  createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
    const g = { type: "linear", args: [x0, y0, x1, y1], stops: [] as Array<[number, string]> };
    this.gradients.push(g);
    return {
      addColorStop: (offset: number, color: string) => {
        g.stops.push([offset, color]);
      },
    } as unknown as CanvasGradient;
  }
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ) {
    const g = { type: "radial", args: [x0, y0, r0, x1, y1, r1], stops: [] as Array<[number, string]> };
    this.gradients.push(g);
    return {
      addColorStop: (offset: number, color: string) => {
        g.stops.push([offset, color]);
      },
    } as unknown as CanvasGradient;
  }
  getImageData(x: number, y: number, w: number, h: number) {
    this.log("getImageData", [x, y, w, h]);
    return { data: this.data, width: w, height: h } as ImageData;
  }
  putImageData(_img: ImageData, x: number, y: number) {
    this.log("putImageData", [x, y]);
    this.putCalls.push({ x, y });
  }
  measureText(text: string) {
    return { width: text.length * 10 } as TextMetrics;
  }
  fillText(text: string, x: number, y: number) {
    this.log("fillText", [text, x, y]);
  }
  strokeText(text: string, x: number, y: number) {
    this.log("strokeText", [text, x, y]);
  }

  asReal() {
    return this as unknown as CanvasRenderingContext2D;
  }

  names(name: string) {
    return this.calls.filter((c) => c.name === name);
  }
}

const TEXT_STYLE = {
  fontId: "comic" as const,
  fontWeight: 600,
  italic: false,
  color: "#111111",
  opacity: 1,
  align: "center" as const,
  lineHeight: 1.25,
  strokeScale: 0,
  strokeColor: "#ffffff",
};

describe("lịch sử op vẽ", () => {
  it("thêm op, hoàn tác, làm lại; op mới xoá nhánh làm lại", () => {
    let h = createDrawOpHistory();
    const a = commitFreeOp("pen", "#000000", 4, 100, 100, 100, "off", [{ x: 0.1, y: 0.1 }], 0);
    const b = commitFreeOp("pen", "#000000", 4, 100, 100, 100, "off", [{ x: 0.2, y: 0.2 }], 0);
    h = pushDrawOp(h, a!);
    h = pushDrawOp(h, b!);
    expect(h.ops).toHaveLength(2);
    h = undoDrawOp(h);
    expect(h.ops).toHaveLength(1);
    expect(h.undone).toHaveLength(1);
    h = redoDrawOp(h);
    expect(h.ops).toHaveLength(2);
    h = undoDrawOp(h);
    const c = commitFreeOp("pen", "#000000", 4, 100, 100, 100, "off", [{ x: 0.3, y: 0.3 }], 0);
    h = pushDrawOp(h, c!);
    expect(h.ops).toHaveLength(2);
    expect(h.undone).toHaveLength(0);
  });

  it("bỏ qua op suy biến và hoàn tác/làm lại rỗng an toàn", () => {
    let h = createDrawOpHistory();
    h = pushDrawOp(h, { kind: "free", tool: "pen", color: "#000", widthPx: 4, opacity: 100, flow: 100, hardness: 100, symmetry: "off", points: [] });
    expect(h.ops).toHaveLength(0);
    expect(undoDrawOp(h)).toBe(h);
    expect(redoDrawOp(h)).toBe(h);
    expect(isEmptyDrawOp({ kind: "shape", shape: "rect", from: { x: 0.5, y: 0.5 }, to: { x: 0.5, y: 0.5 }, sides: 5, fill: false, color: "#000", widthPx: 4, opacity: 100 })).toBe(true);
    expect(isEmptyDrawOp({ kind: "text", text: "   ", x: 0.1, y: 0.1, w: 0.45, fontScale: 0.1, style: TEXT_STYLE })).toBe(true);
    expect(isEmptyDrawOp({ kind: "move", from: { x: 0, y: 0, w: 0.1, h: 0.1 }, dx: 0, dy: 0 })).toBe(true);
    expect(isEmptyDrawOp({ kind: "erase", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] })).toBe(true);
  });
});

describe("danh mục công cụ port từ manga", () => {
  it("đủ 15 công cụ, nhóm đủ 5 nhóm, không có pan", () => {
    const tools = Object.keys(ANIM_TOOL_LABELS);
    expect(tools).toHaveLength(15);
    expect(tools).not.toContain("pan");
    for (const t of tools) {
      expect(ANIM_TOOL_LABELS[t as keyof typeof ANIM_TOOL_LABELS].length).toBeGreaterThan(0);
    }
    expect(ANIM_TOOL_GROUPS.map((g) => g.label)).toEqual(["Vẽ", "Tô", "Hình", "Vùng", "Khác"]);
    expect(ANIM_TOOL_GROUPS.flatMap((g) => g.tools)).toHaveLength(15);
  });

  it("phím tắt đi và về đúng công cụ, không trùng phím", () => {
    const seen = new Set<string>();
    for (const [tool, key] of Object.entries(ANIM_TOOL_SHORTCUTS)) {
      // Modal tra phím sau khi lower-case nên map lưu key chữ thường.
      expect(ANIM_SHORTCUT_TO_TOOL[key.toLowerCase()]).toBe(tool);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("mặc định kiểu manga: bút 3, cọ flow 55, phun 48, tẩy 24", () => {
    expect(animToolDefaults("pen").size).toBe(3);
    expect(animToolDefaults("brush").flow).toBe(55);
    expect(animToolDefaults("airbrush").size).toBe(48);
    expect(animToolDefaults("eraser").size).toBe(24);
    expect(animToolDefaults("bubble").size).toBe(animToolDefaults("shape").size);
  });
});

describe("commit helpers", () => {
  it("làm mượt 0 giữ nguyên điểm, 100 kéo điểm về phía trước", () => {
    const raw = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];
    const exact = commitFreeOp("pen", "#000", 4, 100, 100, 100, "off", raw, 0);
    expect(exact!.points).toEqual(raw);
    const smooth = commitFreeOp("pen", "#000", 4, 100, 100, 100, "off", raw, 100);
    expect(smooth!.points[0]).toEqual(raw[0]);
    expect(smooth!.points[1].x).toBeGreaterThan(0);
    expect(smooth!.points[1].x).toBeLessThan(1);
    expect(commitFreeOp("pen", "#000", 4, 100, 100, 100, "off", [], 0)).toBeNull();
  });

  it("phun tất định với rng cố định, dấu nằm trong bán kính phun", () => {
    const path = [{ x: 0.5, y: 0.5 }];
    const rng = () => 0.5;
    const a = commitAirbrushOp("#ff0000", 20, 60, 80, path, 200, 200, rng);
    const b = commitAirbrushOp("#ff0000", 20, 60, 80, path, 200, 200, rng);
    expect(a).toEqual(b);
    expect(a!.stamps.length).toBe(5);
    for (const s of a!.stamps) {
      const dxPx = (s.x - 0.5) * 200;
      const dyPx = (s.y - 0.5) * 200;
      expect(Math.hypot(dxPx, dyPx)).toBeLessThanOrEqual(10);
    }
    expect(a!.dabRadius).toBeGreaterThan(0);
    expect(commitAirbrushOp("#ff0000", 20, 60, 80, [], 200, 200, rng)).toBeNull();
  });

  it("hình: kẹp số cạnh, line/arrow không đổ đặc, điểm trùng thì null", () => {
    const poly = commitShapeOp("polygon", { x: 0, y: 0 }, { x: 1, y: 1 }, 2, true, "#000", 4, 100);
    expect(poly!.sides).toBe(3);
    const star = commitShapeOp("star", { x: 0, y: 0 }, { x: 1, y: 1 }, 99, true, "#000", 4, 100);
    expect(star!.sides).toBe(12);
    const line = commitShapeOp("line", { x: 0, y: 0 }, { x: 1, y: 1 }, 5, true, "#000", 4, 100);
    expect(line!.fill).toBe(false);
    expect(commitShapeOp("rect", { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, 5, false, "#000", 4, 100)).toBeNull();
  });

  it("cong kẹp độ cong, chuyển sắc và hiệu ứng kẹp giá trị", () => {
    expect(commitCurveOp({ x: 0, y: 0 }, { x: 1, y: 1 }, 200, "#000", 4, 100)!.bow).toBe(100);
    expect(commitCurveOp({ x: 0, y: 0 }, { x: 1, y: 1 }, -200, "#000", 4, 100)!.bow).toBe(-100);
    expect(commitGradientOp("linear", { x: 0, y: 0 }, { x: 1, y: 1 }, "#ff0000", "transparent", 100)).not.toBeNull();
    expect(commitGradientOp("linear", { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, "#ff0000", "transparent", 100)).toBeNull();
    expect(commitEffectOp("blur", 55, { x: 0.5, y: 0.5 }, 0).radiusPx).toBe(1);
  });

  it("chữ rỗng thì null, toạ độ và cỡ chữ được kẹp", () => {
    expect(commitTextOp("   ", 0.1, 0.1, 0.45, 0.1, TEXT_STYLE)).toBeNull();
    const t = commitTextOp("Hi", 2, -1, 0.01, 0, TEXT_STYLE);
    expect(t!.x).toBe(1);
    expect(t!.y).toBe(0);
    expect(t!.w).toBe(0.12);
    expect(t!.fontScale).toBe(0.01);
    const fill = commitFillOp({ x: 0.5, y: 0.5 }, "#ff0000", 100);
    expect(fill.tolerance).toBe(36);
  });

  it("bóng thoại: hộp quá nhỏ thì null, rect không đuôi, ellipse đuôi ở giữa đáy", () => {
    expect(commitBubbleOp("ellipse", { x: 0.1, y: 0.1 }, { x: 0.11, y: 0.11 }, "#000")).toBeNull();
    const rect = commitBubbleOp("rect", { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.4 }, "#000");
    expect(rect!.shape.tail).toBeNull();
    expect(rect!.shape.fill).toBe("#ffffff");
    const ell = commitBubbleOp("ellipse", { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.4 }, "#000");
    expect(ell!.shape.tail!.x).toBeCloseTo(0.3);
    expect(ell!.shape.tail!.y).toBeGreaterThan(0.4);
  });

  it("dời vùng 0 thì null, xoá vùng dưới 3 điểm thì null", () => {
    expect(commitMoveOp({ x: 0, y: 0, w: 0.1, h: 0.1 }, 0, 0)).toBeNull();
    expect(commitMoveOp({ x: 0, y: 0, w: 0.1, h: 0.1 }, 0.1, 0)).not.toBeNull();
    expect(commitEraseOp([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBeNull();
    expect(commitEraseOp([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }])).not.toBeNull();
  });
});

describe("màu", () => {
  it("hex sang rgba theo độ mờ, pixel trong suốt thì không lấy được màu", () => {
    expect(hexToRgba("#ff0000", 50)).toEqual([255, 0, 0, 128]);
    expect(hexToRgba("#00ff00", 100)).toEqual([0, 255, 0, 255]);
    expect(rgbaToHex(255, 0, 0, 255)).toBe("#ff0000");
    expect(rgbaToHex(255, 0, 0, 0)).toBeNull();
  });
});

describe("vẽ op lên ctx giả", () => {
  it("bút vẽ đường theo px, tẩy dùng destination-out, cọ mờ viền theo độ cứng", () => {
    const pen = new FakeCtx(200, 100);
    paintDrawOp(pen.asReal(), { kind: "free", tool: "pen", color: "#000000", widthPx: 4, opacity: 100, flow: 100, hardness: 100, symmetry: "off", points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }] }, 200, 100);
    expect(pen.names("moveTo")[0].args).toEqual([20, 10]);
    expect(pen.names("lineTo")[0].args).toEqual([100, 50]);
    expect(pen.names("stroke")).toHaveLength(1);

    const eraser = new FakeCtx(200, 100);
    paintDrawOp(eraser.asReal(), { kind: "free", tool: "eraser", color: "#000000", widthPx: 10, opacity: 100, flow: 100, hardness: 100, symmetry: "off", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, 200, 100);
    expect(eraser.globalCompositeOperation).toBe("destination-out");

    const brush = new FakeCtx(200, 100);
    paintDrawOp(brush.asReal(), { kind: "free", tool: "brush", color: "#000000", widthPx: 16, opacity: 100, flow: 55, hardness: 35, symmetry: "off", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, 200, 100);
    expect(brush.shadowBlur).toBeCloseTo(5.2);
  });

  it("đối xứng gọi setTransform, tắt đối xứng thì không", () => {
    const sym = new FakeCtx(200, 100);
    paintDrawOp(sym.asReal(), { kind: "free", tool: "brush", color: "#000", widthPx: 4, opacity: 100, flow: 100, hardness: 100, symmetry: "vertical", points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }] }, 200, 100);
    expect(sym.names("setTransform").length).toBeGreaterThan(0);
    const off = new FakeCtx(200, 100);
    paintDrawOp(off.asReal(), { kind: "free", tool: "pen", color: "#000", widthPx: 4, opacity: 100, flow: 100, hardness: 100, symmetry: "off", points: [{ x: 0.1, y: 0.1 }] }, 200, 100);
    expect(off.names("setTransform")).toHaveLength(0);
  });

  it("phun vẽ đúng số dấu tại vị trí dấu, hình vẽ đường bao và đổ đặc khi bật", () => {
    const air = new FakeCtx(200, 200);
    paintDrawOp(air.asReal(), { kind: "airbrush", color: "#ff0000", dabRadius: 2, opacity: 80, stamps: [{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.5 }] }, 200, 200);
    expect(air.names("arc")).toHaveLength(2);
    expect(air.names("arc")[0].args.slice(0, 2)).toEqual([100, 100]);

    const shape = new FakeCtx(200, 200);
    paintDrawOp(shape.asReal(), { kind: "shape", shape: "rect", from: { x: 0.1, y: 0.1 }, to: { x: 0.5, y: 0.5 }, sides: 5, fill: true, color: "#000", widthPx: 4, opacity: 100 }, 200, 200);
    expect(shape.names("closePath")).toHaveLength(1);
    expect(shape.names("fill")).toHaveLength(1);
    expect(shape.names("stroke")).toHaveLength(1);

    const star = new FakeCtx(200, 200);
    paintDrawOp(star.asReal(), { kind: "shape", shape: "star", from: { x: 0.1, y: 0.1 }, to: { x: 0.5, y: 0.5 }, sides: 5, fill: false, color: "#000", widthPx: 4, opacity: 100 }, 200, 200);
    expect(star.names("moveTo")).toHaveLength(1);
    expect(star.names("lineTo").length).toBeGreaterThanOrEqual(9);
    expect(star.names("fill")).toHaveLength(0);
  });

  it("đường cong dùng đúng điểm điều khiển của manga", () => {
    const ctx = new FakeCtx(200, 100);
    paintDrawOp(ctx.asReal(), { kind: "curve", from: { x: 0, y: 0.5 }, to: { x: 1, y: 0.5 }, bow: 40, color: "#000", widthPx: 4, opacity: 100 }, 200, 100);
    const call = ctx.names("bezierCurveTo")[0];
    expect(call.args[0]).toBeCloseTo(200 / 3);
    expect(call.args[1]).toBeCloseTo(90);
    expect(call.args[2]).toBeCloseTo((200 * 2) / 3);
    expect(call.args[3]).toBeCloseTo(90);
    expect(call.args.slice(4)).toEqual([200, 50]);
  });

  it("chuyển sắc tuyến tính và toả tròn, đầu trong suốt giữ hệ màu", () => {
    const linear = new FakeCtx(200, 100);
    paintDrawOp(linear.asReal(), { kind: "gradient", shape: "linear", from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, color: "#ff0000", end: "transparent", opacity: 100 }, 200, 100);
    expect(linear.gradients[0].type).toBe("linear");
    expect(linear.gradients[0].args).toEqual([0, 0, 200, 100]);
    expect(linear.gradients[0].stops).toEqual([[0, "#ff0000"], [1, "rgba(255, 0, 0, 0)"]]);
    expect(linear.names("fillRect")[0].args).toEqual([0, 0, 200, 100]);

    const radial = new FakeCtx(200, 200);
    paintDrawOp(radial.asReal(), { kind: "gradient", shape: "radial", from: { x: 0.5, y: 0.5 }, to: { x: 1, y: 0.5 }, color: "#00ff00", end: "white", opacity: 100 }, 200, 200);
    expect(radial.gradients[0].type).toBe("radial");
    expect(radial.gradients[0].args).toEqual([100, 100, 0, 100, 100, 100]);
  });

  it("đổ màu chỉ lan vùng liên thông, chướng ngại giữ nguyên", () => {
    const ctx = new FakeCtx(4, 4, (x, y) => (x === 1 && y === 1 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const painted = paintFillOp(ctx.asReal(), { kind: "fill", at: { x: 0, y: 0 }, color: "#ff0000", opacity: 100, tolerance: 36 }, 4, 4);
    expect(painted).toBe(15);
    const idx = (1 * 4 + 1) * 4;
    expect([ctx.data[idx], ctx.data[idx + 1], ctx.data[idx + 2]]).toEqual([0, 0, 0]);
    expect(ctx.data[0]).toBe(255);
    expect(ctx.data[1]).toBe(0);
    expect(ctx.putCalls.length).toBeGreaterThan(0);
    const noop = new FakeCtx(2, 2, () => [255, 0, 0, 255]);
    expect(paintFillOp(noop.asReal(), { kind: "fill", at: { x: 0, y: 0 }, color: "#ff0000", opacity: 100, tolerance: 36 }, 2, 2)).toBe(0);
    expect(noop.putCalls).toHaveLength(0);
  });

  it("hiệu ứng mờ làm phẳng điểm sáng, sắc nét làm rõ điểm giữa", () => {
    const blur = new FakeCtx(3, 3, (x, y) => (x === 1 && y === 1 ? [255, 255, 255, 255] : [0, 0, 0, 255]));
    paintDrawOp(blur.asReal(), { kind: "effect", mode: "blur", strength: 55, center: { x: 0.5, y: 0.5 }, radiusPx: 2 }, 3, 3);
    const center = (1 * 3 + 1) * 4;
    expect(blur.data[center]).toBeLessThan(255);
    expect(blur.data[0]).toBeGreaterThan(0);
    expect(blur.putCalls.length).toBeGreaterThan(0);

    const sharp = new FakeCtx(3, 3, (x, y) => (x === 1 && y === 1 ? [128, 128, 128, 255] : [0, 0, 0, 255]));
    paintDrawOp(sharp.asReal(), { kind: "effect", mode: "sharpen", strength: 55, center: { x: 0.5, y: 0.5 }, radiusPx: 2 }, 3, 3);
    expect(sharp.data[center]).toBeGreaterThan(128);
  });

  it("chữ ngắt dòng theo bề rộng, bóng thoại vẽ viền và nền", () => {
    const ctx = new FakeCtx(200, 200);
    paintDrawOp(ctx.asReal(), { kind: "text", text: "hello world", x: 0.1, y: 0.1, w: 0.5, fontScale: 0.2, style: TEXT_STYLE }, 200, 200);
    expect(ctx.names("fillText")).toHaveLength(2);

    const bub = new FakeCtx(200, 200);
    paintDrawOp(bub.asReal(), { kind: "bubble", shape: { id: "b", kind: "ellipse", x: 0.1, y: 0.1, w: 0.4, h: 0.3, tail: { x: 0.3, y: 0.52 }, fill: "#ffffff", strokeColor: "#000000", strokeScale: 0.004 } }, 200, 200);
    // Bóng có đuôi vẽ thân và đuôi riêng nên có ít nhất 1 lần viền và nền.
    expect(bub.names("stroke").length).toBeGreaterThanOrEqual(1);
    expect(bub.names("fill").length).toBeGreaterThanOrEqual(1);

    const shout = new FakeCtx(200, 200);
    paintDrawOp(shout.asReal(), { kind: "bubble", shape: { id: "b", kind: "shout", x: 0.1, y: 0.1, w: 0.4, h: 0.3, tail: null, fill: "#ffffff", strokeColor: "#000000", strokeScale: 0.004 } }, 200, 200);
    expect(shout.names("lineTo").length).toBeGreaterThanOrEqual(10);
  });

  it("dời vùng lấy đúng hộp nguồn và đặt lại đúng độ dời, xoá vùng dùng destination-out", () => {
    const ctx = new FakeCtx(200, 200);
    paintDrawOp(ctx.asReal(), { kind: "move", from: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, dx: 0.1, dy: 0 }, 200, 200);
    expect(ctx.names("getImageData")[0].args).toEqual([20, 20, 40, 40]);
    expect(ctx.names("fillRect")[0].args).toEqual([20, 20, 40, 40]);
    expect(ctx.putCalls[0]).toEqual({ x: 40, y: 20 });

    const er = new FakeCtx(200, 200);
    paintDrawOp(er.asReal(), { kind: "erase", points: [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0, y: 0.5 }] }, 200, 200);
    expect(er.globalCompositeOperation).toBe("destination-out");
    expect(er.names("fill")).toHaveLength(1);
    expect(er.names("closePath")).toHaveLength(1);
  });

  it("vẽ lại toàn bộ: xoá nền, vẽ hình gốc rồi op theo thứ tự", () => {
    const ctx = new FakeCtx(100, 100);
    const base = { width: 100, height: 100 } as unknown as HTMLImageElement;
    const pen = commitFreeOp("pen", "#000", 4, 100, 100, 100, "off", [{ x: 0, y: 0 }, { x: 1, y: 1 }], 0)!;
    renderDrawOps(ctx.asReal(), base, [pen], 100, 100);
    expect(ctx.names("clearRect")[0].args).toEqual([0, 0, 100, 100]);
    expect(ctx.names("drawImage")).toHaveLength(1);
    expect(ctx.names("stroke")).toHaveLength(1);
    const noBase = new FakeCtx(100, 100);
    renderDrawOps(noBase.asReal(), null, [], 100, 100);
    expect(noBase.names("drawImage")).toHaveLength(0);
  });
});

describe("xuất PNG và vòng JSON", () => {
  it("xuất đúng dataUrl PNG từ canvas chính", () => {
    let seen: string | undefined;
    const canvas = {
      toDataURL: (type?: string) => {
        seen = type;
        return "data:image/png;base64,abc";
      },
    };
    expect(exportPngDataUrl(canvas)).toBe("data:image/png;base64,abc");
    expect(seen).toBe("image/png");
  });

  it("mọi loại op đều qua được JSON round-trip", () => {
    const ops: DrawOp[] = [
      commitFreeOp("pen", "#000", 4, 100, 100, 100, "off", [{ x: 0, y: 0 }], 0)!,
      commitAirbrushOp("#000", 20, 60, 80, [{ x: 0.5, y: 0.5 }], 200, 200, () => 0.5)!,
      commitShapeOp("rect", { x: 0, y: 0 }, { x: 1, y: 1 }, 5, true, "#000", 4, 100)!,
      commitCurveOp({ x: 0, y: 0 }, { x: 1, y: 1 }, 40, "#000", 4, 100)!,
      commitGradientOp("linear", { x: 0, y: 0 }, { x: 1, y: 1 }, "#f00", "white", 100)!,
      commitFillOp({ x: 0.5, y: 0.5 }, "#f00", 100),
      commitEffectOp("blur", 55, { x: 0.5, y: 0.5 }, 10),
      commitTextOp("Hi", 0.1, 0.1, 0.45, 0.1, TEXT_STYLE)!,
      commitBubbleOp("ellipse", { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.4 }, "#000")!,
      commitMoveOp({ x: 0, y: 0, w: 0.1, h: 0.1 }, 0.1, 0)!,
      commitEraseOp([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }])!,
    ];
    expect(ops).toHaveLength(11);
    const back = JSON.parse(JSON.stringify(ops)) as DrawOp[];
    expect(back).toEqual(ops);
  });
});

describe("vùng chọn", () => {
  it("rect từ 2 góc, lasso lọc điểm sát nhau, lasso quá ít điểm thì null", () => {
    const rect = selectionFromDrag("rect", [
      { x: 100, y: 100 },
      { x: 50, y: 50 },
    ]);
    expect(rect!.points).toEqual([
      { x: 50, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 100 },
      { x: 50, y: 100 },
    ]);
    expect(rect!.inverted).toBe(false);
    const lasso = selectionFromDrag("lasso", [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(lasso!.points.length).toBeGreaterThanOrEqual(3);
    expect(selectionFromDrag("lasso", [{ x: 0, y: 0 }, { x: 10, y: 10 }])).toBeNull();
    expect(selectionFromDrag("rect", [])).toBeNull();
    const moved = moveSelectionBy(rect!, 5, -5);
    expect(moved.points[0]).toEqual({ x: 55, y: 45 });
  });
});
