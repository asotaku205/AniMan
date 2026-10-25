/**
 * Gắn chuyển động cho vật 2D — thư viện mẫu gắn 1 chạm.
 *
 * Khác với preset cũ trong motionPresets.ts (4 mẫu, áp là thay TOÀN BỘ
 * keys, tư thế nghỉ cố định ở giữa khung): mỗi mẫu ở đây là hàm thuần
 * nhận tư thế nghỉ THẬT của layer (sampleTransform tại thời điểm bắt
 * đầu) + tham số (bắt đầu, thời lượng, hướng, độ mạnh, easing, lặp) và
 * trả về keys. Áp mẫu chỉ thay keys trong đoạn của mẫu, keys ngoài đoạn
 * giữ nguyên — áp xong user sửa tay từng key được, không hộp đen.
 *
 * Lặp (loop/pingpong) không bake vô hạn được nên lưu thành MotionInstance
 * trên layer, đánh giá ở runtime bằng sampleMotionInstance (xem
 * timeline.ts). Muốn sửa tay thì bấm "Chuyển thành keys" để bake 1 chu
 * kỳ thành keys thật rồi tắt lặp.
 */

import {
  IDENTITY_TRANSFORM,
  replaceKeysInRange,
  type EasingId,
  type MotionDirection,
  type MotionInstance,
  type MotionLoop,
  type MotionParams,
  type Transform,
  type TransformKey,
} from "./timeline";

let motionCounter = 0;
function mid(prefix: string): string {
  motionCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${motionCounter.toString(36)}`;
}

export type MotionGroup = "enter" | "exit" | "emphasis";

export const MOTION_GROUP_LABEL: Record<MotionGroup, string> = {
  enter: "Vào khung",
  exit: "Ra khung",
  emphasis: "Nhấn mạnh",
};

export const MOTION_DIRECTION_LABEL: Record<MotionDirection, string> = {
  left: "Từ trái",
  right: "Từ phải",
  bottom: "Từ dưới",
};

export const MOTION_LOOP_LABEL: Record<MotionLoop, string> = {
  once: "Một lần",
  loop: "Lặp lại",
  pingpong: "Đi rồi về",
};

export interface MotionPresetDef {
  id: string;
  name: string;
  group: MotionGroup;
  desc: string;
  /** Mẫu có dùng hướng không (trượt/bay vào-ra). */
  usesDirection: boolean;
  /** Mẫu có dùng độ mạnh không (biên độ/góc/cỡ — trượt và mờ dần không dùng). */
  usesStrength: boolean;
  /** Keys TUYỆT ĐỐI theo thời gian (startSec..startSec+durationSec). */
  build: (rest: Transform, params: MotionParams) => TransformKey[];
}

function k(
  timeSec: number,
  transform: Partial<Transform>,
  easing: EasingId,
): TransformKey {
  return {
    id: mid("mkey"),
    timeSec,
    transform: { ...IDENTITY_TRANSFORM, ...transform },
    easing,
  };
}

function full(rest: Transform): Transform {
  return { ...rest };
}

/** Vị trí ngoài khung theo hướng — hộp layer rộng ~62% khung nên tâm ở
 *  -0.4 / 1.4 / 1.4 là hoàn toàn ngoài khung, không bị cắt nửa chừng. */
function offFrame(rest: Transform, direction: MotionDirection): Transform {
  if (direction === "left") return { ...rest, x: -0.4 };
  if (direction === "right") return { ...rest, x: 1.4 };
  return { ...rest, y: 1.4 };
}

export const MOTION_PRESETS: MotionPresetDef[] = [
  {
    id: "slide-in",
    name: "Trượt vào",
    group: "enter",
    desc: "Vật trượt từ ngoài khung vào vị trí, mờ dần hiện lên.",
    usesDirection: true,
    usesStrength: false,
    build: (rest, p) => [
      k(p.startSec, { ...offFrame(rest, p.direction), opacity: 0 }, p.easing),
      k(p.startSec + p.durationSec, { ...full(rest) }, "linear"),
    ],
  },
  {
    id: "fly-in",
    name: "Bay vào + xoay nhẹ",
    group: "enter",
    desc: "Vật bay chéo vào đồng thời xoay về thẳng và hiện dần.",
    usesDirection: true,
    usesStrength: true,
    build: (rest, p) => {
      const s = p.strength;
      const from = { ...rest };
      if (p.direction === "left") {
        from.x = rest.x - 0.35 * s;
        from.rotation = rest.rotation - 18 * s;
      } else if (p.direction === "right") {
        from.x = rest.x + 0.35 * s;
        from.rotation = rest.rotation + 18 * s;
      } else {
        from.y = rest.y + 0.35 * s;
      }
      return [
        k(p.startSec, { ...from, opacity: 0 }, p.easing),
        k(p.startSec + p.durationSec, { ...full(rest) }, "linear"),
      ];
    },
  },
  {
    id: "scale-up",
    name: "Phóng to dần",
    group: "enter",
    desc: "Vật phóng từ nhỏ lên nguyên cỡ đồng thời hiện dần.",
    usesDirection: false,
    usesStrength: true,
    build: (rest, p) => [
      k(
        p.startSec,
        { ...rest, scale: rest.scale * Math.max(0.05, 1 - 0.7 * p.strength), opacity: 0 },
        p.easing,
      ),
      k(p.startSec + p.durationSec, { ...full(rest) }, "linear"),
    ],
  },
  {
    id: "fade-in",
    name: "Mờ dần vào",
    group: "enter",
    desc: "Vật đứng yên, chỉ mờ dần hiện lên.",
    usesDirection: false,
    usesStrength: false,
    build: (rest, p) => [
      k(p.startSec, { ...rest, opacity: 0 }, p.easing),
      k(p.startSec + p.durationSec, { ...full(rest) }, "linear"),
    ],
  },
  {
    id: "drop-bounce",
    name: "Rơi xuống nảy",
    group: "enter",
    desc: "Vật rơi từ trên xuống và nảy vài nhịp rồi đứng yên.",
    usesDirection: false,
    usesStrength: true,
    build: (rest, p) => [
      k(
        p.startSec,
        { ...rest, y: rest.y - 0.4 * p.strength },
        "bounce",
      ),
      k(p.startSec + p.durationSec, { ...full(rest) }, "linear"),
    ],
  },
  {
    id: "shake-head-no",
    name: "Lắc đầu kiểu “không”",
    group: "enter",
    desc: "Vật xoay qua lại rồi về thẳng — lắc đầu từ chối.",
    usesDirection: false,
    usesStrength: true,
    build: (rest, p) => {
      const s = p.strength;
      const d = p.durationSec;
      const at = (f: number) => p.startSec + d * f;
      return [
        k(at(0), { ...rest, rotation: rest.rotation }, p.easing),
        k(at(0.2), { ...rest, rotation: rest.rotation - 12 * s }, "linear"),
        k(at(0.4), { ...rest, rotation: rest.rotation + 10 * s }, "linear"),
        k(at(0.6), { ...rest, rotation: rest.rotation - 6 * s }, "linear"),
        k(at(0.8), { ...rest, rotation: rest.rotation + 3 * s }, "linear"),
        k(at(1), { ...full(rest) }, "linear"),
      ];
    },
  },
  {
    id: "slide-out",
    name: "Trượt ra",
    group: "exit",
    desc: "Vật trượt ra ngoài khung đồng thời mờ dần.",
    usesDirection: true,
    usesStrength: false,
    build: (rest, p) => [
      k(p.startSec, { ...full(rest) }, p.easing),
      k(
        p.startSec + p.durationSec,
        { ...offFrame(rest, p.direction), opacity: 0 },
        "linear",
      ),
    ],
  },
  {
    id: "fade-out",
    name: "Mờ dần ra",
    group: "exit",
    desc: "Vật đứng yên, chỉ mờ dần biến mất.",
    usesDirection: false,
    usesStrength: false,
    build: (rest, p) => [
      k(p.startSec, { ...full(rest) }, p.easing),
      k(p.startSec + p.durationSec, { ...rest, opacity: 0 }, "linear"),
    ],
  },
  {
    id: "shrink-away",
    name: "Thu nhỏ biến mất",
    group: "exit",
    desc: "Vật thu nhỏ dần về tâm đồng thời mờ dần.",
    usesDirection: false,
    usesStrength: true,
    build: (rest, p) => [
      k(p.startSec, { ...full(rest) }, p.easing),
      k(
        p.startSec + p.durationSec,
        { ...rest, scale: rest.scale * 0.1, opacity: 0 },
        "linear",
      ),
    ],
  },
  {
    id: "bounce-up",
    name: "Nảy lên",
    group: "emphasis",
    desc: "Vật nảy lên một nhịp rồi rơi về chỗ cũ.",
    usesDirection: false,
    usesStrength: true,
    build: (rest, p) => [
      k(p.startSec, { ...full(rest) }, p.easing),
      k(
        p.startSec + p.durationSec / 2,
        { ...rest, y: rest.y - 0.12 * p.strength },
        "ease-in",
      ),
      k(p.startSec + p.durationSec, { ...full(rest) }, "linear"),
    ],
  },
  {
    id: "wiggle",
    name: "Rung nhẹ",
    group: "emphasis",
    desc: "Vật lắc lư qua lại rồi về thẳng — gây chú ý nhẹ.",
    usesDirection: false,
    usesStrength: true,
    build: (rest, p) => {
      const s = p.strength;
      const d = p.durationSec;
      const at = (f: number) => p.startSec + d * f;
      return [
        k(at(0), { ...rest, rotation: rest.rotation }, p.easing),
        k(at(1 / 3), { ...rest, rotation: rest.rotation + 7 * s }, "linear"),
        k(at(2 / 3), { ...rest, rotation: rest.rotation - 7 * s }, "linear"),
        k(at(1), { ...full(rest) }, "linear"),
      ];
    },
  },
  {
    id: "pop",
    name: "Phóng to rồi về",
    group: "emphasis",
    desc: "Vật phồng to lên một nhịp rồi về nguyên cỡ.",
    usesDirection: false,
    usesStrength: true,
    build: (rest, p) => [
      k(p.startSec, { ...full(rest) }, p.easing),
      k(
        p.startSec + p.durationSec / 2,
        { ...rest, scale: rest.scale * (1 + 0.3 * p.strength) },
        "ease-in",
      ),
      k(p.startSec + p.durationSec, { ...full(rest) }, "linear"),
    ],
  },
];

export function motionPresetById(id: string): MotionPresetDef | null {
  return MOTION_PRESETS.find((p) => p.id === id) ?? null;
}

/** Tham số mặc định cho panel: bắt đầu tại playhead, dài 1 giây. */
export function defaultMotionParams(startSec: number): MotionParams {
  return {
    startSec: Math.max(0, startSec),
    durationSec: 1,
    direction: "left",
    strength: 1,
    easing: "ease-in-out",
    loop: "once",
  };
}

export interface PresetApplyResult {
  /** Keys mới của layer (loop/pingpong thì keys giữ nguyên). */
  keys: TransformKey[];
  /** Instance mới khi lặp — null khi gắn một lần (đã bake thành keys). */
  instance: MotionInstance | null;
}

/**
 * Áp mẫu: loop "once" → ghi keys thật vào đoạn (thay keys cũ trong đoạn);
 * loop/pingpong → tạo instance với keys chu kỳ TƯƠNG ĐỐI, không chạm keys.
 */
export function applyMotionPreset(
  keys: readonly TransformKey[],
  preset: MotionPresetDef,
  params: MotionParams,
  rest: Transform,
): PresetApplyResult {
  const safe: MotionParams = {
    ...params,
    startSec: Math.max(0, params.startSec),
    durationSec: Math.max(0.1, params.durationSec),
  };
  const generated = preset.build(rest, safe);
  const endSec = safe.startSec + safe.durationSec;
  if (safe.loop === "once") {
    return {
      keys: replaceKeysInRange(keys, safe.startSec, endSec, generated),
      instance: null,
    };
  }
  const cycleKeys = generated.map((g) => ({
    ...g,
    timeSec: Math.max(0, g.timeSec - safe.startSec),
  }));
  return {
    keys: [...keys],
    instance: {
      id: mid("minst"),
      presetId: preset.id,
      name: preset.name,
      params: safe,
      cycleKeys,
    },
  };
}

/** "Chuyển thành keys": bake 1 chu kỳ của instance thành keys tuyệt đối. */
export function bakeMotionInstance(
  keys: readonly TransformKey[],
  inst: MotionInstance,
): TransformKey[] {
  const absolute = inst.cycleKeys.map((g) => ({
    ...g,
    id: mid("mkey"),
    timeSec: inst.params.startSec + g.timeSec,
  }));
  return replaceKeysInRange(
    keys,
    inst.params.startSec,
    inst.params.startSec + Math.max(0.1, inst.params.durationSec),
    absolute,
  );
}
