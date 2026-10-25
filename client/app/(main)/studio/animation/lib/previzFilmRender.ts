/**
 * Dựng khung hình 3D cho XUẤT PHIM HOÀN CHỈNH (Slice B5): một renderer
 * Three.js ẩn, nạp lần lượt từng cảnh của dự án, vẽ qua camera phim theo
 * keyframe, rồi chép sang canvas 2D để chèn phụ đề (cùng kiểu chữ với
 * bản xuất 2D) và ghi vào MediaRecorder.
 *
 * Hàm dựng hình nhân/đạo cụ sao theo đúng PrevizEditor (bản tham chiếu) —
 * nếu sửa hình dáng ở editor, cần đồng bộ lại tại đây. Việc lấy mẫu vị
 * trí/pose/camera dùng chung hàm thuần ở `lib/previz.ts` nên chuyển động
 * khớp tuyệt đối giữa phát thử và xuất bản.
 */

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { AfterimagePass } from "three/addons/postprocessing/AfterimagePass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { AnimScene } from "./animProject";
import {
  createPrevizScene,
  sampleFocus,
  samplePrevizCamera,
  samplePrevizObject,
  type PrevizObjectKind,
  type PrevizScene,
} from "./previz";
import { dialogueLineAt } from "./dialogue";
import { loadModelForScene } from "./modelLoader";
import { effectiveFilmPost, filmPostActive } from "./filmPost";
import {
  createWeatherPoints,
  updateWeatherPoints,
} from "./weatherPoints";
import {
  createParticlePoints,
  updateParticlePoints,
} from "./particlePoints";

const rad = (deg: number) => (deg * Math.PI) / 180;

interface CharacterParts {
  root: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  head: THREE.Group;
  torso: THREE.Group;
}

function buildCharacter(color: string, height: number): CharacterParts {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({
    color: "#2b2440",
    roughness: 0.8,
  });
  const root = new THREE.Group();
  const legLen = height * 0.47;
  const torsoH = height * 0.32;

  const mkLimb = (w: number, len: number) => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat);
    mesh.position.y = -len / 2;
    pivot.add(mesh);
    return pivot;
  };

  const legL = mkLimb(0.11, legLen);
  legL.position.set(-0.11, legLen, 0);
  const legR = mkLimb(0.11, legLen);
  legR.position.set(0.11, legLen, 0);

  const torso = new THREE.Group();
  torso.position.y = legLen;
  const torsoMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, torsoH, 0.22),
    mat,
  );
  torsoMesh.position.y = torsoH / 2;
  torso.add(torsoMesh);

  const armL = mkLimb(0.09, height * 0.36);
  armL.position.set(-0.27, torsoH - 0.03, 0);
  const armR = mkLimb(0.09, height * 0.36);
  armR.position.set(0.27, torsoH - 0.03, 0);
  torso.add(armL, armR);

  const head = new THREE.Group();
  head.position.y = torsoH + 0.05;
  const headMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 20, 16),
    dark,
  );
  headMesh.position.y = 0.13;
  head.add(headMesh);
  torso.add(head);

  root.add(legL, legR, torso);
  return { root, armL, armR, legL, legR, head, torso };
}

function buildProp(
  kind: PrevizObjectKind,
  color: string,
  size: number,
): THREE.Object3D {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  if (kind === "cylinder") {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(size * 0.4, size * 0.4, size, 20),
      mat,
    );
  }
  if (kind === "wall") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(size * 3, size * 2.2, 0.15),
      mat,
    );
  }
  return new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
}

export interface PrevizFilmRenderer {
  /** Canvas 2D tổng hợp (hình 3D + phụ đề) — nguồn cho captureStream. */
  canvas: HTMLCanvasElement;
  loadScene: (scene: AnimScene) => Promise<void>;
  drawAt: (scene: AnimScene, t: number) => void;
  dispose: () => void;
}

/**
 * Kiểu khai báo của three 0.180 để uniforms của BokehPass là `{}` nên
 * truy cập trực tiếp bị lỗi type — ép kiểu qua record số khi chỉnh
 * focus/aperture/maxblur/aspect lúc chạy (cùng cách với PrevizEditor).
 */
function bokehUniforms(pass: BokehPass): Record<string, { value: number }> {
  return pass.uniforms as unknown as Record<string, { value: number }>;
}

export function createPrevizFilmRenderer(
  width = 960,
  height = 540,
  opts: { applyScenePost?: boolean } = {},
): PrevizFilmRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  const threeScene = new THREE.Scene();
  const shotCam = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);

  // Hậu kỳ cảnh (hoàn thiện xuất phim): cùng bộ xử lý với trình dựng
  // cảnh — khi mọi hiệu ứng tắt thì vẫn vẽ thẳng như cũ, không đổi hình.
  const applyScenePost = opts.applyScenePost ?? true;
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(threeScene, shotCam);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.7,
    0.4,
    0.85,
  );
  const bokehPass = new BokehPass(threeScene, shotCam, {
    focus: 8,
    aperture: 0.025,
    maxblur: 0.01,
  });
  const afterimagePass = new AfterimagePass(0.9);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(bokehPass);
  composer.addPass(afterimagePass);
  composer.addPass(new OutputPass());
  bokehUniforms(bokehPass)["aspect"].value = width / height;

  threeScene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(5, 9, 4);
  threeScene.add(sun);
  threeScene.add(new THREE.GridHelper(30, 30, 0x554477, 0x332a4d));
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: "#1b1530", roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  threeScene.add(ground);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx2d = canvas.getContext("2d")!;

  const groups = new Map<string, THREE.Object3D>();
  const characters = new Map<string, CharacterParts>();
  let current: PrevizScene = createPrevizScene();
  // Đổi cảnh thì khung dư ảnh cũ phải xoá (không để vệt cảnh trước
  // lem sang cảnh sau): khung đầu của cảnh mới vẽ với damp = 0 rồi
  // mới trả về damp thật — khung đó vừa là hình đúng vừa xoá tích lũy.
  let postResetNeeded = false;

  const loadScene = async (scene: AnimScene) => {
    current = scene.previz ?? createPrevizScene();
    postResetNeeded = true;
    syncWeather(scene);
    syncParticles(scene);
    threeScene.background = new THREE.Color(current.backdrop);
    for (const group of groups.values()) threeScene.remove(group);
    groups.clear();
    characters.clear();
    for (const obj of current.objects) {
      if (obj.kind === "model") {
        const holder = new THREE.Group();
        groups.set(obj.id, holder);
        threeScene.add(holder);
        if (obj.modelAssetId) {
          try {
            holder.add(await loadModelForScene(obj.modelAssetId));
          } catch {
            // Mô hình lỗi/không còn trong thư viện — bỏ qua vật thể này
          }
        }
      } else if (obj.kind === "character") {
        const parts = buildCharacter(obj.color, obj.size);
        characters.set(obj.id, parts);
        groups.set(obj.id, parts.root);
        threeScene.add(parts.root);
      } else {
        const mesh = buildProp(obj.kind, obj.color, obj.size);
        mesh.position.y = obj.kind === "wall" ? obj.size * 1.1 : obj.size / 2;
        groups.set(obj.id, mesh);
        threeScene.add(mesh);
      }
    }
  };

  let particlePts: THREE.Points | null = null;
  const syncParticles = (scene: AnimScene) => {
    if (particlePts) {
      threeScene.remove(particlePts);
      particlePts.geometry.dispose();
      (particlePts.material as THREE.Material).dispose();
      particlePts = null;
    }
    if (scene.particles && scene.particles.count > 0) {
      particlePts = createParticlePoints(scene.particles);
      threeScene.add(particlePts);
    }
  };

  let weatherPoints: THREE.Points | null = null;
  const syncWeather = (scene: AnimScene) => {
    if (weatherPoints) {
      threeScene.remove(weatherPoints);
      weatherPoints.geometry.dispose();
      (weatherPoints.material as THREE.Material).dispose();
      weatherPoints = null;
    }
    if (scene.weather && scene.weather.intensity > 0) {
      weatherPoints = createWeatherPoints(scene.weather);
      threeScene.add(weatherPoints);
    }
  };

  const drawAt = (scene: AnimScene, t: number) => {
    if (particlePts) updateParticlePoints(particlePts, t);
    if (weatherPoints) updateWeatherPoints(weatherPoints, t);
    for (const obj of current.objects) {
      const group = groups.get(obj.id);
      if (!group) continue;
      const sampled = samplePrevizObject(obj, t);
      group.position.set(
        sampled.position.x,
        sampled.position.y,
        sampled.position.z,
      );
      group.rotation.y = rad(sampled.rotationY);
      if (obj.kind === "model") group.scale.setScalar(obj.size);
      const glow = sampled.glow;
      group.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && "emissive" in mat) {
          mat.emissive = new THREE.Color(obj.color);
          mat.emissiveIntensity = glow * 0.55;
        }
      });
      const parts = characters.get(obj.id);
      if (parts) {
        const pose = sampled.pose;
        parts.armL.rotation.x = rad(pose.armL);
        parts.armR.rotation.x = rad(pose.armR);
        parts.legL.rotation.x = rad(pose.legL);
        parts.legR.rotation.x = rad(pose.legR);
        parts.head.rotation.x = rad(pose.headTilt);
        parts.torso.rotation.x = rad(pose.lean);
        const bend = Math.min(
          1,
          Math.max(0, (pose.legL + pose.legR) / 2 / 90),
        );
        group.position.y = sampled.position.y - bend * obj.size * 0.26;
      }
    }
    const cam = samplePrevizCamera(current.cameraKeys, t);
    shotCam.position.set(cam.position.x, cam.position.y, cam.position.z);
    shotCam.lookAt(cam.target.x, cam.target.y, cam.target.z);
    // Hậu kỳ cảnh: áp đúng cài đặt của cảnh đang xuất; cảnh nào tắt
    // hết thì vẽ thẳng như cũ (không đổi hình, không chậm thêm).
    const post = effectiveFilmPost(scene, applyScenePost);
    if (filmPostActive(post)) {
      bloomPass.enabled = post.bloom.enabled;
      bloomPass.strength = post.bloom.strength;
      bloomPass.radius = post.bloom.radius;
      bloomPass.threshold = post.bloom.threshold;
      if (post.bloom.quality === "half") {
        bloomPass.setSize(width / 2, height / 2);
      } else {
        bloomPass.setSize(width, height);
      }
      bokehPass.enabled = post.dof.enabled;
      const uniforms = bokehUniforms(bokehPass);
      const focusKeys = current.focusKeys;
      const focusAt =
        focusKeys && focusKeys.length > 0 ? sampleFocus(focusKeys, t) : null;
      uniforms["focus"].value = focusAt ?? post.dof.focus;
      uniforms["aperture"].value = post.dof.aperture;
      uniforms["maxblur"].value = post.dof.maxblur;
      afterimagePass.enabled = post.afterimage.enabled;
      renderPass.camera = shotCam;
      bokehPass.camera = shotCam;
      const resetAfterimage = postResetNeeded && post.afterimage.enabled;
      if (resetAfterimage) afterimagePass.uniforms["damp"].value = 0;
      composer.render();
      if (resetAfterimage) {
        afterimagePass.uniforms["damp"].value = post.afterimage.damp;
      }
    } else {
      renderer.render(threeScene, shotCam);
    }
    postResetNeeded = false;

    ctx2d.drawImage(renderer.domElement, 0, 0, width, height);
    const line = dialogueLineAt(scene.dialogue ?? [], t);
    if (line && line.text.trim()) {
      ctx2d.save();
      ctx2d.font = `600 ${Math.round(height * 0.046)}px sans-serif`;
      ctx2d.textAlign = "center";
      ctx2d.lineWidth = 6;
      ctx2d.strokeStyle = "rgba(0,0,0,0.85)";
      ctx2d.fillStyle = "#ffffff";
      const label = line.speaker ? `${line.speaker}: ${line.text}` : line.text;
      ctx2d.strokeText(label, width / 2, height - height * 0.052);
      ctx2d.fillText(label, width / 2, height - height * 0.052);
      ctx2d.restore();
    }
  };

  return {
    canvas,
    loadScene,
    drawAt,
    dispose: () => {
      (composer as unknown as { dispose?: () => void }).dispose?.();
      (bloomPass as unknown as { dispose?: () => void }).dispose?.();
      (bokehPass as unknown as { dispose?: () => void }).dispose?.();
      (afterimagePass as unknown as { dispose?: () => void }).dispose?.();
      renderer.dispose();
    },
  };
}
