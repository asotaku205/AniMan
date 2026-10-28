/**
 * Bộ kiểm tra mô hình 3D (GLB): đọc phần đầu file .glb (khối JSON khai
 * báo cấu trúc) để trả lời ngay khi nạp — mô hình có XƯƠNG không, có
 * những CLIP CHUYỂN ĐỘNG nào, bao nhiêu tam giác, nặng bao nhiêu — kèm
 * cảnh báo theo ngân sách của sa bàn/phim web. Đây là tiền đề để dùng
 * nhân vật có rig thật (từ Meshy/Tripo/Mixamo...) thay cho mannequin
 * tĩnh. Hàm thuần, không cần tải cả mô hình lên bộ nhớ đồ hoạ.
 */

export interface ModelAnimationInfo {
  name: string;
  durationSec: number;
}

export interface ModelInspection {
  format: "glb" | "vrm";
  fileBytes: number;
  triangleCount: number;
  meshCount: number;
  materialCount: number;
  textureCount: number;
  hasSkeleton: boolean;
  boneCount: number;
  humanoidBoneCount: number;
  expressionCount: number;
  expressionNames: string[];
  animations: ModelAnimationInfo[];
  warnings: string[];
}

/** Ngân sách khuyến nghị cho một mô hình dùng trong app web. */
export const GLB_TRIANGLE_BUDGET = 50_000;
export const GLB_SIZE_BUDGET = 5 * 1024 * 1024;

interface GltfAccessor {
  count: number;
  max?: number[];
}
interface GltfPrimitive {
  attributes: Record<string, number>;
  indices?: number;
  mode?: number;
}
interface GltfJson {
  meshes?: Array<{ primitives: GltfPrimitive[] }>;
  materials?: unknown[];
  textures?: unknown[];
  skins?: Array<{ joints: number[] }>;
  animations?: Array<{
    name?: string;
    samplers: Array<{ input: number }>;
  }>;
  accessors?: GltfAccessor[];
  extensions?: Record<string, unknown>;
}

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"

/** Phân tích một buffer GLB. Ném lỗi nếu không phải GLB hợp lệ. */
export function inspectGlbBuffer(buf: ArrayBuffer): ModelInspection {
  const view = new DataView(buf);
  if (buf.byteLength < 20 || view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error("not-glb");
  }
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== CHUNK_JSON) throw new Error("not-glb");
  const jsonText = new TextDecoder().decode(
    new Uint8Array(buf, 20, jsonLength),
  );
  const json = JSON.parse(jsonText) as GltfJson;
  const accessors = json.accessors ?? [];

  let triangleCount = 0;
  let meshCount = 0;
  for (const mesh of json.meshes ?? []) {
    meshCount += 1;
    for (const prim of mesh.primitives) {
      const count =
        prim.indices != null
          ? (accessors[prim.indices]?.count ?? 0)
          : (accessors[prim.attributes.POSITION]?.count ?? 0);
      const mode = prim.mode ?? 4;
      if (mode === 4) triangleCount += count / 3;
      else if (mode === 5 || mode === 6) triangleCount += Math.max(0, count - 2);
    }
  }

  const skins = json.skins ?? [];
  const boneCount = skins.reduce((sum, s) => sum + s.joints.length, 0);
  const hasSkeleton = skins.length > 0;
  const vrm0 = json.extensions?.VRM as
    | { humanoid?: { humanBones?: unknown[] }; blendShapeMaster?: { blendShapeGroups?: unknown[] } }
    | undefined;
  const vrm1 = json.extensions?.VRMC_vrm as
    | { humanoid?: { humanBones?: Record<string, unknown> }; expressions?: { preset?: Record<string, unknown>; custom?: Record<string, unknown> } }
    | undefined;
  const humanoidBoneCount = Array.isArray(vrm0?.humanoid?.humanBones)
    ? vrm0.humanoid.humanBones.length
    : Object.keys(vrm1?.humanoid?.humanBones ?? {}).length;
  const expressionCount = Array.isArray(vrm0?.blendShapeMaster?.blendShapeGroups)
    ? vrm0.blendShapeMaster.blendShapeGroups.length
    : Object.keys(vrm1?.expressions?.preset ?? {}).length +
      Object.keys(vrm1?.expressions?.custom ?? {}).length;
  const expressionNames = Array.isArray(vrm0?.blendShapeMaster?.blendShapeGroups)
    ? vrm0.blendShapeMaster.blendShapeGroups
        .map((group) => (group as { name?: string }).name?.trim() ?? "")
        .filter(Boolean)
    : [
        ...Object.keys(vrm1?.expressions?.preset ?? {}),
        ...Object.keys(vrm1?.expressions?.custom ?? {}),
      ];
  const format = vrm0 || vrm1 ? "vrm" : "glb";

  const animations: ModelAnimationInfo[] = (json.animations ?? []).map(
    (anim, i) => {
      let duration = 0;
      for (const sampler of anim.samplers) {
        const acc = accessors[sampler.input];
        if (acc?.max?.[0] != null) duration = Math.max(duration, acc.max[0]);
      }
      return {
        name: anim.name?.trim() || `Clip ${i + 1}`,
        durationSec: Math.round(duration * 100) / 100,
      };
    },
  );

  const warnings: string[] = [];
  if (format === "vrm" && humanoidBoneCount === 0) {
    warnings.push("VRM không khai báo bộ xương humanoid đầy đủ — không thể đảm bảo retarget chuyển động.");
  }
  if (triangleCount > GLB_TRIANGLE_BUDGET) {
    warnings.push(
      `Mô hình nặng: ${Math.round(triangleCount).toLocaleString("vi-VN")} tam giác (khuyến nghị dưới ${GLB_TRIANGLE_BUDGET.toLocaleString("vi-VN")}) — phim có thể giật, hãy giảm đa giác (decimate) trong Blender.`,
    );
  }
  if (buf.byteLength > GLB_SIZE_BUDGET) {
    warnings.push(
      "Dung lượng hơn 5MB — tải chậm và tốn bộ nhớ; hãy nén texture xuống 1024 và dùng bản rút gọn.",
    );
  }
  if (!hasSkeleton) {
    warnings.push(
      "Không có xương — đây là mô hình tĩnh: đặt được vào cảnh nhưng không có chuyển động người (đi, chạy...). Muốn có chuyển động, gắn xương bằng Meshy/Tripo/Mixamo rồi nạp lại.",
    );
  } else if (animations.length === 0) {
    warnings.push(
      "Có xương nhưng chưa có sẵn clip chuyển động nào trong file — cần bake clip (Idle, Walk...) vào GLB khi xuất từ Blender/dịch vụ gắn xương.",
    );
  }

  return {
    format,
    fileBytes: buf.byteLength,
    triangleCount: Math.round(triangleCount),
    meshCount,
    materialCount: json.materials?.length ?? 0,
    textureCount: json.textures?.length ?? 0,
    hasSkeleton,
    boneCount,
    humanoidBoneCount,
    expressionCount,
    expressionNames,
    animations,
    warnings,
  };
}

/** Phân tích từ data URL (định dạng thư viện tài sản đang lưu). */
export function inspectGlbDataUrl(dataUrl: string): ModelInspection | null {
  try {
    const base64 = dataUrl.split(",")[1];
    if (!base64) return null;
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return inspectGlbBuffer(bytes.buffer as ArrayBuffer);
  } catch {
    return null;
  }
}

/** Một dòng tóm tắt ngắn để hiển thị cạnh tên mô hình. */
export function inspectionSummary(insp: ModelInspection): string {
  const parts = [
    insp.format === "vrm" ? "VRM anime" : "GLB",
    `${insp.triangleCount.toLocaleString("vi-VN")} tam giác`,
    insp.hasSkeleton ? `${insp.boneCount} xương` : "không xương",
  ];
  if (insp.animations.length > 0) {
    parts.push(
      `${insp.animations.length} clip: ${insp.animations.map((a) => a.name).join(", ")}`,
    );
  }
  if (insp.format === "vrm") {
    parts.push(`${insp.humanoidBoneCount} xương humanoid`);
    parts.push(
      insp.expressionCount > 0
        ? `${insp.expressionCount} biểu cảm${insp.expressionNames.length ? ` (${insp.expressionNames.slice(0, 4).join(", ")}${insp.expressionNames.length > 4 ? "…" : ""})` : ""}`
        : "chưa có biểu cảm",
    );
  }
  parts.push(
    insp.fileBytes >= 1024 * 1024
      ? `${(insp.fileBytes / 1024 / 1024).toFixed(1)}MB`
      : `${Math.max(1, Math.round(insp.fileBytes / 1024))}KB`,
  );
  return parts.join(" · ");
}
