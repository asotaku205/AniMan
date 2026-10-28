/**
 * Dự án mẫu hoàn chỉnh (đưa quy trình làm phim mẫu vào sản phẩm): hai dự
 * án dựng sẵn bằng đúng thư viện tài sản + mô hình dữ liệu của AniMan —
 * có cảnh, phong cảnh, nhân vật, chuyển động, camera và lời thoại. Dự án
 * mẫu ĐÃ CÓ SẴN giọng đọc mẫu + nhạc nền (file tĩnh đóng gói kèm app,
 * ProjectHub nạp vào kho khi tạo) — mở ra phát thử là có tiếng ngay;
 * người dùng học theo rồi thu giọng của mình thay vào nếu muốn.
 *
 * Phần vẽ hình 2D dùng canvas tại trình duyệt (chạy khi người dùng bấm
 * tạo mẫu); dự án 3D thuần dữ liệu nên kiểm thử được.
 */

import {
  createAnimProject,
  createAnimScene,
  type AnimProject,
} from "./animProject";
import {
  createSceneLayer,
  IDENTITY_CAMERA,
  IDENTITY_TRANSFORM,
  type SceneLayer,
} from "./timeline";
import { newAssetId, type Model3DAsset } from "./animAssets";
import { bgmBlobKey, listAnimAssets, saveAnimAsset } from "./animStorage";
import { createPrevizObject, newPrevizId, vec3 } from "./previz";
import { createActionSegment } from "./actionTrack";
import { buildPreset } from "./sceneEnvironment";
import { DEFAULT_POST } from "./postFx";
import type { DialogueLine } from "./dialogue";

// ── Lời thoại mẫu (dùng chung cho bản dựng + kiểm thử cấu trúc) ──────────────

export const SAMPLE_DIALOGUE_2D: Array<{
  scene: string;
  speaker: string;
  text: string;
  startSec: number;
  durationSec: number;
}> = [
  { scene: "Chào buổi sáng", speaker: "Linh", text: "Chào buổi sáng! Hôm nay trời đẹp quá.", startSec: 0.3, durationSec: 3.9 },
  { scene: "Gọi bạn", speaker: "Hùng", text: "Linh ơi, đợi tớ với! Mình cùng đến trường nhé.", startSec: 0.3, durationSec: 4.8 },
  { scene: "Đến trường", speaker: "Linh", text: "Được thôi! Đi nào, kẻo muộn giờ học đấy.", startSec: 0.3, durationSec: 4.4 },
];

export const SAMPLE_DIALOGUE_3D: Array<{
  scene: string;
  speaker: string;
  text: string;
  startSec: number;
  durationSec: number;
}> = [
  { scene: "Tiết học cuối ngày", speaker: "Thầy giáo", text: "Các em mở sách ra, hôm nay chúng ta học bài mới.", startSec: 0.4, durationSec: 3.8 },
  { scene: "Ghé hiệu sách", speaker: "Linh", text: "Tan học rồi! Mình ghé hiệu sách một chút nhé.", startSec: 0.4, durationSec: 4.2 },
  { scene: "Tấm bản đồ trong gáy sách", speaker: "Linh", text: "Có ai đó đã giấu một tấm bản đồ ở đây.", startSec: 0.6, durationSec: 3.2 },
  { scene: "Kho báu dưới tán cây", speaker: "Hùng", text: "Kho báu là cuốn sách được chuyền tay cho người tiếp theo.", startSec: 0.6, durationSec: 3.7 },
];

export const SAMPLE_QUATERNIUS_MODEL_NAME = "Character Animated by Quaternius - DgOCW9ZCRJ";
const SAMPLE_QUATERNIUS_MODEL_URL = "/models/Character-Animated-by-Quaternius-DgOCW9ZCRJ.glb";

/** Bảo đảm model mẫu nằm trong thư viện chung để dự án còn mở được sau F5. */
export async function ensureSampleQuaterniusModel(): Promise<string> {
  const assets = await listAnimAssets();
  const existing = assets.find(
    (asset): asset is Model3DAsset =>
      asset.kind === "model3d" && asset.name === SAMPLE_QUATERNIUS_MODEL_NAME,
  );
  if (existing) return existing.id;

  const response = await fetch(SAMPLE_QUATERNIUS_MODEL_URL);
  if (!response.ok) throw new Error("Không tải được model GLB mẫu trong dự án.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const asset: Model3DAsset = {
    kind: "model3d",
    id: newAssetId("model"),
    name: SAMPLE_QUATERNIUS_MODEL_NAME,
    format: "glb",
    dataUrl: `data:model/gltf-binary;base64,${btoa(binary)}`,
    createdAt: Date.now(),
  };
  await saveAnimAsset(asset);
  return asset.id;
}

/**
 * Giọng mẫu đóng gói sẵn (dữ liệu base64 trong lib/sampleAudioData.ts,
 * sinh bằng giọng đọc tiếng Việt): mỗi cảnh mẫu có đúng 1 dòng thoại,
 * gắn 1 bản thu với id cố định. ProjectHub giải mã và nạp vào kho âm
 * thanh khi người dùng bấm tạo mẫu — nhờ vậy dự án mẫu mở ra là CÓ
 * TIẾNG ngay như phim mẫu gửi kèm, trên mọi máy checkout.
 */
export const SAMPLE_VOICE_FILES: Array<{
  kind: "2d" | "3d";
  sceneIndex: number;
  file: string;
  takeId: string;
}> = [
  { kind: "2d", sceneIndex: 0, file: "2d-1.mp3", takeId: "take-sample-2d-1" },
  { kind: "2d", sceneIndex: 1, file: "2d-2.mp3", takeId: "take-sample-2d-2" },
  { kind: "2d", sceneIndex: 2, file: "2d-3.mp3", takeId: "take-sample-2d-3" },
  { kind: "3d", sceneIndex: 0, file: "3d-1.mp3", takeId: "take-sample-3d-1" },
  { kind: "3d", sceneIndex: 1, file: "3d-2.mp3", takeId: "take-sample-3d-2" },
];

/** Gắn bản thu mẫu + nhạc nền mẫu vào dự án vừa dựng (chỉ dữ liệu — file
 * âm thanh thật do ProjectHub nạp vào kho theo SAMPLE_VOICE_FILES). */
function attachSampleAudio(project: AnimProject, kind: "2d" | "3d"): void {
  for (const entry of SAMPLE_VOICE_FILES.filter((e) => e.kind === kind)) {
    const line = project.scenes[entry.sceneIndex]?.dialogue?.[0];
    if (!line) continue;
    line.takes = [
      {
        id: entry.takeId,
        durationSec: line.durationSec,
        volume: 1,
        createdAt: 0,
        note: "Giọng mẫu có sẵn",
      },
    ];
    line.selectedTakeId = entry.takeId;
  }
  project.bgm = {
    blobKey: bgmBlobKey(project.id),
    name: "Nhạc nền mẫu — đệm nhẹ",
    volume: 0.35,
    loop: true,
  };
}

let sampleLineCounter = 0;
function sampleLine(
  item: (typeof SAMPLE_DIALOGUE_2D)[number],
): DialogueLine {
  sampleLineCounter += 1;
  return {
    id: `dlg-sample-${sampleLineCounter}`,
    speaker: item.speaker,
    text: item.text,
    startSec: item.startSec,
    durationSec: item.durationSec,
  };
}

// ── Vẽ hình 2D mẫu bằng canvas ───────────────────────────────────────────────

function makeImage(draw: (c: CanvasRenderingContext2D) => void): string {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  return canvas.toDataURL("image/png");
}

function bgMorning(): string {
  return makeImage((c) => {
    const g = c.createLinearGradient(0, 0, 0, 540);
    g.addColorStop(0, "#8ec9ee");
    g.addColorStop(1, "#e8f7ff");
    c.fillStyle = g;
    c.fillRect(0, 0, 960, 540);
    c.fillStyle = "#ffd94d";
    c.beginPath();
    c.arc(820, 90, 46, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.9)";
    for (const [x, y, w] of [[140, 80, 130], [420, 55, 100], [640, 120, 90]] as const) {
      c.beginPath();
      c.ellipse(x, y, w / 2, 22, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#79c26a";
    c.fillRect(0, 450, 960, 90);
    c.fillStyle = "#f4e3c2";
    c.fillRect(90, 300, 210, 150);
    c.fillStyle = "#c65b4e";
    c.beginPath();
    c.moveTo(75, 300);
    c.lineTo(195, 225);
    c.lineTo(315, 300);
    c.closePath();
    c.fill();
    c.fillStyle = "#7a4a2b";
    c.fillRect(170, 375, 50, 75);
    c.fillStyle = "#bfe3ff";
    c.fillRect(115, 330, 42, 42);
    c.fillRect(235, 330, 42, 42);
    c.fillStyle = "#7a4a2b";
    c.fillRect(700, 350, 22, 100);
    c.fillStyle = "#4e9e4e";
    for (const [x, y, r] of [[711, 320, 55], [665, 345, 40], [758, 345, 40]] as const) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  });
}

function bgStreet(): string {
  return makeImage((c) => {
    const g = c.createLinearGradient(0, 0, 0, 540);
    g.addColorStop(0, "#f7b267");
    g.addColorStop(1, "#f4845f");
    c.fillStyle = g;
    c.fillRect(0, 0, 960, 540);
    c.fillStyle = "#5b4a68";
    c.fillRect(30, 150, 150, 300);
    c.fillRect(790, 130, 140, 320);
    c.fillStyle = "#ffd94d";
    for (let i = 0; i < 6; i++) {
      c.fillRect(55 + (i % 2) * 70, 185 + Math.floor(i / 2) * 80, 26, 32);
      c.fillRect(815 + (i % 2) * 60, 165 + Math.floor(i / 2) * 85, 24, 30);
    }
    c.fillStyle = "#4a4a55";
    c.fillRect(0, 450, 960, 90);
    c.strokeStyle = "#ffe9a8";
    c.lineWidth = 5;
    c.setLineDash([36, 30]);
    c.beginPath();
    c.moveTo(0, 497);
    c.lineTo(960, 497);
    c.stroke();
  });
}

function bgSchool(): string {
  return makeImage((c) => {
    const g = c.createLinearGradient(0, 0, 0, 540);
    g.addColorStop(0, "#a8d8ff");
    g.addColorStop(1, "#eaf7ff");
    c.fillStyle = g;
    c.fillRect(0, 0, 960, 540);
    c.fillStyle = "#e8eef7";
    c.fillRect(280, 170, 400, 280);
    c.fillStyle = "#3f6fb5";
    c.beginPath();
    c.moveTo(255, 170);
    c.lineTo(480, 85);
    c.lineTo(705, 170);
    c.closePath();
    c.fill();
    c.fillStyle = "#ffffff";
    c.fillRect(385, 118, 190, 40);
    c.fillStyle = "#24508c";
    c.font = "700 24px sans-serif";
    c.textAlign = "center";
    c.fillText("TRƯỜNG HỌC", 480, 147);
    c.fillStyle = "#7a4a2b";
    c.fillRect(445, 360, 70, 90);
    c.fillStyle = "#bfe3ff";
    for (const [x, y] of [[320, 220], [590, 220], [320, 300], [590, 300]] as const)
      c.fillRect(x, y, 52, 46);
    c.fillStyle = "#79c26a";
    c.fillRect(0, 450, 960, 90);
  });
}

function characterImage(shirt: string, hair: string, longHair: boolean): string {
  return makeImage((c) => {
    const cx = 480;
    c.fillStyle = "#3a3a4a";
    c.fillRect(cx - 34, 398, 24, 62);
    c.fillRect(cx + 10, 398, 24, 62);
    c.fillStyle = "#22222e";
    c.fillRect(cx - 38, 456, 32, 12);
    c.fillRect(cx + 6, 456, 32, 12);
    c.fillStyle = shirt;
    c.beginPath();
    c.roundRect(cx - 52, 292, 104, 112, 18);
    c.fill();
    c.fillRect(cx - 74, 300, 20, 88);
    c.fillRect(cx + 54, 300, 20, 88);
    c.fillStyle = "#f2c09a";
    c.beginPath();
    c.arc(cx, 246, 36, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = hair;
    c.beginPath();
    c.arc(cx, 238, 38, Math.PI, Math.PI * 2);
    c.fill();
    if (longHair) {
      c.fillRect(cx - 40, 238, 14, 74);
      c.fillRect(cx + 26, 238, 14, 74);
    }
    c.fillStyle = "#26262e";
    c.beginPath();
    c.arc(cx - 13, 248, 3.6, 0, Math.PI * 2);
    c.arc(cx + 13, 248, 3.6, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#26262e";
    c.lineWidth = 2.4;
    c.beginPath();
    c.arc(cx, 258, 9, 0.15 * Math.PI, 0.85 * Math.PI);
    c.stroke();
  });
}

// ── Dựng hai dự án mẫu ───────────────────────────────────────────────────────

const key = (
  timeSec: number,
  x: number,
  scale = 1,
): SceneLayer["keys"][number] => ({
  id: `k-${timeSec}-${x}`,
  timeSec,
  transform: { ...IDENTITY_TRANSFORM, x, scale },
  easing: "ease-in-out",
});

function layerWith(
  name: string,
  image: string,
  keys: SceneLayer["keys"],
): SceneLayer {
  const layer = createSceneLayer(name, "#2b2440");
  layer.imageDataUrl = image;
  layer.keys = keys;
  return layer;
}

export function buildSampleProject2D(): AnimProject {
  const project = createAnimProject(
    "Dự án mẫu 2D — Buổi sáng của Linh",
    "2d",
  );
  const linh = characterImage("#e85d75", "#4a2c1a", true);
  const hung = characterImage("#3f7fbf", "#1c1c22", false);

  const s1 = createAnimScene("Chào buổi sáng", 5);
  s1.timeline = {
    layers: [
      layerWith("Nền buổi sáng", bgMorning(), [key(0, 0.5)]),
      layerWith("Linh", linh, [key(0, 0.44, 0.96), key(5, 0.5, 1)]),
    ],
    cameraKeys: [
      { id: "cam-s1-a", timeSec: 0, camera: { ...IDENTITY_CAMERA }, easing: "ease-in-out" },
      { id: "cam-s1-b", timeSec: 5, camera: { x: 0.5, y: 0.5, zoom: 1.1 }, easing: "ease-in-out" },
    ],
  };
  s1.dialogue = [sampleLine(SAMPLE_DIALOGUE_2D[0])];

  const s2 = createAnimScene("Gọi bạn", 5.5);
  s2.timeline = {
    layers: [
      layerWith("Nền đường phố", bgStreet(), [key(0, 0.5)]),
      layerWith("Linh", linh, [key(0, 0.64)]),
      layerWith("Hùng", hung, [key(0, 0.16), key(5.5, 0.34)]),
    ],
    cameraKeys: [],
  };
  s2.dialogue = [sampleLine(SAMPLE_DIALOGUE_2D[1])];

  const s3 = createAnimScene("Đến trường", 5);
  s3.timeline = {
    layers: [
      layerWith("Nền trường học", bgSchool(), [key(0, 0.5)]),
      layerWith("Linh", linh, [key(0, 0.4), key(5, 0.47)]),
      layerWith("Hùng", hung, [key(0, 0.24), key(5, 0.31)]),
    ],
    cameraKeys: [
      { id: "cam-s3-a", timeSec: 0, camera: { x: 0.46, y: 0.5, zoom: 1.05 }, easing: "ease-in-out" },
      { id: "cam-s3-b", timeSec: 5, camera: { x: 0.54, y: 0.5, zoom: 1.05 }, easing: "ease-in-out" },
    ],
  };
  s3.dialogue = [sampleLine(SAMPLE_DIALOGUE_2D[2])];

  project.scenes = [s1, s2, s3];
  attachSampleAudio(project, "2d");
  return project;
}

function sampleActor(
  name: string,
  modelAssetId: string,
  size: number,
  start: { x: number; z: number },
  end?: { timeSec: number; x: number; z: number },
  clip?: string,
): ReturnType<typeof createPrevizObject> {
  const actor = createPrevizObject("model", name);
  actor.modelAssetId = modelAssetId;
  actor.size = size;
  actor.keys = [
    { ...actor.keys[0], position: vec3(start.x, 0, start.z), rotationY: 0 },
    ...(end
      ? [{
          id: newPrevizId("pkey"),
          timeSec: end.timeSec,
          position: vec3(end.x, 0, end.z),
          rotationY: 0,
          poseId: "stand",
          easing: "ease-in-out" as const,
        }]
      : []),
  ];
  if (clip) actor.actions = [createActionSegment(clip, 0, end?.timeSec ?? 5)];
  return actor;
}

function sampleProp(
  kind: "box" | "cylinder" | "wall",
  name: string,
  color: string,
  size: number,
  x: number,
  y: number,
  z: number,
) {
  const object = createPrevizObject(kind, name);
  object.color = color;
  object.size = size;
  object.keys[0] = { ...object.keys[0], position: vec3(x, y, z) };
  return object;
}

export function buildSampleProject3D(
  modelAssetId = "sample-quaternius-character-animated",
  existingProject?: Pick<AnimProject, "id" | "createdAt">,
): AnimProject {
  const project = createAnimProject("Dự án mẫu 3D — Tấm bản đồ trong gáy sách", "3d");
  if (existingProject) {
    project.id = existingProject.id;
    project.createdAt = existingProject.createdAt;
    project.updatedAt = Date.now();
  }
  project.fps = 24;
  const room = buildPreset("room");
  const street = buildPreset("street");
  const forest = buildPreset("forest");

  // 1 — Lời dặn trong lớp học mở câu chuyện về cuốn sách cũ.
  const teacher = sampleActor("Thầy giáo", modelAssetId, 1.72, { x: -1.1, z: -1.2 }, undefined, "Idle");
  const maiClass = sampleActor("Mai", modelAssetId, 1.62, { x: 1.05, z: 0.1 }, undefined, "Idle");
  const s1 = createAnimScene("Tiết học cuối ngày", 5);
  s1.environment = { ...room.environment, time: 15, weather: "clear" };
  s1.previz = {
    backdrop: "#c5d9e8",
    objects: [
      ...room.objects.slice(0, 3),
      sampleProp("box", "Bàn giáo viên", "#76513a", 1.1, -1.1, 0, -1.55),
      sampleProp("box", "Bàn học", "#8b6749", 0.85, 1, 0, 0.35),
      sampleProp("box", "Cuốn sách xanh", "#315f70", 0.24, 1, 0.92, 0.28),
      teacher,
      maiClass,
    ],
    cameraKeys: [
      { id: newPrevizId("cam"), timeSec: 0, position: vec3(0.2, 2.3, 7.2), target: vec3(0, 1.15, -0.7), easing: "ease-in-out" },
      { id: newPrevizId("cam"), timeSec: 5, position: vec3(1.35, 1.8, 5.6), target: vec3(0.8, 1.05, -0.1), easing: "ease-in-out" },
    ],
  };
  s1.dialogue = [sampleLine(SAMPLE_DIALOGUE_3D[0])];
  s1.shotType = "Trung cảnh";

  // 2 — Tan học, Mai và Hùng tìm tới hiệu sách cũ trong cơn mưa đầu mùa.
  const maiStreet = sampleActor("Mai", modelAssetId, 1.62, { x: -2.8, z: 1.2 }, { timeSec: 5.5, x: 0.5, z: 0.9 }, "Walk");
  const hungStreet = sampleActor("Hùng", modelAssetId, 1.7, { x: -3.5, z: 2.3 }, { timeSec: 5.5, x: -0.3, z: 2 }, "Walk");
  const s2 = createAnimScene("Ghé hiệu sách", 5.5);
  s2.environment = { ...street.environment, time: 17.4, weather: "rain", fogDensity: 0.18 };
  s2.weather = { type: "rain", intensity: 0.55 };
  s2.previz = {
    backdrop: "#53677a",
    objects: [
      ...street.objects,
      sampleProp("wall", "Hiệu sách Mưa", "#6f5367", 2.5, 3.2, 0, -3.8),
      sampleProp("box", "Biển hiệu hiệu sách", "#e8bd78", 0.45, 3.2, 2.55, -3.5),
      maiStreet,
      hungStreet,
    ],
    cameraKeys: [
      { id: newPrevizId("cam"), timeSec: 0, position: vec3(-0.4, 2.4, 8), target: vec3(-0.5, 1.1, 0.5), easing: "ease-in-out" },
      { id: newPrevizId("cam"), timeSec: 5.5, position: vec3(1.5, 2, 6.1), target: vec3(0.8, 1.05, 0.5), easing: "ease-in-out" },
    ],
  };
  s2.dialogue = [sampleLine(SAMPLE_DIALOGUE_3D[1])];
  s2.shotType = "Toàn cảnh";

  // 3 — Một tấm bản đồ được giấu trong gáy quyển sách, clip PickUp lấy
  // thẳng từ file GLB để minh họa chuyển động model thật.
  const maiShop = sampleActor("Mai", modelAssetId, 1.62, { x: -1.25, z: 0.2 }, { timeSec: 4.8, x: -0.65, z: 0.2 }, "Idle");
  maiShop.actions = [
    createActionSegment("Idle", 0, 1.8),
    createActionSegment("PickUp", 1.8, 3),
  ];
  const hungShop = sampleActor("Hùng", modelAssetId, 1.7, { x: 1.45, z: 0.5 }, undefined, "Idle");
  const s3 = createAnimScene("Tấm bản đồ trong gáy sách", 4.8);
  s3.environment = { ...room.environment, time: 18.1, weather: "rain", fogDensity: 0.08 };
  s3.previz = {
    backdrop: "#31364a",
    objects: [
      ...room.objects.slice(0, 3),
      sampleProp("box", "Kệ sách trái", "#624b42", 1.45, -3.1, 0, -1.1),
      sampleProp("box", "Kệ sách phải", "#76533e", 1.5, 3.1, 0, -1.1),
      sampleProp("box", "Quầy sách", "#815d45", 1.05, 0.2, 0, -2.2),
      sampleProp("box", "Quyển sách cũ", "#8b4e3f", 0.28, -0.65, 1.05, -2.15),
      maiShop,
      hungShop,
    ],
    cameraKeys: [
      { id: newPrevizId("cam"), timeSec: 0, position: vec3(-3.7, 2.2, 6.8), target: vec3(0, 1.1, -0.8), easing: "ease-in-out" },
      { id: newPrevizId("cam"), timeSec: 4.8, position: vec3(-0.8, 1.7, 4.7), target: vec3(-0.5, 1.05, -1.3), easing: "ease-in-out" },
    ],
  };
  s3.dialogue = [sampleLine(SAMPLE_DIALOGUE_3D[2])];
  s3.shotType = "Cận cảnh";

  // 4 — Bản đồ dẫn tới gốc cây phượng; món quà là sách để lại cho người sau.
  const maiFinal = sampleActor("Mai", modelAssetId, 1.62, { x: -2.4, z: 2.2 }, { timeSec: 5, x: -0.4, z: 0.5 }, "Walk");
  const hungFinal = sampleActor("Hùng", modelAssetId, 1.7, { x: 2.4, z: 2.7 }, { timeSec: 5, x: 0.65, z: 0.7 }, "Walk");
  const s4 = createAnimScene("Kho báu dưới tán cây", 5);
  s4.environment = { ...forest.environment, time: 7.1, weather: "clear", fogDensity: 0.04 };
  s4.previz = {
    backdrop: "#a7c9da",
    objects: [
      ...forest.objects,
      sampleProp("cylinder", "Cây phượng già", "#9b6847", 3.4, 0, 0, -2.3),
      sampleProp("box", "Hộp sách gỗ", "#805b3c", 0.65, 0.15, 0, -0.9),
      sampleProp("box", "Cuốn sách trao lại", "#d3b273", 0.24, 0.15, 0.68, -0.9),
      maiFinal,
      hungFinal,
    ],
    cameraKeys: [
      { id: newPrevizId("cam"), timeSec: 0, position: vec3(0, 3.2, 10), target: vec3(0, 1.1, 0), easing: "ease-in-out" },
      { id: newPrevizId("cam"), timeSec: 5, position: vec3(1.4, 2.4, 7.2), target: vec3(0, 1.1, 0), easing: "ease-in-out" },
    ],
  };
  s4.dialogue = [sampleLine(SAMPLE_DIALOGUE_3D[3])];
  s4.shotType = "Toàn cảnh kết";

  project.scenes = [s1, s2, s3, s4];
  project.post = {
    ...DEFAULT_POST,
    creditsLines: ["TẤM BẢN ĐỒ TRONG GÁY SÁCH", "Một phim ngắn dựng trong AniMan", "Model: Quaternius Character Animated"],
  };
  attachSampleAudio(project, "3d");
  return project;
}
