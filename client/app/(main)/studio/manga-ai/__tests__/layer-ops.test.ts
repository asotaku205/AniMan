import { describe, expect, it } from "vitest";
import {
  moveLayerInList,
  moveLayerToIndex,
  duplicateLayerInList,
  mergeDownInList,
  canRemoveLayerInList,
} from "../lib/layerOps";
import {
  createAiLayer,
  createUserLayer,
  type LayerItem,
} from "../data";

/** Danh sách viết tay — giá trị kỳ vọng là literal độc lập, không suy từ code. */
function list(ids: string[]): LayerItem[] {
  return ids.map((id) => createUserLayer(`L-${id}`, { id }));
}
function idsOf(layers: LayerItem[]): string[] {
  return layers.map((l) => l.id);
}

describe("moveLayerInList (BR-L13 — index 0 = trên cùng)", () => {
  it("'up' đưa layer về phía index 0", () => {
    const layers = list(["a", "b", "c"]);
    expect(idsOf(moveLayerInList(layers, "b", "up"))).toEqual(["b", "a", "c"]);
  });

  it("'down' đưa layer về phía cuối mảng", () => {
    const layers = list(["a", "b", "c"]);
    expect(idsOf(moveLayerInList(layers, "b", "down"))).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("đang ở đỉnh mà 'up' → giữ nguyên tham chiếu (không render thừa)", () => {
    const layers = list(["a", "b"]);
    expect(moveLayerInList(layers, "a", "up")).toBe(layers);
  });

  it("đang ở đáy mà 'down' → giữ nguyên tham chiếu", () => {
    const layers = list(["a", "b"]);
    expect(moveLayerInList(layers, "b", "down")).toBe(layers);
  });

  it("id không tồn tại → giữ nguyên tham chiếu", () => {
    const layers = list(["a", "b"]);
    expect(moveLayerInList(layers, "xx", "up")).toBe(layers);
  });

  it("không đột biến mảng gốc", () => {
    const layers = list(["a", "b", "c"]);
    moveLayerInList(layers, "c", "up");
    expect(idsOf(layers)).toEqual(["a", "b", "c"]);
  });
});

describe("moveLayerToIndex (kéo-thả sắp xếp)", () => {
  it("thả 'c' lên đầu → đứng index 0 (trên cùng)", () => {
    expect(
      idsOf(moveLayerToIndex(list(["a", "b", "c"]), "c", 0)),
    ).toEqual(["c", "a", "b"]);
  });

  it("thả 'a' xuống cuối → đứng cuối mảng", () => {
    expect(
      idsOf(moveLayerToIndex(list(["a", "b", "c"]), "a", 2)),
    ).toEqual(["b", "c", "a"]);
  });

  it("index vượt biên → kẹp vào biên gần nhất", () => {
    expect(idsOf(moveLayerToIndex(list(["a", "b"]), "a", 99))).toEqual([
      "b",
      "a",
    ]);
    expect(idsOf(moveLayerToIndex(list(["a", "b"]), "b", -5))).toEqual([
      "b",
      "a",
    ]);
  });

  it("id không tồn tại → giữ nguyên tham chiếu", () => {
    const layers = list(["a", "b"]);
    expect(moveLayerToIndex(layers, "xx", 0)).toBe(layers);
  });
});

describe("duplicateLayerInList (nhân bản layer)", () => {
  it("clone chèn ngay TRÊN bản gốc (index của gốc)", () => {
    const layers = list(["a", "b", "c"]);
    const clone = createUserLayer("L-b (bản sao)", { id: "b2" });
    expect(idsOf(duplicateLayerInList(layers, "b", clone))).toEqual([
      "a",
      "b2",
      "b",
      "c",
    ]);
  });

  it("id không tồn tại → giữ nguyên tham chiếu", () => {
    const layers = list(["a"]);
    const clone = createUserLayer("x", { id: "x2" });
    expect(duplicateLayerInList(layers, "zz", clone)).toBe(layers);
  });

  it("layer AI không được nhân bản → giữ nguyên tham chiếu", () => {
    const ai = createAiLayer("AI", { id: "ai1" });
    const layers = [...list(["a"]), ai];
    const clone = createUserLayer("x", { id: "x2" });
    expect(duplicateLayerInList(layers, "ai1", clone)).toBe(layers);
  });

  it("không đột biến mảng gốc", () => {
    const layers = list(["a", "b"]);
    duplicateLayerInList(layers, "a", createUserLayer("x", { id: "x2" }));
    expect(idsOf(layers)).toEqual(["a", "b"]);
  });
});

describe("mergeDownInList (gộp layer vào layer ngay dưới)", () => {
  it("gộp 'b' vào 'c' bên dưới: giữ 'c', loại 'b'", () => {
    const out = mergeDownInList(list(["a", "b", "c"]), "b");
    expect(out).not.toBeNull();
    expect(idsOf(out!.layers)).toEqual(["a", "c"]);
    expect(out!.targetId).toBe("c");
  });

  it("đang ở đáy (không có layer dưới) → null", () => {
    expect(mergeDownInList(list(["a", "b"]), "b")).toBeNull();
  });

  it("id không tồn tại → null", () => {
    expect(mergeDownInList(list(["a"]), "zz")).toBeNull();
  });

  it("layer AI không tham gia gộp (cả gốc lẫn đích) → null", () => {
    const ai = createAiLayer("AI", { id: "ai1" });
    expect(mergeDownInList([...list(["a"]), ai], "ai1")).toBeNull();
    expect(mergeDownInList([ai, ...list(["a"])], "ai1")).toBeNull();
    expect(mergeDownInList([...list(["a"]), ai], "a")).toBeNull();
  });

  it("không đột biến mảng gốc", () => {
    const layers = list(["a", "b"]);
    mergeDownInList(layers, "a");
    expect(idsOf(layers)).toEqual(["a", "b"]);
  });
});

describe("canRemoveLayerInList (luôn giữ ≥1 layer vẽ được)", () => {
  it("2 user layer → xóa được", () => {
    expect(canRemoveLayerInList(list(["a", "b"]), "a")).toBe(true);
  });

  it("chỉ còn 1 layer duy nhất → không xóa", () => {
    expect(canRemoveLayerInList(list(["a"]), "a")).toBe(false);
  });

  it("1 user + 1 AI → không xóa user cuối (AI không vẽ được)", () => {
    const layers = [...list(["a"]), createAiLayer("AI", { id: "ai1" })];
    expect(canRemoveLayerInList(layers, "a")).toBe(false);
  });

  it("2 user + 1 AI → xóa user được", () => {
    const layers = [...list(["a", "b"]), createAiLayer("AI", { id: "ai1" })];
    expect(canRemoveLayerInList(layers, "a")).toBe(true);
  });

  it("layer AI không bao giờ xóa bằng nút xóa", () => {
    const layers = [...list(["a"]), createAiLayer("AI", { id: "ai1" })];
    expect(canRemoveLayerInList(layers, "ai1")).toBe(false);
  });

  it("id không tồn tại → false", () => {
    expect(canRemoveLayerInList(list(["a", "b"]), "zz")).toBe(false);
  });
});
