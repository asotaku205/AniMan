import { describe, expect, it } from "vitest";
import { inspectGlbBuffer, inspectionSummary } from "../lib/modelInspect";

function makeGlb(json: Record<string, unknown>): ArrayBuffer {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const padded = Math.ceil(jsonBytes.length / 4) * 4;
  const total = 12 + 8 + padded;
  const buf = new ArrayBuffer(total);
  const view = new DataView(buf);
  view.setUint32(0, 0x46546c67, true); // glTF
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, padded, true);
  view.setUint32(16, 0x4e4f534a, true); // JSON
  const target = new Uint8Array(buf, 20, padded).fill(0x20);
  target.set(jsonBytes);
  return buf;
}

describe("bộ kiểm tra GLB", () => {
  it("đọc xương, clip, tam giác từ GLB có rig", () => {
    const buf = makeGlb({
      asset: { version: "2.0" },
      accessors: [{ count: 4 }, { count: 6 }, { count: 3, max: [2.5] }],
      meshes: [
        { primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] },
      ],
      materials: [{}, {}],
      textures: [{}],
      skins: [{ joints: [0, 1, 2] }],
      animations: [
        { name: "Walk", channels: [{}], samplers: [{ input: 2 }] },
      ],
    });
    const insp = inspectGlbBuffer(buf);
    expect(insp.triangleCount).toBe(2);
    expect(insp.meshCount).toBe(1);
    expect(insp.materialCount).toBe(2);
    expect(insp.hasSkeleton).toBe(true);
    expect(insp.boneCount).toBe(3);
    expect(insp.animations).toEqual([{ name: "Walk", durationSec: 2.5 }]);
    expect(insp.warnings).toHaveLength(0);
    expect(inspectionSummary(insp)).toContain("Walk");
  });

  it("mô hình tĩnh: cảnh báo không có xương", () => {
    const buf = makeGlb({
      asset: { version: "2.0" },
      accessors: [{ count: 3 }, { count: 3 }],
      meshes: [
        { primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] },
      ],
    });
    const insp = inspectGlbBuffer(buf);
    expect(insp.hasSkeleton).toBe(false);
    expect(insp.warnings.some((w) => w.includes("Không có xương"))).toBe(true);
  });

  it("có xương nhưng không clip: cảnh báo riêng; file không phải GLB thì ném lỗi", () => {
    const buf = makeGlb({
      asset: { version: "2.0" },
      skins: [{ joints: [0] }],
    });
    const insp = inspectGlbBuffer(buf);
    expect(
      insp.warnings.some((w) => w.includes("chưa có sẵn clip")),
    ).toBe(true);
    expect(() => inspectGlbBuffer(new ArrayBuffer(32))).toThrow();
  });
});
