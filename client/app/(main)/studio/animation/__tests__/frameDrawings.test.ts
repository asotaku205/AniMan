/**
 * Frame drawing (vẽ từng khung): hàm thuần, không chạm IndexedDB.
 */
import { describe, expect, it } from "vitest";
import type { DrawStroke } from "../lib/drawStrokes";
import {
  addEmptyFrameDrawing,
  addStrokeToFrame,
  bracketingKeyPoses,
  countFrameStrokes,
  duplicateFrameDrawing,
  frameCount,
  frameIndex,
  frameStrokesAt,
  frameTime,
  ghostFramesAfter,
  ghostFramesBefore,
  layerPointToStagePoint,
  normalizeFrameDrawings,
  penStrokesOnly,
  removeEmptyFrameDrawings,
  removeFrameDrawing,
  setFrameKeyPose,
  stagePointToLayerPoint,
  type FrameDrawing,
} from "../lib/frameDrawings";

function stroke(id: string, tool: "pen" | "eraser" = "pen"): DrawStroke {
  return {
    id,
    tool,
    color: "#171717",
    widthPx: 4,
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.2 },
    ],
  };
}

function drawing(
  layerId: string,
  frame: number,
  ids: string[],
  isKeyPose = false,
): FrameDrawing {
  return {
    id: `d-${layerId}-${frame}`,
    frame,
    layerId,
    strokes: ids.map((id) => stroke(id)),
    isKeyPose,
  };
}

describe("frameDrawings - số frame và thời điểm", () => {
  it("số frame = ceil(thời lượng x fps), ít nhất 1", () => {
    expect(frameCount(3, 12)).toBe(36);
    expect(frameCount(3, 24)).toBe(72);
    expect(frameCount(0.1, 12)).toBe(2);
    expect(frameCount(0, 12)).toBe(1);
    expect(frameCount(3, 0)).toBe(1);
  });

  it("frame chứa thời điểm t, kẹp trong phạm vi cảnh", () => {
    expect(frameIndex(0, 12, 3)).toBe(0);
    expect(frameIndex(0.5, 12, 3)).toBe(6);
    expect(frameIndex(2.999, 12, 3)).toBe(35);
    expect(frameIndex(99, 12, 3)).toBe(35);
    expect(frameIndex(-1, 12, 3)).toBe(0);
  });

  it("thời điểm bắt đầu frame = frame / fps", () => {
    expect(frameTime(0, 12)).toBe(0);
    expect(frameTime(6, 12)).toBe(0.5);
    expect(frameTime(12, 24)).toBe(0.5);
  });
});

describe("frameDrawings - nét của frame tại thời điểm t", () => {
  const drawings = [
    drawing("layer-a", 0, ["s0"]),
    drawing("layer-a", 5, ["s5"]),
    drawing("layer-a", 10, ["s10"]),
    drawing("layer-b", 5, ["sb5"]),
  ];

  it("giữ hình: frame trống hiện nét của frame có vẽ gần nhất trước đó", () => {
    expect(frameStrokesAt(drawings, "layer-a", 0.1, 12, 3).map((s) => s.id)).toEqual([
      "s0",
    ]);
    // t = 0.5s là frame 6, chưa có vẽ, giữ nét frame 5.
    expect(frameStrokesAt(drawings, "layer-a", 0.5, 12, 3).map((s) => s.id)).toEqual([
      "s5",
    ]);
    // Trước frame có vẽ đầu tiên thì không có nét.
    expect(frameStrokesAt(drawings, "layer-a", 0, 12, 3).map((s) => s.id)).toEqual([
      "s0",
    ]);
  });

  it("tắt giữ hình: chỉ frame có vẽ mới hiện nét", () => {
    expect(
      frameStrokesAt(drawings, "layer-a", 0.5, 12, 3, false),
    ).toEqual([]);
    expect(
      frameStrokesAt(drawings, "layer-a", 5 / 12, 12, 3, false).map((s) => s.id),
    ).toEqual(["s5"]);
  });

  it("nét vẽ tách theo layer, không lẫn sang layer khác", () => {
    expect(frameStrokesAt(drawings, "layer-b", 0.5, 12, 3).map((s) => s.id)).toEqual([
      "sb5",
    ]);
    expect(frameStrokesAt(drawings, "layer-b", 0.1, 12, 3)).toEqual([]);
  });
});

describe("frameDrawings - thêm, xóa, nhân đôi frame", () => {
  it("thêm nét vào frame chưa có thì tạo frame mới, frame có rồi thì nối thêm", () => {
    const one = addStrokeToFrame([], "layer-a", 3, stroke("s1"));
    expect(one).toHaveLength(1);
    expect(one[0].frame).toBe(3);
    const two = addStrokeToFrame(one, "layer-a", 3, stroke("s2"));
    expect(two).toHaveLength(1);
    expect(two[0].strokes.map((s) => s.id)).toEqual(["s1", "s2"]);
    const three = addStrokeToFrame(two, "layer-a", 4, stroke("s3"));
    expect(three).toHaveLength(2);
  });

  it("frame trống cắt mạch giữ hình: frame đó hiện không có nét", () => {
    const drawings = [
      drawing("layer-a", 0, ["s0"]),
      ...addEmptyFrameDrawing([drawing("layer-a", 0, ["s0"])], "layer-a", 3),
    ];
    expect(frameStrokesAt(drawings, "layer-a", 0.1, 12, 3).map((s) => s.id)).toEqual([
      "s0",
    ]);
    // Frame 3 trống: giữ hình bị cắt, không hiện nét frame 0 nữa.
    expect(frameStrokesAt(drawings, "layer-a", 3 / 12, 12, 3)).toEqual([]);
    // Frame 4 sau frame trống: giữ hình tiếp tục từ frame trống (vẫn trống).
    expect(frameStrokesAt(drawings, "layer-a", 4 / 12, 12, 3)).toEqual([]);
  });

  it("thêm frame trống đã có rồi thì không đổi gì", () => {
    const drawings = [drawing("layer-a", 1, ["s1"])];
    expect(addEmptyFrameDrawing(drawings, "layer-a", 1)).toEqual(drawings);
    const next = addEmptyFrameDrawing(drawings, "layer-a", 2);
    expect(next).toHaveLength(2);
    expect(next.find((d) => d.frame === 2)!.strokes).toEqual([]);
  });

  it("xóa frame chỉ xóa đúng frame đó, không dời frame khác", () => {
    const drawings = [drawing("layer-a", 0, ["s0"]), drawing("layer-a", 5, ["s5"])];
    const next = removeFrameDrawing(drawings, "layer-a", 0);
    expect(next.map((d) => d.frame)).toEqual([5]);
  });

  it("nhân đôi frame copy nét sang frame đích, id nét mới, không đổi frame gốc", () => {
    const drawings = [drawing("layer-a", 1, ["s1"])];
    const next = duplicateFrameDrawing(drawings, "layer-a", 1, 2);
    expect(next).toHaveLength(2);
    const copy = next.find((d) => d.frame === 2)!;
    expect(copy.strokes).toHaveLength(1);
    expect(copy.strokes[0].id).not.toBe("s1");
    expect(next.find((d) => d.frame === 1)!.strokes[0].id).toBe("s1");
  });

  it("nhân đôi frame chưa có vẽ thì không đổi gì", () => {
    const drawings = [drawing("layer-a", 1, ["s1"])];
    expect(duplicateFrameDrawing(drawings, "layer-a", 9, 10)).toEqual(drawings);
  });
});

describe("frameDrawings - key pose và onion skin", () => {
  it("đánh dấu và bỏ đánh dấu key pose, kèm tên tư thế", () => {
    const drawings = [drawing("layer-a", 0, ["s0"])];
    const marked = setFrameKeyPose(drawings, "layer-a", 0, true, "giơ tay");
    expect(marked[0].isKeyPose).toBe(true);
    expect(marked[0].note).toBe("giơ tay");
    const unmarked = setFrameKeyPose(marked, "layer-a", 0, false);
    expect(unmarked[0].isKeyPose).toBe(false);
    expect(unmarked[0].note).toBeUndefined();
  });

  it("tìm hai key pose kẹp giữa một frame", () => {
    const drawings = [
      drawing("layer-a", 0, ["s0"], true),
      drawing("layer-a", 5, ["s5"]),
      drawing("layer-a", 12, ["s12"], true),
      drawing("layer-a", 24, ["s24"], true),
    ];
    expect(bracketingKeyPoses(drawings, "layer-a", 6)).toEqual({
      prev: 0,
      next: 12,
    });
    expect(bracketingKeyPoses(drawings, "layer-a", 0)).toEqual({
      prev: null,
      next: 12,
    });
    expect(bracketingKeyPoses(drawings, "layer-a", 30)).toEqual({
      prev: 24,
      next: null,
    });
    expect(bracketingKeyPoses(drawings, "layer-b", 6)).toEqual({
      prev: null,
      next: null,
    });
  });

  it("bóng trước/sau lấy frame có vẽ gần nhất, đúng số lượng", () => {
    const drawings = [
      drawing("layer-a", 0, ["s0"]),
      drawing("layer-a", 3, ["s3"]),
      drawing("layer-a", 5, ["s5"]),
      drawing("layer-a", 9, ["s9"]),
    ];
    expect(ghostFramesBefore(drawings, "layer-a", 6, 2)).toEqual([5, 3]);
    expect(ghostFramesBefore(drawings, "layer-a", 6, 1)).toEqual([5]);
    expect(ghostFramesBefore(drawings, "layer-a", 0, 2)).toEqual([]);
    expect(ghostFramesAfter(drawings, "layer-a", 6, 2)).toEqual([9]);
    expect(ghostFramesAfter(drawings, "layer-a", 6, 0)).toEqual([]);
  });

  it("bóng onion skin chỉ lấy nét bút, bỏ nét tẩy", () => {
    const strokes = [stroke("p1", "pen"), stroke("e1", "eraser")];
    expect(penStrokesOnly(strokes).map((s) => s.id)).toEqual(["p1"]);
  });
});

describe("frameDrawings - chuẩn hóa và dọn dẹp", () => {
  it("chuẩn hóa bỏ mục sai, gộp trùng, giữ frame trống và key pose chưa vẽ", () => {
    const next = normalizeFrameDrawings([
      drawing("layer-a", 2, ["s2"]),
      drawing("layer-a", 2, ["s2b"]),
      { id: "bad", frame: -1, layerId: "layer-a", strokes: [stroke("x")] },
      { id: "bad2", frame: 3, layerId: "", strokes: [stroke("x")] },
      { id: "junk", frame: 4, layerId: "layer-a", strokes: [{ not: "a stroke" }] },
      { id: "empty", frame: 6, layerId: "layer-a", strokes: [] },
      { id: "key", frame: 5, layerId: "layer-a", strokes: [], isKeyPose: true, note: "tư thế" },
      "không phải object",
      null,
    ]);
    expect(next.map((d) => `${d.layerId}:${d.frame}`)).toEqual([
      "layer-a:2",
      "layer-a:5",
      "layer-a:6",
    ]);
    expect(next[0].strokes.map((s) => s.id)).toEqual(["s2", "s2b"]);
    expect(next[1].isKeyPose).toBe(true);
    expect(next[2].strokes).toEqual([]);
  });

  it("đếm tổng nét và dọn frame trống nhưng giữ key pose", () => {
    const drawings = [
      drawing("layer-a", 0, ["s0", "s1"]),
      drawing("layer-a", 1, []),
      { id: "k", frame: 2, layerId: "layer-a", strokes: [], isKeyPose: true },
    ];
    expect(countFrameStrokes(drawings)).toBe(2);
    expect(removeEmptyFrameDrawings(drawings).map((d) => d.frame)).toEqual([0, 2]);
  });
});

describe("frameDrawings - tọa độ sân khấu và local của layer", () => {
  const close = (p: { x: number; y: number }, x: number, y: number) => {
    expect(p.x).toBeCloseTo(x, 9);
    expect(p.y).toBeCloseTo(y, 9);
  };

  it("layer đứng yên ở mặc định thì điểm local bằng điểm sân khấu", () => {
    const tr = { x: 0.5, y: 0.5, scale: 1, rotation: 0 };
    const cam = { x: 0.5, y: 0.5, zoom: 1 };
    close(stagePointToLayerPoint({ x: 0.25, y: 0.75 }, tr, cam, 960, 540), 0.25, 0.75);
    close(layerPointToStagePoint({ x: 0.25, y: 0.75 }, tr, cam, 960, 540), 0.25, 0.75);
  });

  it("vòng đi-về stage -> local -> stage trả đúng điểm ban đầu", () => {
    const tr = { x: 0.6, y: 0.4, scale: 1.5, rotation: 30 };
    const cam = { x: 0.45, y: 0.55, zoom: 1.25 };
    for (const p of [
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.5 },
      { x: 0.9, y: 0.2 },
      { x: 0.3, y: 0.85 },
    ]) {
      const local = stagePointToLayerPoint(p, tr, cam, 960, 540);
      close(layerPointToStagePoint(local, tr, cam, 960, 540), p.x, p.y);
    }
  });

  it("layer dời sang phải thì điểm local dời ngược lại", () => {
    const tr = { x: 0.6, y: 0.5, scale: 1, rotation: 0 };
    const cam = { x: 0.5, y: 0.5, zoom: 1 };
    // Layer dời phải 0.1 khung: điểm sân khấu 0.6 nằm ở giữa layer (0.5).
    close(stagePointToLayerPoint({ x: 0.6, y: 0.5 }, tr, cam, 960, 540), 0.5, 0.5);
  });
});
