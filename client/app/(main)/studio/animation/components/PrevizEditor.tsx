"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  Camera,
  Download,
  KeyRound,
  Pause,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import type { AnimScene } from "../lib/animProject";
import { EASING_OPTIONS, type EasingId } from "../lib/timeline";
import {
  createPrevizObject,
  createPrevizScene,
  newPrevizId,
  POSE_OPTIONS,
  samplePrevizCamera,
  samplePrevizObject,
  upsertPrevizCameraKey,
  upsertPrevizKey,
  vec3,
  type PrevizObject,
  type PrevizObjectKind,
  type PrevizScene,
  type Vec3,
} from "../lib/previz";
import { videoGenStatus } from "../lib/videoGen";
import { newDialogueId, type DialogueLine } from "../lib/dialogue";
import { loadModelForScene } from "../lib/modelLoader";
import DialogueVoice from "./DialogueVoice";
import { playSceneVoice } from "../lib/voicePreview";

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

/** Mannequin khớp nối đơn giản (khối + cầu) — đủ cho previz blocking/pose. */
function buildCharacter(color: string, height: number): CharacterParts {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: "#2b2440", roughness: 0.8 });
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
  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, torsoH, 0.22), mat);
  torsoMesh.position.y = torsoH / 2;
  torso.add(torsoMesh);

  const armL = mkLimb(0.09, height * 0.36);
  armL.position.set(-0.27, torsoH - 0.03, 0);
  const armR = mkLimb(0.09, height * 0.36);
  armR.position.set(0.27, torsoH - 0.03, 0);
  torso.add(armL, armR);

  const head = new THREE.Group();
  head.position.y = torsoH + 0.05;
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), dark);
  headMesh.position.y = 0.13;
  head.add(headMesh);
  torso.add(head);

  root.add(legL, legR, torso);
  return { root, armL, armR, legL, legR, head, torso };
}

function buildProp(kind: PrevizObjectKind, color: string, size: number): THREE.Object3D {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  if (kind === "cylinder") {
    return new THREE.Mesh(new THREE.CylinderGeometry(size * 0.4, size * 0.4, size, 20), mat);
  }
  if (kind === "wall") {
    return new THREE.Mesh(new THREE.BoxGeometry(size * 3, size * 2.2, 0.15), mat);
  }
  return new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
}

/**
 * Editor previz 3D cho MỘT cảnh (Lớp A): dựng cảnh bằng mannequin/đạo cụ,
 * keyframe vị trí + pose cho vật thể, camera phim keyframe riêng, xem
 * qua 2 chế độ (góc tự do / qua camera phim), xuất WebM ngay trong trình
 * duyệt. Cổng sinh video AI (Lớp B) hiển thị trạng thái kết nối thật.
 */
export function PrevizEditor({
  scene,
  onChange,
  onDialogueChange,
}: {
  scene: AnimScene;
  onChange: (previz: PrevizScene) => void;
  onDialogueChange?: (lines: DialogueLine[]) => void;
}) {
  const previz = useMemo<PrevizScene>(
    () => scene.previz ?? createPrevizScene(),
    [scene.previz],
  );
  const duration = Math.max(0.5, scene.durationSec);
  const [timeSec, setTimeSec] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<"orbit" | "shot">("orbit");
  const [selectedId, setSelectedId] = useState<string | null>(
    previz.objects[0]?.id ?? null,
  );
  const [recording, setRecording] = useState(false);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    orbitCam: THREE.PerspectiveCamera;
    shotCam: THREE.PerspectiveCamera;
    controls: OrbitControls;
    groups: Map<string, THREE.Object3D>;
    characters: Map<string, CharacterParts>;
  } | null>(null);

  const selected = previz.objects.find((o) => o.id === selectedId) ?? null;

  // Draft cho vật thể đang chọn (vị trí/pose tại playhead, sửa rồi đặt key)
  const [draftPos, setDraftPos] = useState<Vec3>(vec3());
  const [draftRotY, setDraftRotY] = useState(0);
  const [draftPose, setDraftPose] = useState("stand");
  const [draftDirty, setDraftDirty] = useState(false);
  const [easing, setEasing] = useState<EasingId>("ease-in-out");
  const [draftCamPos, setDraftCamPos] = useState<Vec3>(vec3(0, 1.6, 6));
  const [draftCamTarget, setDraftCamTarget] = useState<Vec3>(vec3(0, 1.1, 0));
  const [draftCamDirty, setDraftCamDirty] = useState(false);

  useEffect(() => {
    if (!draftDirty && selected) {
      const s = samplePrevizObject(selected, timeSec);
      setDraftPos(s.position);
      setDraftRotY(s.rotationY);
    }
    if (!draftCamDirty) {
      const cam = samplePrevizCamera(previz.cameraKeys, timeSec);
      setDraftCamPos(cam.position);
      setDraftCamTarget(cam.target);
    }
  }, [timeSec, selected, previz.cameraKeys, draftDirty, draftCamDirty]);

  const updateObject = useCallback(
    (id: string, patch: Partial<PrevizObject>) => {
      onChange({
        ...previz,
        objects: previz.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      });
    },
    [previz, onChange],
  );

  // ── Khởi tạo Three.js ──────────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const threeScene = new THREE.Scene();
    const orbitCam = new THREE.PerspectiveCamera(
      50,
      mount.clientWidth / mount.clientHeight,
      0.1,
      200,
    );
    orbitCam.position.set(4.5, 3.2, 7);
    const shotCam = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 200);
    const controls = new OrbitControls(orbitCam, renderer.domElement);
    controls.target.set(0, 1, 0);

    threeScene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(5, 9, 4);
    threeScene.add(sun);
    const grid = new THREE.GridHelper(30, 30, 0x554477, 0x332a4d);
    threeScene.add(grid);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: "#1b1530", roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    threeScene.add(ground);

    threeRef.current = {
      renderer,
      scene: threeScene,
      orbitCam,
      shotCam,
      controls,
      groups: new Map(),
      characters: new Map(),
    };
    return () => {
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      threeRef.current = null;
    };
  }, []);

  // ── Đồng bộ vật thể vào scene Three ────────────────────────────────────────
  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx) return;
    ctx.scene.background = new THREE.Color(previz.backdrop);
    const seen = new Set<string>();
    for (const obj of previz.objects) {
      seen.add(obj.id);
      if (!ctx.groups.has(obj.id)) {
        if (obj.kind === "model") {
          // Mô hình glTF: đặt nhóm giữ chỗ trước, nạp xong gắn vào sau
          const holder = new THREE.Group();
          ctx.groups.set(obj.id, holder);
          ctx.scene.add(holder);
          if (obj.modelAssetId) {
            void loadModelForScene(obj.modelAssetId)
              .then((loaded) => {
                if (ctx.groups.get(obj.id) === holder) holder.add(loaded);
              })
              .catch(() => undefined);
          }
        } else if (obj.kind === "character") {
          const parts = buildCharacter(obj.color, obj.size);
          ctx.characters.set(obj.id, parts);
          ctx.groups.set(obj.id, parts.root);
          ctx.scene.add(parts.root);
        } else {
          const mesh = buildProp(obj.kind, obj.color, obj.size);
          mesh.position.y = obj.kind === "wall" ? obj.size * 1.1 : obj.size / 2;
          ctx.groups.set(obj.id, mesh);
          ctx.scene.add(mesh);
        }
      }
    }
    for (const [id, group] of [...ctx.groups.entries()]) {
      if (!seen.has(id)) {
        ctx.scene.remove(group);
        ctx.groups.delete(id);
        ctx.characters.delete(id);
      }
    }
  }, [previz]);

  // ── Vòng render ─────────────────────────────────────────────────────────────
  const stateRef = useRef({ previz, timeSec, viewMode, draftDirty, draftPos, draftRotY, draftPose, selectedId, draftCamDirty, draftCamPos, draftCamTarget });
  stateRef.current = { previz, timeSec, viewMode, draftDirty, draftPos, draftRotY, draftPose, selectedId, draftCamDirty, draftCamPos, draftCamTarget };
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const ctx = threeRef.current;
      if (!ctx) return;
      const st = stateRef.current;
      for (const obj of st.previz.objects) {
        const group = ctx.groups.get(obj.id);
        if (!group) continue;
        let sampled = samplePrevizObject(obj, st.timeSec);
        if (st.draftDirty && obj.id === st.selectedId) {
          sampled = {
            position: st.draftPos,
            rotationY: st.draftRotY,
            pose: sampled.pose,
          };
        }
        group.position.set(sampled.position.x, sampled.position.y, sampled.position.z);
        group.rotation.y = rad(sampled.rotationY);
        if (obj.kind === "model") group.scale.setScalar(obj.size);
        const parts = ctx.characters.get(obj.id);
        if (parts) {
          const pose =
            st.draftDirty && obj.id === st.selectedId
              ? (samplePrevizObject({ ...obj, keys: obj.keys.map((k) => ({ ...k, poseId: st.draftPose })) }, st.timeSec).pose)
              : sampled.pose;
          parts.armL.rotation.x = rad(pose.armL);
          parts.armR.rotation.x = rad(pose.armR);
          parts.legL.rotation.x = rad(pose.legL);
          parts.legR.rotation.x = rad(pose.legR);
          parts.head.rotation.x = rad(pose.headTilt);
          parts.torso.rotation.x = rad(pose.lean);
          const bend = Math.min(1, Math.max(0, (pose.legL + pose.legR) / 2 / 90));
          group.position.y = sampled.position.y - bend * obj.size * 0.26;
        }
      }
      const cam = st.draftCamDirty
        ? { position: st.draftCamPos, target: st.draftCamTarget }
        : samplePrevizCamera(st.previz.cameraKeys, st.timeSec);
      ctx.shotCam.position.set(cam.position.x, cam.position.y, cam.position.z);
      ctx.shotCam.lookAt(cam.target.x, cam.target.y, cam.target.z);
      ctx.controls.enabled = st.viewMode === "orbit";
      ctx.renderer.render(
        ctx.scene,
        st.viewMode === "shot" ? ctx.shotCam : ctx.orbitCam,
      );
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Phát thử
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last: number | null = null;
    const tick = (ts: number) => {
      if (last == null) last = ts;
      const dt = (ts - last) / 1000;
      last = ts;
      setTimeSec((prev) => {
        const next = prev + dt;
        return next >= duration ? 0 : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration]);

  // Phát thử KÈM TIẾNG: lên lịch các bản thu đã chọn theo mốc thoại
  const voicePlaybackRef = useRef<{ stop: () => void } | null>(null);
  const dialogueRef = useRef<DialogueLine[]>([]);
  dialogueRef.current = scene.dialogue ?? [];
  useEffect(() => {
    if (!playing) {
      voicePlaybackRef.current?.stop();
      voicePlaybackRef.current = null;
      return;
    }
    let alive = true;
    void playSceneVoice(dialogueRef.current, timeSec).then((pb) => {
      if (!alive) {
        pb?.stop();
        return;
      }
      voicePlaybackRef.current = pb;
    });
    return () => {
      alive = false;
      voicePlaybackRef.current?.stop();
      voicePlaybackRef.current = null;
    };
    // Chỉ chạy lại khi bấm phát/dừng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // ── Xuất WebM (qua camera phim, đúng thời lượng cảnh) ──────────────────────
  const exportWebM = async () => {
    const ctx = threeRef.current;
    if (!ctx || recording) return;
    setRecording(true);
    setViewMode("shot");
    setPlaying(false);
    setTimeSec(0);
    await new Promise((r) => setTimeout(r, 120));
    const stream = ctx.renderer.domElement.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const done = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.start(200);
    setPlaying(true);
    await new Promise((r) => setTimeout(r, duration * 1000 + 150));
    setPlaying(false);
    recorder.stop();
    await done;
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scene.name.replace(/\s+/g, "-")}-previz.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setRecording(false);
  };

  const vecSliders = (
    label: string,
    v: Vec3,
    onVal: (next: Vec3) => void,
  ) => (
    <div className="space-y-1">
      <div className="text-[11px] text-white/50">{label}</div>
      {(["x", "y", "z"] as const).map((axis) => (
        <label key={axis} className="flex items-center gap-2 text-[11px] text-white/45">
          <span className="w-4 uppercase">{axis}</span>
          <input
            type="range"
            min={axis === "y" ? 0 : -8}
            max={8}
            step={0.1}
            value={v[axis]}
            onChange={(e) => onVal({ ...v, [axis]: Number(e.currentTarget.value) })}
            className="flex-1 accent-sky-500"
          />
          <span className="w-9 text-right tabular-nums text-white/70">
            {v[axis].toFixed(1)}
          </span>
        </label>
      ))}
    </div>
  );

  const genStatus = videoGenStatus();

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d0817] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-white/80">
          PREVIZ 3D — {scene.name.toUpperCase()}
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {(["orbit", "shot"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 h-8 text-[12px] ${
                  viewMode === m
                    ? "bg-sky-500/30 text-white"
                    : "bg-white/5 text-white/55 hover:bg-white/10"
                }`}
              >
                {m === "orbit" ? "Góc tự do" : "Qua camera phim"}
              </button>
            ))}
          </div>
          <button
            onClick={() => void exportWebM()}
            disabled={recording}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-sky-500/25 border border-sky-400/40 text-[12px] font-medium hover:bg-sky-500/35 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {recording ? "Đang render…" : "Xuất WebM cảnh này"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div>
          <div
            ref={mountRef}
            className="w-full aspect-video rounded-xl border border-white/10 overflow-hidden bg-black [&>canvas]:w-full [&>canvas]:h-full"
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setPlaying((v) => !v)}
              aria-label={playing ? "Dừng" : "Phát"}
              className="p-2.5 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 hover:opacity-90 transition"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <span className="text-[12px] tabular-nums text-white/60 w-24">
              {timeSec.toFixed(2)}s / {duration.toFixed(1)}s
            </span>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.01}
              value={timeSec}
              onChange={(e) => {
                setPlaying(false);
                setTimeSec(Number(e.currentTarget.value));
              }}
              aria-label="Playhead"
              className="flex-1 accent-sky-500"
            />
          </div>
          <p className="mt-2 text-[11px] text-white/35">
            Kéo chuột trong khung 3D để xoay góc nhìn tự do. Nhân vật là
            hình nhân khớp nối dùng để dựng cảnh và tạo dáng — không phải
            mô hình hoàn thiện.
          </p>
          <div
            className={`mt-2 rounded-xl border p-3 text-[12px] leading-relaxed ${
              genStatus.connected
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 bg-white/[0.03] text-white/50"
            }`}
          >
            <span className="font-medium text-white/75">Sinh video AI từ cảnh này: </span>
            {genStatus.label}
          </div>
        </div>

        <div className="space-y-4 text-sm">
          <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-semibold text-white/70">VẬT THỂ TRONG CẢNH</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["character", "+ Nhân vật"],
                  ["box", "+ Khối hộp"],
                  ["cylinder", "+ Khối trụ"],
                  ["wall", "+ Tường"],
                ] as Array<[PrevizObjectKind, string]>
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  onClick={() => {
                    const obj = createPrevizObject(
                      kind,
                      kind === "character"
                        ? `Nhân vật ${previz.objects.filter((o) => o.kind === "character").length + 1}`
                        : label.replace("+ ", ""),
                    );
                    onChange({ ...previz, objects: [...previz.objects, obj] });
                    setSelectedId(obj.id);
                  }}
                  className="px-2 h-7 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
                >
                  {label}
                </button>
              ))}
            </div>
            {previz.objects.map((obj) => (
              <div
                key={obj.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 border ${
                  obj.id === selectedId
                    ? "border-sky-400/50 bg-sky-500/10"
                    : "border-white/5 hover:border-white/15"
                }`}
              >
                <button
                  onClick={() => {
                    setSelectedId(obj.id);
                    setDraftDirty(false);
                  }}
                  className="flex-1 text-left text-[13px] truncate"
                >
                  {obj.name}
                  <span className="text-white/35 text-[11px]"> · {obj.keys.length} key</span>
                </button>
                <input
                  type="color"
                  value={obj.color}
                  onChange={(e) => {
                    updateObject(obj.id, { color: e.currentTarget.value });
                    // Màu Three cập nhật ở lần dựng lại vật thể — xoá cache để dựng mới
                    const ctx = threeRef.current;
                    const group = ctx?.groups.get(obj.id);
                    if (ctx && group) {
                      ctx.scene.remove(group);
                      ctx.groups.delete(obj.id);
                      ctx.characters.delete(obj.id);
                    }
                  }}
                  aria-label="Màu vật thể"
                  className="w-6 h-6 bg-transparent cursor-pointer"
                />
                <button
                  onClick={() => {
                    onChange({
                      ...previz,
                      objects: previz.objects.filter((o) => o.id !== obj.id),
                    });
                    if (selectedId === obj.id) setSelectedId(null);
                  }}
                  aria-label="Xoá vật thể"
                  className="text-white/35 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </section>

          {selected && (
            <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2.5">
              <h3 className="text-[12px] font-semibold text-white/70">
                {selected.name.toUpperCase()} — VỊ TRÍ & POSE
              </h3>
              {vecSliders("Vị trí (mét)", draftPos, (v) => {
                setDraftPos(v);
                setDraftDirty(true);
              })}
              <label className="flex items-center gap-2 text-[11px] text-white/45">
                <span className="w-14">Xoay Y</span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={draftRotY}
                  onChange={(e) => {
                    setDraftRotY(Number(e.currentTarget.value));
                    setDraftDirty(true);
                  }}
                  className="flex-1 accent-sky-500"
                />
                <span className="w-9 text-right tabular-nums text-white/70">
                  {Math.round(draftRotY)}°
                </span>
              </label>
              {selected.kind === "character" && (
                <label className="flex items-center gap-2 text-[11px] text-white/45">
                  <span className="w-14">Pose</span>
                  <select
                    value={draftPose}
                    onChange={(e) => {
                      setDraftPose(e.currentTarget.value);
                      setDraftDirty(true);
                    }}
                    className="flex-1 h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none"
                  >
                    {POSE_OPTIONS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex items-center gap-2">
                <select
                  value={easing}
                  onChange={(e) => setEasing(e.currentTarget.value as EasingId)}
                  aria-label="Easing"
                  className="h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] outline-none"
                >
                  {EASING_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    updateObject(selected.id, {
                      keys: upsertPrevizKey(selected.keys, {
                        id: newPrevizId("pkey"),
                        timeSec: Math.round(timeSec * 100) / 100,
                        position: draftPos,
                        rotationY: draftRotY,
                        poseId: draftPose,
                        easing,
                      }),
                    });
                    setDraftDirty(false);
                  }}
                  className="flex-1 h-8 rounded-lg bg-sky-500/25 border border-sky-400/40 text-[12px] font-medium hover:bg-sky-500/35 flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Đặt key tại {timeSec.toFixed(2)}s
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selected.keys.map((k) => (
                  <span
                    key={k.id}
                    className="flex items-center gap-1 px-2 h-6 rounded-md bg-white/5 border border-white/10 text-[11px]"
                  >
                    {k.timeSec.toFixed(2)}s
                    {selected.kind === "character" ? ` · ${k.poseId}` : ""}
                    <button
                      onClick={() =>
                        updateObject(selected.id, {
                          keys: selected.keys.filter((x) => x.id !== k.id),
                        })
                      }
                      aria-label="Xoá key"
                      className="text-white/40 hover:text-rose-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2.5">
            <h3 className="text-[12px] font-semibold text-white/70 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" /> CAMERA PHIM
            </h3>
            {vecSliders("Vị trí camera", draftCamPos, (v) => {
              setDraftCamPos(v);
              setDraftCamDirty(true);
            })}
            {vecSliders("Điểm nhìn", draftCamTarget, (v) => {
              setDraftCamTarget(v);
              setDraftCamDirty(true);
            })}
            <button
              onClick={() => {
                onChange({
                  ...previz,
                  cameraKeys: upsertPrevizCameraKey(previz.cameraKeys, {
                    id: newPrevizId("camkey"),
                    timeSec: Math.round(timeSec * 100) / 100,
                    position: draftCamPos,
                    target: draftCamTarget,
                    easing,
                  }),
                });
                setDraftCamDirty(false);
              }}
              className="w-full h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 text-[12px] font-medium hover:bg-sky-500/30 flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" /> Đặt key camera tại {timeSec.toFixed(2)}s
            </button>
            <div className="flex flex-wrap gap-1.5">
              {previz.cameraKeys.map((k) => (
                <span
                  key={k.id}
                  className="flex items-center gap-1 px-2 h-6 rounded-md bg-white/5 border border-white/10 text-[11px]"
                >
                  {k.timeSec.toFixed(2)}s
                  <button
                    onClick={() =>
                      onChange({
                        ...previz,
                        cameraKeys: previz.cameraKeys.filter((x) => x.id !== k.id),
                      })
                    }
                    aria-label="Xoá key camera"
                    className="text-white/40 hover:text-rose-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[11px] text-white/45">
              <span className="w-14">Nền cảnh</span>
              <input
                type="color"
                value={previz.backdrop}
                onChange={(e) => onChange({ ...previz, backdrop: e.currentTarget.value })}
                className="w-8 h-7 bg-transparent cursor-pointer"
              />
            </label>
          </section>
        </div>
      </div>

      {onDialogueChange && (
        <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-semibold text-white/70">
              THOẠI & GIỌNG CỦA CẢNH
            </h3>
            <button
              onClick={() =>
                onDialogueChange([
                  ...(scene.dialogue ?? []),
                  {
                    id: newDialogueId(),
                    text: "",
                    startSec: 0.3,
                    durationSec: 2,
                  },
                ])
              }
              className="flex items-center gap-1 px-2 h-7 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
            >
              <Plus className="w-3 h-3" /> Dòng thoại
            </button>
          </div>
          {(scene.dialogue ?? []).map((line) => (
            <div
              key={line.id}
              className="rounded-lg bg-white/[0.03] border border-white/5 p-2 space-y-1.5"
            >
              <input
                value={line.text}
                onChange={(e) =>
                  onDialogueChange(
                    (scene.dialogue ?? []).map((x) =>
                      x.id === line.id
                        ? { ...x, text: e.currentTarget.value }
                        : x,
                    ),
                  )
                }
                placeholder="Nội dung thoại…"
                className="w-full bg-transparent text-[13px] outline-none border-b border-transparent focus:border-white/30"
              />
              <div className="flex items-center gap-2 text-[11px] text-white/45">
                <label className="flex items-center gap-1">
                  Từ
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={line.startSec}
                    onChange={(e) =>
                      onDialogueChange(
                        (scene.dialogue ?? []).map((x) =>
                          x.id === line.id
                            ? { ...x, startSec: Number(e.currentTarget.value) }
                            : x,
                        ),
                      )
                    }
                    className="w-14 h-7 rounded bg-black/50 border border-white/10 px-1.5 text-white"
                  />
                  s
                </label>
                <label className="flex items-center gap-1">
                  Dài
                  <input
                    type="number"
                    min={0.3}
                    step={0.1}
                    value={line.durationSec}
                    onChange={(e) =>
                      onDialogueChange(
                        (scene.dialogue ?? []).map((x) =>
                          x.id === line.id
                            ? {
                                ...x,
                                durationSec: Number(e.currentTarget.value),
                              }
                            : x,
                        ),
                      )
                    }
                    className="w-14 h-7 rounded bg-black/50 border border-white/10 px-1.5 text-white"
                  />
                  s
                </label>
                <button
                  onClick={() =>
                    onDialogueChange(
                      (scene.dialogue ?? []).filter((x) => x.id !== line.id),
                    )
                  }
                  aria-label="Xoá dòng thoại"
                  className="ml-auto text-white/35 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <DialogueVoice
                line={line}
                onChange={(next) =>
                  onDialogueChange(
                    (scene.dialogue ?? []).map((x) =>
                      x.id === next.id ? next : x,
                    ),
                  )
                }
              />
            </div>
          ))}
          {(scene.dialogue ?? []).length === 0 && (
            <p className="text-[11px] text-white/35">
              Chưa có thoại — thêm dòng thoại rồi thu giọng để phim có tiếng
              khi xuất bản.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
