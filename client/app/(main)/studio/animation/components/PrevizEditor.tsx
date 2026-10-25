"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
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
  type ClipSource,
  type Vec3,
} from "../lib/previz";
import { videoGenStatus } from "../lib/videoGen";
import { newDialogueId, type DialogueLine } from "../lib/dialogue";
import { loadModelForSceneWithClips, loadClipSourceAsset } from "../lib/modelLoader";
import { createActionSegment, sampleActionSegment } from "../lib/actionTrack";
import { createMixerState, updateMixerState, type MixerState } from "../lib/clipPlayer";
import { bakeClipForTarget, mixerBindToRigJoints } from "../lib/clipRetarget";
import { createPoseKey, eulerDegToQuat, expandPoseTemplate, quatToEulerDeg, samplePoseKeys, type BoneQuat } from "../lib/poseTrack";
import { applyPoseToBones, capturePose } from "../lib/posePlayer";
import { TEST_POSES } from "../lib/rig";
import { EffectPoints } from "../lib/effectPlayer";
import { formulaMaxLife, type EffectFormula } from "../lib/effectFormula";
import { listAnimAssets, saveAnimAsset } from "../lib/animStorage";
import { newAssetId, type Model3DAsset } from "../lib/animAssets";
import { inspectGlbDataUrl } from "../lib/modelInspect";
import { EffectStudioPanel } from "./EffectStudioPanel";
import {
  createWeatherPoints,
  updateWeatherPoints,
} from "../lib/weatherPoints";
import {
  createParticlePoints,
  updateParticlePoints,
} from "../lib/particlePoints";
import { SceneParticlesPanel } from "./SceneParticlesPanel";
import type { ParticleSystemSettings } from "../lib/particles";
import type { SceneWeather, WeatherType } from "../lib/layerEffects";
import DialogueVoice from "./DialogueVoice";
import { SceneAudioPanel } from "./SceneAudioPanel";
import { EnvironmentPanel, type TerrainBrushTool } from "./EnvironmentPanel";
import {
  DEFAULT_ENVIRONMENT,
  effectiveFog,
  environmentSky,
  type SceneEnvironment,
} from "../lib/sceneEnvironment";
import {
  applyBrush,
  heightAtGrid,
  type TerrainGrid,
} from "../lib/terrainBrush";
import { createTerrainGeometry } from "../lib/terrainMesh";
import { weatherParams } from "../../world-builder/lib/diorama";
import type { SceneAudioClip } from "../lib/animProject";
import { playSceneSounds } from "../lib/voicePreview";
import { renderFilmAudioMix } from "../lib/filmAudio";
import type { AnimProject } from "../lib/animProject";

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

/** Chuyển động gắn thêm đã khớp xong, sẵn sàng phát qua mixer. */
interface AttachedClipInfo {
  /** Tên clip trong mixer (clip đã khớp mang hậu tố "(đã khớp)"). */
  bakedName: string;
  sourceAssetId: string;
  sourceClipName: string;
  sourceName: string;
  status: "direct" | "retargeted";
  missingBones: string[];
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
/** Dải timeline đa track của editor 3D (bố cục R1): camera, từng vật thể
 * và thoại trên cùng một trục — bấm để tua, bấm tên vật thể để chọn. Dải
 * giới hạn chiều cao + cuộn nội bộ để sân khấu luôn cao tối đa. */
function PrevizStrip({
  previz,
  dialogue,
  audioClips,
  duration,
  timeSec,
  selectedId,
  onSelect,
  onSeek,
}: {
  previz: PrevizScene;
  dialogue: DialogueLine[];
  audioClips: SceneAudioClip[];
  duration: number;
  timeSec: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSeek: (t: number) => void;
}) {
  const pct = (t: number) =>
    `${Math.max(0, Math.min(100, (t / duration) * 100))}%`;
  const seekFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(duration, ratio * duration)));
  };
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 0.001; t += duration > 12 ? 2 : 1) ticks.push(t);
  const rows: { id: string; label: string; color: string; onClick?: () => void }[] = [
    { id: "camera", label: "Camera", color: "#38bdf8" },
    ...previz.objects.map((o) => ({
      id: o.id,
      label: o.name,
      color: "#a78bfa",
      onClick: () => onSelect(o.id),
    })),
    { id: "dialogue", label: "Thoại", color: "#f472b6" },
    ...(audioClips.length > 0
      ? [{ id: "audio", label: "Âm thanh", color: "#34d399" }]
      : []),
  ];
  return (
    <div className="shrink-0 border-t border-white/10 pt-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-white/50">
          TIMELINE — BẤM ĐỂ TUA · BẤM TÊN VẬT THỂ ĐỂ CHỌN
        </span>
        <span className="text-[11px] text-white/40 tabular-nums">
          {timeSec.toFixed(2)}s / {duration.toFixed(1)}s
        </span>
      </div>
      <div className="max-h-[188px] overflow-y-auto overflow-x-clip">
        <div className="grid grid-cols-[116px_minmax(0,1fr)]">
          <div>
            <div className="h-4 sticky top-0 bg-[#0a0614] z-10" />
            {rows.map((r) => (
              <button
                key={r.id}
                onClick={r.onClick}
                className={`h-6 w-full flex items-center gap-1.5 px-1.5 text-xs truncate text-left rounded ${
                  r.id === selectedId
                    ? "bg-sky-500/15 text-white"
                    : "text-white/55 hover:text-white"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-none"
                  style={{ background: r.color }}
                />
                <span className="truncate">{r.label}</span>
              </button>
            ))}
          </div>
          <div className="relative" onPointerDown={seekFromEvent}>
            <div className="h-4 relative border-b border-white/10 cursor-pointer sticky top-0 bg-[#0a0614] z-10">
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute top-0 text-[10px] text-white/40"
                  style={{
                    left: pct(t),
                    transform:
                      t === 0
                        ? "none"
                        : t >= duration
                          ? "translateX(-100%)"
                          : "translateX(-50%)",
                  }}
                >
                  {t.toFixed(0)}s
                </span>
              ))}
            </div>
            {rows.map((r) => (
              <div
                key={r.id}
                className="h-6 relative border-b border-white/5 cursor-pointer"
              >
                {r.id === "camera" &&
                  previz.cameraKeys.map((k) => (
                    <span
                      key={k.id}
                      title={`Key camera tại ${k.timeSec.toFixed(2)}s`}
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-sky-400"
                      style={{ left: `calc(${pct(k.timeSec)} - 4px)` }}
                    />
                  ))}
                {r.id !== "camera" &&
                  r.id !== "dialogue" &&
                  r.id !== "audio" &&
                  (() => {
                    const obj = previz.objects.find((o) => o.id === r.id);
                    if (!obj) return null;
                    return (
                      <>
                        <span className="absolute top-[2px] bottom-[2px] left-0 right-0 rounded bg-violet-500/25 border border-violet-400/30" />
                        {obj.keys.map((k) => (
                          <span
                            key={k.id}
                            title={`Key tại ${k.timeSec.toFixed(2)}s`}
                            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-amber-400"
                            style={{ left: `calc(${pct(k.timeSec)} - 4px)` }}
                          />
                        ))}
                      </>
                    );
                  })()}
                {r.id === "dialogue" &&
                  dialogue.map((line) => (
                    <span
                      key={line.id}
                      title={`${line.speaker}: ${line.text}`}
                      className="absolute top-[2px] bottom-[2px] rounded bg-pink-500/40 border border-pink-400/40 text-[9px] text-white/85 px-1 truncate leading-[17px]"
                      style={{
                        left: pct(line.startSec),
                        width: `${Math.max(2, (line.durationSec / duration) * 100)}%`,
                      }}
                    >
                      {line.speaker}
                    </span>
                  ))}
                {r.id === "audio" &&
                  audioClips.map((clip) => (
                    <span
                      key={clip.id}
                      title={clip.name}
                      className="absolute top-[2px] bottom-[2px] rounded bg-emerald-500/40 border border-emerald-400/40 text-[9px] text-white/85 px-1 truncate leading-[17px]"
                      style={{
                        left: pct(clip.startSec),
                        width: `${Math.max(2, (clip.durationSec / duration) * 100)}%`,
                      }}
                    >
                      {clip.name}
                    </span>
                  ))}
              </div>
            ))}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none"
              style={{ left: pct(timeSec) }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrevizEditor({
  scene,
  onChange,
  onDialogueChange,
  onWeatherChange,
  onAudioChange,
  onParticlesChange,
  onEnvironmentChange,
}: {
  scene: AnimScene;
  onChange: (previz: PrevizScene) => void;
  onDialogueChange?: (lines: DialogueLine[]) => void;
  onWeatherChange?: (weather: SceneWeather | null) => void;
  onAudioChange?: (clips: SceneAudioClip[]) => void;
  onParticlesChange?: (particles: ParticleSystemSettings | null) => void;
  onEnvironmentChange?: (environment: SceneEnvironment) => void;
}) {
  const previz = useMemo<PrevizScene>(
    () => scene.previz ?? createPrevizScene(),
    [scene.previz],
  );
  const duration = Math.max(0.5, scene.durationSec);
  const [timeSec, setTimeSec] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<"orbit" | "shot">("orbit");
  const [propsOpen, setPropsOpen] = useState(true);
  useEffect(() => {
    if (safeFrameRef.current)
      safeFrameRef.current.style.display = viewMode === "shot" ? "block" : "none";
  }, [viewMode]);
  const [selectedId, setSelectedId] = useState<string | null>(
    previz.objects[0]?.id ?? null,
  );
  const [recording, setRecording] = useState(false);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const safeFrameRef = useRef<HTMLDivElement | null>(null);
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    orbitCam: THREE.PerspectiveCamera;
    shotCam: THREE.PerspectiveCamera;
    controls: OrbitControls;
    groups: Map<string, THREE.Object3D>;
    characters: Map<string, CharacterParts>;
    /** Mixer phát clip xương cho từng vật thể model (Phase 4). */
    mixers: Map<string, MixerState>;
    /** Nhóm hạt cho từng sự kiện hiệu ứng (Phase 5). */
    effectGroups: Map<string, { points: EffectPoints; formula: EffectFormula }>;
    /** Nhóm hạt xem thử hiệu ứng (Phase 5). */
    previewPoints: EffectPoints | null;
    /** Mặt phẳng chớp sáng trước camera (Phase 5) — vẽ trong canvas
     * nên phim xuất cũng có chớp như preview. */
    flashMesh: THREE.Mesh;
    weatherPoints: THREE.Points | null;
    particlePoints: THREE.Points | null;
    sunLight: THREE.DirectionalLight;
    envHemi: THREE.HemisphereLight | null;
    flashLight: THREE.AmbientLight;
    terrainMesh: THREE.Mesh | null;
    envPoints: THREE.Points | null;
    waterMesh: THREE.Mesh | null;
    cloudGroup: THREE.Group | null;
  } | null>(null);

  /** Công thức hiệu ứng đã lưu + xem thử (Phase 5). */
  const [effectFormulas, setEffectFormulas] = useState<EffectFormula[]>([]);
  const [previewFormula, setPreviewFormula] = useState<EffectFormula | null>(null);
  const [previewStartSec, setPreviewStartSec] = useState(0);
  const [previewPos, setPreviewPos] = useState({ x: 0, y: 0.5, z: 0 });

  const selected = previz.objects.find((o) => o.id === selectedId) ?? null;

  // Phong cảnh (giai đoạn B): môi trường của cảnh + cọ nặn đất.
  const environment = scene.environment ?? DEFAULT_ENVIRONMENT;
  const [brushTool, setBrushTool] = useState<TerrainBrushTool>({
    mode: "off",
    radius: 2,
    strength: 0.3,
  });
  const [brushDraft, setBrushDraft] = useState<TerrainGrid | null>(null);
  const brushToolRef = useRef(brushTool);
  brushToolRef.current = brushTool;
  const envRef = useRef(environment);
  envRef.current = environment;
  const brushDraftRef = useRef<TerrainGrid | null>(null);
  const paintingRef = useRef(false);
  const paintAtRef = useRef<(x: number, z: number) => void>(() => {});
  const commitBrushRef = useRef<() => void>(() => {});
  paintAtRef.current = (x, z) => {
    const env = envRef.current;
    const tool = brushToolRef.current;
    if (tool.mode === "off") return;
    const next = applyBrush(
      brushDraftRef.current ?? env.terrain,
      tool.mode,
      x,
      z,
      tool.radius,
      tool.strength,
    );
    brushDraftRef.current = next;
    setBrushDraft(next);
  };
  commitBrushRef.current = () => {
    const draft = brushDraftRef.current;
    brushDraftRef.current = null;
    setBrushDraft(null);
    if (draft && onEnvironmentChange)
      onEnvironmentChange({ ...envRef.current, terrain: draft });
  };

  const refreshEffectFormulas = useCallback(async () => {
    const assets = await listAnimAssets().catch(() => []);
    const formulas: EffectFormula[] = [];
    for (const a of assets) {
      if (a.kind === "effect") formulas.push(a.formula);
    }
    setEffectFormulas(formulas);
  }, []);
  useEffect(() => {
    void refreshEffectFormulas();
  }, [refreshEffectFormulas]);

  // Đồng bộ nhóm hạt theo sự kiện hiệu ứng (Phase 5).
  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx) return;
    const wanted = new Map<string, { event: NonNullable<PrevizScene["effectEvents"]>[number]; formula: EffectFormula }>();
    for (const ev of previz.effectEvents ?? []) {
      const f = effectFormulas.find((x) => x.id === ev.effectId);
      if (f) wanted.set(ev.id, { event: ev, formula: f });
    }
    for (const [id, g] of [...ctx.effectGroups.entries()]) {
      const w = wanted.get(id);
      if (!w || w.formula !== g.formula) {
        ctx.scene.remove(g.points.group);
        g.points.dispose();
        ctx.effectGroups.delete(id);
      }
    }
    for (const [id, w] of wanted) {
      const existing = ctx.effectGroups.get(id);
      if (existing) {
        existing.points.group.position.set(w.event.position.x, w.event.position.y, w.event.position.z);
      } else {
        const points = new EffectPoints(w.formula);
        points.group.position.set(w.event.position.x, w.event.position.y, w.event.position.z);
        ctx.scene.add(points.group);
        ctx.effectGroups.set(id, { points, formula: w.formula });
      }
    }
  }, [previz.effectEvents, effectFormulas]);

  // Nhóm hạt xem thử hiệu ứng (Phase 5).
  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx) return;
    if (ctx.previewPoints) {
      ctx.scene.remove(ctx.previewPoints.group);
      ctx.previewPoints.dispose();
      ctx.previewPoints = null;
    }
    if (previewFormula) {
      const points = new EffectPoints(previewFormula);
      points.group.position.set(previewPos.x, previewPos.y, previewPos.z);
      ctx.scene.add(points.group);
      ctx.previewPoints = points;
    }
  }, [previewFormula, previewPos]);

  // Tương tác trực tiếp trên khung 3D (S3): bấm chọn vật thể, kéo trên mặt đất
  const stageInteractRef = useRef<{
    onPick: (id: string) => void;
    onDrag: (id: string, pos: { x: number; y: number; z: number }) => void;
  } | null>(null);
  stageInteractRef.current = {
    onPick: (id) => setSelectedId(id),
    onDrag: (id, pos) => {
      setSelectedId(id);
      setDraftPos(pos);
      setDraftDirty(true);
    },
  };

  // Draft cho vật thể đang chọn (vị trí/pose tại playhead, sửa rồi đặt key)
  const [draftPos, setDraftPos] = useState<Vec3>(vec3());
  const [draftRotY, setDraftRotY] = useState(0);
  const [draftPose, setDraftPose] = useState("stand");
  /** Tên clip xương đã nạp cho từng vật thể model (Phase 4). */
  const [modelClipNames, setModelClipNames] = useState<Record<string, string[]>>({});
  /** Model nào có xương (để gắn chuyển động từ file khác). */
  const [modelHasSkeleton, setModelHasSkeleton] = useState<Record<string, boolean>>({});
  /** Chuyển động gắn thêm đã khớp xong cho từng vật thể model. */
  const [attachedClipInfo, setAttachedClipInfo] = useState<Record<string, AttachedClipInfo[]>>({});
  /** Lỗi gắn chuyển động cho từng vật thể model. */
  const [attachErrors, setAttachErrors] = useState<Record<string, string>>({});
  /** Thông báo của form gắn chuyển động (panel hành động). */
  const [attachMsg, setAttachMsg] = useState<string | null>(null);
  /** Mẫu trong thư viện có thể lấy chuyển động (trừ file của nhân vật). */
  const [clipSourceAssets, setClipSourceAssets] = useState<Model3DAsset[]>([]);
  const [draftSourceAssetId, setDraftSourceAssetId] = useState("");
  const [draftSourceClips, setDraftSourceClips] = useState<string[]>([]);
  const [draftSourceClip, setDraftSourceClip] = useState("");
  /** key "assetId::clipName" đã xử lý cho từng vật thể -> tên clip trong mixer ("" = đã thử và lỗi). */
  const attachedDoneRef = useRef(new Map<string, Map<string, string>>());
  const attachedBusyRef = useRef(new Set<string>());
  const [draftActClip, setDraftActClip] = useState("");
  const [draftActStart, setDraftActStart] = useState(0);
  const [draftActDur, setDraftActDur] = useState(2);
  const [draftActLoop, setDraftActLoop] = useState(true);
  const [draftActSpeed, setDraftActSpeed] = useState(1);
  const [draftPoseKeyId, setDraftPoseKeyId] = useState<string | null>(null);

  const [draftTemplatePose, setDraftTemplatePose] = useState("bind");
  const [poseMsg, setPoseMsg] = useState<string | null>(null);
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
    renderer.setSize(mount.clientWidth, mount.clientHeight, false);
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
    // Mặt đất phong cảnh (giai đoạn B): lưới cao độ, mặc định phẳng.
    const initialEnv = scene.environment ?? DEFAULT_ENVIRONMENT;
    const terrainMesh = new THREE.Mesh(
      createTerrainGeometry(initialEnv.terrain),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    );
    threeScene.add(terrainMesh);
    const flashLight = new THREE.AmbientLight(0xffffff, 0);
    threeScene.add(flashLight);

    threeRef.current = {
      renderer,
      scene: threeScene,
      orbitCam,
      shotCam,
      controls,
      groups: new Map(),
      characters: new Map(),
      mixers: new Map(),
      effectGroups: new Map(),
      previewPoints: null,
      sunLight: sun,
      envHemi: null,
      flashLight,
      terrainMesh,
      envPoints: null,
      waterMesh: null,
      cloudGroup: null,
      flashMesh: (() => {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, side: THREE.DoubleSide }),
        );
        m.renderOrder = 999;
        m.frustumCulled = false;
        m.visible = false;
        threeScene.add(m);
        return m;
      })(),
      weatherPoints: null,
      particlePoints: null,
    };

    // Co giãn renderer theo ô chứa (khung R1 thay đổi kích thước theo cửa sổ)
    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      orbitCam.aspect = w / h;
      orbitCam.updateProjectionMatrix();
      shotCam.aspect = w / h;
      shotCam.updateProjectionMatrix();
      const sf = safeFrameRef.current;
      if (sf) {
        let tw = w;
        let th = (w * 9) / 16;
        if (th > h) {
          th = h;
          tw = (h * 16) / 9;
        }
        sf.style.width = `${tw}px`;
        sf.style.height = `${th}px`;
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // Chọn/kéo vật thể ngay trên khung 3D (S3)
    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let dragId: string | null = null;
    let downAt: { x: number; y: number } | null = null;
    const ndcOf = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
    };
    const pickAt = (e: PointerEvent): string | null => {
      const ctxNow = threeRef.current;
      if (!ctxNow) return null;
      raycaster.setFromCamera(ndcOf(e), ctxNow.orbitCam);
      const hits = raycaster.intersectObjects(
        [...ctxNow.groups.values()],
        true,
      );
      for (const hit of hits) {
        let node: THREE.Object3D | null = hit.object;
        while (node) {
          if (typeof node.userData.objectId === "string")
            return node.userData.objectId;
          node = node.parent;
        }
      }
      return null;
    };
    const onPointerDown = (e: PointerEvent) => {
      if (stateRef.current.viewMode !== "orbit") return;
      // Cọ địa hình: kéo trên mặt đất để nặn đất, không chọn vật.
      if (brushToolRef.current.mode !== "off") {
        const ctxNow = threeRef.current;
        if (ctxNow?.terrainMesh) {
          raycaster.setFromCamera(ndcOf(e), ctxNow.orbitCam);
          const hits = raycaster.intersectObject(ctxNow.terrainMesh, false);
          if (hits.length > 0) {
            paintingRef.current = true;
            controls.enabled = false;
            paintAtRef.current(hits[0].point.x, hits[0].point.z);
          }
        }
        return;
      }
      downAt = { x: e.clientX, y: e.clientY };
      const id = pickAt(e);
      if (id) {
        dragId = id;
        controls.enabled = false;
        stageInteractRef.current?.onPick(id);
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (paintingRef.current) {
        const ctxNow = threeRef.current;
        if (!ctxNow?.terrainMesh) return;
        raycaster.setFromCamera(ndcOf(e), ctxNow.orbitCam);
        const hits = raycaster.intersectObject(ctxNow.terrainMesh, false);
        if (hits.length > 0)
          paintAtRef.current(hits[0].point.x, hits[0].point.z);
        return;
      }
      if (!dragId) return;
      const ctxNow = threeRef.current;
      if (!ctxNow) return;
      raycaster.setFromCamera(ndcOf(e), ctxNow.orbitCam);
      const point = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, point)) {
        const nx = Math.max(-14, Math.min(14, point.x));
        const nz = Math.max(-14, Math.min(14, point.z));
        stageInteractRef.current?.onDrag(dragId, {
          x: nx,
          y: heightAtGrid(envRef.current.terrain, nx, nz),
          z: nz,
        });
      }
    };
    const onPointerUp = () => {
      if (paintingRef.current) {
        paintingRef.current = false;
        commitBrushRef.current();
      }
      dragId = null;
      downAt = null;
      controls.enabled = stateRef.current.viewMode === "orbit";
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      threeRef.current = null;
    };
  }, []);

  // ── Phong cảnh (giai đoạn B): dựng lại mặt đất khi địa hình đổi ───────
  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx?.terrainMesh) return;
    const grid = brushDraft ?? environment.terrain;
    const old = ctx.terrainMesh.geometry;
    ctx.terrainMesh.geometry = createTerrainGeometry(grid);
    old.dispose();
  }, [environment.terrain, brushDraft]);

  // ── Phong cảnh (giai đoạn B): trời, nắng, sương, mây, nước, mưa ───────
  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx) return;
    if (ctx.envPoints) {
      ctx.scene.remove(ctx.envPoints);
      ctx.envPoints.geometry.dispose();
      (ctx.envPoints.material as THREE.Material).dispose();
      ctx.envPoints = null;
    }
    if (ctx.cloudGroup) {
      ctx.scene.remove(ctx.cloudGroup);
      ctx.cloudGroup.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        }
      });
      ctx.cloudGroup = null;
    }
    if (ctx.waterMesh) {
      ctx.scene.remove(ctx.waterMesh);
      ctx.waterMesh.geometry.dispose();
      (ctx.waterMesh.material as THREE.Material).dispose();
      ctx.waterMesh = null;
    }
    const env = scene.environment;
    if (!env) {
      ctx.scene.fog = null;
      return;
    }
    const sky = environmentSky(env);
    ctx.scene.background = new THREE.Color(sky.skyBg);
    ctx.sunLight.color.set(sky.sunColor);
    ctx.sunLight.intensity = sky.sunIntensity;
    const angle = ((env.time - 6) / 12) * Math.PI;
    ctx.sunLight.position.set(
      Math.cos(angle) * 20,
      Math.max(1, Math.sin(angle) * 18 + 2),
      6,
    );
    if (!ctx.envHemi) {
      ctx.envHemi = new THREE.HemisphereLight(0xffffff, 0x332244, 0.3);
      ctx.scene.add(ctx.envHemi);
    }
    ctx.envHemi.intensity = sky.hemiIntensity;
    const fog = effectiveFog(env);
    ctx.scene.fog = new THREE.Fog(sky.skyBg, fog.near, fog.far);
    // Mây: số lượng theo độ phủ, màu theo độ xám của thời tiết.
    const wp = weatherParams(env.weather);
    const cloudGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#ffffff").lerp(
        new THREE.Color("#5b6470"),
        wp.cloudDark,
      ),
      transparent: true,
      opacity: 0.9,
      roughness: 1,
    });
    const count = Math.round(wp.cloudCover * 10);
    for (let i = 0; i < count; i += 1) {
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
      cloud.position.set(
        -25 + ((i * 37) % 50),
        12 + (i % 3) * 2,
        -25 + ((i * 53) % 50),
      );
      cloudGroup.add(cloud);
    }
    ctx.scene.add(cloudGroup);
    ctx.cloudGroup = cloudGroup;
    // Mặt nước phẳng.
    if (env.waterLevel >= 0) {
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(30, 30),
        new THREE.MeshStandardMaterial({
          color: "#3a7bd5",
          transparent: true,
          opacity: 0.65,
          roughness: 0.2,
        }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = env.waterLevel;
      ctx.scene.add(water);
      ctx.waterMesh = water;
    }
    // Hạt mưa/tuyết của chính thời tiết phong cảnh (tái dùng hạt S2).
    if (env.weather === "rain") {
      ctx.envPoints = createWeatherPoints({ type: "rain", intensity: 0.8 });
      ctx.scene.add(ctx.envPoints);
    } else if (env.weather === "snow") {
      ctx.envPoints = createWeatherPoints({ type: "snow", intensity: 0.6 });
      ctx.scene.add(ctx.envPoints);
    }
  }, [scene.environment]);

  // ── Thời tiết 3D (S2): gắn hạt vào scene khi thời tiết thay đổi ──────────
  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx) return;
    if (ctx.weatherPoints) {
      ctx.scene.remove(ctx.weatherPoints);
      ctx.weatherPoints.geometry.dispose();
      (ctx.weatherPoints.material as THREE.Material).dispose();
      ctx.weatherPoints = null;
    }
    if (scene.weather && scene.weather.intensity > 0) {
      const points = createWeatherPoints(scene.weather);
      ctx.weatherPoints = points;
      ctx.scene.add(points);
    }
  }, [scene.weather]);

  // ── Hệ hạt tự chế 3D (R3): gắn hạt vào scene khi thông số thay đổi ──────
  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx) return;
    if (ctx.particlePoints) {
      ctx.scene.remove(ctx.particlePoints);
      ctx.particlePoints.geometry.dispose();
      (ctx.particlePoints.material as THREE.Material).dispose();
      ctx.particlePoints = null;
    }
    if (scene.particles && scene.particles.count > 0) {
      const points = createParticlePoints(scene.particles);
      ctx.particlePoints = points;
      ctx.scene.add(points);
    }
  }, [scene.particles]);

  // ── Chuyển động gắn thêm từ file khác (Phase 4: clip retarget) ──────────
  const attachKey = (assetId: string, clipName: string) => `${assetId}::${clipName}`;

  /** Hòa giải clipSources của một vật thể với mixer: gắn mới, gỡ cũ. */
  const reconcileAttachedClips = (obj: PrevizObject, ms: MixerState) => {
    const wanted = new Map<string, ClipSource>();
    for (const s of obj.clipSources ?? []) wanted.set(attachKey(s.assetId, s.clipName), s);
    let done = attachedDoneRef.current.get(obj.id);
    if (!done) {
      done = new Map();
      attachedDoneRef.current.set(obj.id, done);
    }
    const doneMap = done;
    // Gỡ những clip không còn trong danh sách.
    for (const [key, bakedName] of [...doneMap.entries()]) {
      if (wanted.has(key)) continue;
      doneMap.delete(key);
      if (bakedName) {
        const idx = ms.clips.findIndex((c) => c.name === bakedName);
        if (idx >= 0) ms.clips.splice(idx, 1);
        setAttachedClipInfo((prev) => ({
          ...prev,
          [obj.id]: (prev[obj.id] ?? []).filter((a) => a.bakedName !== bakedName),
        }));
      }
    }
    for (const [key, s] of wanted) {
      if (doneMap.has(key)) continue;
      const busyKey = `${obj.id}|${key}`;
      if (attachedBusyRef.current.has(busyKey)) continue;
      attachedBusyRef.current.add(busyKey);
      void (async () => {
        try {
          const src = await loadClipSourceAsset(s.assetId);
          const sourceClip = src.clips.find((c) => c.name === s.clipName);
          if (!sourceClip) {
            setAttachErrors((prev) => ({
              ...prev,
              [obj.id]: `Không còn chuyển động “${s.clipName}” trong file “${src.sourceName}”.`,
            }));
            doneMap.set(key, "");
            return;
          }
          const targetJoints = mixerBindToRigJoints(ms);
          const baked = bakeClipForTarget(sourceClip, src.sourceJoints, targetJoints);
          if (!baked) {
            setAttachErrors((prev) => ({
              ...prev,
              [obj.id]: `Chuyển động “${s.clipName}” không khớp với nhân vật này (không còn xương nào dùng được) nên chưa gắn.`,
            }));
            doneMap.set(key, "");
            return;
          }
          if (!ms.clips.some((c) => c.name === baked.clip.name)) ms.clips.push(baked.clip);
          doneMap.set(key, baked.clip.name);
          setAttachedClipInfo((prev) => ({
            ...prev,
            [obj.id]: [
              ...(prev[obj.id] ?? []).filter((a) => a.bakedName !== baked.clip.name),
              {
                bakedName: baked.clip.name,
                sourceAssetId: s.assetId,
                sourceClipName: s.clipName,
                sourceName: src.sourceName,
                status: baked.status,
                missingBones: baked.missingBones,
              },
            ],
          }));
          setAttachErrors((prev) => {
            const next = { ...prev };
            delete next[obj.id];
            return next;
          });
        } catch (e) {
          const msg =
            e instanceof Error && e.message === "not-found"
              ? "Không tìm thấy file chuyển động gốc trong thư viện (có thể đã bị xoá)."
              : e instanceof Error && e.message === "no-skeleton"
                ? "File gốc không có xương nên không gắn được chuyển động."
                : "Không đọc được file chuyển động gốc.";
          setAttachErrors((prev) => ({ ...prev, [obj.id]: msg }));
          doneMap.set(key, "");
        } finally {
          attachedBusyRef.current.delete(busyKey);
        }
      })();
    }
  };

  const refreshClipSourceAssets = useCallback(async () => {
    const assets = await listAnimAssets().catch(() => []);
    const models: Model3DAsset[] = [];
    for (const a of assets) {
      if (a.kind !== "model3d") continue;
      if (a.inspection && a.inspection.animations.length === 0) continue;
      models.push(a);
    }
    setClipSourceAssets(models);
  }, []);

  useEffect(() => {
    void refreshClipSourceAssets();
  }, [refreshClipSourceAssets]);

  const handleSourceAssetChange = async (assetId: string) => {
    setDraftSourceAssetId(assetId);
    setDraftSourceClip("");
    const asset = clipSourceAssets.find((a) => a.id === assetId);
    if (!asset) {
      setDraftSourceClips([]);
      return;
    }
    const names = asset.inspection?.animations.map((a) => a.name) ?? [];
    if (names.length > 0) {
      setDraftSourceClips(names);
      return;
    }
    try {
      const src = await loadClipSourceAsset(assetId);
      setDraftSourceClips(src.clips.map((c) => c.name));
    } catch {
      setDraftSourceClips([]);
    }
  };

  const attachSource = (obj: PrevizObject, assetId: string, clipName: string) => {
    const existing = obj.clipSources ?? [];
    if (existing.some((s) => s.assetId === assetId && s.clipName === clipName)) {
      setAttachMsg("Chuyển động này đã gắn rồi.");
      return;
    }
    if (assetId === obj.modelAssetId) {
      setAttachMsg("Đây chính là file của nhân vật — chuyển động của nó đã có sẵn.");
      return;
    }
    setAttachMsg(null);
    updateObject(obj.id, { clipSources: [...existing, { assetId, clipName }] });
  };

  const uploadClipFile = (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setAttachMsg("File nặng hơn 20MB — hãy dùng bản rút gọn.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      const inspection = inspectGlbDataUrl(dataUrl) ?? undefined;
      const names = inspection?.animations.map((a) => a.name) ?? [];
      if (names.length === 0) {
        setAttachMsg("File này không có chuyển động xương nào.");
        return;
      }
      const id = newAssetId("model");
      await saveAnimAsset({
        kind: "model3d",
        id,
        name: file.name.replace(/\.glb$/i, ""),
        dataUrl,
        createdAt: Date.now(),
        inspection,
      });
      await refreshClipSourceAssets();
      setDraftSourceAssetId(id);
      setDraftSourceClips(names);
      if (names.length === 1) {
        const obj = previz.objects.find((o) => o.id === selectedId);
        if (obj) attachSource(obj, id, names[0]);
        setAttachMsg(`Đã nạp “${file.name}” vào thư viện và gắn chuyển động “${names[0]}”.`);
      } else {
        setDraftSourceClip("");
        setAttachMsg(`Đã nạp “${file.name}” vào thư viện — chọn chuyển động rồi bấm Gắn.`);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── Đồng bộ vật thể vào scene Three ────────────────────────────────────────
  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx) return;
    ctx.scene.background = new THREE.Color(
      scene.environment
        ? environmentSky(scene.environment).skyBg
        : previz.backdrop,
    );
    const seen = new Set<string>();
    for (const obj of previz.objects) {
      seen.add(obj.id);
      const existing = ctx.groups.get(obj.id);
      if (existing) existing.userData.objectId = obj.id;
      if (!ctx.groups.has(obj.id)) {
        if (obj.kind === "model") {
          // Mô hình glTF: đặt nhóm giữ chỗ trước, nạp xong gắn vào sau
          const holder = new THREE.Group();
          ctx.groups.set(obj.id, holder);
          ctx.scene.add(holder);
          if (obj.modelAssetId) {
            void loadModelForSceneWithClips(obj.modelAssetId)
              .then((loaded) => {
                if (ctx.groups.get(obj.id) !== holder) return;
                holder.add(loaded.group);
                const ms = createMixerState(loaded.group, loaded.clips);
                if (ms) {
                  ctx.mixers.set(obj.id, ms);
                  reconcileAttachedClips(obj, ms);
                }
                setModelClipNames((prev) => ({
                  ...prev,
                  [obj.id]: loaded.clips.map((c) => c.name),
                }));
                setModelHasSkeleton((prev) => ({ ...prev, [obj.id]: ms !== null }));
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
      // Vật thể đã có sẵn: chỉ hòa giải chuyển động gắn thêm (clipSources đổi).
      if (obj.kind === "model" && ctx.groups.has(obj.id)) {
        const ms = ctx.mixers.get(obj.id);
        if (ms) reconcileAttachedClips(obj, ms);
      }
    }
    for (const [id, group] of [...ctx.groups.entries()]) {
      if (!seen.has(id)) {
        ctx.scene.remove(group);
        ctx.groups.delete(id);
        ctx.characters.delete(id);
        ctx.mixers.delete(id);
        attachedDoneRef.current.delete(id);
        setAttachedClipInfo((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setAttachErrors((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setModelHasSkeleton((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }
  }, [previz]);

  // ── Vòng render ─────────────────────────────────────────────────────────────
  const stateRef = useRef({ previz, timeSec, viewMode, draftDirty, draftPos, draftRotY, draftPose, selectedId, draftCamDirty, draftCamPos, draftCamTarget, previewFormula, previewStartSec, environment });
  stateRef.current = { previz, timeSec, viewMode, draftDirty, draftPos, draftRotY, draftPose, selectedId, draftCamDirty, draftCamPos, draftCamTarget, previewFormula, previewStartSec, environment };
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
            glow: sampled.glow,
          };
        }
        group.position.set(sampled.position.x, sampled.position.y, sampled.position.z);
        group.rotation.y = rad(sampled.rotationY);
        if (obj.kind === "model") group.scale.setScalar(obj.size);
        group.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat && "emissive" in mat) {
            mat.emissive = new THREE.Color(obj.color);
            mat.emissiveIntensity = sampled.glow * 0.55;
          }
        });
        if (obj.kind === "model") {
          const ms = ctx.mixers.get(obj.id);
          if (ms) {
            const activeSeg = sampleActionSegment(obj.actions, st.timeSec);
            updateMixerState(ms, st.timeSec, activeSeg);
            // Dáng mốc chỉ phát khi không có clip nào đang chạy.
            if (!activeSeg && !ms.current && !ms.fading && obj.poseKeys && obj.poseKeys.length > 0) {
              const pose = samplePoseKeys(obj.poseKeys, st.timeSec);
              if (pose) applyPoseToBones(ms.boneByName, pose);
            }
          }
        }
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
      if (ctx.weatherPoints) updateWeatherPoints(ctx.weatherPoints, st.timeSec);
      if (ctx.envPoints) updateWeatherPoints(ctx.envPoints, st.timeSec);
      if (ctx.cloudGroup && st.environment) {
        const wind = weatherParams(st.environment.weather).wind;
        ctx.cloudGroup.position.x = ((st.timeSec * wind * 0.6) % 60) - 30;
      }
      if (
        ctx.waterMesh &&
        st.environment &&
        st.environment.waterLevel >= 0
      ) {
        ctx.waterMesh.position.y =
          st.environment.waterLevel + Math.sin(st.timeSec * 0.8) * 0.03;
      }
      // Sấm sét (chỉ mưa): chớp sáng thoáng qua theo thời gian xem.
      if (st.environment?.weather === "rain") {
        const fl = Math.sin(st.timeSec * 13.7) * Math.sin(st.timeSec * 7.3);
        ctx.flashLight.intensity = fl > 0.996 ? 1.5 : 0;
      } else {
        ctx.flashLight.intensity = 0;
      }
      if (ctx.particlePoints) updateParticlePoints(ctx.particlePoints, st.timeSec);
      // Hiệu ứng 3D (Phase 5): hạt + rung camera + chớp sáng theo timeline.
      for (const [id, g] of ctx.effectGroups) {
        const ev = st.previz.effectEvents?.find((e) => e.id === id);
        if (!ev) {
          g.points.group.visible = false;
          continue;
        }
        const local = st.timeSec - ev.startSec;
        if (local < -0.05 || local > ev.durationSec + formulaMaxLife(g.formula)) {
          g.points.group.visible = false;
          continue;
        }
        g.points.group.visible = true;
        g.points.update(local, ev.burst, ev.durationSec);
      }
      if (ctx.previewPoints && st.previewFormula) {
        const period = formulaMaxLife(st.previewFormula) + 1;
        const local = (((st.timeSec - st.previewStartSec) % period) + period) % period;
        ctx.previewPoints.update(local, true, 0);
      }
      let shake = 0;
      let flash = 0;
      for (const ev of st.previz.effectEvents ?? []) {
        const local = st.timeSec - ev.startSec;
        if (local >= 0 && local <= ev.durationSec) {
          shake = Math.max(shake, ev.shake * (1 - local / Math.max(0.1, ev.durationSec)));
        }
        if (ev.flash > 0 && local >= 0 && local <= 0.3) {
          flash = Math.max(flash, ev.flash * (1 - local / 0.3));
        }
      }
      const activeCam = st.viewMode === "shot" ? ctx.shotCam : ctx.orbitCam;
      if (st.viewMode === "shot" && shake > 0) {
        const t = st.timeSec;
        ctx.shotCam.position.x += (Math.sin(t * 47.3) + Math.sin(t * 31.7) * 0.6) * 0.12 * shake;
        ctx.shotCam.position.y += (Math.sin(t * 39.1 + 2) + Math.sin(t * 27.9) * 0.6) * 0.12 * shake;
      }
      if (flash > 0.01) {
        const dir = activeCam.getWorldDirection(new THREE.Vector3());
        const fov = (activeCam as THREE.PerspectiveCamera).fov;
        const w = ctx.renderer.domElement.clientWidth || 1;
        const h = ctx.renderer.domElement.clientHeight || 1;
        const height = 2 * Math.tan((fov * Math.PI) / 360) * 0.5;
        ctx.flashMesh.position.copy(activeCam.position).addScaledVector(dir, 0.5);
        ctx.flashMesh.quaternion.copy(activeCam.quaternion);
        ctx.flashMesh.scale.set(height * (w / h), height, 1);
        (ctx.flashMesh.material as THREE.MeshBasicMaterial).opacity = flash * 0.85;
        ctx.flashMesh.visible = true;
      } else {
        ctx.flashMesh.visible = false;
      }
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
  const audioClipsRef = useRef<SceneAudioClip[]>([]);
  audioClipsRef.current = scene.audioClips ?? [];
  useEffect(() => {
    if (!playing) {
      voicePlaybackRef.current?.stop();
      voicePlaybackRef.current = null;
      return;
    }
    let alive = true;
    void playSceneSounds(dialogueRef.current, audioClipsRef.current, timeSec).then((pb) => {
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
    // Tiếng của cảnh (thoại + clip hiệu ứng/nhạc) trộn sẵn rồi phát vào
    // luồng ghi — trước đây bản xuất từng cảnh chỉ có hình, không tiếng.
    let audioCtx: AudioContext | null = null;
    let startSceneAudio: (() => void) | null = null;
    try {
      const mixBlob = await renderFilmAudioMix(
        { scenes: [scene], bgm: null } as unknown as AnimProject,
        0,
      );
      if (mixBlob) {
        audioCtx = new AudioContext();
        const buf = await audioCtx.decodeAudioData(
          await mixBlob.arrayBuffer(),
        );
        const dest = audioCtx.createMediaStreamDestination();
        const srcNode = audioCtx.createBufferSource();
        srcNode.buffer = buf;
        srcNode.connect(dest);
        const track = dest.stream.getAudioTracks()[0];
        if (track) stream.addTrack(track);
        startSceneAudio = () => {
          try {
            srcNode.start();
          } catch {
            /* đã phát */
          }
        };
      }
    } catch {
      audioCtx = null;
      startSceneAudio = null;
    }
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
    startSceneAudio?.();
    await new Promise((r) => setTimeout(r, duration * 1000 + 150));
    setPlaying(false);
    recorder.stop();
    await done;
    void audioCtx?.close().catch(() => undefined);
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
    <div className="h-full min-h-0 flex flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-white/80">
          DỰNG CẢNH 3D — {scene.name.toUpperCase()}
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
          <button
            onClick={() => setPropsOpen((v) => !v)}
            title={propsOpen ? "Thu gọn cột thuộc tính" : "Mở cột thuộc tính"}
            className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/60 hover:bg-white/10 hover:text-white transition"
          >
            {propsOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {propsOpen ? "Thu gọn panel" : "Mở panel"}
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${propsOpen ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "xl:grid-cols-[minmax(0,1fr)]"} gap-4 flex-1 min-h-0`}>
        <div className="min-w-0 min-h-0 flex flex-col overflow-hidden">
          <div className="relative w-full flex-1 min-h-0">
            <div
              ref={mountRef}
              className="absolute inset-0 rounded-xl border border-white/10 overflow-hidden bg-black [&>canvas]:w-full [&>canvas]:h-full"
            />
            <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-black/55 px-2 py-1 text-[10.5px] text-white/70">
              Bấm vật thể để chọn · kéo để dời · kéo vùng trống để xoay camera
            </span>
            <div
              ref={safeFrameRef}
              style={{ display: "none" }}
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-dashed border-white/40 rounded-[4px]"
            >
              <span className="absolute top-1 left-2 text-[10px] tracking-wide text-white/60">
                KHUNG XUẤT 16:9
              </span>
            </div>
          </div>
          <div className="mt-3 shrink-0 flex items-center gap-2">
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
        </div>

        {propsOpen && (
        <div className="space-y-4 text-sm overflow-y-auto min-h-0 pr-0.5">
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
                    obj.keys[0] = {
                      ...obj.keys[0],
                      position: {
                        x: 0,
                        y: heightAtGrid(environment.terrain, 0, 0),
                        z: 0,
                      },
                    };
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

          {onEnvironmentChange && (
            <EnvironmentPanel
              previz={previz}
              onPrevizChange={onChange}
              environment={scene.environment ?? DEFAULT_ENVIRONMENT}
              onEnvironmentChange={onEnvironmentChange}
              brushTool={brushTool}
              onBrushToolChange={setBrushTool}
            />
          )}

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
              <label className="flex items-center gap-2 text-[11px] text-white/45">
                <span className="w-14">Phát sáng</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={selected.glow ?? 0}
                  onChange={(e) =>
                    onChange({
                      ...previz,
                      objects: previz.objects.map((o) =>
                        o.id === selected.id
                          ? { ...o, glow: Number(e.currentTarget.value) }
                          : o,
                      ),
                    })
                  }
                  className="flex-1 accent-amber-400"
                />
                <span className="w-9 text-right tabular-nums text-white/70">
                  {Math.round((selected.glow ?? 0) * 100)}%
                </span>
              </label>
              <p className="text-[10.5px] text-white/30 leading-relaxed">
                Mức phát sáng được ghi vào key mỗi khi bấm "Đặt key" — đặt
                ở nhiều key với mức khác nhau để vật phát sáng thay đổi
                theo thời gian.
              </p>
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
                        glow: selected.glow ?? 0,
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

          {selected && selected.kind === "model" && (
            <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2.5">
              <h3 className="text-[12px] font-semibold text-white/70">
                HÀNH ĐỘNG (clip xương)
              </h3>
              {(() => {
                const embedded = modelClipNames[selected.id];
                if (embedded === undefined) {
                  return <p className="text-[11px] text-white/40">Đang nạp model…</p>;
                }
                const attached = attachedClipInfo[selected.id] ?? [];
                const clipOptions = [
                  ...embedded.map((c) => ({ value: c, label: c })),
                  ...attached.map((a) => ({
                    value: a.bakedName,
                    label: `${a.sourceClipName} · ${a.status === "retargeted" ? "đã khớp" : "trực tiếp"}`,
                  })),
                ];
                const clip = clipOptions.find((o) => o.value === draftActClip)?.value ?? clipOptions[0]?.value ?? "";
                const attachedOfClip = attached.find((a) => a.bakedName === clip);
                const sourceOptions = clipSourceAssets.filter((a) => a.id !== selected.modelAssetId);
                return (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {(selected.actions ?? []).map((a) => (
                        <span
                          key={a.id}
                          className="flex items-center gap-1 px-2 h-6 rounded-md bg-violet-500/15 border border-violet-400/30 text-[11px]"
                        >
                          {a.clipName} · {a.startSec.toFixed(1)}–{(a.startSec + a.durationSec).toFixed(1)}s
                          {a.loop ? " · lặp" : " · 1 lần"} · ×{a.speed}
                          <button
                            onClick={() =>
                              updateObject(selected.id, {
                                actions: (selected.actions ?? []).filter((x) => x.id !== a.id),
                              })
                            }
                            aria-label="Xoá hành động"
                            className="text-white/40 hover:text-rose-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    {clipOptions.length === 0 ? (
                      <p className="text-[11px] text-white/40 leading-relaxed">
                        Model này chưa có chuyển động nào. Gắn chuyển động từ
                        file khác ở bên dưới (ví dụ file .glb tải từ Mixamo) —
                        chuyển động sẽ tự khớp sang tỉ lệ nhân vật này.
                      </p>
                    ) : (
                      <>
                        <label className="flex items-center gap-2 text-[11px] text-white/45">
                          <span className="w-14">Clip</span>
                          <select
                            value={clip}
                            onChange={(e) => setDraftActClip(e.currentTarget.value)}
                            className="flex-1 h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none"
                          >
                            {clipOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </label>
                        {attachedOfClip && (
                          <p className="text-[11px] leading-relaxed text-sky-200/80">
                            {attachedOfClip.status === "retargeted"
                              ? `Đã khớp chuyển động từ “${attachedOfClip.sourceName}” sang nhân vật này.`
                              : `Dùng trực tiếp chuyển động từ “${attachedOfClip.sourceName}” (xương đã khớp sẵn).`}
                          </p>
                        )}
                        {attachedOfClip && attachedOfClip.missingBones.length > 0 && (
                          <p className="text-[11px] leading-relaxed text-amber-300/90">
                            Một số xương trong file gốc không có trên nhân vật này nên đã bỏ qua: {attachedOfClip.missingBones.join(", ")}.
                          </p>
                        )}
                        <div className="flex gap-2">
                          <label className="flex-1 text-[11px] text-white/45">
                            Bắt đầu (s)
                            <input
                              type="number" step={0.1} min={0} value={draftActStart}
                              onChange={(e) => setDraftActStart(Number(e.currentTarget.value) || 0)}
                              className="mt-0.5 w-full h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none"
                            />
                          </label>
                          <label className="flex-1 text-[11px] text-white/45">
                            Dài (s)
                            <input
                              type="number" step={0.1} min={0.1} value={draftActDur}
                              onChange={(e) => setDraftActDur(Number(e.currentTarget.value) || 0.1)}
                              className="mt-0.5 w-full h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none"
                            />
                          </label>
                          <label className="flex-1 text-[11px] text-white/45">
                            Tốc độ
                            <input
                              type="number" step={0.1} min={0.1} value={draftActSpeed}
                              onChange={(e) => setDraftActSpeed(Number(e.currentTarget.value) || 1)}
                              className="mt-0.5 w-full h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none"
                            />
                          </label>
                        </div>
                        <div className="flex gap-1.5">
                          <label className="flex items-center gap-1.5 text-[11px] text-white/60 px-1">
                            <input
                              type="checkbox" checked={draftActLoop}
                              onChange={(e) => setDraftActLoop(e.currentTarget.checked)}
                            />
                            Lặp tới hết đoạn
                          </label>
                          <button
                            onClick={() => setDraftActStart(Math.round(timeSec * 100) / 100)}
                            className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px]"
                          >
                            Lấy mốc đang xem ({timeSec.toFixed(2)}s)
                          </button>
                          <button
                            onClick={() => {
                              updateObject(selected.id, {
                                actions: [
                                  ...(selected.actions ?? []),
                                  {
                                    ...createActionSegment(clip, draftActStart, draftActDur),
                                    loop: draftActLoop,
                                    speed: draftActSpeed,
                                  },
                                ],
                              });
                            }}
                            className="flex-1 h-8 rounded-lg bg-violet-500/25 border border-violet-400/40 text-[12px] font-medium hover:bg-violet-500/35"
                          >
                            Thêm hành động
                          </button>
                        </div>
                        <p className="text-[10.5px] text-white/30 leading-relaxed">
                          Bấm phát là nhân vật diễn đúng đoạn đã gắn; xuất WebM
                          ghi lại đúng hành động đang xem.
                        </p>
                      </>
                    )}
                    {modelHasSkeleton[selected.id] ? (
                      <div className="pt-2 border-t border-white/10 space-y-2">
                        <p className="text-[11px] font-medium text-white/60">Thêm chuyển động từ file khác</p>
                        {attachErrors[selected.id] && (
                          <p className="text-[11px] text-rose-300 leading-relaxed">{attachErrors[selected.id]}</p>
                        )}
                        {attachMsg && (
                          <p className="text-[11px] text-emerald-300 leading-relaxed">{attachMsg}</p>
                        )}
                        {attached.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {attached.map((a) => (
                              <span
                                key={a.bakedName}
                                className="flex items-center gap-1 px-2 h-6 rounded-md bg-sky-500/15 border border-sky-400/30 text-[11px]"
                              >
                                {a.sourceClipName} · {a.status === "retargeted" ? "đã khớp" : "trực tiếp"} · từ “{a.sourceName}”
                                <button
                                  onClick={() =>
                                    updateObject(selected.id, {
                                      clipSources: (selected.clipSources ?? []).filter(
                                        (s) => !(s.assetId === a.sourceAssetId && s.clipName === a.sourceClipName),
                                      ),
                                    })
                                  }
                                  aria-label="Gỡ chuyển động"
                                  className="text-white/40 hover:text-rose-400"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <label className="flex items-center gap-2 text-[11px] text-white/45">
                          <span className="w-14">File mẫu</span>
                          <select
                            value={draftSourceAssetId}
                            onChange={(e) => void handleSourceAssetChange(e.currentTarget.value)}
                            className="flex-1 h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none"
                          >
                            <option value="">Chọn mẫu trong thư viện…</option>
                            {sourceOptions.map((m) => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </label>
                        {draftSourceClips.length > 0 && (
                          <label className="flex items-center gap-2 text-[11px] text-white/45">
                            <span className="w-14">Chuyển động</span>
                            <select
                              value={draftSourceClip}
                              onChange={(e) => setDraftSourceClip(e.currentTarget.value)}
                              className="flex-1 h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none"
                            >
                              {draftSourceClips.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              if (draftSourceAssetId && draftSourceClip) attachSource(selected, draftSourceAssetId, draftSourceClip);
                            }}
                            disabled={!draftSourceAssetId || !draftSourceClip}
                            className="flex-1 h-8 rounded-lg bg-sky-500/25 border border-sky-400/40 text-[12px] font-medium hover:bg-sky-500/35 disabled:opacity-50"
                          >
                            Gắn chuyển động
                          </button>
                          <label className="px-3 h-8 leading-8 rounded-lg bg-white/5 border border-white/10 text-[12px] cursor-pointer">
                            Tải file .glb mới
                            <input
                              type="file"
                              accept=".glb,model/gltf-binary"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.currentTarget.files?.[0];
                                e.currentTarget.value = "";
                                if (file) uploadClipFile(file);
                              }}
                            />
                          </label>
                        </div>
                        <p className="text-[10.5px] text-white/30 leading-relaxed">
                          File .glb tải từ Mixamo hay mẫu trong thư viện đều được:
                          chuyển động tự khớp sang tỉ lệ nhân vật này, đoạn nào
                          không khớp xương sẽ báo rõ chứ không gắn hỏng.
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-white/40 leading-relaxed">
                        Nhân vật này không có xương nên chưa gắn được chuyển động từ file khác.
                      </p>
                    )}
                  </>
                );
              })()}
            </section>
          )}

          {selected && selected.kind === "model" && (
            <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2.5">
              <h3 className="text-[12px] font-semibold text-white/70">
                DÁNG MỐC (tự dựng, không cần clip)
              </h3>
              {modelClipNames[selected.id] === undefined ? (
                <p className="text-[11px] text-white/40">Đang nạp model…</p>
              ) : (
                <>
                  {poseMsg && <p className="text-[11px] text-emerald-300 leading-relaxed">{poseMsg}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {[...(selected.poseKeys ?? [])]
                      .sort((a, b) => a.timeSec - b.timeSec)
                      .map((k) => (
                        <span
                          key={k.id}
                          className="flex items-center gap-1 px-2 h-6 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-[11px]"
                        >
                          {k.timeSec.toFixed(2)}s · {Object.keys(k.bones).length} xương
                          <button
                            onClick={() => setDraftPoseKeyId(draftPoseKeyId === k.id ? null : k.id)}
                            className="text-white/60 hover:text-white underline underline-offset-2"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => {
                              updateObject(selected.id, {
                                poseKeys: (selected.poseKeys ?? []).filter((x) => x.id !== k.id),
                              });
                              if (draftPoseKeyId === k.id) setDraftPoseKeyId(null);
                            }}
                            aria-label="Xoá dáng mốc"
                            className="text-white/40 hover:text-rose-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                  </div>
                  {draftPoseKeyId &&
                    (() => {
                      const k = (selected.poseKeys ?? []).find((x) => x.id === draftPoseKeyId);
                      if (!k) return null;
                      return (
                        <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
                          {Object.keys(k.bones)
                            .sort()
                            .map((name) => {
                              const e = quatToEulerDeg(k.bones[name]);
                              return (
                                <div key={name} className="grid grid-cols-[110px_1fr_1fr_1fr] gap-1.5 items-center">
                                  <span className="text-[11px] text-white/60 truncate">{name}</span>
                                  {e.map((v, axis) => (
                                    <label key={axis} className="block text-[10px] text-white/40">
                                      {["X", "Y", "Z"][axis]}
                                      <input
                                        type="number"
                                        step={1}
                                        value={Math.round(v * 100) / 100}
                                        onChange={(ev) => {
                                          const next = [...e] as [number, number, number];
                                          next[axis] = Number(ev.currentTarget.value) || 0;
                                          const q = eulerDegToQuat(next);
                                          updateObject(selected.id, {
                                            poseKeys: (selected.poseKeys ?? []).map((pk) =>
                                              pk.id === k.id
                                                ? { ...pk, bones: { ...pk.bones, [name]: q } }
                                                : pk,
                                            ),
                                          });
                                        }}
                                        className="mt-0.5 w-full h-7 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] text-white outline-none"
                                      />
                                    </label>
                                  ))}
                                </div>
                              );
                            })}
                        </div>
                      );
                    })()}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        const ms = threeRef.current?.mixers.get(selected.id);
                        if (!ms) {
                          setPoseMsg("Model chưa nạp xong hoặc không có xương — chờ model hiện trong khung rồi thử lại.");
                          return;
                        }
                        const bones = capturePose(ms.boneByName);
                        updateObject(selected.id, {
                          poseKeys: [
                            ...(selected.poseKeys ?? []),
                            createPoseKey(Math.round(timeSec * 100) / 100, bones),
                          ],
                        });
                        setPoseMsg(`Đã chụp dáng tại ${timeSec.toFixed(2)}s (${Object.keys(bones).length} xương).`);
                      }}
                      className="flex-1 h-8 rounded-lg bg-emerald-500/25 border border-emerald-400/40 text-[12px] font-medium hover:bg-emerald-500/35"
                    >
                      Chụp dáng hiện tại ({timeSec.toFixed(2)}s)
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <select
                      value={draftTemplatePose}
                      onChange={(e) => setDraftTemplatePose(e.currentTarget.value)}
                      className="h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none"
                    >
                      {Object.entries(TEST_POSES).map(([id, tp]) => (
                        <option key={id} value={id}>{tp.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const ms = threeRef.current?.mixers.get(selected.id);
                        if (!ms) {
                          setPoseMsg("Model chưa nạp xong hoặc không có xương — chờ model hiện trong khung rồi thử lại.");
                          return;
                        }
                        const bind: Record<string, BoneQuat> = {};
                        for (const [name, bone] of ms.boneByName) {
                          const b = ms.bind.get(bone);
                          if (b) bind[name] = [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w];
                        }
                        const bones = expandPoseTemplate(TEST_POSES[draftTemplatePose].pose, bind);
                        updateObject(selected.id, {
                          poseKeys: [
                            ...(selected.poseKeys ?? []),
                            createPoseKey(Math.round(timeSec * 100) / 100, bones),
                          ],
                        });
                        setPoseMsg(`Đã thêm dáng mẫu tại ${timeSec.toFixed(2)}s.`);
                      }}
                      className="flex-1 h-8 rounded-lg bg-white/5 border border-white/10 text-[12px]"
                    >
                      Thêm dáng mẫu tại mốc đang xem
                    </button>
                  </div>
                  <p className="text-[10.5px] text-white/30 leading-relaxed">
                    Dáng mốc chỉ phát khi không có đoạn clip nào đang chạy tại
                    thời điểm đó; giữa 2 mốc xương nội suy mượt. Chụp dáng
                    trong lúc clip đang phát để giữ lại khoảnh khắc ưng ý.
                  </p>
                </>
              )}
            </section>
          )}

          <EffectStudioPanel
            previz={previz}
            onChange={onChange}
            timeSec={timeSec}
            selectedPosition={selected ? samplePrevizObject(selected, timeSec).position : null}
            formulas={effectFormulas}
            onFormulasChange={() => void refreshEffectFormulas()}
            previewing={previewFormula !== null}
            onPreview={(f) => {
              if (!f) {
                setPreviewFormula(null);
              } else {
                setPreviewFormula(f);
                setPreviewStartSec(timeSec);
                setPreviewPos(
                  selected ? samplePrevizObject(selected, timeSec).position : { x: 0, y: 0.5, z: 0 },
                );
              }
            }}
          />

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
          {onWeatherChange && (
            <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
              <h3 className="text-[12px] font-semibold text-white/70">
                HIỆU ỨNG CẢNH — THỜI TIẾT & KHÔNG KHÍ
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <select
                  value={scene.weather?.type ?? "none"}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    if (v === "none") onWeatherChange(null);
                    else
                      onWeatherChange({
                        type: v as WeatherType,
                        intensity: scene.weather?.intensity ?? 0.7,
                      });
                  }}
                  className="h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-white/80"
                >
                  <option value="none">Không có</option>
                  <option value="rain">Mưa</option>
                  <option value="snow">Tuyết rơi</option>
                  <option value="sparkles">Lấp lánh</option>
                </select>
                {scene.weather && (
                  <label className="flex items-center gap-2 text-white/50 flex-1 min-w-[160px]">
                    Mật độ
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={scene.weather.intensity}
                      onChange={(e) =>
                        onWeatherChange({
                          ...scene.weather!,
                          intensity: Number(e.currentTarget.value),
                        })
                      }
                      className="flex-1 accent-sky-400"
                    />
                  </label>
                )}
              </div>
              <p className="text-[11px] text-white/35">
                Thời tiết hiện ở cả lúc dựng, lúc phát thử và trong bản xuất.
              </p>
            </section>
          )}

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
          {onParticlesChange && (
            <SceneParticlesPanel
              value={scene.particles ?? null}
              onChange={onParticlesChange}
            />
          )}
          {onAudioChange && (
            <SceneAudioPanel scene={scene} onChange={onAudioChange} />
          )}
        </div>
        )}
      </div>

      {/* Dải timeline đa track (R1) */}
      <PrevizStrip
        previz={previz}
        dialogue={scene.dialogue ?? []}
        audioClips={scene.audioClips ?? []}
        duration={duration}
        timeSec={timeSec}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onSeek={(t) => {
          setPlaying(false);
          setTimeSec(t);
        }}
      />
    </div>
  );
}
