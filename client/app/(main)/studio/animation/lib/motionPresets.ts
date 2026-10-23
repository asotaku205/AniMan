/**
 * Thư viện chuyển động — preset có TÊN CHUẨN + tham số, theo mô hình
 * motion-prompt (MIT): người dùng chọn theo tên thay vì mô tả mơ hồ, mỗi
 * preset là hàm thuần sinh keyframe deterministic (cùng tham số → cùng
 * keyframe), áp vào là sửa tiếp được từng key. Không AI ở đây — đây là
 * TOOL; AI gợi ý chọn preset là việc của slice sau.
 */

import {
  IDENTITY_CAMERA,
  IDENTITY_TRANSFORM,
  type CameraKey,
  type EasingId,
  type TransformKey,
} from "./timeline";

let presetCounter = 0;
function pid(prefix: string): string {
  presetCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${presetCounter.toString(36)}`;
}

export interface CameraPreset {
  id: string;
  name: string;
  desc: string;
  build: (durationSec: number) => CameraKey[];
}

function camKey(
  timeSec: number,
  camera: Partial<{ x: number; y: number; zoom: number }>,
  easing: EasingId,
): CameraKey {
  return {
    id: pid("camkey"),
    timeSec,
    camera: { ...IDENTITY_CAMERA, ...camera },
    easing,
  };
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: "ken-burns-in",
    name: "Ken Burns — phóng vào",
    desc: "Lia nhẹ đồng thời phóng to dần vào điểm nhấn, mở đầu cảnh êm.",
    build: (d) => [
      camKey(0, { zoom: 1 }, "ease-in-out"),
      camKey(d, { zoom: 1.3 }, "linear"),
    ],
  },
  {
    id: "ken-burns-out",
    name: "Ken Burns — thu ra",
    desc: "Từ cận cảnh thu dần ra toàn cảnh, hợp kết đoạn/chuyển cảnh.",
    build: (d) => [
      camKey(0, { zoom: 1.3 }, "ease-in-out"),
      camKey(d, { zoom: 1 }, "linear"),
    ],
  },
  {
    id: "pan-left",
    name: "Lia trái",
    desc: "Máy lia ngang sang trái đều tốc, theo hướng đọc truyện.",
    build: (d) => [
      camKey(0, { x: 0.62 }, "ease-in-out"),
      camKey(d, { x: 0.38 }, "linear"),
    ],
  },
  {
    id: "pan-right",
    name: "Lia phải",
    desc: "Máy lia ngang sang phải, dẫn mắt tới chủ thể mới vào khung.",
    build: (d) => [
      camKey(0, { x: 0.38 }, "ease-in-out"),
      camKey(d, { x: 0.62 }, "linear"),
    ],
  },
  {
    id: "push-in-fast",
    name: "Đẩy nhanh (push-in)",
    desc: "Phóng nhanh vào chủ thể tạo căng thẳng, easing lấy đà ở đầu.",
    build: (d) => [
      camKey(0, { zoom: 1 }, "ease-in"),
      camKey(d, { zoom: 1.6 }, "linear"),
    ],
  },
  {
    id: "shake-light",
    name: "Rung nhẹ",
    desc: "Rung khung hình biên độ nhỏ — chấn động, hồi hộp, va chạm nhẹ.",
    build: (d) => {
      const keys: CameraKey[] = [camKey(0, {}, "linear")];
      const steps = Math.max(4, Math.floor(d * 6));
      for (let i = 1; i < steps; i++) {
        const t = (d * i) / steps;
        keys.push(
          camKey(
            t,
            {
              x: 0.5 + (i % 2 === 0 ? 0.008 : -0.008),
              y: 0.5 + (i % 3 === 0 ? 0.006 : -0.004),
            },
            "linear",
          ),
        );
      }
      keys.push(camKey(d, {}, "linear"));
      return keys;
    },
  },
];

export interface LayerPreset {
  id: string;
  name: string;
  desc: string;
  build: (durationSec: number) => TransformKey[];
}

function layerKey(
  timeSec: number,
  transform: Partial<{
    x: number;
    y: number;
    scale: number;
    rotation: number;
    opacity: number;
  }>,
  easing: EasingId,
): TransformKey {
  return {
    id: pid("key"),
    timeSec,
    transform: { ...IDENTITY_TRANSFORM, ...transform },
    easing,
  };
}

export const LAYER_PRESETS: LayerPreset[] = [
  {
    id: "float-in",
    name: "Trôi vào từ dưới",
    desc: "Layer mờ dần hiện lên đồng thời trôi nhẹ lên — mở cảnh mềm.",
    build: (d) => [
      layerKey(0, { y: 0.58, opacity: 0 }, "ease-out"),
      layerKey(Math.min(d, 1.2), { y: 0.5, opacity: 1 }, "linear"),
    ],
  },
  {
    id: "pop-in",
    name: "Bật vào (pop)",
    desc: "Phóng từ nhỏ tới nguyên cỡ với easing lấy đà — nhấn mạnh, vui nhộn.",
    build: (d) => [
      layerKey(0, { scale: 0.5, opacity: 0 }, "back"),
      layerKey(Math.min(d, 0.6), { scale: 1, opacity: 1 }, "linear"),
    ],
  },
  {
    id: "slide-in-left",
    name: "Trượt vào từ trái",
    desc: "Layer trượt từ ngoài khung trái vào vị trí — nhân vật bước vào cảnh.",
    build: (d) => [
      layerKey(0, { x: 0.15, opacity: 0 }, "ease-out"),
      layerKey(Math.min(d, 0.9), { x: 0.5, opacity: 1 }, "linear"),
    ],
  },
  {
    id: "fade-out",
    name: "Mờ dần biến mất",
    desc: "Layer mờ về 0 ở cuối cảnh — kết thúc mềm, chuyển cảnh.",
    build: (d) => [
      layerKey(Math.max(0, d - 1), { opacity: 1 }, "ease-in"),
      layerKey(d, { opacity: 0 }, "linear"),
    ],
  },
];
