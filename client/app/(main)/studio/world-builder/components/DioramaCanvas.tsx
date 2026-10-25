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
  clampGround,
  modelDef,
  moonCoverOffset,
  moonCoverSide,
  moonPhase,
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
import { mulberry32 } from "../lib/worldGen";
import {
  CHUNK_SIZE,
  TERRAIN_CELLS,
  chunkKey,
  heightAt,
  seasonTint,
  terrainVertexColor,
  worldBounds,
  type River,
  type TerrainBrushMode,
  type TerrainPath,
  type WorldTerrain,
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
  flyTo: { position: [number, number, number]; target: [number, number, number]; nonce: number; sky?: boolean } | null;
  canvasApiRef: React.MutableRefObject<{
    capture: () => string | null;
    getCamera: () => { position: [number, number, number]; target: [number, number, number] } | null;
  } | null>;
  terrain: WorldTerrain;
  paths: TerrainPath[];
  draftPath: Array<{ x: number; z: number }>;
  /** Sông/suối (W9) + nét sông đang vẽ. */
  rivers: River[];
  draftRiver: Array<{ x: number; z: number }>;
  /** Cọ địa hình đang cầm (null = không vẽ địa hình). */
  terrainTool:
    | { kind: "brush"; mode: TerrainBrushMode; radius: number; strength: number }
    | { kind: "biome"; biomeId: string; radius: number }
    | null;
  pathMode: boolean;
  riverMode: boolean;
  onRiverPoint: (x: number, z: number) => void;
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
    // Bóng đèn đường: ban đêm tự phát sáng (Phase 2, chỉ phát sáng nhìn
    // thấy, chưa hắt sáng xuống đất — cần đèn điểm riêng mới hắt được).
    if (p.modelId === "lamp" && part.shape === "sphere") mesh.userData.lampBulb = true;
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
  paths,
  draftPath,
  rivers,
  draftRiver,
  terrainTool,
  pathMode,
  riverMode,
  onRiverPoint,
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
    meshes: THREE.Group;
    water: THREE.Mesh;
    pathsGroup: THREE.Group;
    base: THREE.Mesh;
    skirt: THREE.Mesh;
  } | null>(null);
  const brushingRef = useRef(false);
  const lastBrushRef = useRef(0);
  const glbCacheRef = useRef<Map<string, THREE.Group>>(new Map());
  const glbFailedRef = useRef<Set<string>>(new Set());
  const [glbTick, setGlbTick] = useState(0);
  const callbacksRef = useRef({
    onSelect, onPlace, onMove, placing, terrainTool, pathMode, riverMode,
    onTerrainBrush, onPathPoint, onRiverPoint,
  });
  callbacksRef.current = {
    onSelect, onPlace, onMove, placing, terrainTool, pathMode, riverMode,
    onTerrainBrush, onPathPoint, onRiverPoint,
  };
  const terrainDataRef = useRef({ terrain });
  terrainDataRef.current = { terrain };
  // Chữ ký màu thực thể: đổi màu mới dựng lại mesh (mẫu Nhân vật lấy
  // màu từ entity); gõ tên/mô tả trong hồ sơ KHÔNG được dựng lại cả
  // sa bàn — đó là một nguồn giật khi sửa hồ sơ.
  const entityColorSig = entities.map((e) => e.id + ":" + e.color).join("|");
  const entitiesRef = useRef(entities);
  entitiesRef.current = entities;
  const customModelsRef = useRef(customModels);
  customModelsRef.current = customModels;
  const skyLightsRef = useRef<{ sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight } | null>(null);
  /** Vòm trời gradient: tạo trong init effect theo từng scene (ghi đè
      ref mỗi lần mount) thay vì guard "tạo 1 lần", để không kẹt ở
      scene cũ khi canvas remount. */
  const domeRef = useRef<{
    mesh: THREE.Mesh;
    mat: THREE.ShaderMaterial;
  } | null>(null);
  /** Bầu trời sống (Phase 2): đĩa mặt trời, mặt trăng + pha, sao, mây. */
  const skyDressRef = useRef<{
    sun: THREE.Group;
    sunMat: THREE.SpriteMaterial;
    sunCoreMat: THREE.MeshBasicMaterial;
    moon: THREE.Group;
    moonDark: THREE.Mesh;
    stars: THREE.Points;
    clouds: THREE.Sprite[];
    scene: THREE.Scene;
  } | null>(null);
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
    // Vòm trời gradient: thay màu nền phẳng bằng chuyển sắc đỉnh-chân
    // trời, để nhìn từ sa bàn cũng thấy bầu trời chứ không chỉ 1 màu.
    {
      const domeMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          topColor: { value: new THREE.Color("#3a86d8") },
          horizonColor: { value: new THREE.Color("#bfe3f5") },
        },
        vertexShader: `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 topColor; uniform vec3 horizonColor; varying vec3 vDir; void main() { float h = normalize(vDir).y; vec3 col = h >= 0.0 ? mix(horizonColor, topColor, pow(h, 0.55)) : mix(horizonColor, horizonColor * 0.45, pow(-h, 0.5)); gl_FragColor = vec4(col, 1.0); }`,
      });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), domeMat);
      dome.renderOrder = -1;
      dome.frustumCulled = false;
      scene.add(dome);
      domeRef.current = { mesh: dome, mat: domeMat };
    }
    // Ánh sáng môi trường cho vật liệu PBR của model GLB: model thật
    // (da, vải, kim loại) cần phản chiếu môi trường mới ra chất thật.
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;


    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      // 1000 để chứa mặt trời/mặt trăng/sao ở 260–280m (Phase 2).
      1000,
    );
    camera.position.set(22, 24, 22);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 4;
    controls.maxDistance = 120;

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
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.1;
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

    // Đế sa bàn: khối đế sâu 6m, mặt trên nằm NGAY DƯỚI đáy địa
    // hình thấp nhất (-3) để không bao giờ đồng phẳng với mặt đất
    // (đồng phẳng = nhấp nháy z-fighting ở vùng đất phẳng y=0).
    // Mặt địa hình dựng lại ở effect riêng khi terrain đổi.
    // Đế + mặt nước dùng hình đơn vị, co giãn theo biên thế giới ở
    // terrain effect (world nhiều chunk thì đế phủ toàn bộ biên).
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1, 6, 1),
      new THREE.MeshStandardMaterial({ color: "#3c2c17", roughness: 1 }),
    );
    base.position.y = -6.05; // mặt trên ở -3.05, dưới đáy địa hình -3
    base.receiveShadow = true;
    scene.add(base);
    const terrainMeshes = new THREE.Group();
    scene.add(terrainMeshes);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
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
    // Váy nối: dải đứng quanh mép địa hình, kéo từ cao độ mép xuống
    // mặt trên đế — để từ góc thấp không nhìn thấy khe hở giữa mặt
    // đất và khối đế (mặt đất trông như "bị cao hơn" / lơ lửng).
    const skirt = new THREE.Mesh(
      new THREE.BufferGeometry(),
      // DoubleSide: váy dựng theo 4 hướng mép chunk, không lo chiều
      // pháp tuyến từng đoạn.
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    );
    skirt.receiveShadow = true;
    scene.add(skirt);
    terrainRef.current = { meshes: terrainMeshes, water, pathsGroup, base, skirt };

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
      const td = terrainDataRef.current;
      // Lặp theo cao độ thật: giao mặt phẳng y=0 -> lấy cao độ tại đó
      // -> giao lại với mặt phẳng y=cao độ... 3 lần là hội tụ, vật bám
      // đúng con trỏ cả trên đồi lẫn dưới hố (không raycast mesh đắt).
      let y = 0;
      let hit = new THREE.Vector3();
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      for (let k = 0; k < 3; k += 1) {
        plane.constant = -y;
        if (!raycaster.ray.intersectPlane(plane, hit)) return null;
        const h = heightAt(td.terrain, hit.x, hit.z);
        if (Math.abs(h - y) < 0.02) break;
        y = h;
      }
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
      if (cb.riverMode) {
        const pt = groundPoint(e);
        if (pt) cb.onRiverPoint(pt.x, pt.z);
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
      const b = worldBounds(td.terrain);
      const fp =
        placementsRef.current.find((pp) => pp.id === drag.id) ?
          placementFootprint(placementsRef.current.find((pp) => pp.id === drag.id)!, customModelsRef.current) : 0;
      drag.group.position.x = clampGround(pt.x, fp, b.minX, b.maxX);
      drag.group.position.z = clampGround(pt.z, fp, b.minZ, b.maxZ);
      drag.group.position.y = heightAt(td.terrain, drag.group.position.x, drag.group.position.z);
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
      const b = worldBounds(td.terrain);
      const sx = snapToGrid(clampGround(drag.group.position.x, fp, b.minX, b.maxX));
      const sz = snapToGrid(clampGround(drag.group.position.z, fp, b.minZ, b.maxZ));
      settle = {
        group: drag.group,
        from: drag.group.position.clone(),
        to: new THREE.Vector3(sx, heightAt(td.terrain, sx, sz), sz),
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

    // Di chuyển tự do bằng phím: WASD/mũi tên pan theo hướng nhìn,
    // Q/E lên/xuống. Bỏ qua khi đang gõ trong ô nhập.
    const keysDown = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select")) return;
      keysDown.add(e.code);
      if (e.code.startsWith("Arrow")) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.code);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let raf = 0;
    let lastT = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      // Bầu trời sống: mặt trăng hướng về camera, mây trôi rồi quấn lại.
      const dress = skyDressRef.current;
      if (dress) {
        dress.sun.lookAt(camera.position);
        dress.moon.lookAt(camera.position);
        for (const c of dress.clouds) {
          c.position.x += (c.userData.speed as number) * dt;
          if (c.position.x > 150) c.position.x = -150;
        }
      }
      // Pan bằng phím: dời cả camera lẫn điểm nhìn cùng một vector.
      if (keysDown.size > 0) {
        const fwd = new THREE.Vector3();
        camera.getWorldDirection(fwd);
        fwd.y = 0;
        if (fwd.lengthSq() > 1e-6) {
          fwd.normalize();
          const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
          const move = new THREE.Vector3();
          if (keysDown.has("KeyW") || keysDown.has("ArrowUp")) move.add(fwd);
          if (keysDown.has("KeyS") || keysDown.has("ArrowDown")) move.sub(fwd);
          if (keysDown.has("KeyD") || keysDown.has("ArrowRight")) move.add(right);
          if (keysDown.has("KeyA") || keysDown.has("ArrowLeft")) move.sub(right);
          if (keysDown.has("KeyE")) move.y += 1;
          if (keysDown.has("KeyQ")) move.y -= 1;
          if (move.lengthSq() > 0) {
            move.normalize().multiplyScalar(18 * dt);
            camera.position.add(move);
            controls.target.add(move);
          }
        }
      }
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
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      controls.dispose();
      if (terrainRef.current) disposeObject(terrainRef.current.meshes);
      terrainRef.current?.water.geometry.dispose();
      (terrainRef.current?.water.material as THREE.Material).dispose();
      if (terrainRef.current) disposeObject(terrainRef.current.pathsGroup);
      terrainRef.current?.skirt.geometry.dispose();
      (terrainRef.current?.skirt.material as THREE.Material).dispose();
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
      if (domeRef.current) {
        domeRef.current.mesh.geometry.dispose();
        domeRef.current.mat.dispose();
        domeRef.current = null;
      }
      // Scene cũ chết theo cleanup — giữ ref bầu trời là lần mount sau
      // tưởng đã có mà không vẽ lại (đúng kiểu "chỉ thấy 1 màu nền").
      skyDressRef.current = null;
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
          clone.position.set(p.x, heightAt(terrain, p.x, p.z), p.z);
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
      group.position.y = heightAt(terrain, p.x, p.z);
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
      circle.position.set(p.x, heightAt(terrain, p.x, p.z) + 0.03, p.z);
      t.objects.add(circle);
    }
  }, [placements, glbDataUrls, entityColorSig, glbTick, factions]);

  // Dựng mặt địa hình khi terrain/đường đổi: 1 mesh mỗi chunk +
  // màu đỉnh (smooth normals — hướng realistic, không faceted) + mặt
  // nước + dải đường đi bám theo cao độ.
  useEffect(() => {
    const t = terrainRef.current;
    if (!t) return;
    const b = worldBounds(terrain);
    // Dọn mesh chunk cũ, dựng lại theo từng chunk (mesh đặt tại tâm
    // chunk; mapping đỉnh PlaneGeometry sau rotateX giống bản 1 ô).
    for (const child of [...t.meshes.children]) {
      t.meshes.remove(child);
      disposeObject(child);
    }
    for (const key of Object.keys(terrain.chunks)) {
      const chunk = terrain.chunks[key];
      const [cx, cz] = key.split(",").map(Number);
      const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, TERRAIN_CELLS, TERRAIN_CELLS);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const colors = new Float32Array(pos.count * 3);
      for (let v = 0; v < pos.count; v += 1) {
        const j = Math.floor(v / (TERRAIN_CELLS + 1));
        const i = v % (TERRAIN_CELLS + 1);
        pos.setY(v, chunk.heights[j][i]);
        const c = seasonTint(terrainVertexColor(chunk, i, j, terrain.waterLevel), sky.season);
        colors[v * 3] = c[0];
        colors[v * 3 + 1] = c[1];
        colors[v * 3 + 2] = c[2];
      }
      pos.needsUpdate = true;
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
      );
      mesh.receiveShadow = true;
      mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      t.meshes.add(mesh);
    }
    // Váy nối CHỈ ở chu vi ngoài thế giới: mỗi chunk chỉ dựng váy ở
    // cạnh nào không có chunk kề — giữa 2 chunk kề nhau mặt đất đã
    // liền (mép kẹp bằng nhau), dựng váy ở đó sẽ thành tường chắn.
    {
      const SKIRT_BOTTOM = -3.05;
      const spos: number[] = [];
      const scol: number[] = [];
      const has = (cx: number, cz: number) => !!terrain.chunks[chunkKey(cx, cz)];
      const pushV = (x: number, z: number, y: number, c: [number, number, number]) => {
        spos.push(x, y, z);
        scol.push(c[0] * 0.72, c[1] * 0.72, c[2] * 0.72);
      };
      const strip = (
        pts: Array<{ x: number; z: number; y: number; c: [number, number, number] }>,
      ) => {
        for (let k = 0; k < pts.length - 1; k += 1) {
          const a = pts[k];
          const bb = pts[k + 1];
          pushV(a.x, a.z, a.y, a.c); pushV(bb.x, bb.z, bb.y, bb.c); pushV(bb.x, bb.z, SKIRT_BOTTOM, bb.c);
          pushV(a.x, a.z, a.y, a.c); pushV(bb.x, bb.z, SKIRT_BOTTOM, bb.c); pushV(a.x, a.z, SKIRT_BOTTOM, a.c);
        }
      };
      for (const key of Object.keys(terrain.chunks)) {
        const chunk = terrain.chunks[key];
        const [cx, cz] = key.split(",").map(Number);
        const ox = cx * CHUNK_SIZE - CHUNK_SIZE / 2;
        const oz = cz * CHUNK_SIZE - CHUNK_SIZE / 2;
        const col = (i: number, j: number) =>
          seasonTint(terrainVertexColor(chunk, i, j, terrain.waterLevel), sky.season);
        if (!has(cx, cz - 1)) {
          // Mép -z (j=0).
          strip(Array.from({ length: TERRAIN_CELLS + 1 }, (_, i) => ({
            x: ox + (i / TERRAIN_CELLS) * CHUNK_SIZE,
            z: oz,
            y: chunk.heights[0][i],
            c: col(i, 0),
          })));
        }
        if (!has(cx, cz + 1)) {
          strip(Array.from({ length: TERRAIN_CELLS + 1 }, (_, i) => ({
            x: ox + (i / TERRAIN_CELLS) * CHUNK_SIZE,
            z: oz + CHUNK_SIZE,
            y: chunk.heights[TERRAIN_CELLS][i],
            c: col(i, TERRAIN_CELLS),
          })));
        }
        if (!has(cx - 1, cz)) {
          strip(Array.from({ length: TERRAIN_CELLS + 1 }, (_, j) => ({
            x: ox,
            z: oz + (j / TERRAIN_CELLS) * CHUNK_SIZE,
            y: chunk.heights[j][0],
            c: col(0, j),
          })));
        }
        if (!has(cx + 1, cz)) {
          strip(Array.from({ length: TERRAIN_CELLS + 1 }, (_, j) => ({
            x: ox + CHUNK_SIZE,
            z: oz + (j / TERRAIN_CELLS) * CHUNK_SIZE,
            y: chunk.heights[j][TERRAIN_CELLS],
            c: col(TERRAIN_CELLS, j),
          })));
        }
      }
      const sgeo = new THREE.BufferGeometry();
      sgeo.setAttribute("position", new THREE.Float32BufferAttribute(spos, 3));
      sgeo.setAttribute("color", new THREE.Float32BufferAttribute(scol, 3));
      sgeo.computeVertexNormals();
      const sold = t.skirt.geometry;
      t.skirt.geometry = sgeo;
      sold.dispose();
    }
    // Đế + mặt nước phủ toàn bộ biên thế giới (chiều cao đế giữ nguyên).
    t.base.scale.set(b.maxX - b.minX + 2, 1, b.maxZ - b.minZ + 2);
    t.base.position.set(b.centerX, -6.05, b.centerZ);
    t.water.scale.set(b.maxX - b.minX, b.maxZ - b.minZ, 1);
    t.water.position.set(b.centerX, terrain.waterLevel + 0.02, b.centerZ);
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
      yOff = 0.06,
      water = false,
    ) => {
      const group = new THREE.Group();
      if (points.length === 1) {
        const dot = new THREE.Mesh(
          new THREE.CircleGeometry(width, 16),
          water
            ? new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.75, roughness: 0.15 })
            : new THREE.MeshStandardMaterial({ color, roughness: 1 }),
        );
        dot.rotation.x = -Math.PI / 2;
        dot.position.set(
          points[0].x,
          heightAt(terrain, points[0].x, points[0].z) + yOff + 0.01,
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
        const yA = heightAt(terrain, a.x, a.z) + yOff;
        const yB = heightAt(terrain, b.x, b.z) + yOff;
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
          water
            ? new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.75, roughness: 0.15, side: THREE.DoubleSide })
            : new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide }),
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
    for (const river of rivers) {
      if (river.points.length > 0) {
        t.pathsGroup.add(buildRibbon(river.points, "#2f8fe0", river.width / 2, 0.15, true));
      }
    }
    if (draftRiver.length > 0) {
      t.pathsGroup.add(buildRibbon(draftRiver, "#7cc4ff", 0.5, 0.15, true));
    }
  }, [terrain, paths, draftPath, rivers, draftRiver, sky.season]);

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
        heightAt(terrain, sel.x, sel.z) + 0.04,
        sel.z,
      );
      t.ring.scale.setScalar(placementFootprint(sel, customModels));
    } else {
      t.ring.visible = false;
    }
  }, [placements, selectedId, terrain, customModels]);

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
    // Bầu trời sống (Phase 2): tạo 1 lần cho mỗi scene, cập nhật theo
    // giờ. Guard cũ chỉ kiểm tra ref nên nếu scene đã đổi (remount)
    // mà ref còn thì bầu trời kẹt ở scene chết — kiểm tra cả scene.
    if (!skyDressRef.current || skyDressRef.current.scene !== t.scene) {
      const cv = document.createElement("canvas");
      cv.width = 128;
      cv.height = 128;
      const ctx = cv.getContext("2d")!;
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.35, "rgba(255,255,255,0.85)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      const glowTex = new THREE.CanvasTexture(cv);
      const sunMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false });
      const sunGlow = new THREE.Sprite(sunMat);
      sunGlow.scale.setScalar(110);
      // Đĩa đặc: quầng mềm một mình dễ bị nuốt khi nền sáng hoặc khi
      // ảnh nén — đĩa đặc nhìn là thấy ngay, không thể lẫn vào nền.
      const sunCoreMat = new THREE.MeshBasicMaterial({ color: "#fff8e0", fog: false, transparent: true, opacity: 1 });
      const sunCore = new THREE.Mesh(new THREE.CircleGeometry(16, 32), sunCoreMat);
      sunCore.position.z = 0.1;
      const sun = new THREE.Group();
      sun.add(sunGlow, sunCore);
      t.scene.add(sun);
      const moon = new THREE.Group();
      const moonBright = new THREE.Mesh(
        new THREE.CircleGeometry(9, 32),
        new THREE.MeshBasicMaterial({ color: "#e8ecf5", fog: false, transparent: true, opacity: 0.95 }),
      );
      const moonDark = new THREE.Mesh(
        new THREE.CircleGeometry(9.4, 32),
        new THREE.MeshBasicMaterial({ color: "#0d0817", fog: false, transparent: true, opacity: 1 }),
      );
      moonDark.position.z = 0.2;
      moon.add(moonBright, moonDark);
      t.scene.add(moon);
      const rng = mulberry32(42);
      const pos = new Float32Array(600 * 3);
      for (let i = 0; i < 600; i += 1) {
        const a = rng() * Math.PI * 2;
        const y = 0.1 + rng() * 0.9;
        const r = Math.sqrt(1 - y * y);
        pos[i * 3] = Math.cos(a) * r * 280;
        pos[i * 3 + 1] = y * 280;
        pos[i * 3 + 2] = Math.sin(a) * r * 280;
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(
        sg,
        new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }),
      );
      t.scene.add(stars);
      const crng = mulberry32(7);
      const clouds: THREE.Sprite[] = [];
      for (let i = 0; i < 24; i += 1) {
        const m = new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, fog: false });
        const sp = new THREE.Sprite(m);
        sp.position.set((crng() - 0.5) * 280, 55 + crng() * 30, (crng() - 0.5) * 280);
        sp.scale.set(50 + crng() * 50, 18 + crng() * 14, 1);
        sp.userData = { speed: 0.6 + crng() * 0.9, base: 0.6 + crng() * 0.25 };
        t.scene.add(sp);
        clouds.push(sp);
      }
      skyDressRef.current = { sun, sunMat, sunCoreMat, moon, moonDark, stars, clouds, scene: t.scene };
    }
    const d = skyDressRef.current!;
    const day = sky.time >= 6 && sky.time <= 18;
    const dome = domeRef.current;
    if (dome) {
      const warm = sky.time < 8 || sky.time > 16;
      if (sky.weather === "fog") {
        dome.mat.uniforms.topColor.value.set("#9aa5b5");
        dome.mat.uniforms.horizonColor.value.set("#c8ccd4");
      } else if (!day) {
        dome.mat.uniforms.topColor.value.set("#030712");
        dome.mat.uniforms.horizonColor.value.set("#1b2340");
      } else if (warm) {
        dome.mat.uniforms.topColor.value.set("#5b7fc4");
        dome.mat.uniforms.horizonColor.value.set("#ffb066");
      } else {
        dome.mat.uniforms.topColor.value.set("#3a86d8");
        dome.mat.uniforms.horizonColor.value.set("#bfe3f5");
      }
    }
    const sunDir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    d.sun.position.copy(sunDir).multiplyScalar(260);
    d.sunMat.color.set(info.sunColor);
    d.sunCoreMat.color.set(info.sunColor);
    d.sun.visible = day;
    const nightT = sky.time >= 18 ? sky.time - 18 : sky.time + 6;
    const mAz = (nightT / 12) * Math.PI;
    const mEl = Math.sin(mAz) * 0.9 + 0.08;
    const moonDir = new THREE.Vector3(Math.cos(mAz) * Math.cos(mEl), Math.sin(mEl), Math.sin(mAz) * Math.cos(mEl));
    d.moon.position.copy(moonDir).multiplyScalar(260);
    d.moon.visible = !day;
    const phase = moonPhase();
    d.moonDark.position.set(moonCoverOffset(phase, 9) * moonCoverSide(phase), 0, 0.2);
    (d.moonDark.material as THREE.MeshBasicMaterial).color.set(info.skyBg);
    const darkness = !day ? 1 : sky.time < 7 || sky.time > 17 ? 0.4 : 0;
    (d.stars.material as THREE.PointsMaterial).opacity = darkness * 0.9;
    const cloudBase = day ? 1 : 0.3;
    for (const c of d.clouds) {
      c.material.opacity = (c.userData.base as number) * cloudBase;
    }
    if (!day) {
      // Ban đêm đèn chính thành ánh trăng: xanh nhạt, từ hướng mặt trăng.
      lights.sun.position.copy(moonDir).multiplyScalar(40);
      lights.sun.color.set("#8ea2c8");
      lights.sun.intensity = 0.3;
    }
  }, [sky]);

  // Đèn đường phát sáng khi trời tối (Phase 2): chạy lại mỗi khi giờ
  // hoặc vật đổi, vì vật mới đặt cũng cần được gắn phát sáng.
  useEffect(() => {
    const t = threeRef.current;
    if (!t) return;
    const night = !(sky.time >= 6 && sky.time <= 18);
    t.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.userData?.lampBulb) return;
      const m = mesh.material as THREE.MeshStandardMaterial;
      m.emissive.set("#ffca5e");
      m.emissiveIntensity = night ? 1.5 : 0;
    });
  }, [sky, placements]);

  // Bay tới góc nhìn đã lưu khi workspace yêu cầu.
  useEffect(() => {
    const t = threeRef.current;
    if (!t || !flyTo) return;
    // Góc ngắm trời nhìn thẳng lên nên phải mở khoá cực (mặc định khoá
    // ở 85° để camera không chui xuống dưới đế sa bàn); bay thường thì
    // trả về giới hạn cũ để góc nhìn sa bàn không bị lạ.
    t.controls.maxPolarAngle = flyTo.sky ? Math.PI : Math.PI / 2 - 0.05;
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
