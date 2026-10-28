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
  SkipBack,
  SkipForward,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { AnimScene } from "../lib/animProject";
import { sceneSpeed } from "../lib/animProject";
import { verticalFrame } from "../lib/filmPost";
import {
  DEFAULT_SCENE_POST,
  clampScenePostSettings,
  scenePostOf,
  type ScenePostSettings,
} from "../lib/scenePost";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { AfterimagePass } from "three/addons/postprocessing/AfterimagePass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { EASING_OPTIONS, type EasingId } from "../lib/timeline";
import {
  createPrevizObject,
  createPrevizScene,
  newPrevizId,
  POSE_OPTIONS,
  sampleFocus,
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
import {
  buildShotKeys,
  SHOT_PRESETS,
  type ShotPresetId,
} from "../lib/cameraShots";
import {
  clampCameraDrag,
  panCameraDrag,
  frustumFar,
  frustumLineSegments,
  rayPlanePoint,
} from "../lib/cameraRigModel";
import { resolveShotCamera } from "../lib/cameraDraft";
import { videoGenStatus } from "../lib/videoGen";
import { newDialogueId, type DialogueLine } from "../lib/dialogue";
import { loadModelForSceneWithClips, loadClipSourceAsset } from "../lib/modelLoader";
import { createActionSegment, sampleActionSegment } from "../lib/actionTrack";
import { createMixerState, updateMixerState, type MixerState } from "../lib/clipPlayer";
import { applyVrmExpressions, updateLoadedVrms } from "../lib/gltfLoader";
import { buildPrevizCharacter, buildPrevizProp, type CharacterParts } from "../lib/previzGeometry";
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
  playing,
  onTogglePlayback,
  onAddKey,
  onMoveKey,
  onDeleteKey,
  onStep,
  onMoveDialogue,
  onMoveAudio,
  onMoveAction,
  fps,
}: {
  previz: PrevizScene;
  dialogue: DialogueLine[];
  audioClips: SceneAudioClip[];
  duration: number;
  timeSec: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSeek: (t: number) => void;
  playing: boolean;
  onTogglePlayback: () => void;
  onAddKey: (trackId: string) => void;
  onMoveKey: (trackId: string, keyId: string, timeSec: number) => void;
  onDeleteKey: (trackId: string, keyId: string) => void;
  onStep: (direction: -1 | 1) => void;
  onMoveDialogue: (id: string, startSec: number) => void;
  onMoveAudio: (id: string, startSec: number) => void;
  onMoveAction: (objectId: string, actionId: string, startSec: number) => void;
  fps: 12 | 24;
}) {
  const [zoom, setZoom] = useState(1);
  const [keyNotice, setKeyNotice] = useState("");
  const [selectedKey, setSelectedKey] = useState<{ trackId: string; keyId: string } | null>(null);
  const [activeTrackId, setActiveTrackId] = useState(selectedId ?? "camera");
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const dragKeyRef = useRef<{ trackId: string; keyId: string; lastTimeSec: number | null } | null>(null);
  const dragClipRef = useRef<{ kind: "dialogue" | "audio" | "action"; trackId: string; clipId: string; grabOffsetSec: number; lastTimeSec: number | null } | null>(null);
  const scrubbingRef = useRef(false);
  useEffect(() => {
    setActiveTrackId(selectedId ?? "camera");
  }, [selectedId]);
  const pct = (t: number) =>
    `${Math.max(0, Math.min(100, (t / duration) * 100))}%`;
  const seekFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(duration, Math.round(ratio * duration * fps) / fps)));
  };
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 0.001; t += duration > 12 ? 2 : 1) ticks.push(t);
  const beginKeyDrag = (
    e: React.PointerEvent<HTMLSpanElement>,
    trackId: string,
    keyId: string,
  ) => {
    e.stopPropagation();
    dragKeyRef.current = { trackId, keyId, lastTimeSec: null };
    setSelectedKey({ trackId, keyId });
    setActiveTrackId(trackId);
    if (trackId !== "camera") onSelect(trackId);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const dragSelectedKey = (e: React.PointerEvent<HTMLSpanElement>) => {
    const active = dragKeyRef.current;
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!active || !rect || rect.width <= 0) return;
    e.stopPropagation();
    const rawTime = ((e.clientX - rect.left) / rect.width) * duration;
    const t = Math.max(0, Math.min(duration, Math.round(rawTime * fps) / fps));
    if (active.lastTimeSec === t) return;
    active.lastTimeSec = t;
    onMoveKey(active.trackId, active.keyId, t);
  };
  const finishKeyDrag = () => { dragKeyRef.current = null; };
  const beginClipDrag = (
    e: React.PointerEvent<HTMLSpanElement>,
    kind: "dialogue" | "audio" | "action",
    trackId: string,
    clipId: string,
    startSec: number,
  ) => {
    e.stopPropagation();
    const rect = timelineRef.current?.getBoundingClientRect();
    const pointerTime = rect?.width
      ? ((e.clientX - rect.left) / rect.width) * duration
      : startSec;
    dragClipRef.current = { kind, trackId, clipId, grabOffsetSec: pointerTime - startSec, lastTimeSec: null };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const dragClip = (e: React.PointerEvent<HTMLSpanElement>) => {
    const active = dragClipRef.current;
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!active || !rect || rect.width <= 0) return;
    e.stopPropagation();
    const rawTime = ((e.clientX - rect.left) / rect.width) * duration;
    const startSec = Math.max(0, Math.min(duration, Math.round((rawTime - active.grabOffsetSec) * fps) / fps));
    if (active.lastTimeSec === startSec) return;
    active.lastTimeSec = startSec;
    if (active.kind === "dialogue") onMoveDialogue(active.clipId, startSec);
    else if (active.kind === "audio") onMoveAudio(active.clipId, startSec);
    else onMoveAction(active.trackId, active.clipId, startSec);
  };
  const finishClipDrag = () => { dragClipRef.current = null; };
  const rows: { id: string; label: string; color: string; onClick?: () => void }[] = [
    { id: "camera", label: "Camera", color: "#38bdf8" },
    ...previz.objects.map((o) => ({
      id: o.id,
      label: o.name,
      color: "#a78bfa",
      onClick: () => onSelect(o.id),
    })),
    ...previz.objects
      .filter((o) => o.kind === "model" && (o.actions?.length ?? 0) > 0)
      .map((o) => ({ id: `actions:${o.id}`, label: `↳ Hành động · ${o.name}`, color: "#c084fc", onClick: () => onSelect(o.id) })),
    { id: "dialogue", label: "Thoại", color: "#f472b6" },
    ...(audioClips.length > 0
      ? [{ id: "audio", label: "Âm thanh", color: "#34d399" }]
      : []),
  ];
  const canAddKey = activeTrackId === "camera" || previz.objects.some((obj) => obj.id === activeTrackId);
  return (
    <div className="shrink-0 border-t border-white/10 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-white/50">
          TIMELINE — TRACK · KEYFRAME · THOẠI · ÂM THANH
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => onStep(-1)} title="Lùi 1 frame" aria-label="Lùi 1 frame" className="grid place-items-center w-7 h-7 rounded hover:bg-white/10 text-white/65"><SkipBack className="w-3.5 h-3.5" /></button>
          <button onClick={onTogglePlayback} title={playing ? "Tạm dừng" : "Phát"} aria-label={playing ? "Tạm dừng" : "Phát"} className="grid place-items-center w-7 h-7 rounded bg-sky-500/20 text-sky-200 hover:bg-sky-500/30">{playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}</button>
          <button onClick={() => onStep(1)} title="Tiến 1 frame" aria-label="Tiến 1 frame" className="grid place-items-center w-7 h-7 rounded hover:bg-white/10 text-white/65"><SkipForward className="w-3.5 h-3.5" /></button>
          <span className="mx-1 text-[11px] text-white/40 tabular-nums">{timeSec.toFixed(2)}s / {duration.toFixed(1)}s</span>
          <button disabled={!canAddKey} onClick={() => { onAddKey(activeTrackId); setKeyNotice(`Đã lưu key tại ${timeSec.toFixed(2)}s cho ${activeTrackId === "camera" ? "Camera" : previz.objects.find((obj) => obj.id === activeTrackId)?.name ?? "vật thể"}.`); }} title="Lưu trạng thái track đang chọn tại playhead" aria-label="Thêm keyframe" className="flex items-center gap-1 px-2 h-7 rounded bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 text-[11px] disabled:opacity-30"><Plus className="w-3 h-3" /> Add key</button>
          <button
            disabled={!selectedKey}
            onClick={() => {
              if (!selectedKey) return;
              onDeleteKey(selectedKey.trackId, selectedKey.keyId);
              setSelectedKey(null);
            }}
            title="Xóa keyframe đang chọn"
            aria-label="Xóa keyframe"
            className="px-2 h-7 rounded text-[11px] text-white/55 hover:text-rose-300 hover:bg-white/5 disabled:opacity-30"
          ><Trash2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => setZoom((v) => Math.max(1, v / 1.25))} title="Thu nhỏ timeline" aria-label="Thu nhỏ timeline" className="grid place-items-center w-7 h-7 rounded hover:bg-white/10 text-white/65"><ZoomOut className="w-3.5 h-3.5" /></button>
          <button onClick={() => setZoom((v) => Math.min(8, v * 1.25))} title="Phóng to timeline" aria-label="Phóng to timeline" className="grid place-items-center w-7 h-7 rounded hover:bg-white/10 text-white/65"><ZoomIn className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {keyNotice && <p role="status" className="mb-1 text-[10px] text-amber-200/80">{keyNotice}</p>}
      <div className="max-h-[220px] overflow-auto">
        <div className="grid grid-cols-[116px_minmax(0,1fr)]">
          <div className="sticky left-0 z-20 bg-[#0a0614]">
            <div className="h-4 sticky top-0 bg-[#0a0614] z-10" />
            {rows.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setActiveTrackId(r.id);
                  r.onClick?.();
                }}
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
          <div
            ref={timelineRef}
            className="relative"
            style={{ width: `${zoom * 100}%`, touchAction: "none" }}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).dataset.timelineKey === "true") return;
              scrubbingRef.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              seekFromEvent(e);
            }}
            onPointerMove={(e) => { if (scrubbingRef.current) seekFromEvent(e); }}
            onPointerUp={() => { scrubbingRef.current = false; }}
            onPointerCancel={() => { scrubbingRef.current = false; }}
          >
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
                      onPointerDown={(e) => beginKeyDrag(e, "camera", k.id)}
                      data-timeline-key="true"
                      onPointerMove={dragSelectedKey}
                      onPointerUp={finishKeyDrag}
                      className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 cursor-ew-resize touch-none ${selectedKey?.trackId === "camera" && selectedKey.keyId === k.id ? "bg-white ring-2 ring-sky-400" : "bg-sky-400"}`}
                      style={{ left: `calc(${pct(k.timeSec)} - 5px)` }}
                      onClick={() => onSeek(k.timeSec)}
                    />
                  ))}
                {r.id.startsWith("actions:") && (() => {
                  const objectId = r.id.slice("actions:".length);
                  const obj = previz.objects.find((item) => item.id === objectId);
                  return obj?.actions?.map((action) => (
                    <span
                      key={action.id}
                      data-timeline-key="true"
                      title={`${action.clipName} · ${action.startSec.toFixed(2)}s`}
                      onPointerDown={(e) => beginClipDrag(e, "action", obj.id, action.id, action.startSec)}
                      onPointerMove={dragClip}
                      onPointerUp={finishClipDrag}
                      onClick={() => onSeek(action.startSec)}
                      className="absolute top-[2px] bottom-[2px] rounded bg-violet-500/45 border border-violet-300/50 text-[9px] text-white/90 px-1 truncate leading-[17px] cursor-grab touch-none"
                      style={{ left: pct(action.startSec), width: `${Math.max(2, (action.durationSec / duration) * 100)}%` }}
                    >{action.clipName}</span>
                  ));
                })()}
                {r.id !== "camera" && !r.id.startsWith("actions:") &&
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
                            onPointerDown={(e) => beginKeyDrag(e, obj.id, k.id)}
                            data-timeline-key="true"
                            onPointerMove={dragSelectedKey}
                            onPointerUp={finishKeyDrag}
                            className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 cursor-ew-resize touch-none ${selectedKey?.trackId === obj.id && selectedKey.keyId === k.id ? "bg-white ring-2 ring-amber-400" : "bg-amber-400"}`}
                            style={{ left: `calc(${pct(k.timeSec)} - 5px)` }}
                            onClick={() => onSeek(k.timeSec)}
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
                      data-timeline-key="true"
                      onPointerDown={(e) => beginClipDrag(e, "dialogue", "dialogue", line.id, line.startSec)}
                      onPointerMove={dragClip}
                      onPointerUp={finishClipDrag}
                      onClick={() => onSeek(line.startSec)}
                      className="absolute top-[2px] bottom-[2px] rounded bg-pink-500/40 border border-pink-400/40 text-[9px] text-white/85 px-1 truncate leading-[17px] cursor-grab touch-none"
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
                      data-timeline-key="true"
                      onPointerDown={(e) => beginClipDrag(e, "audio", "audio", clip.id, clip.startSec)}
                      onPointerMove={dragClip}
                      onPointerUp={finishClipDrag}
                      onClick={() => onSeek(clip.startSec)}
                      className="absolute top-[2px] bottom-[2px] rounded bg-emerald-500/40 border border-emerald-400/40 text-[9px] text-white/85 px-1 truncate leading-[17px] cursor-grab touch-none"
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

/**
 * Kiểu khai báo của three 0.180 để uniforms của BokehPass là `{}` nên
 * truy cập trực tiếp bị lỗi type — ép kiểu qua record số khi chỉnh
 * focus/aperture/maxblur/aspect lúc chạy.
 */
function bokehUniforms(pass: BokehPass): Record<string, { value: number }> {
  return pass.uniforms as unknown as Record<string, { value: number }>;
}

export function PrevizEditor({
  scene,
  onChange,
  fps = 24,
  onDialogueChange,
  onWeatherChange,
  onAudioChange,
  onParticlesChange,
  onEnvironmentChange,
  onScenePostChange,
  exportAspect,
}: {
  scene: AnimScene;
  fps?: 12 | 24;
  /** Tỉ lệ khung xuất của dự án (dọc 9:16 thì khung chóp hẹp lại). */
  exportAspect?: number;
  onChange: (previz: PrevizScene) => void;
  onDialogueChange?: (lines: DialogueLine[]) => void;
  onWeatherChange?: (weather: SceneWeather | null) => void;
  onAudioChange?: (clips: SceneAudioClip[]) => void;
  onParticlesChange?: (particles: ParticleSystemSettings | null) => void;
  onEnvironmentChange?: (environment: SceneEnvironment) => void;
  onScenePostChange?: (post: ScenePostSettings) => void;
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
  // Tỉ lệ khung xuất hiện tại (sibling dùng cho khung hình chóp của máy
  // quay) — resize đọc qua ref để không kẹt tỉ lệ lúc mở đầu.
  const exportAspectRef = useRef(exportAspect);
  exportAspectRef.current = exportAspect;
  useEffect(() => {
    if (safeFrameRef.current)
      safeFrameRef.current.style.display =
        viewMode === "shot" ||
        (exportAspect != null && exportAspect < 1)
          ? "block"
          : "none";
  }, [viewMode, exportAspect]);
  // Đổi kiểu xuất thì tính lại khung ngay (resize chỉ chạy khi đổi kích
  // thước ô xem, không chạy khi chỉ đổi tỉ lệ).
  useEffect(() => {
    const mount = mountRef.current;
    const sf = safeFrameRef.current;
    if (!mount || !sf) return;
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    if (w === 0 || h === 0) return;
    if (exportAspect != null && exportAspect < 1) {
      const { frame } = verticalFrame(w, h);
      sf.style.width = `${frame.width}px`;
      sf.style.height = `${frame.height}px`;
      sf.style.display = "block";
    } else {
      let tw = w;
      let th = (w * 9) / 16;
      if (th > h) {
        th = h;
        tw = (h * 16) / 9;
      }
      sf.style.width = `${tw}px`;
      sf.style.height = `${th}px`;
      sf.style.display = viewMode === "shot" ? "block" : "none";
    }
  }, [exportAspect, viewMode]);
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
    /** Bộ xử lý hậu kỳ (giai đoạn C): null khi chưa dựng xong. */
    composer: EffectComposer | null;
    renderPass: RenderPass | null;
    bloomPass: UnrealBloomPass | null;
    bokehPass: BokehPass | null;
    afterimagePass: AfterimagePass | null;
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
    sunVisual: THREE.Group;
    envHemi: THREE.HemisphereLight | null;
    flashLight: THREE.AmbientLight;
    terrainMesh: THREE.Mesh | null;
    envPoints: THREE.Points | null;
    waterMesh: THREE.Mesh | null;
    cloudGroup: THREE.Group | null;
    /** Mô hình máy quay kéo được (chỉ góc tự do): thân + khung chóp + điểm nhìn. */
    camModel: THREE.Group | null;
    camFrustum: THREE.LineSegments | null;
    camTargetHandle: THREE.Mesh | null;
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
  // Hậu kỳ cảnh (giai đoạn C): cài đặt hiệu lực + ref cho vòng render/resize.
  const scenePost = scenePostOf(scene);
  const scenePostRef = useRef(scenePost);
  scenePostRef.current = scenePost;
  const brushDraftRef = useRef<TerrainGrid | null>(null);
  const paintingRef = useRef(false);
  /** Chặn OrbitControls trong lúc đang kéo (vòng lặp render đọc cờ này). */
  const dragLockRef = useRef(false);
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
    onDragEnd: (id: string, pos: { x: number; y: number; z: number }) => void;
  } | null>(null);
  stageInteractRef.current = {
    onPick: (id) => {
      // Mỗi vật thể có bản nháp vị trí riêng. Nếu giữ draftDirty khi đổi
      // selection trên sân khấu, draftPos của vật thể vừa kéo sẽ bị áp
      // lên nhân vật mới và khiến hai nhân vật chồng đúng cùng tọa độ.
      setSelectedId(id);
      setDraftDirty(false);
    },
    onDrag: (id, pos) => {
      setSelectedId(id);
      setDraftPos(pos);
      setDraftDirty(true);
    },
    onDragEnd: (id, pos) => {
      const target = previz.objects.find((obj) => obj.id === id);
      if (!target) return;
      const atTime = target.keys.find((key) => Math.abs(key.timeSec - timeSec) < 1e-4);
      const template = atTime ?? target.keys.reduce((best, key) =>
        Math.abs(key.timeSec - timeSec) < Math.abs(best.timeSec - timeSec) ? key : best,
      target.keys[0]);
      onChange({
        ...previz,
        objects: previz.objects.map((obj) => obj.id === id
          ? { ...obj, keys: upsertPrevizKey(obj.keys, {
              ...template,
              id: atTime?.id ?? newPrevizId("pkey"),
              timeSec,
              position: pos,
            }) }
          : obj),
      });
      setDraftDirty(false);
    },
  };

  // Draft cho vật thể đang chọn (vị trí/pose tại playhead, sửa rồi đặt key)
  const [draftPos, setDraftPos] = useState<Vec3>(vec3());
  const [draftRotY, setDraftRotY] = useState(0);
  const [draftPose, setDraftPose] = useState("stand");
  /** Tên clip xương đã nạp cho từng vật thể model (Phase 4). */
  const [modelClipNames, setModelClipNames] = useState<Record<string, string[]>>({});
  const [modelLoadErrors, setModelLoadErrors] = useState<Record<string, string>>({});
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
  // Cú máy mẫu (giai đoạn D): chọn mẫu + mục tiêu rồi sinh key.
  const [shotPreset, setShotPreset] = useState<ShotPresetId>("dolly-in");
  const [shotDuration, setShotDuration] = useState(3);
  const [shotTargetId, setShotTargetId] = useState("");
  const [shotDistance, setShotDistance] = useState(0);
  const [shotHeight, setShotHeight] = useState(2);
  const [shotAngle, setShotAngle] = useState(90);
  const [shotFocusFrom, setShotFocusFrom] = useState(3);
  const [shotFocusTo, setShotFocusTo] = useState(9);
  const [draftCamDirty, setDraftCamDirty] = useState(false);
  // Giây lúc sửa camera lần cuối — bản nháp chỉ áp tại giây này.
  const [draftCamTimeSec, setDraftCamTimeSec] = useState(0);
  // Camera phim đang hiển thị: bản nháp chỉ tại giây đã sửa, còn lại
  // dùng key đã lưu — kéo camera không kéo theo mọi khung hình.
  const shownCam = resolveShotCamera({
    draftDirty: draftCamDirty,
    draftTimeSec: draftCamTimeSec,
    draftPos: draftCamPos,
    draftTarget: draftCamTarget,
    keys: previz.cameraKeys,
    timeSec,
  });
  // Mô hình máy quay kéo được: chế độ dời máy + công tắc hiện mô hình.
  const [camMoveMode, setCamMoveMode] = useState(false);
  const [showCamModel, setShowCamModel] = useState(true);
  const camDragRef = useRef<null | {
    kind: "pos" | "target";
    planePoint: THREE.Vector3;
    planeNormal: THREE.Vector3;
    /** Vị trí + điểm nhìn lúc bắt đầu kéo (pan: cả hai tịnh tiến cùng nhau). */
    startPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    /** Điểm chuột chạm mặt phẳng kéo lúc bắt đầu kéo. */
    grabPoint: THREE.Vector3;
  }>(null);

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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
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

    // Hậu kỳ (giai đoạn C): xử lý khung hình qua bộ lọc — khi mọi hiệu
    // ứng tắt thì chuỗi chỉ còn vẽ cảnh + chuẩn hoá màu nên nhìn y như cũ.
    const post0 = clampScenePostSettings(scene.scenePost ?? DEFAULT_SCENE_POST);
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const renderPass = new RenderPass(threeScene, orbitCam);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(mount.clientWidth, mount.clientHeight),
      post0.bloom.strength,
      post0.bloom.radius,
      post0.bloom.threshold,
    );
    bloomPass.enabled = post0.bloom.enabled;
    const bokehPass = new BokehPass(threeScene, orbitCam, {
      focus: post0.dof.focus,
      aperture: post0.dof.aperture,
      maxblur: post0.dof.maxblur,
    });
    bokehPass.enabled = post0.dof.enabled;
    const afterimagePass = new AfterimagePass(post0.afterimage.damp);
    afterimagePass.enabled = post0.afterimage.enabled;
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(bokehPass);
    composer.addPass(afterimagePass);
    composer.addPass(new OutputPass());

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
    const sunVisual = new THREE.Group();
    const sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xffe7a3, fog: false, toneMapped: false }),
    );
    const sunGlow = new THREE.Mesh(
      new THREE.SphereGeometry(3.6, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xffbd59, transparent: true, opacity: 0.22, fog: false, depthWrite: false, toneMapped: false }),
    );
    sunVisual.add(sunGlow, sunDisc);
    sunVisual.renderOrder = 5;
    threeScene.add(sunVisual);
    const grid = new THREE.GridHelper(30, 30, 0x554477, 0x332a4d);
    threeScene.add(grid);
    // Mặt đất phong cảnh (giai đoạn B): lưới cao độ, mặc định phẳng.
    const initialEnv = scene.environment ?? DEFAULT_ENVIRONMENT;
    const terrainMesh = new THREE.Mesh(
      createTerrainGeometry(initialEnv.terrain),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    );
    terrainMesh.receiveShadow = true;
    threeScene.add(terrainMesh);
    const flashLight = new THREE.AmbientLight(0xffffff, 0);
    threeScene.add(flashLight);

    // Mô hình máy quay kéo được: thân + ống kính + điểm nhìn + khung chóp.
    // Mô hình xây theo trục +Z (ống kính nhô về +Z) để lookAt hướng về điểm nhìn.
    const camModel = new THREE.Group();
    const camBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.26, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 }),
    );
    camBody.userData.camPart = "body";
    camModel.add(camBody);
    const camLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.28, 20),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 }),
    );
    camLens.rotation.x = Math.PI / 2;
    camLens.position.z = 0.38;
    camLens.userData.camPart = "body";
    camModel.add(camLens);
    const camRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.02, 10, 24),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
    );
    camRing.position.z = 0.52;
    camRing.userData.camPart = "body";
    camModel.add(camRing);
    const camTargetHandle = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    );
    camTargetHandle.userData.camPart = "target";
    threeScene.add(camModel);
    threeScene.add(camTargetHandle);
    // Khung chóp: 12 đoạn × 2 đầu = 24 đỉnh, cập nhật mỗi khung hình.
    const camFrustumGeo = new THREE.BufferGeometry();
    camFrustumGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(24 * 3), 3),
    );
    const camFrustum = new THREE.LineSegments(
      camFrustumGeo,
      new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 }),
    );
    camFrustum.frustumCulled = false;
    threeScene.add(camFrustum);

    threeRef.current = {
      renderer,
      scene: threeScene,
      orbitCam,
      shotCam,
      controls,
      composer,
      renderPass,
      bloomPass,
      bokehPass,
      afterimagePass,
      groups: new Map(),
      characters: new Map(),
      mixers: new Map(),
      effectGroups: new Map(),
      previewPoints: null,
      sunLight: sun,
      sunVisual,
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
      camModel,
      camFrustum,
      camTargetHandle,
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
      composer.setSize(w, h);
      // Chất lượng phát sáng "một nửa": xử lý mờ ở độ phân giải thấp hơn.
      const pr = Math.min(2, window.devicePixelRatio || 1);
      if (scenePostRef.current.bloom.quality === "half") {
        bloomPass.setSize((w * pr) / 2, (h * pr) / 2);
      }
      bokehUniforms(bokehPass)["aspect"].value = orbitCam.aspect;
      const sf = safeFrameRef.current;
      if (sf) {
        const aspect = exportAspectRef.current;
        if (aspect != null && aspect < 1) {
          const { frame } = verticalFrame(w, h);
          sf.style.width = `${frame.width}px`;
          sf.style.height = `${frame.height}px`;
        } else {
          let tw = w;
          let th = (w * 9) / 16;
          if (th > h) {
            th = h;
            tw = (h * 16) / 9;
          }
          sf.style.width = `${tw}px`;
          sf.style.height = `${th}px`;
        }
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // Chọn/kéo vật thể ngay trên khung 3D (S3)
    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let dragId: string | null = null;
    let dragMoved = false;
    let lastDragPosition: Vec3 | null = null;
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
            dragLockRef.current = true;
            controls.enabled = false;
            paintAtRef.current(hits[0].point.x, hits[0].point.z);
          }
        }
        return;
      }
      // Dời máy quay: chỉ handle của máy quay ăn chuột, không chọn vật.
      if (stateRef.current.camMoveMode) {
        const ctxNow = threeRef.current;
        if (ctxNow?.camModel && ctxNow?.camTargetHandle) {
          raycaster.setFromCamera(ndcOf(e), ctxNow.orbitCam);
          const hits = raycaster.intersectObjects(
            [ctxNow.camModel, ctxNow.camTargetHandle],
            true,
          );
          let part: string | null = null;
          for (const hit of hits) {
            let node: THREE.Object3D | null = hit.object;
            while (node) {
              if (typeof node.userData.camPart === "string") {
                part = node.userData.camPart;
                break;
              }
              node = node.parent;
            }
            if (part) break;
          }
          if (part === "body" || part === "target") {
            const st = stateRef.current;
            const cam = resolveShotCamera({
              draftDirty: st.draftCamDirty,
              draftTimeSec: st.draftCamTimeSec,
              draftPos: st.draftCamPos,
              draftTarget: st.draftCamTarget,
              keys: st.previz.cameraKeys,
              timeSec: st.timeSec,
            });
            const anchor = part === "body" ? cam.position : cam.target;
            const normal = new THREE.Vector3();
            ctxNow.orbitCam.getWorldDirection(normal);
            const grab = rayPlanePoint(
              { x: raycaster.ray.origin.x, y: raycaster.ray.origin.y, z: raycaster.ray.origin.z },
              { x: raycaster.ray.direction.x, y: raycaster.ray.direction.y, z: raycaster.ray.direction.z },
              { x: anchor.x, y: anchor.y, z: anchor.z },
              { x: normal.x, y: normal.y, z: normal.z },
            );
            camDragRef.current = {
              kind: part === "body" ? "pos" : "target",
              planePoint: new THREE.Vector3(anchor.x, anchor.y, anchor.z),
              planeNormal: normal,
              startPos: new THREE.Vector3(cam.position.x, cam.position.y, cam.position.z),
              startTarget: new THREE.Vector3(cam.target.x, cam.target.y, cam.target.z),
              grabPoint: grab
                ? new THREE.Vector3(grab.x, grab.y, grab.z)
                : new THREE.Vector3(anchor.x, anchor.y, anchor.z),
            };
            dragLockRef.current = true;
            controls.enabled = false;
          }
        }
        return;
      }
      const id = pickAt(e);
      if (id) {
        dragId = id;
        dragMoved = false;
        lastDragPosition = null;
        dragLockRef.current = true;
        controls.enabled = false;
        stageInteractRef.current?.onPick(id);
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      const camDrag = camDragRef.current;
      if (camDrag) {
        const ctxNow = threeRef.current;
        if (!ctxNow) return;
        raycaster.setFromCamera(ndcOf(e), ctxNow.orbitCam);
        const hit = rayPlanePoint(
          { x: raycaster.ray.origin.x, y: raycaster.ray.origin.y, z: raycaster.ray.origin.z },
          { x: raycaster.ray.direction.x, y: raycaster.ray.direction.y, z: raycaster.ray.direction.z },
          { x: camDrag.planePoint.x, y: camDrag.planePoint.y, z: camDrag.planePoint.z },
          { x: camDrag.planeNormal.x, y: camDrag.planeNormal.y, z: camDrag.planeNormal.z },
        );
        if (!hit) return;
        if (camDrag.kind === "pos") {
          // Pan: máy + điểm nhìn tịnh tiến cùng nhau, hướng nhìn giữ nguyên.
          const panned = panCameraDrag(
            { x: camDrag.startPos.x, y: camDrag.startPos.y, z: camDrag.startPos.z },
            { x: camDrag.startTarget.x, y: camDrag.startTarget.y, z: camDrag.startTarget.z },
            { x: camDrag.grabPoint.x, y: camDrag.grabPoint.y, z: camDrag.grabPoint.z },
            hit,
          );
          setDraftCamPos(panned.position);
          setDraftCamTarget(panned.target);
        } else setDraftCamTarget(hit);
        setDraftCamDirty(true);
        setDraftCamTimeSec(stateRef.current.timeSec);
        return;
      }
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
        lastDragPosition = {
          x: nx,
          y: heightAtGrid(envRef.current.terrain, nx, nz),
          z: nz,
        };
        dragMoved = true;
      }
    };
    const onPointerUp = () => {
      camDragRef.current = null;
      if (paintingRef.current) {
        paintingRef.current = false;
        commitBrushRef.current();
      }
      const completedDragId = dragId;
      dragId = null;
      if (dragMoved && lastDragPosition) {
        stageInteractRef.current?.onDragEnd(completedDragId ?? "", lastDragPosition);
      }
      dragMoved = false;
      lastDragPosition = null;
      dragLockRef.current = false;
      controls.enabled =
        stateRef.current.viewMode === "orbit" && !stateRef.current.camMoveMode;
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
      (composer as unknown as { dispose?: () => void }).dispose?.();
      (bloomPass as unknown as { dispose?: () => void }).dispose?.();
      (bokehPass as unknown as { dispose?: () => void }).dispose?.();
      (afterimagePass as unknown as { dispose?: () => void }).dispose?.();
      const camCtx = threeRef.current;
      if (camCtx?.camModel) {
        threeScene.remove(camCtx.camModel);
        camCtx.camModel.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry.dispose();
          const mat = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        });
      }
      if (camCtx?.camFrustum) {
        threeScene.remove(camCtx.camFrustum);
        camCtx.camFrustum.geometry.dispose();
        (camCtx.camFrustum.material as THREE.Material).dispose();
      }
      if (camCtx?.camTargetHandle) {
        threeScene.remove(camCtx.camTargetHandle);
        camCtx.camTargetHandle.geometry.dispose();
        (camCtx.camTargetHandle.material as THREE.Material).dispose();
      }
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      threeRef.current = null;
    };
  }, []);

  // ── Hậu kỳ (giai đoạn C): đồng bộ tham số bộ lọc khi cài đặt đổi ───
  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx?.composer) return;
    const post = scenePostRef.current;
    if (ctx.bloomPass) {
      ctx.bloomPass.enabled = post.bloom.enabled;
      ctx.bloomPass.strength = post.bloom.strength;
      ctx.bloomPass.radius = post.bloom.radius;
      ctx.bloomPass.threshold = post.bloom.threshold;
    }
    if (ctx.bokehPass) {
      ctx.bokehPass.enabled = post.dof.enabled;
      const uniforms = bokehUniforms(ctx.bokehPass);
      uniforms["focus"].value = post.dof.focus;
      uniforms["aperture"].value = post.dof.aperture;
      uniforms["maxblur"].value = post.dof.maxblur;
    }
    if (ctx.afterimagePass) {
      ctx.afterimagePass.enabled = post.afterimage.enabled;
      ctx.afterimagePass.uniforms["damp"].value = post.afterimage.damp;
    }
    // Đổi chất lượng phát sáng thì dựng lại kích thước bộ lọc.
    const w = mountRef.current?.clientWidth ?? 0;
    const h = mountRef.current?.clientHeight ?? 0;
    if (w > 0 && h > 0) {
      ctx.composer.setSize(w, h);
      const pr = Math.min(2, window.devicePixelRatio || 1);
      if (ctx.bloomPass && post.bloom.quality === "half") {
        ctx.bloomPass.setSize((w * pr) / 2, (h * pr) / 2);
      }
    }
  }, [scene.scenePost]);

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
    const env = scene.environment ?? DEFAULT_ENVIRONMENT;
    const sky = environmentSky(env);
    ctx.scene.background = new THREE.Color(sky.skyBg);
    ctx.sunLight.color.set(sky.sunColor);
    ctx.sunLight.intensity = sky.sunIntensity;
    const angle = ((env.time - 6) / 12) * Math.PI;
    const sunElevation = Math.sin(angle);
    ctx.sunLight.position.set(
      Math.cos(angle) * 20,
      Math.max(0.5, sunElevation * 18 + 2),
      6,
    );
    ctx.sunVisual.position.set(Math.cos(angle) * 70, sunElevation * 45 + 16, -52);
    ctx.sunVisual.visible = sunElevation > -0.28;
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
  }, [environment]);

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
                setModelLoadErrors((prev) => { const next = { ...prev }; delete next[obj.id]; return next; });
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
              .catch((error: unknown) => {
                if (ctx.groups.get(obj.id) !== holder) return;
                const message = error instanceof Error ? error.message : "Lỗi không xác định";
                setModelLoadErrors((prev) => ({ ...prev, [obj.id]: `Không hiển thị được model: ${message}` }));
                setModelClipNames((prev) => ({ ...prev, [obj.id]: [] }));
              });
          }
        } else if (obj.kind === "character") {
          const parts = buildPrevizCharacter(obj.color, obj.size);
          ctx.characters.set(obj.id, parts);
          ctx.groups.set(obj.id, parts.root);
          ctx.scene.add(parts.root);
        } else {
          const mesh = buildPrevizProp(obj.kind, obj.color, obj.size, obj.name);
          ctx.groups.set(obj.id, mesh);
          ctx.scene.add(mesh);
        }
      }
      // Tag ngay trong lượt tạo đầu tiên. Trước đây chỉ gắn objectId lên
      // group đã tồn tại từ lượt render sau, nhưng effect này chỉ chạy khi
      // previz đổi — model mở từ project vì thế nhìn thấy được mà không
      // thể raycast chọn/kéo trên sân khấu.
      const registeredGroup = ctx.groups.get(obj.id);
      if (registeredGroup) registeredGroup.userData.objectId = obj.id;
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
  const stateRef = useRef({ previz, timeSec, viewMode, draftDirty, draftPos, draftRotY, draftPose, selectedId, draftCamDirty, draftCamPos, draftCamTarget, draftCamTimeSec, previewFormula, previewStartSec, environment, camMoveMode, showCamModel, exportAspect });
  stateRef.current = { previz, timeSec, viewMode, draftDirty, draftPos, draftRotY, draftPose, selectedId, draftCamDirty, draftCamPos, draftCamTarget, draftCamTimeSec, previewFormula, previewStartSec, environment, camMoveMode, showCamModel, exportAspect };
  useEffect(() => {
    let raf = 0;
    let lastFrameMs = 0;
    const loop = (frameMs: number) => {
      raf = requestAnimationFrame(loop);
      const vrmDelta = lastFrameMs === 0
        ? 0
        : Math.min(0.1, Math.max(0, (frameMs - lastFrameMs) / 1000));
      lastFrameMs = frameMs;
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
          applyVrmExpressions(group, obj.expressions);
          updateLoadedVrms(group, vrmDelta);
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
      // Bản nháp chỉ áp tại giây đã sửa, còn lại dùng key đã lưu.
      const cam = resolveShotCamera({
        draftDirty: st.draftCamDirty,
        draftTimeSec: st.draftCamTimeSec,
        draftPos: st.draftCamPos,
        draftTarget: st.draftCamTarget,
        keys: st.previz.cameraKeys,
        timeSec: st.timeSec,
      });
      ctx.shotCam.position.set(cam.position.x, cam.position.y, cam.position.z);
      ctx.shotCam.lookAt(cam.target.x, cam.target.y, cam.target.z);
      // Mô hình máy quay: chỉ hiện ở góc tự do, bám đúng vị trí/điểm nhìn.
      if (ctx.camModel && ctx.camFrustum && ctx.camTargetHandle) {
        const showCam = st.viewMode === "orbit" && st.showCamModel;
        ctx.camModel.visible = showCam;
        ctx.camFrustum.visible = showCam;
        ctx.camTargetHandle.visible = showCam;
        if (showCam) {
          ctx.camModel.position.set(cam.position.x, cam.position.y, cam.position.z);
          ctx.camModel.lookAt(cam.target.x, cam.target.y, cam.target.z);
          ctx.camTargetHandle.position.set(cam.target.x, cam.target.y, cam.target.z);
          const aspect = st.exportAspect ?? 16 / 9;
          const segs = frustumLineSegments(
            cam.position,
            cam.target,
            45,
            aspect,
            0.3,
            frustumFar(cam.position, cam.target),
          );
          const attr = ctx.camFrustum.geometry.getAttribute(
            "position",
          ) as THREE.BufferAttribute;
          segs.forEach((s, i) => {
            attr.setXYZ(i * 2, s[0].x, s[0].y, s[0].z);
            attr.setXYZ(i * 2 + 1, s[1].x, s[1].y, s[1].z);
          });
          attr.needsUpdate = true;
        }
      }
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
      // Khóa góc xem khi đang kéo hoặc ở chế độ Dời máy quay: trước đây
      // dòng này bật lại OrbitControls mỗi khung hình nên kéo camera cũng
      // xoay cả khung hình theo con trỏ chuột.
      ctx.controls.enabled =
        st.viewMode === "orbit" && !st.camMoveMode && !dragLockRef.current;
      // Vẽ qua bộ xử lý hậu kỳ (phát sáng / mờ hậu cảnh / dư ảnh);
      // camera của bộ lọc bám theo camera đang xem (tự do hay camera phim).
      if (ctx.composer && ctx.renderPass) {
        ctx.renderPass.camera = activeCam;
        if (ctx.bokehPass) {
          ctx.bokehPass.camera = activeCam;
          // Focus pull: điểm nét chạy theo mốc thời gian của cảnh.
          const focusKeys = st.previz?.focusKeys;
          if (focusKeys && focusKeys.length > 0) {
            const f = sampleFocus(focusKeys, st.timeSec);
            if (f != null) {
              bokehUniforms(ctx.bokehPass)["focus"].value = f;
            }
          }
        }
        ctx.composer.render();
      } else {
        ctx.renderer.render(ctx.scene, activeCam);
      }
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
        // timeSec là thời gian NỘI DUNG: quay chậm thì đồng hồ nội dung
        // chạy chậm theo tốc độ cảnh, vòng lặp vẫn quay về đầu ở cuối cảnh.
        const next = prev + dt * sceneSpeed(scene);
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
    // Thời gian ghi THỰC TẾ = thời lượng nội dung / tốc độ (quay chậm
    // thì ghi lâu hơn); bản trộn tiếng đã chậm theo cùng tốc độ nên khớp.
    await new Promise((r) =>
      setTimeout(r, (duration / sceneSpeed(scene)) * 1000 + 150),
    );
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
                {exportAspect != null && exportAspect < 1
                  ? "KHUNG XUẤT 9:16"
                  : "KHUNG XUẤT 16:9"}
              </span>
              {exportAspect != null && exportAspect < 1 && (
                <div className="absolute left-[5%] top-[5%] h-[90%] w-[90%] border border-dashed border-white/25 rounded-[2px]">
                  <span className="absolute bottom-1 right-2 text-[10px] tracking-wide text-white/50">
                    KHUNG AN TOÀN
                  </span>
                </div>
              )}
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
                    const sameKindCount = previz.objects.filter((o) => o.kind === kind).length;
                    const spawnX = sameKindCount === 0
                      ? 0
                      : (sameKindCount % 2 === 1
                        ? Math.ceil(sameKindCount / 2)
                        : -Math.ceil(sameKindCount / 2)) * 1.4;
                    obj.keys[0] = {
                      ...obj.keys[0],
                      position: {
                        x: spawnX,
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

          {onScenePostChange && (
            <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2.5">
              <h3 className="text-[12px] font-semibold text-white/70">
                HẬU KỲ CẢNH — PHÁT SÁNG · MỜ HẬU CẢNH · DƯ ẢNH
              </h3>
              <p className="text-[11px] text-white/40 leading-relaxed">
                Tất cả mặc định tắt — bật lên mới tốn hiệu năng. Áp ngay
                trong khung xem trước và cả khi xuất WebM cảnh này.
              </p>
              <label className="flex items-center gap-2 text-[12px] text-white/70">
                <input
                  type="checkbox"
                  checked={scenePost.bloom.enabled}
                  onChange={(e) =>
                    onScenePostChange(
                      clampScenePostSettings({
                        ...scenePost,
                        bloom: { ...scenePost.bloom, enabled: e.currentTarget.checked },
                      }),
                    )
                  }
                  className="accent-amber-400"
                />
                Phát sáng (đèn, lửa, mặt trời lan sáng ra xung quanh)
              </label>
              {scenePost.bloom.enabled && (
                <div className="pl-6 space-y-1.5 text-[11px] text-white/55">
                  <label className="flex items-center gap-2">
                    <span className="w-24">Ngưỡng sáng</span>
                    <input type="range" min={0} max={1} step={0.05} value={scenePost.bloom.threshold}
                      onChange={(e) => onScenePostChange(clampScenePostSettings({ ...scenePost, bloom: { ...scenePost.bloom, threshold: Number(e.currentTarget.value) } }))}
                      className="flex-1 accent-amber-400" />
                    <span className="w-9 text-right tabular-nums text-white/70">{scenePost.bloom.threshold.toFixed(2)}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="w-24">Cường độ</span>
                    <input type="range" min={0} max={3} step={0.1} value={scenePost.bloom.strength}
                      onChange={(e) => onScenePostChange(clampScenePostSettings({ ...scenePost, bloom: { ...scenePost.bloom, strength: Number(e.currentTarget.value) } }))}
                      className="flex-1 accent-amber-400" />
                    <span className="w-9 text-right tabular-nums text-white/70">{scenePost.bloom.strength.toFixed(1)}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="w-24">Độ lan</span>
                    <input type="range" min={0} max={1} step={0.05} value={scenePost.bloom.radius}
                      onChange={(e) => onScenePostChange(clampScenePostSettings({ ...scenePost, bloom: { ...scenePost.bloom, radius: Number(e.currentTarget.value) } }))}
                      className="flex-1 accent-amber-400" />
                    <span className="w-9 text-right tabular-nums text-white/70">{scenePost.bloom.radius.toFixed(2)}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="w-24">Chất lượng</span>
                    <select
                      value={scenePost.bloom.quality}
                      onChange={(e) => onScenePostChange(clampScenePostSettings({ ...scenePost, bloom: { ...scenePost.bloom, quality: e.currentTarget.value as "full" | "half" } }))}
                      className="h-7 rounded-lg bg-white/5 border border-white/10 px-2 text-white/80"
                    >
                      <option value="full">Đủ (đẹp nhất)</option>
                      <option value="half">Một nửa (nhẹ, máy yếu)</option>
                    </select>
                  </label>
                </div>
              )}
              <label className="flex items-center gap-2 text-[12px] text-white/70">
                <input
                  type="checkbox"
                  checked={scenePost.dof.enabled}
                  onChange={(e) =>
                    onScenePostChange(
                      clampScenePostSettings({
                        ...scenePost,
                        dof: { ...scenePost.dof, enabled: e.currentTarget.checked },
                      }),
                    )
                  }
                  className="accent-sky-400"
                />
                Mờ hậu cảnh (chỉ giữ nét ở một khoảng cách)
              </label>
              {scenePost.dof.enabled && (
                <div className="pl-6 space-y-1.5 text-[11px] text-white/55">
                  <label className="flex items-center gap-2">
                    <span className="w-24">Điểm nét (m)</span>
                    <input type="range" min={0.5} max={30} step={0.5} value={scenePost.dof.focus}
                      onChange={(e) => onScenePostChange(clampScenePostSettings({ ...scenePost, dof: { ...scenePost.dof, focus: Number(e.currentTarget.value) } }))}
                      className="flex-1 accent-sky-400" />
                    <span className="w-9 text-right tabular-nums text-white/70">{scenePost.dof.focus.toFixed(1)}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="w-24">Độ mở</span>
                    <input type="range" min={0} max={0.1} step={0.005} value={scenePost.dof.aperture}
                      onChange={(e) => onScenePostChange(clampScenePostSettings({ ...scenePost, dof: { ...scenePost.dof, aperture: Number(e.currentTarget.value) } }))}
                      className="flex-1 accent-sky-400" />
                    <span className="w-9 text-right tabular-nums text-white/70">{scenePost.dof.aperture.toFixed(3)}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="w-24">Độ mờ tối đa</span>
                    <input type="range" min={0} max={0.05} step={0.005} value={scenePost.dof.maxblur}
                      onChange={(e) => onScenePostChange(clampScenePostSettings({ ...scenePost, dof: { ...scenePost.dof, maxblur: Number(e.currentTarget.value) } }))}
                      className="flex-1 accent-sky-400" />
                    <span className="w-9 text-right tabular-nums text-white/70">{scenePost.dof.maxblur.toFixed(3)}</span>
                  </label>
                </div>
              )}
              <label className="flex items-center gap-2 text-[12px] text-white/70">
                <input
                  type="checkbox"
                  checked={scenePost.afterimage.enabled}
                  onChange={(e) =>
                    onScenePostChange(
                      clampScenePostSettings({
                        ...scenePost,
                        afterimage: { ...scenePost.afterimage, enabled: e.currentTarget.checked },
                      }),
                    )
                  }
                  className="accent-violet-400"
                />
                Dư ảnh chuyển động (vệt mờ khi vật di chuyển nhanh)
              </label>
              {scenePost.afterimage.enabled && (
                <div className="pl-6 space-y-1.5 text-[11px] text-white/55">
                  <label className="flex items-center gap-2">
                    <span className="w-24">Độ giữ vệt</span>
                    <input type="range" min={0} max={1} step={0.05} value={scenePost.afterimage.damp}
                      onChange={(e) => onScenePostChange(clampScenePostSettings({ ...scenePost, afterimage: { ...scenePost.afterimage, damp: Number(e.currentTarget.value) } }))}
                      className="flex-1 accent-violet-400" />
                    <span className="w-9 text-right tabular-nums text-white/70">{scenePost.afterimage.damp.toFixed(2)}</span>
                  </label>
                </div>
              )}
            </section>
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
                  return <p className="text-[11px] text-white/40">{modelLoadErrors[selected.id] ?? "Đang nạp model…"}</p>;
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
                const selectedModelAsset = clipSourceAssets.find((a) => a.id === selected.modelAssetId);
                const expressionNames = selectedModelAsset?.inspection?.expressionNames ?? [];
                const sourceOptions = clipSourceAssets.filter(
                  (a) => a.id !== selected.modelAssetId && (a.inspection?.animations.length ?? 0) > 0,
                );
                return (
                  <>
                    {expressionNames.length > 0 && (
                      <div className="space-y-2 rounded-lg border border-white/5 bg-black/20 p-2">
                        <p className="text-[11px] font-medium text-white/60">BIỂU CẢM VRM</p>
                        {expressionNames.map((name) => (
                          <label key={name} className="flex items-center gap-2 text-[11px] text-white/55">
                            <span className="w-20 truncate" title={name}>{name}</span>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={selected.expressions?.[name] ?? 0}
                              onChange={(e) => updateObject(selected.id, {
                                expressions: {
                                  ...selected.expressions,
                                  [name]: Number(e.currentTarget.value),
                                },
                              })}
                              className="flex-1 accent-violet-400"
                            />
                            <span className="w-8 text-right tabular-nums">{Math.round((selected.expressions?.[name] ?? 0) * 100)}%</span>
                          </label>
                        ))}
                      </div>
                    )}
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
                <p className="text-[11px] text-white/40">{modelLoadErrors[selected.id] ?? "Đang nạp model…"}</p>
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
            {vecSliders("Vị trí camera", shownCam.position, (v) => {
              setDraftCamPos(v);
              setDraftCamDirty(true);
              setDraftCamTimeSec(timeSec);
            })}
            {vecSliders("Điểm nhìn", shownCam.target, (v) => {
              setDraftCamTarget(v);
              setDraftCamDirty(true);
              setDraftCamTimeSec(timeSec);
            })}
            <button
              onClick={() => {
                // Lưu bản nháp đúng tại giây đã sửa, không phải giây
                // playhead đang đứng (tránh lưu nháp vào sai thời điểm).
                const keyTimeSec = draftCamDirty ? draftCamTimeSec : timeSec;
                onChange({
                  ...previz,
                  cameraKeys: upsertPrevizCameraKey(previz.cameraKeys, {
                    id: newPrevizId("camkey"),
                    timeSec: Math.round(keyTimeSec * 100) / 100,
                    position: draftCamPos,
                    target: draftCamTarget,
                    easing,
                  }),
                });
                setDraftCamDirty(false);
              }}
              className="w-full h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 text-[12px] font-medium hover:bg-sky-500/30 flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" /> Đặt key camera tại {(draftCamDirty ? draftCamTimeSec : timeSec).toFixed(2)}s
            </button>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setCamMoveMode((v) => !v)}
                className={`px-2.5 h-8 rounded-lg border text-[12px] font-medium ${camMoveMode ? "bg-violet-500/30 border-violet-400/50 text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
              >
                {camMoveMode ? "Đang dời máy quay" : "Dời máy quay"}
              </button>
              <label className="flex items-center gap-1.5 text-[12px] text-white/60">
                <input
                  type="checkbox"
                  checked={showCamModel}
                  onChange={(e) => setShowCamModel(e.currentTarget.checked)}
                  className="accent-violet-400"
                />
                Hiện mô hình máy quay
              </label>
            </div>
            {camMoveMode && (
              <p className="text-[11px] text-white/40 leading-relaxed">
                Kéo thân máy để dời cả máy quay và điểm nhìn cùng nhau
                (hướng nhìn giữ nguyên), kéo quả cầu vàng ở điểm nhìn để
                đổi hướng ngắm. Ở chế độ này góc xem cố định, chỉ kéo được
                máy quay. Kéo xong bấm "Đặt key camera" để lưu góc này.
              </p>
            )}
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
            <div className="rounded-lg border border-white/10 bg-black/20 p-2.5 space-y-2">
              <div className="text-[11px] font-medium text-white/70">Cú máy mẫu</div>
              <p className="text-[11px] text-white/40 leading-relaxed">
                Chọn một cú máy, máy sẽ tự đặt key từ vị trí camera hiện
                tại — sửa từng key tay sau đó như bình thường.
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={shotPreset}
                  onChange={(e) => setShotPreset(e.currentTarget.value as ShotPresetId)}
                  className="h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-[12px] text-white/80 outline-none"
                >
                  {SHOT_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                {(shotPreset === "orbit" || shotPreset === "tracking") && (
                  <select
                    value={shotTargetId}
                    onChange={(e) => setShotTargetId(e.currentTarget.value)}
                    className="h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-[12px] text-white/80 outline-none"
                  >
                    <option value="">Mục tiêu: điểm nhìn hiện tại</option>
                    {previz.objects.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-1 text-[11px] text-white/45">
                  Dài
                  <input
                    type="number"
                    min={0.5}
                    max={30}
                    step={0.5}
                    value={shotDuration}
                    onChange={(e) => setShotDuration(Number(e.currentTarget.value) || 3)}
                    className="w-14 h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] text-white/80 outline-none"
                  />
                  s
                </label>
                {(shotPreset === "dolly-in" || shotPreset === "dolly-out") && (
                  <label className="flex items-center gap-1 text-[11px] text-white/45">
                    Khoảng (m, 0 = tự tính)
                    <input
                      type="number"
                      min={0}
                      max={20}
                      step={0.5}
                      value={shotDistance}
                      onChange={(e) => setShotDistance(Number(e.currentTarget.value) || 0)}
                      className="w-14 h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] text-white/80 outline-none"
                    />
                  </label>
                )}
                {(shotPreset === "crane-up" || shotPreset === "crane-down") && (
                  <label className="flex items-center gap-1 text-[11px] text-white/45">
                    Độ cao (m)
                    <input
                      type="number"
                      min={0.5}
                      max={10}
                      step={0.5}
                      value={shotHeight}
                      onChange={(e) => setShotHeight(Number(e.currentTarget.value) || 2)}
                      className="w-14 h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] text-white/80 outline-none"
                    />
                  </label>
                )}
                {shotPreset === "orbit" && (
                  <label className="flex items-center gap-1 text-[11px] text-white/45">
                    Góc quay (°)
                    <input
                      type="number"
                      min={10}
                      max={360}
                      step={10}
                      value={shotAngle}
                      onChange={(e) => setShotAngle(Number(e.currentTarget.value) || 90)}
                      className="w-16 h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] text-white/80 outline-none"
                    />
                  </label>
                )}
                {shotPreset === "focus-pull" && (
                  <>
                    <label className="flex items-center gap-1 text-[11px] text-white/45">
                      Nét từ (m)
                      <input
                        type="number"
                        min={0.1}
                        max={100}
                        step={0.5}
                        value={shotFocusFrom}
                        onChange={(e) => setShotFocusFrom(Number(e.currentTarget.value) || 3)}
                        className="w-14 h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] text-white/80 outline-none"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-white/45">
                      tới (m)
                      <input
                        type="number"
                        min={0.1}
                        max={100}
                        step={0.5}
                        value={shotFocusTo}
                        onChange={(e) => setShotFocusTo(Number(e.currentTarget.value) || 9)}
                        className="w-14 h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] text-white/80 outline-none"
                      />
                    </label>
                  </>
                )}
              </div>
              {shotPreset === "tracking" &&
                (() => {
                  const t = previz.objects.find((o) => o.id === shotTargetId);
                  return !t || t.keys.length < 2;
                })() && (
                  <p className="text-[11px] text-amber-300/85 leading-relaxed">
                    Đi theo cần một vật có ít nhất 2 key chuyển động — chọn
                    vật khác hoặc đặt thêm key cho vật trước.
                  </p>
                )}
              {shotPreset === "focus-pull" && (
                <p className="text-[11px] text-white/40 leading-relaxed">
                  Bấm thêm sẽ tự bật mờ hậu cảnh cho cảnh này để thấy điểm
                  nét chuyển dần.
                </p>
              )}
              <button
                disabled={
                  shotPreset === "tracking" &&
                  (() => {
                    const t = previz.objects.find((o) => o.id === shotTargetId);
                    return !t || t.keys.length < 2;
                  })()
                }
                onClick={() => {
                  const targetObj = previz.objects.find((o) => o.id === shotTargetId);
                  const targetPos = targetObj
                    ? samplePrevizObject(targetObj, timeSec).position
                    : draftCamTarget;
                  const pathSamples =
                    shotPreset === "tracking" && targetObj
                      ? targetObj.keys.map((k) => ({
                          timeSec: k.timeSec,
                          position: k.position,
                        }))
                      : undefined;
                  const built = buildShotKeys(shotPreset, {
                    startTimeSec: timeSec,
                    durationSec: shotDuration,
                    fromPosition: shownCam.position,
                    fromTarget: shownCam.target,
                    targetPosition: targetPos,
                    moveDistance: shotDistance > 0 ? shotDistance : undefined,
                    height: shotHeight,
                    angleDeg: shotAngle,
                    pathSamples,
                    focusFrom: shotFocusFrom,
                    focusTo: shotFocusTo,
                  });
                  let keys = previz.cameraKeys;
                  for (const k of built.keys) {
                    keys = upsertPrevizCameraKey(keys, k);
                  }
                  onChange({
                    ...previz,
                    cameraKeys: keys,
                    focusKeys:
                      built.focusKeys.length > 0
                        ? [...(previz.focusKeys ?? []), ...built.focusKeys]
                        : previz.focusKeys,
                  });
                  if (shotPreset === "focus-pull" && onScenePostChange) {
                    onScenePostChange({
                      ...scenePost,
                      dof: { ...scenePost.dof, enabled: true },
                    });
                  }
                }}
                className="w-full h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 text-[12px] font-medium hover:bg-sky-500/30 disabled:opacity-50"
              >
                Thêm cú máy từ {timeSec.toFixed(2)}s
              </button>
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
        fps={fps}
        timeSec={timeSec}
        selectedId={selectedId}
        playing={playing}
        onTogglePlayback={() => setPlaying((value) => !value)}
        onStep={(direction) => {
          setPlaying(false);
          setTimeSec((value) => Math.max(0, Math.min(duration, value + direction / fps)));
        }}
        onSelect={(id) => {
          setSelectedId(id);
          setDraftDirty(false);
        }}
        onAddKey={(trackId) => {
          if (trackId === "camera") {
            const sampled = samplePrevizCamera(previz.cameraKeys, timeSec);
            const nearest = previz.cameraKeys.reduce<(typeof previz.cameraKeys)[number] | undefined>((best, key) =>
              !best || Math.abs(key.timeSec - timeSec) < Math.abs(best.timeSec - timeSec) ? key : best,
            undefined);
            onChange({
              ...previz,
              cameraKeys: upsertPrevizCameraKey(previz.cameraKeys, {
                id: newPrevizId("cam"),
                timeSec,
                position: draftCamDirty ? draftCamPos : sampled.position,
                target: draftCamDirty ? draftCamTarget : sampled.target,
                easing: nearest?.easing ?? "linear",
              }),
            });
            setDraftCamDirty(false);
            return;
          }
          const target = previz.objects.find((obj) => obj.id === trackId);
          if (!target) return;
          const sampled = samplePrevizObject(target, timeSec);
          const nearest = target.keys.reduce<(typeof target.keys)[number] | undefined>((best, key) =>
            !best || Math.abs(key.timeSec - timeSec) < Math.abs(best.timeSec - timeSec) ? key : best,
          undefined);
          onChange({
            ...previz,
            objects: previz.objects.map((obj) => obj.id === target.id
              ? { ...obj, keys: upsertPrevizKey(obj.keys, {
                  id: newPrevizId("pkey"),
                  timeSec,
                  position: draftDirty && selectedId === target.id ? draftPos : sampled.position,
                  rotationY: draftDirty && selectedId === target.id ? draftRotY : sampled.rotationY,
                  poseId: nearest?.poseId ?? "stand",
                  glow: nearest?.glow ?? obj.glow ?? 0,
                  easing: nearest?.easing ?? "linear",
                }) }
              : obj),
          });
          if (selectedId === target.id) setDraftDirty(false);
        }}
        onMoveKey={(trackId, keyId, nextTime) => {
          const clamped = Math.max(0, Math.min(duration, Math.round(nextTime * fps) / fps));
          if (trackId === "camera") {
            onChange({
              ...previz,
              cameraKeys: previz.cameraKeys
                .map((key) => key.id === keyId ? { ...key, timeSec: clamped } : key)
                .sort((a, b) => a.timeSec - b.timeSec),
            });
          } else {
            onChange({
              ...previz,
              objects: previz.objects.map((obj) => obj.id === trackId
                ? { ...obj, keys: obj.keys
                    .map((key) => key.id === keyId ? { ...key, timeSec: clamped } : key)
                    .sort((a, b) => a.timeSec - b.timeSec) }
                : obj),
            });
          }
        }}
        onDeleteKey={(trackId, keyId) => {
          if (trackId === "camera") {
            if (previz.cameraKeys.length <= 1) return;
            onChange({ ...previz, cameraKeys: previz.cameraKeys.filter((key) => key.id !== keyId) });
          } else {
            onChange({
              ...previz,
              objects: previz.objects.map((obj) => obj.id === trackId && obj.keys.length > 1
                ? { ...obj, keys: obj.keys.filter((key) => key.id !== keyId) }
                : obj),
            });
          }
        }}
        onMoveDialogue={(id, startSec) => {
          const next = (scene.dialogue ?? []).map((line) => line.id === id
            ? { ...line, startSec: Math.min(startSec, Math.max(0, duration - line.durationSec)) }
            : line);
          onDialogueChange?.(next);
        }}
        onMoveAudio={(id, startSec) => {
          const next = (scene.audioClips ?? []).map((clip) => clip.id === id
            ? { ...clip, startSec: Math.min(startSec, Math.max(0, duration - clip.durationSec)) }
            : clip);
          onAudioChange?.(next);
        }}
        onMoveAction={(objectId, actionId, startSec) => {
          onChange({
            ...previz,
            objects: previz.objects.map((obj) => obj.id === objectId
              ? { ...obj, actions: (obj.actions ?? []).map((action) => action.id === actionId
                  ? { ...action, startSec: Math.min(startSec, Math.max(0, duration - action.durationSec)) }
                  : action) }
              : obj),
          });
        }}
        onSeek={(t) => {
          setPlaying(false);
          setTimeSec(Math.round(t * fps) / fps);
        }}
      />
    </div>
  );
}
