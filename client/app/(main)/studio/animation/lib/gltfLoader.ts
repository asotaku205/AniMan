/** GLTFLoader dùng chung cho GLB và VRM trong Animation Studio. */

import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import type { VRM } from "@pixiv/three-vrm";
import type * as THREE from "three";

export function createAnimationGltfLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  // Cùng kho tài sản với World Builder: file Draco phải đọc được ở
  // cả hai studio, file giải nén lấy từ CDN gstatic (repo không chứa
  // được file nhị phân wasm qua kênh đẩy snapshot).
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  loader.setDRACOLoader(draco);
  return loader;
}

/** Chuẩn hóa hướng nhìn VRM 0.x; VRM 1.x được giữ nguyên. */
export function prepareLoadedVrm(gltf: { userData: Record<string, unknown> }): VRM | null {
  const vrm = (gltf.userData.vrm as VRM | undefined) ?? null;
  if (vrm) VRMUtils.rotateVRM0(vrm);
  return vrm;
}

/** Áp các biểu cảm VRM đã lưu trên vật thể vào model đang hiển thị. */
export function applyVrmExpressions(
  root: THREE.Object3D,
  expressions: Record<string, number> | undefined,
): void {
  if (!expressions) return;
  root.traverse((node) => {
    const vrm = node.userData.vrm as VRM | undefined;
    if (!vrm?.expressionManager) return;
    for (const [name, value] of Object.entries(expressions)) {
      vrm.expressionManager.setValue(name, Math.min(1, Math.max(0, value)));
    }
  });
}

/** Tiến spring bones và các manager VRM theo bước thời gian của timeline. */
export function updateLoadedVrms(root: THREE.Object3D, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;
  root.traverse((node) => {
    const vrm = node.userData.vrm as VRM | undefined;
    vrm?.update(deltaSeconds);
  });
}
