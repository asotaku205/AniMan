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
import {
  GROUND_SIZE,
  clampGround,
  modelDef,
  placementFootprint,
  snapToGrid,
  type DioramaPlacement,
  type StoryEntity,
} from "../lib/diorama";

interface Props {
  placements: DioramaPlacement[];
  entities: StoryEntity[];
  selectedId: string | null;
  /** Đang cầm một mẫu để đặt — bấm vào mặt đất là đặt xuống. */
  placing: boolean;
  /** dataUrl GLB theo asset id (từ kho tài sản Animation Studio). */
  glbDataUrls: Record<string, string>;
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
): THREE.Group {
  const def = modelDef(p.modelId);
  const group = new THREE.Group();
  group.position.set(p.x, 0, p.z);
  group.rotation.y = p.rotationY;
  group.scale.setScalar(p.scale);
  group.userData.placementId = p.id;
  for (const part of def.parts) {
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
      part.color === "__entity__" ? (entity?.color ?? "#8b5cf6") : part.color;
    const mesh = new THREE.Mesh(
      geometry,
      // MeshStandardMaterial + flatShading = mặt phẳng có chiều sâu
      // ánh sáng rõ hơn Lambert, đúng phong cách low-poly stylized.
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        metalness: 0,
        flatShading: true,
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
  onSelect,
  onPlace,
  onMove,
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
  const glbCacheRef = useRef<Map<string, THREE.Group>>(new Map());
  const glbFailedRef = useRef<Set<string>>(new Set());
  const [, setGlbTick] = useState(0);
  const callbacksRef = useRef({ onSelect, onPlace, onMove, placing });
  callbacksRef.current = { onSelect, onPlace, onMove, placing };

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

    scene.add(new THREE.HemisphereLight(0xbcd7ff, 0x3a2f22, 0.55));
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

    // Đế sa bàn: khối đế + mặt đất phẳng + lưới mờ
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(GROUND_SIZE + 2, 1, GROUND_SIZE + 2),
      new THREE.MeshStandardMaterial({ color: "#3c2c17", roughness: 1 }),
    );
    base.position.y = -0.5;
    base.receiveShadow = true;
    scene.add(base);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
      new THREE.MeshStandardMaterial({ color: "#5d9150", roughness: 1 }),
    );
    ground.receiveShadow = true;
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.01;
    scene.add(ground);
    const grid = new THREE.GridHelper(GROUND_SIZE, GROUND_SIZE, 0xffffff, 0xffffff);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.08;
    grid.position.y = 0.02;
    scene.add(grid);

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

    const ndc = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
    };
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
      if (cb.placing) {
        const pt = groundPoint(e);
        if (pt) cb.onPlace(pt.x, pt.z);
        return;
      }
      const group = pickPlacement(e);
      if (!group) return;
      const id = group.userData.placementId as string;
      cb.onSelect(id);
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
      drag.group.position.x = clampGround(pt.x);
      drag.group.position.z = clampGround(pt.z);
    };
    const onPointerUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      controls.enabled = true;
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
      const fp = found ? placementFootprint(found) : 0;
      callbacksRef.current.onMove(
        drag.id,
        snapToGrid(clampGround(drag.group.position.x, fp)),
        snapToGrid(clampGround(drag.group.position.z, fp)),
      );
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

  // Dựng lại vật khi dữ liệu đổi
  useEffect(() => {
    const t = threeRef.current;
    if (!t) return;
    for (const child of [...t.objects.children]) {
      t.objects.remove(child);
      // Clone GLB chia sẻ geometry với cache — dispose nó là hỏng cache.
      if (!(child as THREE.Group).userData.sharedGlb) disposeObject(child);
    }
    const entityById = new Map(entities.map((e) => [e.id, e]));
    const loader = new GLTFLoader();
    for (const p of placements) {
      if (!p.visible) continue;
      if (p.glbAssetId) {
        const cached = glbCacheRef.current.get(p.glbAssetId);
        if (cached) {
          const clone = cached.clone(true);
          clone.position.set(p.x, 0, p.z);
          clone.rotation.y = p.rotationY;
          clone.scale.setScalar(p.scale);
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
          ),
        );
        continue;
      }
      t.objects.add(
        buildPlacementMesh(p, p.storyEntityId ? (entityById.get(p.storyEntityId) ?? null) : null),
      );
    }
    const sel = placements.find((p) => p.id === selectedId);
    if (sel) {
      t.ring.visible = true;
      t.ring.position.set(sel.x, 0.04, sel.z);
      t.ring.scale.setScalar(placementFootprint(sel));
    } else {
      t.ring.visible = false;
    }
  }, [placements, entities, selectedId, glbDataUrls]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ cursor: placing ? "copy" : "default", touchAction: "none" }}
    />
  );
}
