import { describe, expect, it } from "vitest";
import { autoFitRigPro } from "../lib/rigPro";
import {
  addJoint,
  applySingleJointEdit,
  removeJoint,
} from "../lib/jointEdit";

const by = (joints: { name: string; pos: readonly number[] }[]) =>
  new Map(joints.map((j) => [j.name, j.pos]));

describe("addJoint — tự thêm khớp cho vật không phải người", () => {
  it("danh sách trống thì khớp đầu tiên là Khớp 1 ở gốc tọa độ", () => {
    const { joints, name } = addJoint([], null);
    expect(name).toBe("Khớp 1");
    expect(joints).toEqual([{ name: "Khớp 1", parent: null, pos: [0, 0, 0] }]);
  });

  it("thêm làm con của khớp đang chọn, vị trí cao hơn cha một đoạn nhỏ", () => {
    const pro = autoFitRigPro(1.7);
    const { joints, name } = addJoint(pro, "Hips");
    const hips = by(pro).get("Hips")!;
    const added = joints.find((j) => j.name === name)!;
    expect(added.parent).toBe("Hips");
    expect(added.pos[0]).toBeCloseTo(hips[0], 5);
    expect(added.pos[1]).toBeCloseTo(hips[1] + 0.1, 5);
    expect(added.pos[2]).toBeCloseTo(hips[2], 5);
    // Cha đứng trước con trong danh sách.
    expect(joints.findIndex((j) => j.name === "Hips")).toBeLessThan(
      joints.findIndex((j) => j.name === name),
    );
  });

  it("tên tự sinh không trùng tên đã có", () => {
    const { joints } = addJoint(
      [{ name: "Khớp 1", parent: null, pos: [0, 0, 0] }],
      null,
    );
    expect(joints.map((j) => j.name)).toContain("Khớp 2");
  });

  it("cha không tồn tại thì thành khớp gốc", () => {
    const { joints, name } = addJoint([], "Không có khớp này");
    expect(joints.find((j) => j.name === name)!.parent).toBeNull();
  });
});

describe("removeJoint — xoá khớp, con gắn lại về cha của khớp bị xoá", () => {
  it("xoá khớp giữa thì con nhận cha mới, chuỗi không đứt", () => {
    const pro = autoFitRigPro(1.7);
    const next = removeJoint(pro, "LeftArm");
    expect(next.some((j) => j.name === "LeftArm")).toBe(false);
    expect(next.find((j) => j.name === "LeftForeArm")!.parent).toBe(
      "LeftShoulder",
    );
    expect(next.find((j) => j.name === "LeftHand")!.parent).toBe("LeftForeArm");
  });

  it("xoá khớp gốc thì con thành khớp gốc, không xoá cả nhánh", () => {
    const pro = autoFitRigPro(1.7);
    const next = removeJoint(pro, "Hips");
    expect(next.find((j) => j.name === "Spine")!.parent).toBeNull();
    expect(next.find((j) => j.name === "LeftUpLeg")!.parent).toBeNull();
    expect(next.some((j) => j.name === "Head")).toBe(true);
  });

  it("xoá khớp không có thì giữ nguyên", () => {
    const pro = autoFitRigPro(1.7);
    expect(removeJoint(pro, "Không có")).toEqual(pro);
  });
});

describe("applySingleJointEdit — sửa số dời cả nhánh như kéo chuột", () => {
  it("sửa khớp cha thì con cháu dời cùng delta, khớp ngoài nhánh giữ nguyên", () => {
    const pro = autoFitRigPro(1.7);
    const before = by(pro);
    const oldArm = before.get("LeftArm")!;
    const edited = applySingleJointEdit(pro, "LeftArm", [0.9, 1.4, 0.1], false);
    const after = by(edited);
    const delta = [0.9 - oldArm[0], 1.4 - oldArm[1], 0.1 - oldArm[2]];
    for (const name of ["LeftArm", "LeftForeArm", "LeftHand", "LeftHandIndex2"]) {
      const old = before.get(name)!;
      const next = after.get(name)!;
      expect(next[0]).toBeCloseTo(old[0] + delta[0], 5);
      expect(next[1]).toBeCloseTo(old[1] + delta[1], 5);
      expect(next[2]).toBeCloseTo(old[2] + delta[2], 5);
    }
    expect(after.get("RightArm")).toEqual(before.get("RightArm"));
    expect(after.get("Hips")).toEqual(before.get("Hips"));
  });

  it("bật đối xứng thì cả nhánh đối tác mirror theo nhánh đã dời", () => {
    const pro = autoFitRigPro(1.7);
    const before = by(pro);
    const edited = applySingleJointEdit(pro, "LeftArm", [0.9, 1.4, 0.1], true);
    const after = by(edited);
    const left = after.get("LeftForeArm")!;
    const right = after.get("RightForeArm")!;
    expect(right[0]).toBeCloseTo(-left[0], 5);
    expect(right[1]).toBeCloseTo(left[1], 5);
    expect(right[2]).toBeCloseTo(left[2], 5);
    expect(after.get("Hips")).toEqual(before.get("Hips"));
  });

  it("khớp tự thêm không có tên Left/Right thì đối xứng bỏ qua", () => {
    const { joints } = addJoint([], null);
    const edited = applySingleJointEdit(joints, "Khớp 1", [0.2, 0.3, 0.4], true);
    expect(edited.find((j) => j.name === "Khớp 1")!.pos).toEqual([
      0.2, 0.3, 0.4,
    ]);
    expect(edited).toHaveLength(1);
  });
});
