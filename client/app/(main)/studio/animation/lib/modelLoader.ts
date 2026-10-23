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

const cache = new Map<string, Promise<THREE.Group>>();

async function fetchModelGroup(assetId: string): Promise<THREE.Group> {
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
  return outer;
}

/** Lấy một BẢN SAO của mô hình (đã chuẩn hoá), sẵn sàng đặt vào cảnh. */
export async function loadModelForScene(
  assetId: string,
): Promise<THREE.Object3D> {
  if (!cache.has(assetId)) {
    cache.set(assetId, fetchModelGroup(assetId));
  }
  const proto = await cache.get(assetId)!;
  return cloneSkeleton(proto) as THREE.Object3D;
}
