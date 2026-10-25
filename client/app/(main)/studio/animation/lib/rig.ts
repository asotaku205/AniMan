/**
 * Phòng Rig (Phase 3): bộ xương mẫu + tự căn + tính trọng số da.
 *
 * Thuần toán học, không phụ thuộc Three — để test được mà không cần
 * trình duyệt. Tên xương theo chuẩn Mixamo để dùng chung clip với
 * nhau (đi/chạy/nhảy/đánh nhau từ Mixamo).
 */

export interface RigJoint {
  name: string;
  parent: string | null;
  /** Vị trí khớp trong không gian model (mét, gốc ở giữa 2 bàn chân). */
  pos: [number, number, number];
}

/** Thứ tự xương: cha luôn đứng trước con (để dựng cây không cần tìm). */
export const RIG_BONE_NAMES = [
  "Hips",
  "Spine",
  "Spine1",
  "Spine2",
  "Neck",
  "Head",
  "LeftShoulder",
  "LeftArm",
  "LeftForeArm",
  "LeftHand",
  "RightShoulder",
  "RightArm",
  "RightForeArm",
  "RightHand",
  "LeftUpLeg",
  "LeftLeg",
  "LeftFoot",
  "RightUpLeg",
  "RightLeg",
  "RightFoot",
] as const;

export type RigBoneName = (typeof RIG_BONE_NAMES)[number];

const PARENTS: Record<RigBoneName, RigBoneName | null> = {
  Hips: null,
  Spine: "Hips",
  Spine1: "Spine",
  Spine2: "Spine1",
  Neck: "Spine2",
  Head: "Neck",
  LeftShoulder: "Spine2",
  LeftArm: "LeftShoulder",
  LeftForeArm: "LeftArm",
  LeftHand: "LeftForeArm",
  RightShoulder: "Spine2",
  RightArm: "RightShoulder",
  RightForeArm: "RightArm",
  RightHand: "RightForeArm",
  LeftUpLeg: "Hips",
  LeftLeg: "LeftUpLeg",
  LeftFoot: "LeftLeg",
  RightUpLeg: "Hips",
  RightLeg: "RightUpLeg",
  RightFoot: "RightLeg",
};

/**
 * Tự căn xương theo chiều cao H (mét) ở tư thế T-pose, nhân vật nhìn
 * về +Z, tay dang ngang. Tỉ lệ theo giải phẫu người trung bình.
 * Khớp cuối (bàn tay/bàn chân/đầu) không có con nên đoạn xương của nó
 * được kéo dài thêm 0.15m theo hướng từ cha tới nó (dùng khi tính
 * trọng số).
 */
export function autoFitRig(heightM: number): RigJoint[] {
  const H = Math.max(0.5, heightM);
  const p = (name: RigBoneName, pos: [number, number, number]): RigJoint => ({
    name,
    parent: PARENTS[name],
    pos,
  });
  return [
    p("Hips", [0, 0.52 * H, 0]),
    p("Spine", [0, 0.6 * H, 0]),
    p("Spine1", [0, 0.72 * H, 0]),
    p("Spine2", [0, 0.82 * H, 0]),
    p("Neck", [0, 0.88 * H, 0]),
    p("Head", [0, 0.94 * H, 0]),
    p("LeftShoulder", [0.13 * H, 0.84 * H, 0]),
    p("LeftArm", [0.31 * H, 0.84 * H, 0]),
    p("LeftForeArm", [0.47 * H, 0.84 * H, 0]),
    p("LeftHand", [0.55 * H, 0.84 * H, 0]),
    p("RightShoulder", [-0.13 * H, 0.84 * H, 0]),
    p("RightArm", [-0.31 * H, 0.84 * H, 0]),
    p("RightForeArm", [-0.47 * H, 0.84 * H, 0]),
    p("RightHand", [-0.55 * H, 0.84 * H, 0]),
    p("LeftUpLeg", [0.06 * H, 0.52 * H, 0]),
    p("LeftLeg", [0.07 * H, 0.28 * H, 0]),
    p("LeftFoot", [0.07 * H, 0.06 * H, 0.02 * H]),
    p("RightUpLeg", [-0.06 * H, 0.52 * H, 0]),
    p("RightLeg", [-0.07 * H, 0.28 * H, 0]),
    p("RightFoot", [-0.07 * H, 0.06 * H, 0.02 * H]),
  ];
}

/** Đoạn xương của 1 khớp: từ vị trí cha tới vị trí khớp (khớp cuối kéo dài thêm). */
export function boneSegment(
  joints: RigJoint[],
  name: string,
  leafExtensionM = 0.15,
): { a: [number, number, number]; b: [number, number, number] } {
  const joint = joints.find((j) => j.name === name)!;
  const parent = joint.parent ? joints.find((j) => j.name === joint.parent) : null;
  if (!parent) return { a: joint.pos, b: joint.pos };
  const hasChild = joints.some((j) => j.parent === name);
  if (hasChild) return { a: parent.pos, b: joint.pos };
  // Khớp cuối: kéo dài theo hướng cha → khớp thêm leafExtensionM.
  const d: [number, number, number] = [
    joint.pos[0] - parent.pos[0],
    joint.pos[1] - parent.pos[1],
    joint.pos[2] - parent.pos[2],
  ];
  const len = Math.hypot(...d) || 1;
  const ext = leafExtensionM / len;
  return {
    a: parent.pos,
    b: [joint.pos[0] + d[0] * ext, joint.pos[1] + d[1] * ext, joint.pos[2] + d[2] * ext],
  };
}

function distToSegment(
  px: number, py: number, pz: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const lenSq = dx * dx + dy * dy + dz * dz;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy), pz - (az + t * dz));
}

export interface SkinWeights {
  /** Mỗi đỉnh: tối đa 4 xương (index + trọng số đã chuẩn hoá = 1). */
  skinIndex: number[][];
  skinWeight: number[][];
}

/**
 * Tính trọng số da: mỗi đỉnh chịu ảnh hưởng của tối đa 4 xương gần
 * nhất, trọng số tỉ lệ nghịch bình phương khoảng cách tới đoạn xương,
 * chuẩn hoá tổng = 1. Đỉnh càng gần xương nào thì xương đó kéo càng mạnh.
 * Index xương theo đúng thứ tự joints (khớp với thứ tự xương dựng trong
 * buildRiggedRoot) nên dùng được cho cả bộ 20 khớp cũ lẫn 54 khớp Pro.
 * Khớp cuối là ngón tay/ngón chân thì đoạn kéo dài bằng đúng độ dài đoạn
 * của nó (ngón ngắn, không kéo 0.15m như bàn tay).
 */
export function computeSkinWeights(
  positions: Float32Array | number[],
  joints: RigJoint[],
  maxInfluences = 4,
): SkinWeights {
  const jointByName = new Map(joints.map((j) => [j.name, j]));
  const segments = joints.map((joint) => {
    const hasChild = joints.some((j) => j.parent === joint.name);
    const isTipFingerOrToe =
      !hasChild &&
      (joint.name.includes("Thumb") ||
        joint.name.includes("Index") ||
        joint.name.includes("Middle") ||
        joint.name.includes("Ring") ||
        joint.name.includes("Pinky") ||
        joint.name.includes("ToeBase"));
    let ext = 0.15;
    if (isTipFingerOrToe && joint.parent) {
      const parent = jointByName.get(joint.parent)!;
      ext = Math.max(
        0.005,
        Math.hypot(
          joint.pos[0] - parent.pos[0],
          joint.pos[1] - parent.pos[1],
          joint.pos[2] - parent.pos[2],
        ),
      );
    }
    return boneSegment(joints, joint.name, ext);
  });
  const skinIndex: number[][] = [];
  const skinWeight: number[][] = [];
  const count = Math.floor(positions.length / 3);
  for (let v = 0; v < count; v += 1) {
    const px = positions[v * 3];
    const py = positions[v * 3 + 1];
    const pz = positions[v * 3 + 2];
    const scored = segments.map((seg, bi) => ({
      bi,
      w: 1 / (distToSegment(px, py, pz, seg.a[0], seg.a[1], seg.a[2], seg.b[0], seg.b[1], seg.b[2]) + 0.05) ** 2,
    }));
    scored.sort((a, b) => b.w - a.w);
    const top = scored.slice(0, maxInfluences);
    const sum = top.reduce((acc, s) => acc + s.w, 0) || 1;
    skinIndex.push(top.map((s) => s.bi));
    skinWeight.push(top.map((s) => s.w / sum));
  }
  return { skinIndex, skinWeight };
}

/** Pose thử: map tên xương → xoay Euler (radian) áp lên xương trong preview. */
export type TestPose = Record<string, [number, number, number]>;

export const TEST_POSES: Record<string, { name: string; desc: string; pose: TestPose }> = {
  bind: { name: "Đứng thẳng (T-pose)", desc: "Tư thế gốc, không xoay xương nào.", pose: {} },
  wave: {
    name: "Vẫy tay trái",
    desc: "Tay trái giơ lên, cẳng tay hơi gập.",
    pose: { LeftArm: [0, 0, 0.9], LeftForeArm: [0, 0, 0.5] },
  },
  armsUp: {
    name: "Giơ 2 tay",
    desc: "2 tay giơ cao quá đầu.",
    pose: { LeftArm: [0, 0, 2.6], RightArm: [0, 0, -2.6] },
  },
  sit: {
    name: "Ngồi",
    desc: "Đùi gập về trước, cẳng chân thả xuống.",
    pose: {
      LeftUpLeg: [-1.4, 0, 0],
      RightUpLeg: [-1.4, 0, 0],
      LeftLeg: [1.4, 0, 0],
      RightLeg: [1.4, 0, 0],
    },
  },
};
