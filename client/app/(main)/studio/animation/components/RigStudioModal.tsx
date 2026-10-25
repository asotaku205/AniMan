/**
 * Phòng Rig (Phase 3 + Rig Pro): gắn xương nhanh cho nhân vật người ngay
 * trong app, rồi chỉnh sâu: ngón tay/chân, tay chân với tới mục tiêu,
 * tô vùng ảnh hưởng của xương, dáng tự tạo, khuôn mặt, chất liệu.
 *
 * Luồng cũ giữ nguyên: nạp model → tự căn xương mẫu theo chiều cao →
 * người dùng chỉnh khớp (ô số X/Y/Z) → thử dáng mẫu → lưu thành model
 * đã rig (.glb kèm xương) vào kho tài sản. Model đã có xương thì báo
 * và dừng.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { X } from "lucide-react";
import { TEST_POSES, type RigJoint } from "../lib/rig";
import { autoFitRigPro } from "../lib/rigPro";
import {
  buildRiggedRoot,
  exportRiggedRootToGlb,
  loadModelForRig,
  type LoadedModel,
  type RiggedRoot,
} from "../lib/rigExport";
import {
  applyLimbIK,
  ARM_CHAINS,
  captureRest,
  LEG_CHAINS,
  type LimbChain,
  type RestSnapshot,
} from "../lib/ikApply";
import type { Vec3 } from "../lib/ik";
import { captureBoneEulers } from "../lib/poseCapture";
import {
  applyMaterialEdits,
  applyMorphValues,
  applyPaintSnapshots,
  capturePaintSnapshots,
  collectMaterialDefaults,
  collectMaterials,
  collectMorphs,
  type MaterialDefault,
  type MaterialEdit,
  type MaterialEntry,
  type MorphEntry,
  type PaintSnapshot,
} from "../lib/rigCustom";
import { applyBrushStroke, normalizeWeights, type BrushMode } from "../lib/weightPaint";
import { mirrorPose, newPoseId, type SavedPose } from "../lib/poseLibrary";
import type { EulerRad } from "../lib/retarget";
import { inspectGlbDataUrl } from "../lib/modelInspect";
import { newAssetId, type Model3DAsset } from "../lib/animAssets";
import {
  deletePoseEntry,
  listSavedPoses,
  saveAnimAsset,
  savePoseEntry,
} from "../lib/animStorage";

const JOINT_GROUPS: Array<{ name: string; joints: string[] }> = [
  { name: "Thân", joints: ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head"] },
  { name: "Tay trái", joints: ["LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand"] },
  { name: "Tay phải", joints: ["RightShoulder", "RightArm", "RightForeArm", "RightHand"] },
  { name: "Chân trái", joints: ["LeftUpLeg", "LeftLeg", "LeftFoot"] },
  { name: "Chân phải", joints: ["RightUpLeg", "RightLeg", "RightFoot"] },
];

const FINGER_LABELS: Record<string, string> = {
  Thumb: "Ngón cái",
  Index: "Ngón trỏ",
  Middle: "Ngón giữa",
  Ring: "Ngón áp út",
  Pinky: "Ngón út",
};
const FINGER_DOTS = ["Đốt gốc", "Đốt giữa", "Đốt ngọn"];

type IkLimbId = "armLeft" | "armRight" | "legLeft" | "legRight";
const IK_LIMB_DEFS: Array<{
  id: IkLimbId;
  label: string;
  chain: LimbChain;
  isLeg: boolean;
}> = [
  { id: "armLeft", label: "Tay trái", chain: ARM_CHAINS.left, isLeg: false },
  { id: "armRight", label: "Tay phải", chain: ARM_CHAINS.right, isLeg: false },
  { id: "legLeft", label: "Chân trái", chain: LEG_CHAINS.left, isLeg: true },
  { id: "legRight", label: "Chân phải", chain: LEG_CHAINS.right, isLeg: true },
];

const emptyIkEnabled: Record<IkLimbId, boolean> = {
  armLeft: false,
  armRight: false,
  legLeft: false,
  legRight: false,
};
const defaultIkLock: Record<IkLimbId, boolean> = {
  armLeft: false,
  armRight: false,
  legLeft: true,
  legRight: true,
};

interface LivePreview {
  built: RiggedRoot;
  rest: RestSnapshot;
  render: () => void;
}

export function RigStudioModal({
  asset,
  onClose,
  onSaved,
}: {
  asset: Model3DAsset;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loaded, setLoaded] = useState<LoadedModel | null>(null);
  const [joints, setJoints] = useState<RigJoint[] | null>(null);
  const [poseId, setPoseId] = useState("bind");
  const [libraryPose, setLibraryPose] = useState<Record<string, EulerRad> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const liveRef = useRef<LivePreview | null>(null);
  const paintRef = useRef<PaintSnapshot>(new Map());

  // IK: mục tiêu kéo bằng chuột trong khung xem trước hoặc nhập số.
  const [ikEnabled, setIkEnabled] = useState<Record<IkLimbId, boolean>>(emptyIkEnabled);
  const [ikTargets, setIkTargets] = useState<Partial<Record<IkLimbId, Vec3>>>({});
  const [ikLockGround, setIkLockGround] = useState<Record<IkLimbId, boolean>>(defaultIkLock);
  // Tô vùng ảnh hưởng.
  const [paintBone, setPaintBone] = useState<string | null>(null);
  const [paintRadius, setPaintRadius] = useState(0.08);
  const [paintStrength, setPaintStrength] = useState(0.5);
  const [paintMode, setPaintMode] = useState<BrushMode>("add");
  // Khuôn mặt + chất liệu (danh sách lấy từ khung xem trước).
  const [morphList, setMorphList] = useState<MorphEntry[]>([]);
  const [morphValues, setMorphValues] = useState<Record<string, number>>({});
  const [materialList, setMaterialList] = useState<MaterialEntry[]>([]);
  const [materialDefaults, setMaterialDefaults] = useState<MaterialDefault[]>([]);
  const [materialEdits, setMaterialEdits] = useState<Record<number, MaterialEdit>>({});
  // Thư viện dáng.
  const [savedPoses, setSavedPoses] = useState<SavedPose[]>([]);
  const [poseName, setPoseName] = useState("");
  const [clipboardPose, setClipboardPose] = useState<Record<string, EulerRad> | null>(null);

  // Trạng thái tương tác (cọ/kéo) đọc trong handler của khung xem trước.
  const interactRef = useRef({ paintBone, paintRadius, paintStrength, paintMode, joints });
  interactRef.current = { paintBone, paintRadius, paintStrength, paintMode, joints };

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoaded(null);
    setJoints(null);
    setLibraryPose(null);
    setPoseId("bind");
    setIkEnabled(emptyIkEnabled);
    setIkTargets({});
    setIkLockGround(defaultIkLock);
    setPaintBone(null);
    setMorphValues({});
    setMaterialEdits({});
    setMorphList([]);
    setMaterialList([]);
    setMaterialDefaults([]);
    paintRef.current = new Map();
    liveRef.current = null;
    loadModelForRig(asset.dataUrl)
      .then((m) => {
        if (cancelled) return;
        setLoaded(m);
        if (!m.hasSkeleton) setJoints(autoFitRigPro(m.heightM));
      })
      .catch(() => {
        if (!cancelled) setError("Không nạp được model này để rig — kiểm tra lại file .glb.");
      });
    return () => {
      cancelled = true;
    };
  }, [asset]);

  useEffect(() => {
    listSavedPoses()
      .then(setSavedPoses)
      .catch(() => setSavedPoses([]));
  }, []);

  // Xem trước 3D: model đã gắn xương + khung xương, dáng thử, mục tiêu IK,
  // vết tô, khuôn mặt, chất liệu.
  useEffect(() => {
    if (!loaded || loaded.hasSkeleton || !joints || !previewRef.current) return;
    const container = previewRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(container.clientWidth, 420);
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#150e24");
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / 420,
      0.1,
      100,
    );
    const H = loaded.heightM;
    camera.position.set(H * 1.1, H * 0.75, H * 1.5);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, H * 0.5, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(3, 6, 4);
    scene.add(dir);
    scene.add(new THREE.GridHelper(Math.max(4, H * 2), 20, 0x8b5cf6, 0x3a2a5a));
    const render = () => renderer.render(scene, camera);
    controls.addEventListener("change", render);

    let root: THREE.Group | null = null;
    let built: RiggedRoot | null = null;
    let rest: RestSnapshot | null = null;
    const spheres: THREE.Mesh[] = [];
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const setPointer = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
    };

    try {
      built = buildRiggedRoot(loaded.scene, joints);
      root = built.root;
      rest = captureRest(built.boneByName);
      const activePose = libraryPose ?? TEST_POSES[poseId]?.pose ?? {};
      for (const [name, e] of Object.entries(activePose)) {
        built.boneByName.get(name)?.rotation.set(e[0], e[1], e[2]);
      }
      for (const def of IK_LIMB_DEFS) {
        if (!ikEnabled[def.id]) continue;
        const endRest = rest.positions.get(def.chain.end);
        if (!endRest) continue;
        let t = ikTargets[def.id] ?? [endRest.x, endRest.y, endRest.z];
        if (ikLockGround[def.id]) t = [t[0], endRest.y, t[2]];
        applyLimbIK(built.boneByName, rest, def.chain, t as Vec3);
      }
      root.updateMatrixWorld(true);
      applyMorphValues(root, morphValues);
      applyMaterialEdits(root, materialEdits);
      applyPaintSnapshots(root, paintRef.current);
      scene.add(root);
      const helper = new THREE.SkeletonHelper(built.boneByName.get("Hips")!);
      scene.add(helper);
      for (const def of IK_LIMB_DEFS) {
        if (!ikEnabled[def.id]) continue;
        const endRest = rest.positions.get(def.chain.end);
        if (!endRest) continue;
        let t = ikTargets[def.id] ?? [endRest.x, endRest.y, endRest.z];
        if (ikLockGround[def.id]) t = [t[0], endRest.y, t[2]];
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(0.02, H * 0.02), 16, 12),
          new THREE.MeshBasicMaterial({
            color: def.isLeg ? 0x34d399 : 0xa78bfa,
            transparent: true,
            opacity: 0.9,
          }),
        );
        sphere.position.set(t[0], t[1], t[2]);
        sphere.userData.limbId = def.id;
        scene.add(sphere);
        spheres.push(sphere);
      }
      setMorphList(collectMorphs(root));
      setMaterialList(collectMaterials(root));
      setMaterialDefaults(collectMaterialDefaults(root));
      liveRef.current = { built, rest, render };
    } catch {
      setError("Không dựng được xương xem trước — thử bấm Tự căn lại.");
    }
    render();

    // Kéo mục tiêu IK / tô: bắt ở container (capture) để tắt xoay camera
    // trước khi OrbitControls kịp nhận pointerdown.
    type DragState =
      | { kind: "ik"; def: (typeof IK_LIMB_DEFS)[number]; plane: THREE.Plane }
      | { kind: "paint"; mesh: THREE.SkinnedMesh }
      | null;
    let drag: DragState = null;

    const paintAt = (point: THREE.Vector3, mesh: THREE.SkinnedMesh) => {
      const st = interactRef.current;
      if (!st.paintBone || !st.joints) return;
      const boneIndex = st.joints.findIndex((j) => j.name === st.paintBone);
      if (boneIndex < 0) return;
      const geo = mesh.geometry;
      const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
      const siAttr = geo.getAttribute("skinIndex") as THREE.BufferAttribute;
      const swAttr = geo.getAttribute("skinWeight") as THREE.BufferAttribute;
      if (!posAttr || !siAttr || !swAttr) return;
      const count = posAttr.count;
      const skinIndex: number[][] = [];
      const skinWeight: number[][] = [];
      for (let i = 0; i < count; i += 1) {
        skinIndex.push([siAttr.getX(i), siAttr.getY(i), siAttr.getZ(i), siAttr.getW(i)]);
        skinWeight.push([swAttr.getX(i), swAttr.getY(i), swAttr.getZ(i), swAttr.getW(i)]);
      }
      const out = applyBrushStroke({
        positions: posAttr.array as ArrayLike<number>,
        skinIndex,
        skinWeight,
        boneIndex,
        hit: [point.x, point.y, point.z],
        radius: st.paintRadius,
        strength: st.paintStrength,
        mode: st.paintMode,
      });
      const si = new Uint16Array(count * 4);
      const sw = new Float32Array(count * 4);
      for (let i = 0; i < count; i += 1) {
        for (let k = 0; k < 4; k += 1) {
          si[i * 4 + k] = out.skinIndex[i]?.[k] ?? 0;
          sw[i * 4 + k] = out.skinWeight[i]?.[k] ?? 0;
        }
      }
      geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
      geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
      render();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!built || !rest || !root) return;
      setPointer(e);
      const sphereHits = raycaster.intersectObjects(spheres, false);
      if (sphereHits.length > 0) {
        const sphere = sphereHits[0].object as THREE.Mesh;
        const def = IK_LIMB_DEFS.find((d) => d.id === sphere.userData.limbId)!;
        const target = sphere.position.clone();
        let plane: THREE.Plane;
        if (ikLockGround[def.id]) {
          plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -target.y);
        } else {
          const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
          plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, target);
        }
        drag = { kind: "ik", def, plane };
        controls.enabled = false;
        return;
      }
      const st = interactRef.current;
      if (st.paintBone) {
        const meshes: THREE.SkinnedMesh[] = [];
        root.traverse((obj) => {
          if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
            meshes.push(obj as THREE.SkinnedMesh);
          }
        });
        const hits = raycaster.intersectObjects(meshes, false);
        if (hits.length > 0) {
          drag = { kind: "paint", mesh: hits[0].object as THREE.SkinnedMesh };
          controls.enabled = false;
          paintAt(hits[0].point, drag.mesh);
        }
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      const current = drag;
      if (!current || !built || !rest || !root) return;
      setPointer(e);
      if (current.kind === "ik") {
        const point = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(current.plane, point)) return;
        const sphere = spheres.find((sp) => sp.userData.limbId === current.def.id);
        if (sphere) sphere.position.copy(point);
        let t: Vec3 = [point.x, point.y, point.z];
        if (ikLockGround[current.def.id]) {
          const endRest = rest.positions.get(current.def.chain.end);
          if (endRest) t = [point.x, endRest.y, point.z];
        }
        applyLimbIK(built.boneByName, rest, current.def.chain, t);
        root.updateMatrixWorld(true);
        render();
      } else {
        const hits = raycaster.intersectObjects([current.mesh], false);
        if (hits.length > 0) paintAt(hits[0].point, current.mesh);
      }
    };
    const onPointerUp = () => {
      const current = drag;
      if (!current) return;
      if (current.kind === "ik") {
        const sphere = spheres.find((sp) => sp.userData.limbId === current.def.id);
        if (sphere) {
          const p: Vec3 = [sphere.position.x, sphere.position.y, sphere.position.z];
          setIkTargets((prev) => ({ ...prev, [current.def.id]: p }));
        }
      } else if (root) {
        paintRef.current = capturePaintSnapshots(root);
      }
      drag = null;
      controls.enabled = true;
    };
    container.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      container.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      if (root) {
        root.traverse((obj) => {
          (obj as THREE.Mesh).geometry?.dispose?.();
        });
      }
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [loaded, joints, poseId, libraryPose, ikEnabled, ikTargets, ikLockGround, morphValues, materialEdits]);

  const setJointPos = (name: string, axis: number, value: number) => {
    setJoints((js) =>
      (js ?? []).map((j) => {
        if (j.name !== name) return j;
        const pos: [number, number, number] = [...j.pos];
        pos[axis] = value;
        return { ...j, pos };
      }),
    );
  };

  const jointByName = new Map((joints ?? []).map((j) => [j.name, j]));

  const JointRows = ({ names, labels }: { names: string[]; labels?: string[] }) => (
    <div className="space-y-1.5">
      {names.map((name, i) => {
        const joint = jointByName.get(name);
        if (!joint) return null;
        return (
          <div key={name} className="grid grid-cols-[110px_1fr_1fr_1fr] gap-1.5 items-center">
            <span className="text-[11px] text-white/60">{labels?.[i] ?? name}</span>
            {joint.pos.map((v, axis) => (
              <label key={axis} className="block text-[10px] text-white/40">
                {["X", "Y", "Z"][axis]}
                <input
                  type="number"
                  step={0.01}
                  value={v}
                  onChange={(e) => setJointPos(name, axis, Number(e.target.value) || 0)}
                  className="mt-0.5 w-full h-7 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
                />
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );

  const activePose = libraryPose ?? TEST_POSES[poseId]?.pose ?? {};

  const captureCurrentPose = (): Record<string, EulerRad> => {
    const live = liveRef.current;
    if (live) return captureBoneEulers(live.built.boneByName);
    return { ...activePose };
  };

  const refreshPoses = () => {
    listSavedPoses()
      .then(setSavedPoses)
      .catch(() => undefined);
  };

  const saveCurrentPose = () => {
    const name = poseName.trim() || "Dáng không tên";
    savePoseEntry({
      id: newPoseId(),
      name,
      createdAt: Date.now(),
      bones: captureCurrentPose(),
    })
      .then(() => {
        setPoseName("");
        refreshPoses();
      })
      .catch(() => setError("Không lưu được dáng — thử lại sau."));
  };

  const effectiveIkTarget = (def: (typeof IK_LIMB_DEFS)[number]): Vec3 => {
    const t = ikTargets[def.id];
    if (t) {
      if (ikLockGround[def.id]) {
        const endRest = liveRef.current?.rest.positions.get(def.chain.end);
        if (endRest) return [t[0], endRest.y, t[2]];
      }
      return t;
    }
    const endRest = liveRef.current?.rest.positions.get(def.chain.end);
    return endRest ? [endRest.x, endRest.y, endRest.z] : [0, 0, 0];
  };

  const setIkTargetAxis = (def: (typeof IK_LIMB_DEFS)[number], axis: number, value: number) => {
    const cur = effectiveIkTarget(def);
    const next: Vec3 = [...cur];
    next[axis] = value;
    setIkTargets((prev) => ({ ...prev, [def.id]: next }));
  };

  const normalizeLivePaint = () => {
    const live = liveRef.current;
    if (!live) return;
    live.built.root.traverse((obj) => {
      const mesh = obj as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const siAttr = mesh.geometry.getAttribute("skinIndex") as THREE.BufferAttribute;
      const swAttr = mesh.geometry.getAttribute("skinWeight") as THREE.BufferAttribute;
      if (!siAttr || !swAttr) return;
      const count = siAttr.count;
      const rows: number[][] = [];
      for (let i = 0; i < count; i += 1) {
        rows.push([swAttr.getX(i), swAttr.getY(i), swAttr.getZ(i), swAttr.getW(i)]);
      }
      const norm = normalizeWeights(rows);
      const sw = new Float32Array(count * 4);
      for (let i = 0; i < count; i += 1) {
        for (let k = 0; k < 4; k += 1) sw[i * 4 + k] = norm[i][k] ?? 0;
      }
      mesh.geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
    });
    paintRef.current = capturePaintSnapshots(live.built.root);
    live.render();
  };

  const save = async () => {
    if (!loaded || !joints) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      // Xuất từ tư thế gốc, áp mọi chỉnh sửa (vết tô, khuôn mặt, chất liệu).
      const built = buildRiggedRoot(loaded.scene, joints);
      applyPaintSnapshots(built.root, paintRef.current);
      applyMorphValues(built.root, morphValues);
      applyMaterialEdits(built.root, materialEdits);
      built.root.updateMatrixWorld(true);
      const res = await exportRiggedRootToGlb(built.root);
      const inspection = await inspectGlbDataUrl(res.dataUrl);
      if (!inspection || inspection.boneCount === 0) {
        throw new Error("Xuất file xong nhưng không thấy xương trong file — thử lại hoặc kiểm tra model gốc.");
      }
      await saveAnimAsset({
        kind: "model3d",
        id: newAssetId("model"),
        name: `${asset.name} (đã rig)`,
        dataUrl: res.dataUrl,
        createdAt: Date.now(),
        inspection,
      });
      setSavedMsg(
        `Đã lưu "${asset.name} (đã rig)" — ${res.meshCount} lưới, ${res.vertexCount} đỉnh, ${inspection.boneCount} xương. Giờ dùng được clip Mixamo ở Phase 4.`,
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được model đã rig.");
    } finally {
      setSaving(false);
    }
  };

  const sectionClass =
    "rounded-xl border border-white/10 bg-black/30 px-2.5 py-2";
  const inputClass =
    "mt-0.5 w-full h-7 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none";
  const smallBtn =
    "h-8 px-3 rounded-lg border text-[12px] bg-white/5 border-white/10 text-white/70";

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 grid place-items-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-[#150e24] border border-white/10 p-4 space-y-3 my-auto">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 text-[14px] font-medium text-white/90">
            Phòng Rig — {asset.name}
          </h3>
          <button onClick={onClose} aria-label="Đóng" className="text-white/40 hover:text-white">
            <X size={16} />
          </button>
        </div>
        {error && <p className="text-[12px] text-rose-300 leading-relaxed">{error}</p>}
        {savedMsg && <p className="text-[12px] text-emerald-300 leading-relaxed">{savedMsg}</p>}
        {!loaded && !error && (
          <p className="text-[12px] text-white/50">Đang nạp model…</p>
        )}
        {loaded?.hasSkeleton && (
          <p className="text-[12px] text-white/70 leading-relaxed">
            Model này đã có xương sẵn ({loaded.boneCount} xương) — không cần
            rig lại. Dùng thẳng clip ở Phase 4.
          </p>
        )}
        {loaded && !loaded.hasSkeleton && joints && (
          <>
            <p className="text-[11px] text-white/40 leading-relaxed">
              Xương mẫu đã tự căn theo chiều cao {loaded.heightM.toFixed(2)}m,
              gồm cả ngón tay và ngón chân. Chỉnh khớp cho khớp đúng vai,
              khuỷu, gối, ngón của nhân vật rồi thử dáng bên dưới. Clip
              chuyển động dạng vật thể của model gốc (nếu có) sẽ không giữ
              lại sau khi rig.
            </p>
            <div ref={previewRef} className="w-full h-[420px] rounded-xl overflow-hidden bg-[#150e24] border border-white/10" />
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TEST_POSES).map(([id, p]) => (
                <button
                  key={id}
                  onClick={() => {
                    setPoseId(id);
                    setLibraryPose(null);
                  }}
                  title={p.desc}
                  className={`h-8 px-3 rounded-lg border text-[12px] ${!libraryPose && poseId === id ? "bg-violet-500/25 border-violet-400/40 text-violet-100" : "bg-white/5 border-white/10 text-white/70"}`}
                >
                  {p.name}
                </button>
              ))}
              {libraryPose && (
                <span className="h-8 px-3 rounded-lg border border-violet-400/40 bg-violet-500/25 text-violet-100 text-[12px] grid place-items-center">
                  Dáng của tôi
                </span>
              )}
              <button
                onClick={() => setJoints(autoFitRigPro(loaded.heightM))}
                className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-white/70 text-[12px]"
              >
                Tự căn lại
              </button>
            </div>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              <details className={sectionClass}>
                <summary className="text-[12px] text-white/70 cursor-pointer">Khớp chính</summary>
                <div className="space-y-3 mt-2">
                  {JOINT_GROUPS.map((group) => (
                    <div key={group.name}>
                      <p className="text-[11px] text-white/50 mb-1">{group.name}</p>
                      <JointRows names={group.joints} />
                    </div>
                  ))}
                </div>
              </details>

              <details className={sectionClass}>
                <summary className="text-[12px] text-white/70 cursor-pointer">Ngón tay, ngón chân</summary>
                <div className="space-y-3 mt-2">
                  {(["Left", "Right"] as const).map((side) => (
                    <div key={side}>
                      <p className="text-[11px] text-white/50 mb-1">
                        Ngón tay {side === "Left" ? "trái" : "phải"}
                      </p>
                      <div className="space-y-2">
                        {Object.keys(FINGER_LABELS).map((finger) => (
                          <div key={finger}>
                            <p className="text-[11px] text-white/40 mb-1">{FINGER_LABELS[finger]}</p>
                            <JointRows
                              names={[1, 2, 3].map((k) => `${side}Hand${finger}${k}`)}
                              labels={FINGER_DOTS}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div>
                    <p className="text-[11px] text-white/50 mb-1">Ngón chân</p>
                    <JointRows
                      names={["LeftToeBase", "RightToeBase"]}
                      labels={["Chân trái", "Chân phải"]}
                    />
                  </div>
                </div>
              </details>

              <details className={sectionClass}>
                <summary className="text-[12px] text-white/70 cursor-pointer">Tay chân với tới mục tiêu</summary>
                <p className="text-[11px] text-white/40 leading-relaxed mt-2">
                  Bật một bên tay/chân rồi kéo quả cầu trong khung xem trước,
                  hoặc nhập số mục tiêu. Quả cầu tím là tay, xanh lá là chân.
                </p>
                <div className="space-y-2 mt-2">
                  {IK_LIMB_DEFS.map((def) => {
                    const t = effectiveIkTarget(def);
                    return (
                      <div key={def.id} className="rounded-lg bg-black/25 p-2 space-y-1.5">
                        <label className="flex items-center gap-2 text-[12px] text-white/80 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ikEnabled[def.id]}
                            onChange={(e) =>
                              setIkEnabled((prev) => ({ ...prev, [def.id]: e.target.checked }))
                            }
                          />
                          {def.label}
                        </label>
                        {ikEnabled[def.id] && (
                          <>
                            <div className="grid grid-cols-3 gap-1.5">
                              {t.map((v, axis) => (
                                <label key={axis} className="block text-[10px] text-white/40">
                                  {["X", "Y", "Z"][axis]}
                                  <input
                                    type="number"
                                    step={0.01}
                                    value={v}
                                    onChange={(e) =>
                                      setIkTargetAxis(def, axis, Number(e.target.value) || 0)
                                    }
                                    className={inputClass}
                                  />
                                </label>
                              ))}
                            </div>
                            {def.isLeg && (
                              <label className="flex items-center gap-2 text-[11px] text-white/60 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={ikLockGround[def.id]}
                                  onChange={(e) =>
                                    setIkLockGround((prev) => ({ ...prev, [def.id]: e.target.checked }))
                                  }
                                />
                                Giữ bàn chân đứng đất
                              </label>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>

              <details className={sectionClass}>
                <summary className="text-[12px] text-white/70 cursor-pointer">Tô vùng ảnh hưởng của xương</summary>
                <p className="text-[11px] text-white/40 leading-relaxed mt-2">
                  Chọn một xương rồi bấm và kéo trên nhân vật trong khung xem
                  trước để tô. Mẹo: tô chính xác nhất khi nhân vật ở dáng
                  đứng thẳng.
                </p>
                <div className="space-y-2 mt-2">
                  <label className="block text-[11px] text-white/50">
                    Xương muốn tô
                    <select
                      value={paintBone ?? ""}
                      onChange={(e) => setPaintBone(e.target.value || null)}
                      className="mt-0.5 w-full h-9 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
                    >
                      <option value="">— Chưa chọn (kéo để xoay camera) —</option>
                      {joints.map((j) => (
                        <option key={j.name} value={j.name}>
                          {j.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-[11px] text-white/50">
                      Cỡ cọ: {paintRadius.toFixed(2)}m
                      <input
                        type="range"
                        min={0.01}
                        max={0.3}
                        step={0.01}
                        value={paintRadius}
                        onChange={(e) => setPaintRadius(Number(e.target.value))}
                        className="w-full"
                      />
                    </label>
                    <label className="block text-[11px] text-white/50">
                      Độ mạnh: {paintStrength.toFixed(2)}
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={paintStrength}
                        onChange={(e) => setPaintStrength(Number(e.target.value))}
                        className="w-full"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ["add", "Thêm"],
                        ["subtract", "Bớt"],
                        ["smooth", "Làm mịn"],
                      ] as Array<[BrushMode, string]>
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        onClick={() => setPaintMode(mode)}
                        className={`h-8 px-3 rounded-lg border text-[12px] ${paintMode === mode ? "bg-violet-500/25 border-violet-400/40 text-violet-100" : "bg-white/5 border-white/10 text-white/70"}`}
                      >
                        {label}
                      </button>
                    ))}
                    <button onClick={normalizeLivePaint} className={smallBtn}>
                      Chuẩn hoá lại
                    </button>
                  </div>
                </div>
              </details>

              <details className={sectionClass}>
                <summary className="text-[12px] text-white/70 cursor-pointer">Dáng của tôi</summary>
                <p className="text-[11px] text-white/40 leading-relaxed mt-2">
                  Dáng lưu dùng lại được cho mọi nhân vật cùng bộ xương.
                </p>
                <div className="flex gap-1.5 mt-2">
                  <input
                    value={poseName}
                    onChange={(e) => setPoseName(e.target.value)}
                    placeholder="Tên dáng mới…"
                    className="h-9 flex-1 rounded-lg bg-black/40 border border-white/10 px-2.5 text-[12px] outline-none"
                  />
                  <button onClick={saveCurrentPose} className={smallBtn}>
                    Lưu dáng hiện tại
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    onClick={() => setClipboardPose(captureCurrentPose())}
                    className={smallBtn}
                  >
                    Sao chép dáng
                  </button>
                  <button
                    onClick={() => {
                      if (!clipboardPose) return;
                      setLibraryPose({ ...clipboardPose });
                      setPoseId("custom");
                    }}
                    disabled={!clipboardPose}
                    className={`${smallBtn} disabled:opacity-50`}
                  >
                    Dán dáng
                  </button>
                  <button
                    onClick={() => {
                      setLibraryPose(mirrorPose(activePose));
                      setPoseId("custom");
                    }}
                    className={smallBtn}
                  >
                    Lật trái/phải
                  </button>
                </div>
                {savedPoses.length > 0 && (
                  <ul className="space-y-1.5 mt-2">
                    {savedPoses.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-2 rounded-lg bg-black/25 px-2.5 py-1.5"
                      >
                        <span className="flex-1 text-[12px] text-white/80">{p.name}</span>
                        <button
                          onClick={() => {
                            setLibraryPose({ ...p.bones });
                            setPoseId("custom");
                          }}
                          className="text-[12px] text-violet-300 underline underline-offset-2"
                        >
                          Dùng
                        </button>
                        <button
                          onClick={() =>
                            deletePoseEntry(p.id)
                              .then(refreshPoses)
                              .catch(() => setError("Không xoá được dáng — thử lại sau."))
                          }
                          className="text-[12px] text-rose-300 underline underline-offset-2"
                        >
                          Xoá
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </details>

              <details className={sectionClass}>
                <summary className="text-[12px] text-white/70 cursor-pointer">Khuôn mặt</summary>
                {morphList.length === 0 ? (
                  <p className="text-[11px] text-white/40 leading-relaxed mt-2">
                    Model này chưa có khuôn mặt làm sẵn — muốn có biểu cảm thì
                    làm khuôn mặt ở Blender rồi nạp lại model.
                  </p>
                ) : (
                  <div className="space-y-2 mt-2">
                    {morphList.map((m) => {
                      const key = `${m.meshIndex}:${m.name}`;
                      return (
                        <label key={key} className="block text-[11px] text-white/60">
                          {morphList.length > 1 ? `Lưới ${m.meshIndex + 1} — ` : ""}
                          {m.name}: {(morphValues[key] ?? 0).toFixed(2)}
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={morphValues[key] ?? 0}
                            onChange={(e) =>
                              setMorphValues((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                            }
                            className="w-full"
                          />
                        </label>
                      );
                    })}
                    <p className="text-[11px] text-white/40 leading-relaxed">
                      Giá trị khuôn mặt sẽ thành mặc định khi xuất file.
                    </p>
                  </div>
                )}
              </details>

              <details className={sectionClass}>
                <summary className="text-[12px] text-white/70 cursor-pointer">Chất liệu</summary>
                {materialList.length === 0 ? (
                  <p className="text-[11px] text-white/40 leading-relaxed mt-2">
                    Chưa thấy chất liệu nào trong model.
                  </p>
                ) : (
                  <div className="space-y-2 mt-2">
                    {materialList.map((mat) => {
                      const edit = materialEdits[mat.index] ?? {};
                      const def = materialDefaults[mat.index];
                      const setEdit = (patch: MaterialEdit) =>
                        setMaterialEdits((prev) => ({
                          ...prev,
                          [mat.index]: { ...(prev[mat.index] ?? {}), ...patch },
                        }));
                      return (
                        <div key={mat.index} className="rounded-lg bg-black/25 p-2 space-y-1.5">
                          <p className="text-[12px] text-white/80">{mat.name}</p>
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-white/50 flex items-center gap-1.5">
                              Màu
                              <input
                                type="color"
                                value={edit.color ?? def?.color ?? "#ffffff"}
                                onChange={(e) => setEdit({ color: e.target.value })}
                                className="h-7 w-10 rounded bg-black/40 border border-white/10"
                              />
                            </label>
                            <label className="flex-1 text-[11px] text-white/50">
                              Độ nhám: {(edit.roughness ?? def?.roughness ?? 0.8).toFixed(2)}
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={edit.roughness ?? def?.roughness ?? 0.8}
                                onChange={(e) => setEdit({ roughness: Number(e.target.value) })}
                                className="w-full"
                              />
                            </label>
                            <label className="flex-1 text-[11px] text-white/50">
                              Độ bóng: {(edit.metalness ?? def?.metalness ?? 0).toFixed(2)}
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={edit.metalness ?? def?.metalness ?? 0}
                                onChange={(e) => setEdit({ metalness: Number(e.target.value) })}
                                className="w-full"
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </details>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => void save()}
                disabled={saving}
                className="flex-1 h-9 rounded-lg bg-violet-500/40 border border-violet-400/50 text-white text-[12px] font-medium disabled:opacity-50"
              >
                {saving ? "Đang xuất file…" : "Lưu model đã rig"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
