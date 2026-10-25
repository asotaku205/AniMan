/**
 * Nạp mô hình 3D (glTF/GLB) từ thư viện tài sản vào Three.js (Đợt Đ1).
 * Mô hình được CHUẨN HOÁ: chân chạm đất (min.y = 0) và chiều cao = 1 đơn
 * vị — vật thể trong cảnh chỉ cần scale theo `size` (mét). Kết quả cache
 * theo mã tài sản; mỗi lần dùng phải CLONE (SkeletonUtils) để các cảnh
 * không dùng chung một thực thể.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { listAnimAssets } from "./animStorage";
import type { Model3DAsset } from "./animAssets";
import type { RigJoint } from "./rig";
import { gltfBonesToRigJoints } from "./clipRetarget";

interface CachedModel {
  group: THREE.Group;
  /** Clip xương trong file GLB (có thể rỗng) — dùng chung, chỉ đọc. */
  clips: THREE.AnimationClip[];
}

const cache = new Map<string, Promise<CachedModel>>();

async function fetchModelGroup(assetId: string): Promise<CachedModel> {
  const assets = await listAnimAssets();
  const asset = assets.find(
    (a): a is Model3DAsset => a.kind === "model3d" && a.id === assetId,
  );
  if (!asset) throw new Error("Không tìm thấy mô hình trong thư viện.");
  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(asset.dataUrl, "");
  const group = new THREE.Group();
  group.add(gltf.scene);
  // Chuẩn hoá: đưa chân về y=0 và chiều cao về 1
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  const height = size.y > 0 ? size.y : 1;
  group.position.y = -box.min.y;
  const wrapper = new THREE.Group();
  wrapper.add(group);
  wrapper.scale.setScalar(1 / height);
  const outer = new THREE.Group();
  outer.add(wrapper);
  return { group: outer, clips: gltf.animations ?? [] };
}

/** Lấy một BẢN SAO của mô hình (đã chuẩn hoá), sẵn sàng đặt vào cảnh. */
export async function loadModelForScene(
  assetId: string,
): Promise<THREE.Object3D> {
  const { group } = await loadModelForSceneWithClips(assetId);
  return group;
}

/** Như loadModelForScene, kèm clip xương của file gốc. */
export async function loadModelForSceneWithClips(
  assetId: string,
): Promise<{ group: THREE.Object3D; clips: THREE.AnimationClip[] }> {
  if (!cache.has(assetId)) {
    cache.set(assetId, fetchModelGroup(assetId));
  }
  const proto = await cache.get(assetId)!;
  return { group: cloneSkeleton(proto.group) as THREE.Object3D, clips: proto.clips };
}

export interface ClipSourceAsset {
  /** Clip xương trong file nguồn (dùng chung, chỉ đọc). */
  clips: THREE.AnimationClip[];
  /** Xương gốc của file nguồn (để khớp sang nhân vật đích). */
  sourceJoints: RigJoint[];
  sourceName: string;
}

const clipSourceCache = new Map<string, Promise<ClipSourceAsset>>();

/**
 * Nạp một file nguồn làm kho chuyển động (Phase 4: gắn clip từ file
 * khác). Ném "not-found" khi tài sản không còn, "no-skeleton" khi file
 * không có xương. Kết quả cache theo mã tài sản.
 */
export async function loadClipSourceAsset(
  assetId: string,
): Promise<ClipSourceAsset> {
  if (!clipSourceCache.has(assetId)) {
    clipSourceCache.set(
      assetId,
      (async () => {
        const assets = await listAnimAssets();
        const asset = assets.find(
          (a): a is Model3DAsset => a.kind === "model3d" && a.id === assetId,
        );
        if (!asset) throw new Error("not-found");
        const loader = new GLTFLoader();
        const gltf = await loader.parseAsync(asset.dataUrl, "");
        const skinnedMeshes: THREE.SkinnedMesh[] = [];
        gltf.scene.traverse((obj) => {
          const skinned = obj as THREE.SkinnedMesh;
          if (skinned.isSkinnedMesh && skinned.skeleton) skinnedMeshes.push(skinned);
        });
        const skeleton = skinnedMeshes[0]?.skeleton ?? null;
        if (!skeleton) throw new Error("no-skeleton");
        return {
          clips: gltf.animations ?? [],
          sourceJoints: gltfBonesToRigJoints(skeleton.bones),
          sourceName: asset.name,
        };
      })(),
    );
  }
  return clipSourceCache.get(assetId)!;
}
