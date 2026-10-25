/**
 * Rig Pro: bộ xương mở rộng — 20 khớp lõi Mixamo giữ nguyên + ngón tay,
 * ngón chân.
 *
 * Thứ tự: cha luôn đứng trước con (để dựng cây không cần tìm). 20 khớp
 * đầu khớp đúng thứ tự `autoFitRig` cũ nên clip Phase 4 cũ không vỡ.
 * Thuần toán học, không phụ thuộc Three — test được trực tiếp.
 */

import { autoFitRig, type RigJoint } from "./rig";

const SIDES = ["Left", "Right"] as const;
const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Pinky"] as const;

/** Tên xương ngón tay, theo chuẩn Mixamo (LeftHandThumb1 … RightHandPinky3). */
export const FINGER_BONE_NAMES: string[] = [];
for (const side of SIDES) {
  for (const finger of FINGERS) {
    for (let seg = 1; seg <= 3; seg += 1) {
      FINGER_BONE_NAMES.push(`${side}Hand${finger}${seg}`);
    }
  }
}

export const TOE_BONE_NAMES = ["LeftToeBase", "RightToeBase"] as const;

export const RIG_PRO_BONE_NAMES: string[] = [
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
  ...FINGER_BONE_NAMES,
  ...TOE_BONE_NAMES,
];

/**
 * Tự căn xương Pro theo chiều cao H (mét), tư thế T-pose, nhìn về +Z.
 * 20 khớp lõi lấy đúng `autoFitRig`; ngón tay ước lượng từ bàn tay:
 * ngón xòe theo trục tay (±X) với độ xòe nhẹ theo Z, ngón cái hướng
 * ra trước; ngón chân hướng +Z từ bàn chân. Đây chỉ là điểm bắt đầu —
 * người dùng chỉnh số từng khớp trong Phòng Rig.
 */
export function autoFitRigPro(heightM: number): RigJoint[] {
  const H = Math.max(0.5, heightM);
  const joints = autoFitRig(H);
  const by = new Map(joints.map((j) => [j.name, j.pos]));
  const push = (name: string, parent: string, pos: [number, number, number]) =>
    joints.push({ name, parent, pos });

  // Ngón tay: độ dài tổng theo H (ngón giữa dài nhất ~0.062H).
  const fingerLen: Record<string, number> = {
    Thumb: 0.045 * H,
    Index: 0.055 * H,
    Middle: 0.062 * H,
    Ring: 0.058 * H,
    Pinky: 0.045 * H,
  };
  // Độ xòe theo Z của từng ngón (ngón cái ở phía trước nhất).
  const fingerFan: Record<string, number> = {
    Thumb: 0,
    Index: 0.12,
    Middle: 0,
    Ring: -0.12,
    Pinky: -0.25,
  };
  // Gốc ngón lệch khỏi bàn tay theo Z (bàn tay rộng ~0.05H).
  const fingerBaseZ: Record<string, number> = {
    Thumb: 0.035 * H,
    Index: 0.022 * H,
    Middle: 0.007 * H,
    Ring: -0.007 * H,
    Pinky: -0.022 * H,
  };
  for (const side of SIDES) {
    const s = side === "Left" ? 1 : -1;
    const hand = by.get(`${side}Hand`)!;
    for (const finger of FINGERS) {
      const base: [number, number, number] = [
        hand[0],
        hand[1],
        hand[2] + fingerBaseZ[finger],
      ];
      // Ngón cái: từ gốc bàn tay, hướng ra trước + hơi ra ngoài.
      // Các ngón còn lại: hướng dọc trục tay, xòe nhẹ theo Z.
      const dir: [number, number, number] =
        finger === "Thumb"
          ? [s * 0.45, 0, 0.89]
          : [s, 0, fingerFan[finger]];
      const dl = Math.hypot(...dir) || 1;
      const unit: [number, number, number] = [
        dir[0] / dl,
        dir[1] / dl,
        dir[2] / dl,
      ];
      const seg = fingerLen[finger] / 3;
      let prev = `${side}Hand`;
      for (let k = 1; k <= 3; k += 1) {
        const name = `${side}Hand${finger}${k}`;
        const pos: [number, number, number] = [
          base[0] + unit[0] * seg * (k - 1) + (finger === "Thumb" && k === 1 ? s * 0.01 * H : 0),
          base[1] + unit[1] * seg * (k - 1),
          base[2] + unit[2] * seg * (k - 1),
        ];
        push(name, prev, pos);
        prev = name;
      }
    }
  }

  // Ngón chân: từ bàn chân hướng ra trước (+Z), sát đất.
  for (const side of SIDES) {
    const foot = by.get(`${side}Foot`)!;
    push(`${side}ToeBase`, `${side}Foot`, [
      foot[0],
      0.02 * H,
      foot[2] + 0.055 * H,
    ]);
  }
  return joints;
}

/** true khi tên khớp là ngón tay/ngón chân (để tính đoạn xương riêng). */
export function isFingerOrToeBone(name: string): boolean {
  return (
    FINGER_BONE_NAMES.includes(name) ||
    (TOE_BONE_NAMES as readonly string[]).includes(name)
  );
}
