/**
 * Khớp chuyển động từ file khác sang nhân vật (clip retarget, Phase 4):
 * gắn clip xương của file .glb nguồn (ví dụ tải từ Mixamo) vào model đã
 * rig có tỉ lệ khác, để chuyển động chạy đúng dáng người mới thay vì méo.
 *
 * Cách làm (bake lúc gắn, mixer không đổi):
 * - Xoay: mỗi xương đích nhận một xoay bù cố định R0 đưa hướng xương
 *   gốc của đích về hướng xương gốc của nguồn; keyframe xoay nguồn q
 *   thành q * R0. Chứng minh tương đương với retargetPose (lib/retarget)
 *   nằm ở test: retargetPose bù tối thiểu theo từng dáng, và xoay bù
 *   tối thiểu đó chính bằng q * R0 * q⁻¹, nên qOut = q * R0.
 * - Vị trí hông: nhân tỉ lệ dài chân đích/nguồn (legLengthScale).
 * - Xương nào của clip không có trên nhân vật đích thì bỏ track đó và
 *   báo lại; không còn xương nào dùng được thì từ chối gắn.
 * - Tên xương nguồn hay mang tiền tố kiểu Mixamo ("mixamorig:Hips"):
 *   chuẩn hoá về tên chuẩn trước khi khớp, và track sau khi bake mang
 *   tên chuẩn để mixer tìm đúng xương đích.
 * - Track được clone rồi mới sửa (giữ nguyên kiểu nội suy gốc, kể cả
 *   CUBICSPLINE), không bao giờ sửa clip gốc dùng chung.
 */

import * as THREE from "three";
import type { RigJoint } from "./rig";
import {
  legLengthScale,
  quatApplyToVec,
  quatFromUnitVectors,
  quatMultiply,
  restDirection,
  type Quat,
} from "./retarget";

type V3 = [number, number, number];

/** Bỏ tiền tố kiểu Mixamo ("mixamorig:Hips" -> "Hips"). */
export function normalizeBoneName(name: string): string {
  return name.replace(/^mixamorig[:_]/i, "");
}

interface ParsedTrack {
  bone: string;
  property: "quaternion" | "position" | "scale";
}

function parseTrack(trackName: string): ParsedTrack | null {
  const m = /^(.*)\.(quaternion|position|scale)$/.exec(trackName);
  if (!m) return null;
  return { bone: normalizeBoneName(m[1]), property: m[2] as ParsedTrack["property"] };
}

/** Xoay bù cố định cho từng xương (chỉ xương có ở cả hai bên mới có). */
export function boneRetargetDeltas(
  sourceJoints: RigJoint[],
  targetJoints: RigJoint[],
): Map<string, Quat> {
  const targetNames = new Set(targetJoints.map((j) => j.name));
  const deltas = new Map<string, Quat>();
  for (const j of sourceJoints) {
    if (!targetNames.has(j.name)) continue;
    const dirS = restDirection(sourceJoints, j.name);
    const dirT = restDirection(targetJoints, j.name);
    deltas.set(j.name, quatFromUnitVectors(dirT, dirS));
  }
  return deltas;
}

export interface ClipFit {
  /** true khi cần bake (hướng xương gốc khác nhau hoặc tỉ lệ chân khác). */
  retarget: boolean;
  /** Xương của clip không có trên nhân vật đích. */
  missingBones: string[];
}

/** Quyết định clip dùng trực tiếp hay phải bake, và xương nào bị thiếu. */
export function decideClipFit(
  sourceJoints: RigJoint[],
  targetJoints: RigJoint[],
  clipBoneNames: string[],
): ClipFit {
  const targetNames = new Set(targetJoints.map((j) => j.name));
  const missingBones = clipBoneNames.filter((n) => !targetNames.has(n));
  let retarget = false;
  for (const name of clipBoneNames) {
    if (!targetNames.has(name)) continue;
    const dS = restDirection(sourceJoints, name);
    const dT = restDirection(targetJoints, name);
    if (dS[0] * dT[0] + dS[1] * dT[1] + dS[2] * dT[2] < 0.999999) {
      retarget = true;
      break;
    }
  }
  if (!retarget && Math.abs(legLengthScale(sourceJoints, targetJoints) - 1) > 0.01) {
    retarget = true;
  }
  return { retarget, missingBones };
}

/** Một khớp ở tư thế gốc (bind) — đầu vào để dựng RigJoint từ skeleton. */
export interface BindEntry {
  name: string;
  parentName: string | null;
  position: V3;
  quaternion: Quat;
}

/**
 * Dựng RigJoint (vị trí trong không gian gốc của skeleton) từ các
 * transform bind cục bộ. Cha có thể đứng sau con — tự giải đệ quy.
 */
export function bindToRigJoints(entries: BindEntry[]): RigJoint[] {
  const byName = new Map(entries.map((e) => [e.name, e]));
  const memo = new Map<string, { pos: V3; quat: Quat }>();
  const resolve = (name: string): { pos: V3; quat: Quat } => {
    const cached = memo.get(name);
    if (cached) return cached;
    const e = byName.get(name)!;
    let out: { pos: V3; quat: Quat };
    if (!e.parentName || !byName.has(e.parentName)) {
      out = { pos: e.position, quat: e.quaternion };
    } else {
      const p = resolve(e.parentName);
      const rotated = quatApplyToVec(p.quat, e.position);
      out = {
        pos: [p.pos[0] + rotated[0], p.pos[1] + rotated[1], p.pos[2] + rotated[2]],
        quat: quatMultiply(p.quat, e.quaternion),
      };
    }
    memo.set(name, out);
    return out;
  };
  return entries.map((e) => ({
    name: e.name,
    parent: e.parentName && byName.has(e.parentName) ? e.parentName : null,
    pos: resolve(e.name).pos,
  }));
}

/** RigJoint của model đang đứng trong cảnh, lấy từ bind của mixer. */
export function mixerBindToRigJoints(state: {
  bind: Map<
    THREE.Bone,
    { position: THREE.Vector3; quaternion: THREE.Quaternion }
  >;
}): RigJoint[] {
  const entries: BindEntry[] = [];
  for (const [bone, t] of state.bind) {
    const parent = bone.parent as THREE.Bone | null;
    entries.push({
      name: bone.name,
      parentName: parent && (parent as THREE.Bone).isBone ? parent.name : null,
      position: [t.position.x, t.position.y, t.position.z],
      quaternion: [t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w],
    });
  }
  return bindToRigJoints(entries);
}

/** RigJoint của skeleton trong file nguồn vừa parse (bind = transform lúc nạp). */
export function gltfBonesToRigJoints(bones: THREE.Bone[]): RigJoint[] {
  return bindToRigJoints(
    bones.map((bone) => {
      const parent = bone.parent as THREE.Bone | null;
      return {
        name: bone.name,
        parentName: parent && (parent as THREE.Bone).isBone ? parent.name : null,
        position: [bone.position.x, bone.position.y, bone.position.z] as V3,
        quaternion: [
          bone.quaternion.x,
          bone.quaternion.y,
          bone.quaternion.z,
          bone.quaternion.w,
        ] as Quat,
      };
    }),
  );
}

export interface BakedClip {
  clip: THREE.AnimationClip;
  /** "direct": dùng nguyên clip gốc; "retargeted": đã bake khớp sang nhân vật. */
  status: "direct" | "retargeted";
  missingBones: string[];
}

/**
 * Khớp một clip nguồn sang skeleton đích. Trả null khi không còn xương
 * nào của clip dùng được (để panel từ chối gắn thay vì gắn clip hỏng).
 * Khi skeleton đã khớp nhau thì trả nguyên clip gốc (không bake thừa).
 */
export function bakeClipForTarget(
  sourceClip: THREE.AnimationClip,
  sourceJoints: RigJoint[],
  targetJoints: RigJoint[],
): BakedClip | null {
  const parsed: Array<{ track: THREE.KeyframeTrack; bone: string; property: ParsedTrack["property"] }> = [];
  const boneNames: string[] = [];
  for (const t of sourceClip.tracks) {
    const p = parseTrack(t.name);
    if (!p) continue;
    parsed.push({ track: t, ...p });
    if (!boneNames.includes(p.bone)) boneNames.push(p.bone);
  }
  const { retarget, missingBones } = decideClipFit(sourceJoints, targetJoints, boneNames);
  const needsRename = parsed.some((p) => {
    const raw = /^(.*)\.(quaternion|position|scale)$/.exec(p.track.name)![1];
    return raw !== p.bone;
  });
  if (boneNames.filter((b) => !missingBones.includes(b)).length === 0) return null;
  if (!retarget && missingBones.length === 0 && !needsRename) {
    return { clip: sourceClip, status: "direct", missingBones: [] };
  }
  const deltas = boneRetargetDeltas(sourceJoints, targetJoints);
  const scale = legLengthScale(sourceJoints, targetJoints);
  const outTracks: THREE.KeyframeTrack[] = [];
  for (const t of sourceClip.tracks) {
    const p = parseTrack(t.name);
    if (!p) {
      outTracks.push(t);
      continue;
    }
    if (missingBones.includes(p.bone)) continue;
    const nt = t.clone();
    nt.name = `${p.bone}.${p.property}`;
    if (p.property === "quaternion") {
      const delta = deltas.get(p.bone);
      if (delta) {
        const src = t.values as ArrayLike<number>;
        const values = new Float32Array(src.length);
        for (let i = 0; i + 3 < src.length; i += 4) {
          const q: Quat = [src[i], src[i + 1], src[i + 2], src[i + 3]];
          const out = quatMultiply(q, delta);
          values[i] = out[0];
          values[i + 1] = out[1];
          values[i + 2] = out[2];
          values[i + 3] = out[3];
        }
        nt.values = values;
      }
    } else if (p.property === "position" && p.bone === "Hips") {
      // Vị trí hông theo tỉ lệ chân; mọi số trong track (kể cả tiếp tuyến
      // của CUBICSPLINE) đều nhân cùng tỉ lệ vì đây là phép biến đổi tuyến tính.
      nt.values = Float32Array.from(t.values as ArrayLike<number>, (v) => v * scale);
    }
    outTracks.push(nt);
  }
  if (outTracks.length === 0) return null;
  return {
    clip: new THREE.AnimationClip(`${sourceClip.name} (đã khớp)`, sourceClip.duration, outTracks),
    status: "retargeted",
    missingBones,
  };
}
