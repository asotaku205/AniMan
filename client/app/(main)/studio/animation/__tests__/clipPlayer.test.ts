import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createMixerState,
  updateMixerState,
} from "../lib/clipPlayer";
import {
  createActionSegment,
  sampleActionSegment,
} from "../lib/actionTrack";

/** Nhân vật tối giản: 1 xương con xoay quanh Z, clip 1s xoay 0 → 90°. */
function buildRigged() {
  const root = new THREE.Group();
  const hip = new THREE.Bone();
  hip.name = "Hips";
  const leg = new THREE.Bone();
  leg.name = "LeftLeg";
  leg.position.set(0, -0.5, 0);
  hip.add(leg);
  root.add(hip);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, 0, -1, 0], 3),
  );
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute([0, 0, 0, 0, 1, 0, 0, 0], 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0], 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  mesh.add(hip);
  const skeleton = new THREE.Skeleton([hip, leg]);
  mesh.bind(skeleton);
  root.add(mesh);
  root.updateMatrixWorld(true);
  const q0 = new THREE.Quaternion();
  const q90 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
  const clip = new THREE.AnimationClip("Swing", 1, [
    new THREE.QuaternionKeyframeTrack(
      "LeftLeg.quaternion",
      [0, 1],
      [...q0.toArray(), ...q90.toArray()],
    ),
  ]);
  return { root, leg, clip };
}

function angleZ(bone: THREE.Bone): number {
  bone.updateWorldMatrix(true, false);
  return new THREE.Euler().setFromQuaternion(bone.quaternion, "XYZ").z;
}

describe("Bộ phát clip xương", () => {
  it("phát liên tục theo timeline, nhảy thời gian đặt đúng dáng", () => {
    const { root, leg, clip } = buildRigged();
    const state = createMixerState(root, [clip]);
    expect(state).not.toBeNull();
    const seg = { ...createActionSegment("Swing", 0, 5), loop: false, speed: 1 };
    updateMixerState(state!, 0, sampleActionSegment([seg], 0));
    expect(angleZ(leg)).toBeCloseTo(0, 2);
    updateMixerState(state!, 0.5, sampleActionSegment([seg], 0.5));
    expect(angleZ(leg)).toBeCloseTo(Math.PI / 4, 2);
    // Nhảy ngược về 0.25: dáng phải đúng 22.5°, không trôi theo dt cũ.
    updateMixerState(state!, 0.25, sampleActionSegment([seg], 0.25));
    expect(angleZ(leg)).toBeCloseTo(Math.PI / 8, 2);
  });

  it("hết đoạn thì trả xương về dáng gốc", () => {
    const { root, leg, clip } = buildRigged();
    const state = createMixerState(root, [clip]);
    const seg = { ...createActionSegment("Swing", 0, 1), loop: false, speed: 1 };
    updateMixerState(state!, 0, sampleActionSegment([seg], 0));
    updateMixerState(state!, 0.9, sampleActionSegment([seg], 0.9));
    expect(angleZ(leg)).toBeGreaterThan(1);
    updateMixerState(state!, 1.0, sampleActionSegment([seg], 1.0));
    updateMixerState(state!, 1.4, sampleActionSegment([seg], 1.4));
    expect(angleZ(leg)).toBeCloseTo(0, 2);
  });

  it("model không có xương thì không tạo mixer", () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
    expect(createMixerState(root, [])).toBeNull();
  });
});
