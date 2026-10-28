/**
 * Phòng Rig (Phase 3): nạp model, dựng xương, gắn da, xuất GLB kèm xương.
 *
 * Chạy trong trình duyệt (Three.js). Luồng: nạp GLB gốc → nướng
 * transform thế giới vào geometry (để xương và lưới cùng hệ toạ độ)
 * → tạo xương theo khớp → tính trọng số → bind → xuất GLB nhị phân.
 * Model đã có xương thì từ chối (không rig chồng).
 */

import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { computeSkinWeights, type RigJoint } from "./rig";
import { createAnimationGltfLoader, prepareLoadedVrm } from "./gltfLoader";

async function dataUrlToBuffer(dataUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(dataUrl);
  return res.arrayBuffer();
}

function bufferToDataUrl(buf: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("encode"));
    reader.readAsDataURL(new Blob([buf], { type: "model/gltf-binary" }));
  });
}

export interface LoadedModel {
  scene: THREE.Group;
  /** true khi model đã có xương sẵn (không cần rig nữa). */
  hasSkeleton: boolean;
  boneCount: number;
  meshCount: number;
  /** Chiều cao model (mét) theo bounding box — dùng để tự căn xương. */
  heightM: number;
}

export async function loadModelForRig(dataUrl: string): Promise<LoadedModel> {
  const buf = await dataUrlToBuffer(dataUrl);
  const loader = createAnimationGltfLoader();
  const gltf = await loader.parseAsync(buf, "");
  prepareLoadedVrm(gltf);
  const scene = gltf.scene;
  let hasSkeleton = false;
  let boneCount = 0;
  let meshCount = 0;
  scene.traverse((obj) => {
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) hasSkeleton = true;
    if ((obj as THREE.Bone).isBone) boneCount += 1;
    if ((obj as THREE.Mesh).isMesh) meshCount += 1;
  });
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  return { scene, hasSkeleton, boneCount, meshCount, heightM: Math.max(0.1, size.y) };
}

export interface RiggedResult {
  dataUrl: string;
  meshCount: number;
  vertexCount: number;
}

export interface RiggedRoot {
  root: THREE.Group;
  skeleton: THREE.Skeleton;
  boneByName: Map<string, THREE.Bone>;
  meshCount: number;
  vertexCount: number;
}

/**
 * Dựng cây xương + lưới đã gắn da (dùng chung cho xem trước và xuất
 * file). Ném lỗi khi model đã có xương hoặc không có lưới.
 */
export function buildRiggedRoot(
  scene: THREE.Group,
  joints: RigJoint[],
): RiggedRoot {
  const meshes: THREE.Mesh[] = [];
  scene.traverse((obj) => {
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
      throw new Error("Model này đã có xương sẵn, không cần rig lại.");
    }
    if ((obj as THREE.Mesh).isMesh) meshes.push(obj as THREE.Mesh);
  });
  if (meshes.length === 0) throw new Error("Không tìm thấy lưới nào trong model.");

  scene.updateMatrixWorld(true);
  const root = new THREE.Group();
  root.name = "RigRoot";
  const baked: THREE.SkinnedMesh[] = [];
  const allPositions: number[] = [];
  for (const mesh of meshes) {
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    const bakedMesh = new THREE.SkinnedMesh(geo, mesh.material);
    bakedMesh.name = mesh.name || "mesh";
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i += 1) {
      allPositions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    }
    baked.push(bakedMesh);
    root.add(bakedMesh);
  }
  // Xương: vị trí local = vị trí khớp trừ vị trí khớp cha.
  const jointByName = new Map(joints.map((j) => [j.name, j]));
  const bones = joints.map((joint) => {
    const bone = new THREE.Bone();
    bone.name = joint.name;
    if (joint.parent) {
      const parent = jointByName.get(joint.parent)!;
      bone.position.set(
        joint.pos[0] - parent.pos[0],
        joint.pos[1] - parent.pos[1],
        joint.pos[2] - parent.pos[2],
      );
    } else {
      bone.position.set(joint.pos[0], joint.pos[1], joint.pos[2]);
    }
    return bone;
  });
  const boneByName = new Map(bones.map((b) => [b.name, b]));
  joints.forEach((joint, idx) => {
    if (joint.parent) boneByName.get(joint.parent)!.add(bones[idx]);
    else root.add(bones[idx]);
  });
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const weights = computeSkinWeights(allPositions, joints);
  let offset = 0;
  let vertexCount = 0;
  for (const mesh of baked) {
    const posAttr = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const count = posAttr.count;
    vertexCount += count;
    const skinIndex = new Uint16Array(count * 4);
    const skinWeight = new Float32Array(count * 4);
    for (let i = 0; i < count; i += 1) {
      const idx = weights.skinIndex[offset + i];
      const w = weights.skinWeight[offset + i];
      for (let k = 0; k < 4; k += 1) {
        skinIndex[i * 4 + k] = idx[k] ?? 0;
        skinWeight[i * 4 + k] = w[k] ?? 0;
      }
    }
    offset += count;
    mesh.geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
    mesh.geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
    mesh.bind(skeleton, new THREE.Matrix4());
  }
  return { root, skeleton, boneByName, meshCount: baked.length, vertexCount };
}

/**
 * Xuất root đã rig thành GLB (root đã áp mọi chỉnh sửa: vết tô, khuôn mặt,
 * chất liệu — và phải ở tư thế gốc khi gọi).
 */
export async function exportRiggedRootToGlb(
  root: THREE.Group,
): Promise<RiggedResult> {
  let meshCount = 0;
  let vertexCount = 0;
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      meshCount += 1;
      const pos = (obj as THREE.Mesh).geometry.getAttribute("position");
      if (pos) vertexCount += pos.count;
    }
  });
  const outScene = new THREE.Scene();
  outScene.add(root);
  const exporter = new GLTFExporter();
  const buf = await exporter.parseAsync(outScene, { binary: true });
  const dataUrl = await bufferToDataUrl(buf as ArrayBuffer);
  return { dataUrl, meshCount, vertexCount };
}

/**
 * Xuất model đã rig thành GLB. Clip chuyển động dạng vật thể của
 * model gốc không giữ lại (clip xương cần bộ xương mới này).
 */
export async function buildRiggedGlb(
  scene: THREE.Group,
  joints: RigJoint[],
): Promise<RiggedResult> {
  const { root } = buildRiggedRoot(scene, joints);
  return exportRiggedRootToGlb(root);
}
