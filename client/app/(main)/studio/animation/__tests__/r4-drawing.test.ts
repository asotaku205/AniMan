import { describe, expect, it } from "vitest";
import {
  createDrawHistory,
  pushDrawStroke,
  redoDrawStroke,
  undoDrawStroke,
  type DrawStroke,
} from "../lib/drawStrokes";
import {
  addExpression,
  createCharacter2D,
  expressionProgress,
  removeExpression,
  setExpressionImage,
} from "../lib/characterSheet";

const stroke = (id: string): DrawStroke => ({
  id,
  tool: "pen",
  color: "#000",
  widthPx: 4,
  points: [{ x: 0.1, y: 0.1 }],
});

describe("lịch sử nét vẽ", () => {
  it("thêm nét, hoàn tác, làm lại; thêm nét mới xoá nhánh làm lại", () => {
    let h = createDrawHistory();
    h = pushDrawStroke(h, stroke("a"));
    h = pushDrawStroke(h, stroke("b"));
    expect(h.strokes.map((s) => s.id)).toEqual(["a", "b"]);
    h = undoDrawStroke(h);
    expect(h.strokes.map((s) => s.id)).toEqual(["a"]);
    h = redoDrawStroke(h);
    expect(h.strokes.map((s) => s.id)).toEqual(["a", "b"]);
    h = undoDrawStroke(h);
    h = pushDrawStroke(h, stroke("c"));
    expect(h.strokes.map((s) => s.id)).toEqual(["a", "c"]);
    expect(h.undone).toHaveLength(0);
  });

  it("nét không điểm thì bỏ qua; hoàn tác rỗng an toàn", () => {
    let h = createDrawHistory();
    h = pushDrawStroke(h, { ...stroke("x"), points: [] });
    expect(h.strokes).toHaveLength(0);
    expect(undoDrawStroke(h)).toBe(h);
  });
});

describe("nhân vật 2D tự tạo", () => {
  it("tạo nhân vật với 5 biểu cảm mặc định chưa vẽ", () => {
    const char = createCharacter2D(" Linh ");
    expect(char.name).toBe("Linh");
    expect(char.expressions).toHaveLength(5);
    expect(expressionProgress(char)).toEqual({ drawn: 0, total: 5 });
  });

  it("gán hình biểu cảm, thêm/xoá biểu cảm, giữ tối thiểu 1", () => {
    let char = createCharacter2D("Hùng");
    char = setExpressionImage(char, "Vui", "data:image/png;base64,x");
    expect(expressionProgress(char).drawn).toBe(1);
    char = addExpression(char, "Cười lớn");
    expect(char.expressions).toHaveLength(6);
    char = addExpression(char, "Cười lớn");
    expect(char.expressions).toHaveLength(6);
    char = removeExpression(char, "Cười lớn");
    expect(char.expressions).toHaveLength(5);
    char = setExpressionImage(char, "Ngạc nhiên", "data:y");
    expect(
      char.expressions.find((e) => e.label === "Ngạc nhiên")?.dataUrl,
    ).toBe("data:y");
    let solo = createCharacter2D("X");
    for (const label of ["Vui", "Buồn", "Giận", "Ngạc nhiên"]) {
      solo = removeExpression(solo, label);
    }
    expect(solo.expressions).toHaveLength(1);
    solo = removeExpression(solo, solo.expressions[0].label);
    expect(solo.expressions).toHaveLength(1);
  });
});
