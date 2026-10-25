/**
 * Mẫu dự án phim (giai đoạn D): bấm một cái là có khung dự án đầy đủ
 * cảnh/nhân vật/hậu kỳ mẫu — sửa thoải mái thành phim của mình.
 * Mẫu không kèm giọng đọc: thoại hiện phụ đề, người dùng thu giọng
 * trong mục Thoại của từng cảnh.
 */

import {
  createAnimProject,
  createAnimScene,
  type AnimProject,
} from "./animProject";
import { buildShotKeys } from "./cameraShots";
import { DEFAULT_POST } from "./postFx";
import { newDialogueId } from "./dialogue";
import {
  createPrevizObject,
  newPrevizId,
  vec3,
  type PrevizCameraKey,
} from "./previz";
import { EXPORT_PRESETS, type ExportPresetId } from "./exportPresets";

export type ProjectTemplateId = "short-3scenes" | "mv" | "ad";

export const PROJECT_TEMPLATES: Array<{
  id: ProjectTemplateId;
  label: string;
  desc: string;
}> = [
  {
    id: "short-3scenes",
    label: "Phim ngắn 3 cảnh",
    desc: "Mở đầu – xung đột – kết thúc, khung ngang 16:9.",
  },
  {
    id: "mv",
    label: "MV dọc",
    desc: "3 cảnh quay chuyển động, khung dọc 9:16.",
  },
  {
    id: "ad",
    label: "Quảng cáo 30s",
    desc: "3 cảnh đúng 30 giây, có chữ chạy dưới giới thiệu sản phẩm.",
  },
];

function camKey(
  timeSec: number,
  position: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
): PrevizCameraKey {
  return {
    id: newPrevizId("camkey"),
    timeSec,
    position: vec3(position.x, position.y, position.z),
    target: vec3(target.x, target.y, target.z),
    easing: "ease-in-out",
  };
}

function line(
  speaker: string,
  text: string,
  startSec: number,
  durationSec: number,
) {
  return {
    id: newDialogueId(),
    text,
    startSec,
    durationSec,
    speaker,
  };
}

function hero(name: string, x: number, z: number) {
  const obj = createPrevizObject("character", name);
  obj.keys = [
    {
      ...obj.keys[0],
      position: vec3(x, 0, z),
    },
  ];
  return obj;
}

function withPost(
  project: AnimProject,
  preset: ExportPresetId,
  creditsLines: string[],
): AnimProject {
  const p = EXPORT_PRESETS[preset];
  return {
    ...project,
    exportPreset: preset,
    post: {
      ...DEFAULT_POST,
      transition: p.transition,
      grade: p.grade,
      titleCard: p.titleCard,
      creditsLines,
    },
  };
}

function buildShort(): AnimProject {
  const project = createAnimProject("Mẫu phim ngắn — 3 cảnh", "3d");
  const s1 = createAnimScene("Mở đầu — Buổi sáng", 5);
  s1.previz = {
    backdrop: "#141126",
    objects: [hero("Linh", -1, 0)],
    cameraKeys: [
      camKey(0, { x: 0, y: 1.7, z: 6.2 }, { x: 0, y: 1.2, z: -1 }),
      camKey(5, { x: 0, y: 1.5, z: 3.4 }, { x: -0.6, y: 1.2, z: -1 }),
    ],
  };
  s1.dialogue = [line("Linh", "Một buổi sáng bình thường, cho đến khi…", 0.4, 3.5)];
  const s2 = createAnimScene("Xung đột — Cơn mưa", 6);
  s2.previz = {
    backdrop: "#1a1430",
    objects: [hero("Linh", 0, 0), hero("Hùng", 2, 1)],
    cameraKeys: [
      camKey(0, { x: -2, y: 2, z: 7 }, { x: 0, y: 1, z: 0 }),
      camKey(6, { x: 2, y: 1.6, z: 5 }, { x: 0.5, y: 1.1, z: 0 }),
    ],
  };
  s2.dialogue = [line("Hùng", "Đợi đã! Cậu không thể đi như vậy được.", 0.4, 4)];
  const s3 = createAnimScene("Kết thúc — Cầu vồng", 5);
  s3.previz = {
    backdrop: "#241a3f",
    objects: [hero("Linh", -0.5, 0), hero("Hùng", 1, 0.5)],
    cameraKeys: [
      camKey(0, { x: 0, y: 1.6, z: 6 }, { x: 0, y: 1.1, z: 0 }),
      camKey(5, { x: 0, y: 2.2, z: 8 }, { x: 0, y: 1.2, z: 0 }),
    ],
  };
  s3.dialogue = [line("Linh", "Ừ, mình cùng đi tiếp nhé.", 0.4, 3)];
  project.scenes = [s1, s2, s3];
  return withPost(project, "short-16x9", [
    "Phim ngắn mẫu",
    "Làm bằng AniMan",
  ]);
}

function buildMv(): AnimProject {
  const project = createAnimProject("Mẫu MV dọc", "3d");
  const mk = (
    name: string,
    dur: number,
    keys: PrevizCameraKey[],
    lower: string,
  ) => {
    const s = createAnimScene(name, dur);
    s.previz = {
      backdrop: "#141126",
      objects: [hero("Ca sĩ", 0, 0)],
      cameraKeys: keys,
    };
    s.lowerThird = {
      name: lower,
      role: "Ca khúc mẫu",
      position: "bottom-left",
      startSec: 0.5,
      durationSec: Math.min(3, dur - 0.5),
    };
    return s;
  };
  const orbit = buildShotKeys("orbit", {
    startTimeSec: 0,
    durationSec: 4,
    fromPosition: vec3(0, 1.6, 5),
    fromTarget: vec3(0, 1.1, 0),
    targetPosition: vec3(0, 1.1, 0),
    angleDeg: 120,
  }).keys;
  const s1 = mk(
    "Đoạn 1 — Mở đầu",
    4,
    [camKey(0, { x: 0, y: 1.6, z: 6 }, { x: 0, y: 1.1, z: 0 })],
    "Ca sĩ",
  );
  const s2 = mk("Đoạn 2 — Điệp khúc", 4, orbit, "Điệp khúc");
  const s3 = mk(
    "Đoạn 3 — Kết",
    4,
    [camKey(0, { x: 0, y: 2.2, z: 7 }, { x: 0, y: 1.2, z: 0 })],
    "Cảm ơn đã xem",
  );
  project.scenes = [s1, s2, s3];
  return withPost(project, "mv-9x16", ["MV mẫu", "Làm bằng AniMan"]);
}

function buildAd(): AnimProject {
  const project = createAnimProject("Mẫu quảng cáo 30s", "3d");
  const mk = (
    name: string,
    dur: number,
    productLine: string,
  ) => {
    const s = createAnimScene(name, dur);
    s.previz = {
      backdrop: "#141126",
      objects: [hero("Người dùng", 0, 0)],
      cameraKeys: [
        camKey(0, { x: 0, y: 1.7, z: 6 }, { x: 0, y: 1.1, z: 0 }),
        camKey(dur, { x: 0, y: 1.5, z: 4 }, { x: 0, y: 1.2, z: 0 }),
      ],
    };
    s.lowerThird = {
      name: productLine,
      role: "Sản phẩm mẫu",
      position: "bottom-left",
      startSec: 0.5,
      durationSec: Math.min(4, dur - 0.5),
    };
    return s;
  };
  project.scenes = [
    mk("Vấn đề — 10s", 10, "Bạn có gặp vấn đề này?"),
    mk("Giải pháp — 10s", 10, "Đây là cách giải quyết"),
    mk("Kêu gọi — 10s", 10, "Thử ngay hôm nay!"),
  ];
  return withPost(project, "ad-30s", ["Quảng cáo mẫu", "Làm bằng AniMan"]);
}

export function buildTemplateProject(id: ProjectTemplateId): AnimProject {
  switch (id) {
    case "mv":
      return buildMv();
    case "ad":
      return buildAd();
    case "short-3scenes":
    default:
      return buildShort();
  }
}
