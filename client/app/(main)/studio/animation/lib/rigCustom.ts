/**
 * Áp chỉnh sửa của Phòng Rig Pro lên root đã rig (three.js): khuôn mặt,
 * chất liệu, vết tô. Dùng chung cho xem trước và xuất file.
 */

import * as THREE from "three";

export interface MorphEntry {
  meshIndex: number;
  name: string;
  /** Chỉ số influence trong morphTargetInfluences. */
  influenceIndex: number;
}

/** Liệt kê mọi khuôn mặt (morph) của root, theo thứ tự lưới. */
export function collectMorphs(root: THREE.Group): MorphEntry[] {
  const out: MorphEntry[] = [];
  let meshIndex = 0;
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const morphs = mesh.geometry.morphAttributes?.position ?? [];
    const dict = mesh.morphTargetDictionary ?? {};
    morphs.forEach((attr, i) => {
      const name = (attr as THREE.BufferAttribute).name || `Khuôn mặt ${i + 1}`;
      out.push({
        meshIndex,
        name,
        influenceIndex: dict[name] ?? i,
      });
    });
    meshIndex += 1;
  });
  return out;
}

export function applyMorphValues(
  root: THREE.Group,
  values: Record<string, number>,
): void {
  const morphs = collectMorphs(root);
  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse((obj) => {
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
      meshes.push(obj as THREE.SkinnedMesh);
    }
  });
  for (const m of morphs) {
    const mesh = meshes[m.meshIndex];
    if (!mesh?.morphTargetInfluences) continue;
    mesh.morphTargetInfluences[m.influenceIndex] =
      values[`${m.meshIndex}:${m.name}`] ?? 0;
  }
}

export interface MaterialEdit {
  color?: string;
  roughness?: number;
  metalness?: number;
}

/** Giá trị gốc của chất liệu (để hiển thị, không dùng để ghi đè). */
export interface MaterialDefault {
  color: string;
  roughness: number;
  metalness: number;
}

export function collectMaterialDefaults(root: THREE.Group): MaterialDefault[] {
  const seen = new Set<THREE.Material>();
  const out: MaterialDefault[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat || seen.has(mat)) continue;
      seen.add(mat);
      const std = mat as THREE.MeshStandardMaterial;
      out.push({
        color: std.color ? `#${std.color.getHexString()}` : "#ffffff",
        roughness: typeof std.roughness === "number" ? std.roughness : 0.8,
        metalness: typeof std.metalness === "number" ? std.metalness : 0,
      });
    }
  });
  return out;
}

export interface MaterialEntry {
  index: number;
  name: string;
}

/** Liệt kê chất liệu duy nhất của root, theo thứ tự duyệt. */
export function collectMaterials(root: THREE.Group): MaterialEntry[] {
  const seen = new Set<THREE.Material>();
  const out: MaterialEntry[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat || seen.has(mat)) continue;
      seen.add(mat);
      out.push({ index: out.length, name: mat.name || `Chất liệu ${out.length + 1}` });
    }
  });
  return out;
}

export function applyMaterialEdits(
  root: THREE.Group,
  edits: Record<number, MaterialEdit>,
): void {
  const entries = collectMaterials(root);
  const mats: THREE.Material[] = [];
  const seen = new Set<THREE.Material>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of list) {
      if (mat && !seen.has(mat)) {
        seen.add(mat);
        mats.push(mat);
      }
    }
  });
  for (const e of entries) {
    const edit = edits[e.index];
    if (!edit) continue;
    const mat = mats[e.index] as THREE.MeshStandardMaterial | undefined;
    if (!mat) continue;
    // Chỉ áp field người dùng đã động vào — tránh tẩy màu gốc.
    if (edit.color !== undefined && mat.color) mat.color.set(edit.color);
    if (edit.roughness !== undefined && typeof mat.roughness === "number") {
      mat.roughness = edit.roughness;
    }
    if (edit.metalness !== undefined && typeof mat.metalness === "number") {
      mat.metalness = edit.metalness;
    }
  }
}

/** Vết tô: mảng skinIndex/skinWeight đã chụp, theo thứ tự lưới. */
export type PaintSnapshot = Map<
  number,
  { skinIndex: Uint16Array; skinWeight: Float32Array }
>;

export function applyPaintSnapshots(
  root: THREE.Group,
  paint: PaintSnapshot,
): void {
  let meshIndex = 0;
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const snap = paint.get(meshIndex);
    if (snap) {
      mesh.geometry.setAttribute(
        "skinIndex",
        new THREE.Uint16BufferAttribute(snap.skinIndex, 4),
      );
      mesh.geometry.setAttribute(
        "skinWeight",
        new THREE.Float32BufferAttribute(snap.skinWeight, 4),
      );
    }
    meshIndex += 1;
  });
}

/** Chụp vết tô hiện tại của root (để giữ qua lần dựng lại khung xem trước). */
export function capturePaintSnapshots(root: THREE.Group): PaintSnapshot {
  const out: PaintSnapshot = new Map();
  let meshIndex = 0;
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const si = mesh.geometry.getAttribute("skinIndex") as THREE.BufferAttribute;
    const sw = mesh.geometry.getAttribute("skinWeight") as THREE.BufferAttribute;
    if (si && sw) {
      out.set(meshIndex, {
        skinIndex: new Uint16Array(si.array as ArrayLike<number>),
        skinWeight: new Float32Array(sw.array as ArrayLike<number>),
      });
    }
    meshIndex += 1;
  });
  return out;
}
