"use client";

/**
 * Sân khấu sa bàn 3D (W1): đế phẳng 40×40, camera xoay/quay tự do
 * (OrbitControls), bấm vào mặt đất để đặt vật đang chọn, kéo vật để
 * dời (snap 0.5 khi thả), bấm vào vật để chọn. Chỉ dựng lại nhóm vật
 * khi placements/entities/selection đổi; kéo vật di chuyển mesh trực
 * tiếp rồi mới commit một lần khi thả chuột.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  GROUND_SIZE,
  clampGround,
  modelDef,
  placementFootprint,
  skySun,
  placementParts,
  snapToGrid,
  type CustomModel,
  type CameraView,
  type Faction,
  type SkySettings,
  type DioramaPlacement,
  type ModelPart,
  type StoryEntity,
} from "../lib/diorama";
import {
  TERRAIN_CELLS,
  heightAt,
  seasonTint,
  terrainVertexColor,
  type Terrain,
  type TerrainBrushMode,
  type TerrainPath,
} from "../lib/terrain";

interface Props {
  placements: DioramaPlacement[];
  entities: StoryEntity[];
  selectedId: string | null;
  /** Đang cầm một mẫu để đặt — bấm vào mặt đất là đặt xuống. */
  placing: boolean;
  /** dataUrl GLB theo asset id (từ kho tài sản Animation Studio). */
  glbDataUrls: Record<string, string>;
  /** Địa hình W3 + cỡ sa bàn + đường đi. */
  customModels: CustomModel[];
  factions: Faction[];
  sky: SkySettings;
  flyTo: { position: [number, number, number]; target: [number, number, number]; nonce: number } | null;
  canvasApiRef: React.MutableRefObject<{
    capture: () => string | null;
    getCamera: () => { position: [number, number, number]; target: [number, number, number] } | null;
  } | null>;
  terrain: Terrain;
  groundSize: number;
  paths: TerrainPath[];
  draftPath: Array<{ x: number; z: number }>;
  /** Cọ địa hình đang cầm (null = không vẽ địa hình). */
  terrainTool:
    | { kind: "brush"; mode: TerrainBrushMode; radius: number; strength: number }
    | { kind: "biome"; biomeId: string; radius: number }
    | null;
  pathMode: boolean;
  onTerrainBrush: (x: number, z: number) => void;
  onPathPoint: (x: number, z: number) => void;
  onSelect: (id: string | null) => void;
  onPlace: (x: number, z: number) => void;
  onMove: (id: string, x: number, z: number) => void;
}

function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
}

function buildPlacementMesh(
  p: DioramaPlacement,
  entity: StoryEntity | null,
  parts: ModelPart[],
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(p.x, 0, p.z);
  group.rotation.set(p.rotationX ?? 0, p.rotationY, p.rotationZ ?? 0);
  group.scale.set(
    p.scale * (p.scaleX ?? 1),
    p.scale * (p.scaleY ?? 1),
    p.scale * (p.scaleZ ?? 1),
  );
  group.userData.placementId = p.id;
  for (let partIdx = 0; partIdx < parts.length; partIdx += 1) {
    const part = parts[partIdx];
    let geometry: THREE.BufferGeometry;
    if (part.shape === "box") {
      // Bo góc nhẹ: khối hộp nhìn "đồ chơi" hơn hẳn hộp sắc cạnh, vẫn
      // rẻ (RoundedBoxGeometry chỉ thêm vài đỉnh) — chuẩn low-poly
      // stylized kiểu KayKit/Kenney.
      const r = Math.min(0.12, part.size[0] / 4, part.size[1] / 4, part.size[2] / 4);
      geometry =
        r > 0.01
          ? new RoundedBoxGeometry(part.size[0], part.size[1], part.size[2], 2, r)
          : new THREE.BoxGeometry(...part.size);
    } else if (part.shape === "cone") {
      geometry = new THREE.ConeGeometry(
        part.size[0],
        part.size[1],
        Math.max(3, Math.round(part.size[2])),
      );
    } else if (part.shape === "cylinder") {
      geometry = new THREE.CylinderGeometry(
        part.size[0],
        part.size[0],
        part.size[1],
        14,
      );
    } else {
      geometry = new THREE.SphereGeometry(part.size[0], 18, 14);
    }
    const color =
      p.partColors?.[partIdx] ??
      (part.color === "__entity__"
        ? (entity?.color ?? "#8b5cf6")
        : (p.tint ?? part.color));
    const mesh = new THREE.Mesh(
      geometry,
      // Smooth shading + Standard: mẫu khối chỉ còn là placeholder bày
      // bố cục — hướng realistic của Sơn nằm ở model GLB (PBR thật),
      // không phải ở mặt phẳng faceted kiểu đồ chơi.
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        metalness: 0,
      }),
    );
    mesh.castShadow = true;
    mesh.position.set(...part.offset);
    if (part.rotationY) mesh.rotation.y = part.rotationY;
    mesh.userData.placementId = p.id;
    group.add(mesh);
  }
  return group;
}

export function DioramaCanvas({
  placements,
  entities,
  selectedId,
  placing,
  glbDataUrls,
  customModels,
  factions,
  sky,
  flyTo,
  canvasApiRef,
  terrain,
  groundSize,
  paths,
  draftPath,
  terrainTool,
  pathMode,
  onSelect,
  onPlace,
  onMove,
  onTerrainBrush,
  onPathPoint,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    objects: THREE.Group;
    ring: THREE.Mesh;
    raycaster: THREE.Raycaster;
    groundPlane: THREE.Plane;
  } | null>(null);
  const dragRef = useRef<{
    id: string;
    group: THREE.Group;
    downX: number;
    downY: number;
    moved: boolean;
  } | null>(null);
  // Cache scene GLB đã nạp theo asset id: clone mỗi lần dựng lại để
  // tránh parse lại base64 khi gõ hồ sơ; clone CHIA SẺ geometry nên
  // khi dọn KHÔNG được dispose clone (xem rebuild effect).
  const terrainRef = useRef<{
    mesh: THREE.Mesh;
    water: THREE.Mesh;
    pathsGroup: THREE.Group;
    base: THREE.Mesh;
  } | null>(null);
  const brushingRef = useRef(false);
  const lastBrushRef = useRef(0);
  const glbCacheRef = useRef<Map<string, THREE.Group>>(new Map());
  const glbFailedRef = useRef<Set<string>>(new Set());
  const [glbTick, setGlbTick] = useState(0);
  const callbacksRef = useRef({
    onSelect, onPlace, onMove, placing, terrainTool, pathMode,
    onTerrainBrush, onPathPoint,
  });
  callbacksRef.current = {
    onSelect, onPlace, onMove, placing, terrainTool, pathMode,
    onTerrainBrush, onPathPoint,
  };
  const terrainDataRef = useRef({ terrain, groundSize });
  terrainDataRef.current = { terrain, groundSize };
  // Chữ ký màu thực thể: đổi màu mới dựng lại mesh (mẫu Nhân vật lấy
  // màu từ entity); gõ tên/mô tả trong hồ sơ KHÔNG được dựng lại cả
  // sa bàn — đó là một nguồn giật khi sửa hồ sơ.
  const entityColorSig = entities.map((e) => e.id + ":" + e.color).join("|");
  const entitiesRef = useRef(entities);
  entitiesRef.current = entities;
  const customModelsRef = useRef(customModels);
  customModelsRef.current = customModels;
  const skyLightsRef = useRef<{ sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight } | null>(null);
  const weatherRef = useRef<{ points: THREE.Points; vel: Float32Array; kind: string } | null>(null);
  const flyRef = useRef<{
    fromPos: THREE.Vector3; fromTarget: THREE.Vector3;
    toPos: THREE.Vector3; toTarget: THREE.Vector3; start: number;
  } | null>(null);

  // Khởi tạo sân khấu 1 lần
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // ACES tone mapping + bóng mềm: hai thứ rẻ nhất để sa bàn hết
    // cảm giác "hình khối thô" mà không cần đổi mẫu vật.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0d0817");
    scene.fog = new THREE.Fog("#0d0817", 70, 130);
    // Ánh sáng môi trường cho vật liệu PBR của model GLB: model thật
    // (da, vải, kim loại) cần phản chiếu môi trường mới ra chất thật.
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;


    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      300,
    );
    camera.position.set(22, 24, 22);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 10;
    controls.maxDistance = 70;

    const hemi = new THREE.HemisphereLight(0xbcd7ff, 0x3a2f22, 0.55);
    scene.add(hemi);
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(20, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.camera.far = 100;
    scene.add(sun);
    skyLightsRef.current = { sun, hemi };
    // Hạt thời tiết: 1200 điểm rơi trong hộp 60×30×60 quanh tâm.
    {
      const N = 1200;
      const pos = new Float32Array(N * 3);
      const vel = new Float32Array(N);
      for (let i = 0; i < N; i += 1) {
        pos[i * 3] = (Math.random() - 0.5) * 60;
        pos[i * 3 + 1] = Math.random() * 30;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
        vel[i] = 0.5 + Math.random();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const points = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ color: 0xcfe6ff, size: 0.16, transparent: true, opacity: 0.85 }),
      );
      points.visible = false;
      points.frustumCulled = false;
      scene.add(points);
      weatherRef.current = { points, vel, kind: "clear" };
    }

    // Đế sa bàn: khối đế sâu 6m (địa hình đào sâu tới -3 vẫn nằm
    // trong khối đế) + mặt địa hình + mặt nước + nhóm đường đi.
    // Mặt địa hình dựng lại ở effect riêng khi terrain đổi.
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(GROUND_SIZE + 2, 6, GROUND_SIZE + 2),
      new THREE.MeshStandardMaterial({ color: "#3c2c17", roughness: 1 }),
    );
    base.position.y = -3;
    base.receiveShadow = true;
    scene.add(base);
    const terrainMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    );
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
      new THREE.MeshStandardMaterial({
        color: "#2f6fb3",
        transparent: true,
        opacity: 0.62,
        roughness: 0.15,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.visible = false;
    scene.add(water);
    const pathsGroup = new THREE.Group();
    scene.add(pathsGroup);
    terrainRef.current = { mesh: terrainMesh, water, pathsGroup, base };

    const objects = new THREE.Group();
    scene.add(objects);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.05, 40),
      new THREE.MeshBasicMaterial({
        color: "#f472b6",
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    ring.visible = false;
    scene.add(ring);

    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    threeRef.current = {
      renderer,
      scene,
      camera,
      controls,
      objects,
      ring,
      raycaster,
      groundPlane,
    };
    canvasApiRef.current = {
      getCamera: () => {
        const t = threeRef.current;
        if (!t) return null;
        return {
          position: [t.camera.position.x, t.camera.position.y, t.camera.position.z],
          target: [t.controls.target.x, t.controls.target.y, t.controls.target.z],
        };
      },
      capture: () => {
        const t = threeRef.current;
        if (!t) return null;
        const wasRing = t.ring.visible;
        t.ring.visible = false;
        t.renderer.render(t.scene, t.camera);
        const url = t.renderer.domElement.toDataURL("image/png");
        t.ring.visible = wasRing;
        return url;
      },
    };

    const ndc = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
    };
    // Giao điểm với mặt phẳng y=0 (không raycast mesh địa hình):
    // raycast 12.800 tam giác mỗi lần rê chuột là nguyên nhân chính
    // gây giật khi kéo — mặt phẳng cho ra x/z đủ chính xác để kéo
    // vật và quét cọ, cao độ lấy từ heightAt() sau đó.
    const groundPoint = (e: PointerEvent): { x: number; z: number } | null => {
      raycaster.setFromCamera(ndc(e), camera);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null;
      return { x: hit.x, z: hit.z };
    };
    const pickPlacement = (e: PointerEvent): THREE.Group | null => {
      raycaster.setFromCamera(ndc(e), camera);
      const hits = raycaster.intersectObjects(objects.children, true);
      for (const hit of hits) {
        let node: THREE.Object3D | null = hit.object;
        while (node) {
          if (node.userData.placementId) return node as THREE.Group;
          node = node.parent;
        }
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      const cb = callbacksRef.current;
      // Tương tác mới tới trước: settle của vật khác thì hạ xuống ngay,
      // settle của đúng vật đang bấm thì huỷ để kéo tiếp từ vị trí thấy.
      if (settle) {
        const group = pickPlacement(e);
        if (!group || group.userData.placementId !== settle.id) finishSettle();
        else settle = null;
      }
      if (cb.terrainTool) {
        const pt = groundPoint(e);
        if (pt) {
          brushingRef.current = true;
          controls.enabled = false;
          cb.onTerrainBrush(pt.x, pt.z);
          lastBrushRef.current = performance.now();
        }
        return;
      }
      if (cb.pathMode) {
        const pt = groundPoint(e);
        if (pt) cb.onPathPoint(pt.x, pt.z);
        return;
      }
      if (cb.placing) {
        const pt = groundPoint(e);
        if (pt) cb.onPlace(pt.x, pt.z);
        return;
      }
      const group = pickPlacement(e);
      if (!group) return;
      const id = group.userData.placementId as string;
      cb.onSelect(id);
      const locked = placementsRef.current.find((pp) => pp.id === id)?.locked;
      if (locked) return;
      controls.enabled = false;
      dragRef.current = {
        id,
        group,
        downX: e.clientX,
        downY: e.clientY,
        moved: false,
      };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (brushingRef.current) {
        const now = performance.now();
        if (now - lastBrushRef.current < 60) return;
        lastBrushRef.current = now;
        const pt = groundPoint(e);
        if (pt) callbacksRef.current.onTerrainBrush(pt.x, pt.z);
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      const pt = groundPoint(e);
      if (!pt) return;
      if (
        Math.abs(e.clientX - drag.downX) + Math.abs(e.clientY - drag.downY) >
        4
      ) {
        drag.moved = true;
      }
      const td = terrainDataRef.current;
      const fp =
        placementsRef.current.find((pp) => pp.id === drag.id) ?
          placementFootprint(placementsRef.current.find((pp) => pp.id === drag.id)!, customModelsRef.current) : 0;
      drag.group.position.x = clampGround(pt.x, fp, td.groundSize);
      drag.group.position.z = clampGround(pt.z, fp, td.groundSize);
      drag.group.position.y = heightAt(td.terrain, td.groundSize, drag.group.position.x, drag.group.position.z);
      // Vòng chọn bám theo vật đang kéo — trước đây vòng đứng yên ở
      // vị trí cũ suốt lúc kéo, thả mới nhảy tới, nhìn rất giật.
      ring.position.set(
        drag.group.position.x,
        drag.group.position.y + 0.04,
        drag.group.position.z,
      );
    };
    const onPointerUp = (e: PointerEvent) => {
      const wasBrushing = brushingRef.current;
      brushingRef.current = false;
      const drag = dragRef.current;
      dragRef.current = null;
      controls.enabled = true;
      if (wasBrushing) return;
      if (!drag) {
        // Chỉ bấm vào khoảng trống TRÊN SA BÀN mới bỏ chọn. Bấm vào
        // panel hồ sơ, cột trái hay nút bấm (target ngoài canvas) mà
        // cũng bỏ chọn thì ô nhập đang sửa sẽ biến mất ngay khi bấm
        // vào — đúng lỗi "nhấn vào hồ sơ thì bị out focus".
        if (e.target !== el) return;
        const cb = callbacksRef.current;
        if (!cb.placing && !pickPlacement(e)) cb.onSelect(null);
        return;
      }
      if (!drag.moved) return;
      const found = placementsRef.current.find((p) => p.id === drag.id);
      const fp = found ? placementFootprint(found, customModelsRef.current) : 0;
      const td = terrainDataRef.current;
      const sx = snapToGrid(clampGround(drag.group.position.x, fp, td.groundSize));
      const sz = snapToGrid(clampGround(drag.group.position.z, fp, td.groundSize));
      settle = {
        group: drag.group,
        from: drag.group.position.clone(),
        to: new THREE.Vector3(sx, heightAt(td.terrain, td.groundSize, sx, sz), sz),
        sx,
        sz,
        id: drag.id,
        start: performance.now(),
      };
    };
    // Hoạt ảnh "hạ xuống" khi thả vật: trượt mượt từ vị trí thả tới
    // ô snap trong 160ms rồi mới commit state — tránh cú nhảy 0.25m
    // + dựng lại cả sa bàn ngay tại thời điểm thả (cảm giác giật).
    let settle: {
      group: THREE.Group;
      from: THREE.Vector3;
      to: THREE.Vector3;
      sx: number;
      sz: number;
      id: string;
      start: number;
    } | null = null;
    const finishSettle = () => {
      if (!settle) return;
      settle.group.position.copy(settle.to);
      callbacksRef.current.onMove(settle.id, settle.sx, settle.sz);
      settle = null;
    };

    const el = renderer.domElement;
    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    const observer = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    observer.observe(container);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (settle) {
        const t = Math.min(1, (performance.now() - settle.start) / 160);
        const ease = 1 - Math.pow(1 - t, 3);
        settle.group.position.lerpVectors(settle.from, settle.to, ease);
        ring.position.set(
          settle.group.position.x,
          settle.group.position.y + 0.04,
          settle.group.position.z,
        );
        if (t >= 1) {
          const done = settle;
          settle = null;
          callbacksRef.current.onMove(done.id, done.sx, done.sz);
        }
      }
      // Bay tới góc nhìn đã lưu (0,8s, ease-out).
      if (flyRef.current) {
        const f = flyRef.current;
        const t = Math.min(1, (performance.now() - f.start) / 800);
        const ease = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(f.fromPos, f.toPos, ease);
        controls.target.lerpVectors(f.fromTarget, f.toTarget, ease);
        if (t >= 1) flyRef.current = null;
      }
      // Hạt mưa/tuyết rơi, hết tầm thì đưa lên đầu lại.
      const w = weatherRef.current;
      if (w && w.points.visible) {
        const arr = (w.points.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
        const speed = w.kind === "rain" ? 16 : 2.5;
        for (let i = 0; i < w.vel.length; i += 1) {
          arr[i * 3 + 1] -= speed * w.vel[i] * 0.016;
          if (w.kind === "snow") arr[i * 3] += Math.sin(performance.now() / 900 + i) * 0.008;
          if (arr[i * 3 + 1] < 0) {
            arr[i * 3 + 1] = 30;
            arr[i * 3] = (Math.random() - 0.5) * 60;
            arr[i * 3 + 2] = (Math.random() - 0.5) * 60;
          }
        }
        w.points.geometry.getAttribute("position").needsUpdate = true;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      terrainRef.current?.mesh.geometry.dispose();
      (terrainRef.current?.mesh.material as THREE.Material).dispose();
      terrainRef.current?.water.geometry.dispose();
      (terrainRef.current?.water.material as THREE.Material).dispose();
      if (terrainRef.current) disposeObject(terrainRef.current.pathsGroup);
      terrainRef.current = null;
      for (const g of glbCacheRef.current.values()) disposeObject(g);
      glbCacheRef.current.clear();
      disposeObject(objects);
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh && child !== ring) {
          child.geometry.dispose();
        }
      });
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      threeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placementsRef = useRef(placements);
  placementsRef.current = placements;

  // Dựng lại vật khi placements/màu/GLB đổi — KHÔNG dựng lại khi
  // chọn vật khác hay khi gõ hồ sơ: trước đây bấm vào vật là cả sa
  // bàn bị dispose + dựng lại ngay lúc bắt đầu kéo (giật 2 lần/kéo).
  useEffect(() => {
    const t = threeRef.current;
    if (!t) return;
    for (const child of [...t.objects.children]) {
      t.objects.remove(child);
      // Clone GLB chia sẻ geometry với cache — dispose nó là hỏng cache.
      if (!(child as THREE.Group).userData.sharedGlb) disposeObject(child);
    }
    const entityById = new Map(entitiesRef.current.map((e) => [e.id, e]));
    const loader = new GLTFLoader();
    for (const p of placements) {
      if (!p.visible) continue;
      if (p.glbAssetId) {
        const cached = glbCacheRef.current.get(p.glbAssetId);
        if (cached) {
          const clone = cached.clone(true);
          clone.position.set(p.x, heightAt(terrain, groundSize, p.x, p.z), p.z);
          clone.rotation.set(p.rotationX ?? 0, p.rotationY, p.rotationZ ?? 0);
          clone.scale.set(
            p.scale * (p.scaleX ?? 1),
            p.scale * (p.scaleY ?? 1),
            p.scale * (p.scaleZ ?? 1),
          );
          clone.userData.placementId = p.id;
          clone.userData.sharedGlb = true;
          t.objects.add(clone);
          continue;
        }
        const dataUrl = glbDataUrls[p.glbAssetId];
        if (dataUrl && !glbFailedRef.current.has(p.glbAssetId)) {
          // Hộp chờ trong lúc nạp file; nạp xong dựng lại 1 lần.
          const holder = buildPlacementMesh(
            { ...p, glbAssetId: null },
            p.storyEntityId ? (entityById.get(p.storyEntityId) ?? null) : null,
            modelDef(p.modelId).parts,
          );
          t.objects.add(holder);
          const assetId = p.glbAssetId;
          loader
            .loadAsync(dataUrl)
            .then((gltf) => {
              const scene = gltf.scene;
              // Chuẩn hoá về chiều cao ~2 đơn vị (file ngoài đơn vị
              // tuỳ ý: mét/cm) rồi cache để lần sau clone thẳng.
              const box = new THREE.Box3().setFromObject(scene);
              const size = new THREE.Vector3();
              box.getSize(size);
              const maxDim = Math.max(size.x, size.y, size.z, 0.001);
              scene.scale.setScalar(2 / maxDim);
              scene.traverse((child) => {
                if (child instanceof THREE.Mesh) child.castShadow = true;
              });
              glbCacheRef.current.set(assetId, scene);
              setGlbTick((v) => v + 1);
            })
            .catch(() => {
              glbFailedRef.current.add(assetId);
              setGlbTick((v) => v + 1);
            });
          continue;
        }
        // Không có file (đã xoá bên Animation Studio / nạp lỗi): vẫn
        // hiện hộp giữ chỗ để vật không biến mất âm thầm.
        t.objects.add(
          buildPlacementMesh(
            { ...p, glbAssetId: null },
            p.storyEntityId ? (entityById.get(p.storyEntityId) ?? null) : null,
            modelDef(p.modelId).parts,
          ),
        );
        continue;
      }
      const group = buildPlacementMesh(
        p,
        p.storyEntityId ? (entityById.get(p.storyEntityId) ?? null) : null,
        placementParts(p, customModelsRef.current),
      );
      group.position.y = heightAt(terrain, groundSize, p.x, p.z);
      t.objects.add(group);
    }
    // Vòng màu phe dưới chân vật: nhìn là biết vật thuộc phe nào.
    const factionById = new Map(factions.map((f) => [f.id, f]));
    for (const p of placements) {
      if (!p.visible || !p.storyEntityId) continue;
      const ent = entityById.get(p.storyEntityId);
      const fac = ent?.factionId ? factionById.get(ent.factionId) : undefined;
      if (!fac) continue;
      const circle = new THREE.Mesh(
        new THREE.CircleGeometry(placementFootprint(p, customModelsRef.current) + 0.3, 32),
        new THREE.MeshBasicMaterial({ color: fac.color, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
      );
      circle.rotation.x = -Math.PI / 2;
      circle.position.set(p.x, heightAt(terrain, groundSize, p.x, p.z) + 0.03, p.z);
      t.objects.add(circle);
    }
  }, [placements, glbDataUrls, entityColorSig, glbTick, factions]);

  // Dựng mặt địa hình khi terrain/size/đường đổi: mesh cao độ +
  // màu đỉnh (smooth normals — hướng realistic, không faceted) + mặt
  // nước + dải đường đi bám theo cao độ.
  useEffect(() => {
    const t = terrainRef.current;
    if (!t) return;
    const size = groundSize;
    const geo = new THREE.PlaneGeometry(size, size, TERRAIN_CELLS, TERRAIN_CELLS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let v = 0; v < pos.count; v += 1) {
      // PlaneGeometry sau rotateX(-90°): hàng j ↔ z = -size/2 + j*cell
      // (xem ghi chú mapping ở terrain.ts), cột i ↔ x tương ứng.
      const j = Math.floor(v / (TERRAIN_CELLS + 1));
      const i = v % (TERRAIN_CELLS + 1);
      pos.setY(v, terrain.heights[j][i]);
      const c = seasonTint(terrainVertexColor(terrain, i, j), sky.season);
      colors[v * 3] = c[0];
      colors[v * 3 + 1] = c[1];
      colors[v * 3 + 2] = c[2];
    }
    pos.needsUpdate = true;
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const old = t.mesh.geometry;
    t.mesh.geometry = geo;
    old.dispose();
    // Đế + mặt nước co giãn theo cỡ sa bàn (chiều cao đế giữ nguyên).
    const k = size / GROUND_SIZE;
    t.base.scale.set(k, 1, k);
    t.water.scale.set(k, k, 1);
    t.water.position.y = terrain.waterLevel;
    t.water.visible = terrain.waterLevel > -1;
    // Đường đi: dải ribbon bám cao độ + chấm tròn ở mỗi điểm.
    for (const child of [...t.pathsGroup.children]) {
      t.pathsGroup.remove(child);
      disposeObject(child);
    }
    const buildRibbon = (
      points: Array<{ x: number; z: number }>,
      color: string,
      width: number,
    ) => {
      const group = new THREE.Group();
      if (points.length === 1) {
        const dot = new THREE.Mesh(
          new THREE.CircleGeometry(width, 16),
          new THREE.MeshStandardMaterial({ color, roughness: 1 }),
        );
        dot.rotation.x = -Math.PI / 2;
        dot.position.set(
          points[0].x,
          heightAt(terrain, size, points[0].x, points[0].z) + 0.07,
          points[0].z,
        );
        group.add(dot);
        return group;
      }
      const verts: number[] = [];
      const idx: number[] = [];
      for (let sIdx = 0; sIdx < points.length - 1; sIdx += 1) {
        const a = points[sIdx];
        const b = points[sIdx + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz) || 1;
        const px = (-dz / len) * width;
        const pz = (dx / len) * width;
        const yA = heightAt(terrain, size, a.x, a.z) + 0.06;
        const yB = heightAt(terrain, size, b.x, b.z) + 0.06;
        const baseIdx = verts.length / 3;
        verts.push(a.x + px, yA, a.z + pz, a.x - px, yA, a.z - pz);
        verts.push(b.x + px, yB, b.z + pz, b.x - px, yB, b.z - pz);
        if (sIdx > 0) {
          const prev = baseIdx - 2;
          idx.push(prev, prev + 1, baseIdx, prev + 1, baseIdx + 1, baseIdx);
        }
        idx.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx + 1, baseIdx + 3, baseIdx + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      group.add(
        new THREE.Mesh(
          g,
          new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide }),
        ),
      );
      return group;
    };
    for (const path of paths) {
      if (path.points.length > 0) {
        t.pathsGroup.add(buildRibbon(path.points, "#8a6b45", 0.7));
      }
    }
    if (draftPath.length > 0) {
      t.pathsGroup.add(buildRibbon(draftPath, "#c4a06a", 0.5));
    }
  }, [terrain, groundSize, paths, draftPath, sky.season]);

  // Vòng chọn: effect riêng, chỉ di chuyển vòng (không dựng lại mesh).
  // Trong lúc kéo/settle, vòng được cập nhật trực tiếp từ handler nên
  // effect này không chạy (placements/selectedId không đổi) — không
  // tranh chấp vị trí.
  useEffect(() => {
    const t = threeRef.current;
    if (!t) return;
    const sel = placements.find((p) => p.id === selectedId);
    if (sel) {
      t.ring.visible = true;
      t.ring.position.set(
        sel.x,
        heightAt(terrain, groundSize, sel.x, sel.z) + 0.04,
        sel.z,
      );
      t.ring.scale.setScalar(placementFootprint(sel, customModels));
    } else {
      t.ring.visible = false;
    }
  }, [placements, selectedId, terrain, groundSize, customModels]);

  // Bầu trời: mặt trời, nền, sương theo giờ + thời tiết.
  useEffect(() => {
    const t = threeRef.current;
    const lights = skyLightsRef.current;
    if (!t || !lights) return;
    const info = skySun(sky);
    const az = ((sky.time - 6) / 12) * Math.PI;
    const el = Math.max(0.05, info.elevation);
    lights.sun.position.set(Math.cos(az) * Math.cos(el) * 40, Math.sin(el) * 40, Math.sin(az) * Math.cos(el) * 40);
    lights.sun.intensity = info.sunIntensity;
    lights.sun.color.set(info.sunColor);
    lights.hemi.intensity = info.hemiIntensity;
    t.scene.background = new THREE.Color(info.skyBg);
    const fog = t.scene.fog as THREE.Fog | null;
    if (fog) {
      fog.color.set(sky.weather === "fog" ? "#c8ccd4" : info.skyBg);
      fog.near = sky.weather === "fog" ? 12 : 70;
      fog.far = sky.weather === "fog" ? 45 : 130;
    }
    const w = weatherRef.current;
    if (w) {
      w.kind = sky.weather;
      w.points.visible = sky.weather === "rain" || sky.weather === "snow";
      (w.points.material as THREE.PointsMaterial).color.set(
        sky.weather === "rain" ? 0x9fc4e8 : 0xffffff,
      );
    }
  }, [sky]);

  // Bay tới góc nhìn đã lưu khi workspace yêu cầu.
  useEffect(() => {
    const t = threeRef.current;
    if (!t || !flyTo) return;
    flyRef.current = {
      fromPos: t.camera.position.clone(),
      fromTarget: t.controls.target.clone(),
      toPos: new THREE.Vector3(...flyTo.position),
      toTarget: new THREE.Vector3(...flyTo.target),
      start: performance.now(),
    };
  }, [flyTo]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ cursor: placing ? "copy" : "default", touchAction: "none" }}
    />
  );
}
