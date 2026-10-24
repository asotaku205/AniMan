/**
 * Phòng Rig (Phase 3): gắn xương nhanh cho nhân vật người ngay trong app.
 *
 * Luồng: nạp model → tự căn xương mẫu theo chiều cao → người dùng kéo
 * khớp cho khớp (ô số X/Y/Z) → thử pose mẫu → lưu thành model đã rig
 * (.glb kèm xương) vào kho tài sản. Model đã có xương thì báo và dừng.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { X } from "lucide-react";
import { autoFitRig, TEST_POSES, type RigJoint } from "../lib/rig";
import {
  buildRiggedGlb,
  buildRiggedRoot,
  loadModelForRig,
  type LoadedModel,
} from "../lib/rigExport";
import { inspectGlbDataUrl } from "../lib/modelInspect";
import { newAssetId, type Model3DAsset } from "../lib/animAssets";
import { saveAnimAsset } from "../lib/animStorage";

const JOINT_GROUPS: Array<{ name: string; joints: string[] }> = [
  { name: "Thân", joints: ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head"] },
  { name: "Tay trái", joints: ["LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand"] },
  { name: "Tay phải", joints: ["RightShoulder", "RightArm", "RightForeArm", "RightHand"] },
  { name: "Chân trái", joints: ["LeftUpLeg", "LeftLeg", "LeftFoot"] },
  { name: "Chân phải", joints: ["RightUpLeg", "RightLeg", "RightFoot"] },
];

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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoaded(null);
    setJoints(null);
    loadModelForRig(asset.dataUrl)
      .then((m) => {
        if (cancelled) return;
        setLoaded(m);
        if (!m.hasSkeleton) setJoints(autoFitRig(m.heightM));
      })
      .catch(() => {
        if (!cancelled) setError("Không nạp được model này để rig — kiểm tra lại file .glb.");
      });
    return () => {
      cancelled = true;
    };
  }, [asset]);

  // Xem trước 3D: model đã gắn xương + khung xương, pose thử.
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
    let root: THREE.Group | null = null;
    try {
      const built = buildRiggedRoot(loaded.scene, joints);
      root = built.root;
      for (const [name, e] of Object.entries(TEST_POSES[poseId]?.pose ?? {})) {
        built.boneByName.get(name)?.rotation.set(e[0], e[1], e[2]);
      }
      scene.add(root);
      const helper = new THREE.SkeletonHelper(built.boneByName.get("Hips")!);
      scene.add(helper);
      root.updateMatrixWorld(true);
    } catch {
      setError("Không dựng được xương xem trước — thử bấm Tự căn lại.");
    }
    const render = () => renderer.render(scene, camera);
    controls.addEventListener("change", render);
    render();
    return () => {
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
  }, [loaded, joints, poseId]);

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

  const save = async () => {
    if (!loaded || !joints) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await buildRiggedGlb(loaded.scene, joints);
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

  const jointByName = new Map((joints ?? []).map((j) => [j.name, j]));

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
              Xương mẫu đã tự căn theo chiều cao {loaded.heightM.toFixed(2)}m.
              Kéo khớp cho khớp đúng vai, khuỷu, gối của nhân vật rồi thử
              pose bên dưới. Clip chuyển động dạng vật thể của model gốc
              (nếu có) sẽ không giữ lại sau khi rig.
            </p>
            <div ref={previewRef} className="w-full h-[420px] rounded-xl overflow-hidden bg-[#150e24] border border-white/10" />
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TEST_POSES).map(([id, p]) => (
                <button
                  key={id}
                  onClick={() => setPoseId(id)}
                  title={p.desc}
                  className={`h-8 px-3 rounded-lg border text-[12px] ${poseId === id ? "bg-violet-500/25 border-violet-400/40 text-violet-100" : "bg-white/5 border-white/10 text-white/70"}`}
                >
                  {p.name}
                </button>
              ))}
              <button
                onClick={() => setJoints(autoFitRig(loaded.heightM))}
                className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-white/70 text-[12px]"
              >
                Tự căn lại
              </button>
            </div>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {JOINT_GROUPS.map((group) => (
                <details key={group.name} className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2">
                  <summary className="text-[12px] text-white/70 cursor-pointer">{group.name}</summary>
                  <div className="space-y-1.5 mt-2">
                    {group.joints.map((name) => {
                      const joint = jointByName.get(name)!;
                      return (
                        <div key={name} className="grid grid-cols-[110px_1fr_1fr_1fr] gap-1.5 items-center">
                          <span className="text-[11px] text-white/60">{name}</span>
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
                </details>
              ))}
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
