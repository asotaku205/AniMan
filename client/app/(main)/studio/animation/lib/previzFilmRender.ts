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
  type PrevizScene,
} from "./previz";
import { dialogueLineAt } from "./dialogue";
import { loadModelForSceneWithClips } from "./modelLoader";
import { createMixerState, updateMixerState, type MixerState } from "./clipPlayer";
import { sampleActionSegment } from "./actionTrack";
import { samplePoseKeys } from "./poseTrack";
import { applyPoseToBones } from "./posePlayer";
import { applyVrmExpressions, updateLoadedVrms } from "./gltfLoader";
import { buildPrevizCharacter, buildPrevizProp, type CharacterParts } from "./previzGeometry";
import { effectiveFilmPost, filmPostActive } from "./filmPost";
import {
  createWeatherPoints,
  updateWeatherPoints,
} from "./weatherPoints";
import {
  createParticlePoints,
  updateParticlePoints,
} from "./particlePoints";
import { createTerrainGeometry } from "./terrainMesh";
import { EffectPoints } from "./effectPlayer";
import {
  effectShakeFlash,
  resolveActiveEffects,
  type EffectEvent,
  type EffectFormula,
} from "./effectFormula";
import { createTerrainGrid } from "./terrainBrush";
import {
  cloudDriftX,
  cloudLayout,
  lightningIntensity,
  resolveFilmEnvironment,
  waterLevelAt,
} from "./filmEnvironment";

const rad = (deg: number) => (deg * Math.PI) / 180;

export interface PrevizFilmRenderer {
  /** Canvas 2D tổng hợp (hình 3D + phụ đề) — nguồn cho captureStream. */
  canvas: HTMLCanvasElement;
  loadScene: (scene: AnimScene) => Promise<void>;
  drawAt: (scene: AnimScene, t: number) => void;
  /** Đổi bộ công thức hiệu ứng (thư viện) rồi dựng lại nhóm hạt cảnh đang nạp. */
  setEffectFormulas: (formulas: EffectFormula[]) => void;
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
  opts: { applyScenePost?: boolean; effectFormulas?: EffectFormula[] } = {},
): PrevizFilmRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
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

  threeScene.add(new THREE.HemisphereLight(0xdceaff, 0x736044, 1.15));
  threeScene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.2);
  sun.position.set(5, 9, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.bias = -0.00015;
  threeScene.add(sun);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x332244, 0);
  threeScene.add(hemi);
  const flashLight = new THREE.AmbientLight(0xffffff, 0);
  threeScene.add(flashLight);
  threeScene.add(new THREE.GridHelper(30, 30, 0x554477, 0x332a4d));
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: "#1b1530", roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  threeScene.add(ground);
  // Mặt đất phong cảnh (dựng từ lưới cao độ, đúng như trình dựng);
  // cảnh không có environment thì ẩn đi, giữ mặt đất phẳng cũ.
  const terrainMesh = new THREE.Mesh(
    createTerrainGeometry(createTerrainGrid()),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  );
  terrainMesh.receiveShadow = true;
  terrainMesh.visible = false;
  threeScene.add(terrainMesh);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx2d = canvas.getContext("2d")!;

  const groups = new Map<string, THREE.Object3D>();
  const mixers = new Map<string, MixerState>();
  const characters = new Map<string, CharacterParts>();
  let current: PrevizScene = createPrevizScene();
  let lastDrawTime: number | null = null;
  // Đổi cảnh thì khung dư ảnh cũ phải xoá (không để vệt cảnh trước
  // lem sang cảnh sau): khung đầu của cảnh mới vẽ với damp = 0 rồi
  // mới trả về damp thật — khung đó vừa là hình đúng vừa xoá tích lũy.
  let postResetNeeded = false;

  const loadScene = async (scene: AnimScene) => {
    current = scene.previz ?? createPrevizScene();
    lastDrawTime = null;
    postResetNeeded = true;
    syncEnvironment(scene);
    syncWeather(scene);
    syncParticles(scene);
    syncEffectGroups();
    effectSceneLoaded = true;
    for (const group of groups.values()) threeScene.remove(group);
    for (const state of mixers.values()) state.mixer.stopAllAction();
    mixers.clear();
    groups.clear();
    characters.clear();
    for (const obj of current.objects) {
      if (obj.kind === "model") {
        const holder = new THREE.Group();
        groups.set(obj.id, holder);
        threeScene.add(holder);
        if (obj.modelAssetId) {
          try {
            const loaded = await loadModelForSceneWithClips(obj.modelAssetId);
            holder.add(loaded.group);
            const mixer = createMixerState(loaded.group, loaded.clips);
            if (mixer) mixers.set(obj.id, mixer);
          } catch {
            // Mô hình lỗi/không còn trong thư viện — bỏ qua vật thể này
          }
        }
      } else if (obj.kind === "character") {
        const parts = buildPrevizCharacter(obj.color, obj.size);
        characters.set(obj.id, parts);
        groups.set(obj.id, parts.root);
        threeScene.add(parts.root);
      } else {
        const mesh = buildPrevizProp(obj.kind, obj.color, obj.size, obj.name);
        groups.set(obj.id, mesh);
        threeScene.add(mesh);
      }
    }
  };

  let cloudGroup: THREE.Group | null = null;
  let cloudMat: THREE.Material | null = null;
  let waterMesh: THREE.Mesh | null = null;
  let envPoints: THREE.Points | null = null;

  const disposeEnvObjects = () => {
    if (cloudGroup) {
      threeScene.remove(cloudGroup);
      cloudGroup.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
      cloudGroup = null;
    }
    if (cloudMat) {
      cloudMat.dispose();
      cloudMat = null;
    }
    if (waterMesh) {
      threeScene.remove(waterMesh);
      waterMesh.geometry.dispose();
      (waterMesh.material as THREE.Material).dispose();
      waterMesh = null;
    }
    if (envPoints) {
      threeScene.remove(envPoints);
      envPoints.geometry.dispose();
      (envPoints.material as THREE.Material).dispose();
      envPoints = null;
    }
  };

  // Môi trường phong cảnh: áp đúng như trình dựng (trời, nắng, sương,
  // mây, nước, mưa/tuyết). Cảnh không có environment giữ đúng fallback
  // cũ: nền backdrop + mặt đất phẳng + không sương/mây/nước.
  const syncEnvironment = (scene: AnimScene) => {
    disposeEnvObjects();
    const res = resolveFilmEnvironment(scene.environment, current.backdrop);
    threeScene.background = new THREE.Color(res.background);
    threeScene.fog = res.fog
      ? new THREE.Fog(res.background, res.fog.near, res.fog.far)
      : null;
    sun.color.set(res.sunColor);
    sun.intensity = res.sunIntensity;
    sun.position.set(
      res.sunPosition[0],
      res.sunPosition[1],
      res.sunPosition[2],
    );
    hemi.intensity = res.hemiIntensity;
    flashLight.intensity = 0;
    const env = scene.environment;
    if (!env) {
      terrainMesh.visible = false;
      ground.visible = true;
      return;
    }
    terrainMesh.geometry.dispose();
    terrainMesh.geometry = createTerrainGeometry(env.terrain);
    terrainMesh.visible = true;
    ground.visible = false;
    const layout = cloudLayout(env.weather);
    cloudMat = new THREE.MeshStandardMaterial({
      color: layout.color,
      transparent: true,
      opacity: 0.9,
      roughness: 1,
    });
    cloudGroup = new THREE.Group();
    for (const pos of layout.clouds) {
      const cloud = new THREE.Group();
      for (let k = 0; k < 3; k += 1) {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(2 + (k % 2), 10, 8),
          cloudMat,
        );
        puff.position.set(k * 2.2 - 2.2, (k % 2) * 0.5, 0);
        puff.scale.y = 0.45;
        cloud.add(puff);
      }
      cloud.position.set(pos.x, pos.y, pos.z);
      cloudGroup.add(cloud);
    }
    threeScene.add(cloudGroup);
    if (env.waterLevel >= 0) {
      waterMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(30, 30),
        new THREE.MeshStandardMaterial({
          color: "#3a7bd5",
          transparent: true,
          opacity: 0.65,
          roughness: 0.2,
        }),
      );
      waterMesh.rotation.x = -Math.PI / 2;
      waterMesh.position.y = env.waterLevel;
      threeScene.add(waterMesh);
    }
    if (env.weather === "rain") {
      envPoints = createWeatherPoints({ type: "rain", intensity: 0.8 });
      threeScene.add(envPoints);
    } else if (env.weather === "snow") {
      envPoints = createWeatherPoints({ type: "snow", intensity: 0.6 });
      threeScene.add(envPoints);
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

  // Hiệu ứng timeline (đợt 1): cùng bộ vẽ EffectPoints + cùng spec hạt có
  // seed như trình dựng, nên cùng thời điểm t thì xem thử/xuất phim ra
  // cùng hình hạt với trình dựng. Công thức đi qua tham số (không đọc
  // IndexedDB trong renderer) để còn chạy được ở xuất phim.
  let effectFormulas: EffectFormula[] = [...(opts.effectFormulas ?? [])];
  const effectGroups = new Map<
    string,
    { points: EffectPoints; event: EffectEvent; formula: EffectFormula }
  >();
  let effectSceneLoaded = false;
  const syncEffectGroups = () => {
    for (const g of effectGroups.values()) {
      threeScene.remove(g.points.group);
      g.points.dispose();
    }
    effectGroups.clear();
    for (const ev of current.effectEvents ?? []) {
      const formula = effectFormulas.find((f) => f.id === ev.effectId);
      if (!formula) continue; // sự kiện thiếu công thức: bỏ qua, không crash
      const points = new EffectPoints(formula);
      points.group.position.set(ev.position.x, ev.position.y, ev.position.z);
      threeScene.add(points.group);
      effectGroups.set(ev.id, { points, event: ev, formula });
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
    const vrmDelta = lastDrawTime === null || t < lastDrawTime
      ? 0
      : Math.min(0.1, t - lastDrawTime);
    lastDrawTime = t;
    if (particlePts) updateParticlePoints(particlePts, t);
    if (weatherPoints) updateWeatherPoints(weatherPoints, t);
    if (envPoints) updateWeatherPoints(envPoints, t);
    const env = scene.environment;
    if (cloudGroup && env) {
      cloudGroup.position.x = cloudDriftX(t, env.weather);
    }
    if (waterMesh && env && env.waterLevel >= 0) {
      waterMesh.position.y = waterLevelAt(env.waterLevel, t);
    }
    flashLight.intensity = lightningIntensity(t, env?.weather ?? null);
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
      if (obj.kind === "model") {
        applyVrmExpressions(group, obj.expressions);
        updateLoadedVrms(group, vrmDelta);
      }
      const mixer = mixers.get(obj.id);
      if (mixer) {
        const active = sampleActionSegment(obj.actions, t);
        updateMixerState(mixer, t, active);
        if (!active && !mixer.current && !mixer.fading && obj.poseKeys?.length) {
          const pose = samplePoseKeys(obj.poseKeys, t);
          if (pose) applyPoseToBones(mixer.boneByName, pose);
        }
      }
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
    // Hiệu ứng timeline: chỉ nhóm đang hoạt động mới hiện + cập nhật
    // (đúng resolveActiveEffects); rung camera đúng công thức trình dựng
    // (camera phim là camera cú máy nên lệch nhỏ này không vỡ cú máy).
    const effectEvents = current.effectEvents ?? [];
    const activeEffects = new Map(
      resolveActiveEffects(effectEvents, effectFormulas, t).map((a) => [
        a.event.id,
        a,
      ]),
    );
    for (const [id, g] of effectGroups) {
      const a = activeEffects.get(id);
      if (!a) {
        g.points.group.visible = false;
        continue;
      }
      g.points.group.visible = true;
      g.points.update(t - g.event.startSec, g.event.burst, g.event.durationSec);
    }
    const { shake: effectShake, flash: effectFlash } = effectShakeFlash(
      effectEvents,
      t,
    );
    if (effectShake > 0) {
      shotCam.position.x +=
        (Math.sin(t * 47.3) + Math.sin(t * 31.7) * 0.6) * 0.12 * effectShake;
      shotCam.position.y +=
        (Math.sin(t * 39.1 + 2) + Math.sin(t * 27.9) * 0.6) *
        0.12 *
        effectShake;
    }
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
    // Chớp sáng sự kiện: phủ trắng toàn khung đúng độ mạnh như trình dựng
    // (mặt phẳng trắng trước camera, opacity flash * 0.85).
    if (effectFlash > 0.01) {
      ctx2d.save();
      ctx2d.fillStyle = `rgba(255, 255, 255, ${(effectFlash * 0.85).toFixed(3)})`;
      ctx2d.fillRect(0, 0, width, height);
      ctx2d.restore();
    }
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
    setEffectFormulas: (formulas: EffectFormula[]) => {
      effectFormulas = [...formulas];
      if (effectSceneLoaded) syncEffectGroups();
    },
    dispose: () => {
      for (const state of mixers.values()) state.mixer.stopAllAction();
      mixers.clear();
      for (const g of effectGroups.values()) {
        threeScene.remove(g.points.group);
        g.points.dispose();
      }
      effectGroups.clear();
      disposeEnvObjects();
      terrainMesh.geometry.dispose();
      (terrainMesh.material as THREE.Material).dispose();
      (composer as unknown as { dispose?: () => void }).dispose?.();
      (bloomPass as unknown as { dispose?: () => void }).dispose?.();
      (bokehPass as unknown as { dispose?: () => void }).dispose?.();
      (afterimagePass as unknown as { dispose?: () => void }).dispose?.();
      renderer.dispose();
    },
  };
}
