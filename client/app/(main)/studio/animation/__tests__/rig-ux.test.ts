import { describe, expect, it } from "vitest";
import { autoFitRigPro } from "../lib/rigPro";
import type { RigJoint } from "../lib/rig";
import {
  applySingleJointEdit,
  descendantsOf,
  mirrorBoneName,
  mirrorPosition,
  mirrorSubtreeEdit,
  translateSubtree,
} from "../lib/jointEdit";
import {
  applyFingerPoseToJoints,
  getFingerBase,
  parseFingerJoint,
  poseFingerFromBase,
} from "../lib/fingerPose";

const close = (a: number, b: number, digits = 5) =>
  expect(a).toBeCloseTo(b, digits);
const closeVec = (
  a: readonly number[],
  b: readonly number[],
  digits = 5,
) => a.forEach((v, i) => close(v, b[i], digits));
const len = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe("Đối xứng trái/phải", () => {
  it("rig tự căn đối xứng: khớp phải == mirror của khớp trái (cả ngón tay, ngón chân)", () => {
    const pro = autoFitRigPro(1.7);
    const by = new Map(pro.map((j) => [j.name, j.pos]));
    let paired = 0;
    for (const j of pro) {
      const cp = mirrorBoneName(j.name);
      if (cp) {
        paired += 1;
        closeVec(by.get(cp)!, mirrorPosition(j.pos));
      } else {
        // Khớp giữa (hông, cột sống, cổ, đầu) nằm trên trục giữa.
        expect(j.pos[0]).toBeCloseTo(0, 5);
      }
    }
    // 52 khớp - 6 khớp giữa = 46 khớp có đối tác.
    expect(paired).toBe(46);
  });

  it("mirrorBoneName đổi Left<->Right, khớp giữa trả null", () => {
    expect(mirrorBoneName("LeftForeArm")).toBe("RightForeArm");
    expect(mirrorBoneName("RightHandPinky3")).toBe("LeftHandPinky3");
    expect(mirrorBoneName("LeftToeBase")).toBe("RightToeBase");
    expect(mirrorBoneName("Hips")).toBeNull();
    expect(mirrorBoneName("Spine2")).toBeNull();
    expect(mirrorBoneName("Head")).toBeNull();
  });

  it("sửa một khớp khi bật đối xứng thì khớp đối tác mirror theo, tắt thì độc lập", () => {
    const pro = autoFitRigPro(1.7);
    const before = new Map(pro.map((j) => [j.name, j.pos]));
    const edited = applySingleJointEdit(pro, "LeftArm", [0.9, 1.4, 0.1], true);
    const by = new Map(edited.map((j) => [j.name, j.pos]));
    closeVec(by.get("LeftArm")!, [0.9, 1.4, 0.1]);
    closeVec(by.get("RightArm")!, [-0.9, 1.4, 0.1]);
    // Sửa số dời cả nhánh như kéo chuột: cẳng tay dời cùng delta,
    // nhánh đối tác mirror theo nhánh đã dời.
    const oldArm = before.get("LeftArm")!;
    const delta = [0.9 - oldArm[0], 1.4 - oldArm[1], 0.1 - oldArm[2]];
    const oldFore = before.get("LeftForeArm")!;
    closeVec(by.get("LeftForeArm")!, [
      oldFore[0] + delta[0],
      oldFore[1] + delta[1],
      oldFore[2] + delta[2],
    ]);
    const newLeftFore = by.get("LeftForeArm")!;
    closeVec(by.get("RightForeArm")!, [
      -newLeftFore[0],
      newLeftFore[1],
      newLeftFore[2],
    ]);
    // Khớp ngoài nhánh giữ nguyên.
    closeVec(by.get("Hips")!, before.get("Hips")!);

    const editedOff = applySingleJointEdit(pro, "LeftArm", [0.9, 1.4, 0.1], false);
    const byOff = new Map(editedOff.map((j) => [j.name, j.pos]));
    closeVec(byOff.get("RightArm")!, before.get("RightArm")!);
    closeVec(byOff.get("LeftForeArm")!, [
      oldFore[0] + delta[0],
      oldFore[1] + delta[1],
      oldFore[2] + delta[2],
    ]);
  });

  it("sửa khớp ngón tay cũng mirror sang tay kia", () => {
    const pro = autoFitRigPro(1.7);
    const before = new Map(pro.map((j) => [j.name, j.pos]));
    const edited = applySingleJointEdit(pro, "LeftHandIndex2", [0.5, 1.4, 0.3], true);
    const by = new Map(edited.map((j) => [j.name, j.pos]));
    closeVec(by.get("RightHandIndex2")!, [-0.5, 1.4, 0.3]);
    // Đốt ngọn dời cùng delta, bên kia mirror theo đốt đã dời.
    const old2 = before.get("LeftHandIndex2")!;
    const old3 = before.get("LeftHandIndex3")!;
    const delta = [0.5 - old2[0], 1.4 - old2[1], 0.3 - old2[2]];
    closeVec(by.get("LeftHandIndex3")!, [
      old3[0] + delta[0],
      old3[1] + delta[1],
      old3[2] + delta[2],
    ]);
    const newLeft3 = by.get("LeftHandIndex3")!;
    closeVec(by.get("RightHandIndex3")!, [
      -newLeft3[0],
      newLeft3[1],
      newLeft3[2],
    ]);
  });

  it("sửa khớp giữa thì cả cây dời cùng delta, không mirror sang đâu cả", () => {
    const pro = autoFitRigPro(1.7);
    const before = new Map(pro.map((j) => [j.name, j.pos]));
    const edited = applySingleJointEdit(pro, "Hips", [0.1, 0.9, 0], true);
    const by = new Map(edited.map((j) => [j.name, j.pos]));
    const oldHips = before.get("Hips")!;
    const delta = [0.1 - oldHips[0], 0.9 - oldHips[1], 0];
    // Mọi khớp đều là con cháu của Hips nên dời cùng delta; tay phải
    // dời cùng delta (không phải mirror của vị trí Hips mới).
    for (const j of pro) {
      const old = before.get(j.name)!;
      closeVec(by.get(j.name)!, [
        old[0] + delta[0],
        old[1] + delta[1],
        old[2] + delta[2],
      ]);
    }
  });
});

describe("Cây khớp (kéo khớp dời cả nhánh con)", () => {
  it("descendantsOf: nhánh tay trái gồm cẳng tay, bàn tay và đủ ngón, không lẫn tay phải", () => {
    const pro = autoFitRigPro(1.7);
    const sub = descendantsOf(pro, "LeftArm");
    expect(sub).toContain("LeftForeArm");
    expect(sub).toContain("LeftHand");
    expect(sub).toContain("LeftHandThumb3");
    expect(sub).toContain("LeftHandPinky3");
    expect(sub).not.toContain("LeftArm");
    expect(sub).not.toContain("LeftShoulder");
    expect(sub).not.toContain("RightArm");
    expect(sub).not.toContain("RightHandIndex1");
    // Cẳng tay + bàn tay + 15 khớp ngón = 17.
    expect(sub).toHaveLength(17);
  });

  it("descendantsOf(Hips) là toàn bộ khớp còn lại", () => {
    const pro = autoFitRigPro(1.7);
    expect(descendantsOf(pro, "Hips")).toHaveLength(51);
  });

  it("translateSubtree chỉ dời đúng nhánh, các khớp khác giữ nguyên", () => {
    const pro = autoFitRigPro(1.7);
    const moved = translateSubtree(pro, "LeftForeArm", [0.1, 0, 0]);
    const oldBy = new Map(pro.map((j) => [j.name, j.pos]));
    const newBy = new Map(moved.map((j) => [j.name, j.pos]));
    for (const name of ["LeftForeArm", "LeftHand", "LeftHandIndex2"]) {
      closeVec(newBy.get(name)!, [
        oldBy.get(name)![0] + 0.1,
        oldBy.get(name)![1],
        oldBy.get(name)![2],
      ]);
    }
    closeVec(newBy.get("LeftArm")!, oldBy.get("LeftArm")!);
    closeVec(newBy.get("RightForeArm")!, oldBy.get("RightForeArm")!);
  });

  it("mirrorSubtreeEdit: nhánh phải thành mirror đúng của nhánh trái vừa dời", () => {
    const pro = autoFitRigPro(1.7);
    const moved = translateSubtree(pro, "LeftArm", [0.05, -0.02, 0.03]);
    const sub = ["LeftArm", ...descendantsOf(pro, "LeftArm")];
    const updated = new Map(
      moved.filter((j) => sub.includes(j.name)).map((j) => [j.name, j.pos]),
    );
    const mirrored = mirrorSubtreeEdit(moved, sub, updated);
    const by = new Map(mirrored.map((j) => [j.name, j.pos]));
    for (const name of sub) {
      const cp = mirrorBoneName(name)!;
      closeVec(by.get(cp)!, mirrorPosition(updated.get(name)!));
    }
  });
});

describe("Gập/xòe ngón tay", () => {
  it("parseFingerJoint nhận đúng tên khớp ngón, trả null cho khớp khác", () => {
    expect(parseFingerJoint("LeftHandIndex2")).toEqual({
      side: "Left",
      finger: "Index",
    });
    expect(parseFingerJoint("RightHandPinky3")).toEqual({
      side: "Right",
      finger: "Pinky",
    });
    expect(parseFingerJoint("LeftHand")).toBeNull();
    expect(parseFingerJoint("LeftToeBase")).toBeNull();
  });

  it("getFingerBase trả null khi thiếu khớp ngón", () => {
    const pro = autoFitRigPro(1.7).filter((j) => !j.name.includes("Pinky"));
    expect(getFingerBase(pro, "Left", "Pinky")).toBeNull();
  });

  it("gập/xòe = 0 thì ngón giữ nguyên", () => {
    const pro = autoFitRigPro(1.7);
    const base = getFingerBase(pro, "Left", "Middle")!;
    const posed = poseFingerFromBase(base, "Left", "Middle", 0, 0);
    const by = new Map(pro.map((j) => [j.name, j.pos]));
    closeVec(posed.j1, by.get("LeftHandMiddle1")!);
    closeVec(posed.j2, by.get("LeftHandMiddle2")!);
    closeVec(posed.j3, by.get("LeftHandMiddle3")!);
  });

  it("gập tăng: độ dài đoạn không đổi, chuỗi vẫn nối liền, đầu ngón đi xuống", () => {
    const pro = autoFitRigPro(1.7);
    const base = getFingerBase(pro, "Left", "Middle")!;
    const by = new Map(pro.map((j) => [j.name, j.pos]));
    const origLen1 = len(by.get("LeftHandMiddle2")!, by.get("LeftHandMiddle1")!);
    const origLen2 = len(by.get("LeftHandMiddle3")!, by.get("LeftHandMiddle2")!);
    const posed = poseFingerFromBase(base, "Left", "Middle", 0.8, 0);
    close(len(posed.j2, posed.j1), origLen1);
    close(len(posed.j3, posed.j2), origLen2);
    // Chuỗi nối liền: j2 nằm trên đoạn từ j1, j3 nằm trên đoạn từ j2.
    expect(posed.j2[1]).toBeLessThan(by.get("LeftHandMiddle2")![1]);
    expect(posed.j3[1]).toBeLessThan(by.get("LeftHandMiddle3")![1]);
    // Gập càng mạnh, đầu ngón càng thấp (đơn điệu).
    const more = poseFingerFromBase(base, "Left", "Middle", 1, 0);
    expect(more.j3[1]).toBeLessThan(posed.j3[1]);
  });

  it("xòe: ngón trỏ và ngón út tách xa nhau theo Z, hai tay đối xứng", () => {
    const pro = autoFitRigPro(1.7);
    const by = new Map(pro.map((j) => [j.name, j.pos]));
    const spreadF = (side: "Left" | "Right", finger: "Index" | "Pinky") => {
      const base = getFingerBase(pro, side, finger)!;
      return poseFingerFromBase(base, side, finger, 0, 1).j3;
    };
    const li0 = by.get("LeftHandIndex3")!;
    const lp0 = by.get("LeftHandPinky3")!;
    const li = spreadF("Left", "Index");
    const lp = spreadF("Left", "Pinky");
    expect(li[2]).toBeGreaterThan(li0[2]);
    expect(lp[2]).toBeLessThan(lp0[2]);
    expect(li[2] - lp[2]).toBeGreaterThan(li0[2] - lp0[2]);
    // Tay phải xòe cũng tách ra hai phía Z như tay trái.
    const ri = spreadF("Right", "Index");
    const rp = spreadF("Right", "Pinky");
    const ri0 = by.get("RightHandIndex3")!;
    const rp0 = by.get("RightHandPinky3")!;
    expect(ri[2]).toBeGreaterThan(ri0[2]);
    expect(rp[2]).toBeLessThan(rp0[2]);
  });

  it("gập + xòe cùng lúc vẫn giữ độ dài đoạn", () => {
    const pro = autoFitRigPro(1.7);
    const base = getFingerBase(pro, "Left", "Ring")!;
    const by = new Map(pro.map((j) => [j.name, j.pos]));
    const origLen1 = len(by.get("LeftHandRing2")!, by.get("LeftHandRing1")!);
    const origLen2 = len(by.get("LeftHandRing3")!, by.get("LeftHandRing2")!);
    const posed = poseFingerFromBase(base, "Left", "Ring", 0.6, 0.8);
    close(len(posed.j2, posed.j1), origLen1);
    close(len(posed.j3, posed.j2), origLen2);
  });

  it("applyFingerPoseToJoints chỉ đổi đúng 2 khớp ngón, khớp khác giữ nguyên", () => {
    const pro = autoFitRigPro(1.7);
    const base = getFingerBase(pro, "Right", "Thumb")!;
    const out = applyFingerPoseToJoints(pro, "Right", "Thumb", 0.5, 0.5, base);
    const changed = out.filter(
      (j, i) =>
        j.pos[0] !== pro[i].pos[0] ||
        j.pos[1] !== pro[i].pos[1] ||
        j.pos[2] !== pro[i].pos[2],
    );
    expect(changed.map((j) => j.name).sort()).toEqual([
      "RightHandThumb2",
      "RightHandThumb3",
    ]);
  });
});
