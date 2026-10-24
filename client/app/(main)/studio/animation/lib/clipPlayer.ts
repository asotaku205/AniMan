/**
 * Bộ phát clip xương (Phase 4): lái AnimationMixer theo thời gian
 * timeline, không theo đồng hồ thật — preview và xuất WebM thấy cùng
 * một hành động.
 *
 * - Phát liên tục: mixer.update(dt) với dt = thay đổi của timeSec.
 * - Nhảy thời gian (kéo thanh trượt, phát lặp lại từ đầu): dừng hết,
 *   phát clip đang chọn và đặt đúng thời điểm bằng mixer.setTime().
 * - Đổi đoạn: chuyển mềm 0.25s (fade out/in); hết đoạn: fade out rồi
 *   trả xương về dáng gốc (bind pose).
 */

import * as THREE from "three";
import type { ActiveAction } from "./actionTrack";

export interface MixerState {
  mixer: THREE.AnimationMixer;
  clips: THREE.AnimationClip[];
  current: { clipName: string; action: THREE.AnimationAction } | null;
  fading: { action: THREE.AnimationAction; sinceSec: number } | null;
  bind: Map<
    THREE.Bone,
    { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }
  >;
  lastTimeSec: number;
  started: boolean;
}

/** Dựng mixer cho một model đã nạp; trả null khi model không có xương. */
export function createMixerState(
  root: THREE.Object3D,
  clips: THREE.AnimationClip[],
): MixerState | null {
  const bones = new Map<string, THREE.Bone>();
  root.traverse((obj) => {
    const skinned = obj as THREE.SkinnedMesh;
    if (!skinned.isSkinnedMesh || !skinned.skeleton) return;
    for (const bone of skinned.skeleton.bones) bones.set(bone.uuid, bone);
  });
  if (bones.size === 0) return null;
  const bind = new Map<
    THREE.Bone,
    { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }
  >();
  for (const bone of bones.values()) {
    bind.set(bone, {
      position: bone.position.clone(),
      quaternion: bone.quaternion.clone(),
      scale: bone.scale.clone(),
    });
  }
  return {
    mixer: new THREE.AnimationMixer(root),
    clips,
    current: null,
    fading: null,
    bind,
    lastTimeSec: 0,
    started: false,
  };
}

function restoreBind(state: MixerState): void {
  for (const [bone, t] of state.bind) {
    bone.position.copy(t.position);
    bone.quaternion.copy(t.quaternion);
    bone.scale.copy(t.scale);
  }
}

function configure(
  action: THREE.AnimationAction,
  loop: boolean,
  speed: number,
): void {
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  action.clampWhenFinished = !loop;
  action.timeScale = speed;
  action.enabled = true;
}

export function updateMixerState(
  state: MixerState,
  t: number,
  active: ActiveAction | null,
): void {
  const jump =
    !state.started || t < state.lastTimeSec || t - state.lastTimeSec > 0.5;
  const dt = jump ? 0 : t - state.lastTimeSec;
  state.lastTimeSec = t;
  state.started = true;

  const clip = active
    ? state.clips.find((c) => c.name === active.segment.clipName)
    : undefined;

  if (!clip) {
    if (state.current) {
      state.current.action.fadeOut(0.25);
      state.fading = { action: state.current.action, sinceSec: t };
      state.current = null;
    }
    if (jump) {
      state.mixer.stopAllAction();
      restoreBind(state);
      state.fading = null;
      return;
    }
    if (state.fading && t - state.fading.sinceSec >= 0.3) {
      state.mixer.stopAllAction();
      restoreBind(state);
      state.fading = null;
    }
    state.mixer.update(dt);
    return;
  }

  if (!active) return; // Không tới được đây (!clip đã return), chỉ để TS hẹp kiểu.
  const { loop, speed } = active.segment;
  let local = active.localSec;
  if (loop) {
    local = clip.duration > 0 ? ((local % clip.duration) + clip.duration) % clip.duration : 0;
  } else {
    local = Math.min(Math.max(0, local), clip.duration);
  }

  if (jump) {
    state.mixer.stopAllAction();
    state.fading = null;
    const action = state.mixer.clipAction(clip);
    configure(action, loop, speed);
    action.play();
    state.current = { clipName: clip.name, action };
    state.mixer.setTime(local);
    return;
  }

  if (state.current && state.current.clipName === clip.name) {
    configure(state.current.action, loop, speed);
  } else {
    if (state.current) state.current.action.fadeOut(0.25);
    const action = state.mixer.clipAction(clip);
    configure(action, loop, speed);
    action.reset().fadeIn(0.25).play();
    state.current = { clipName: clip.name, action };
    state.fading = null;
  }
  if (state.fading && t - state.fading.sinceSec >= 0.3) {
    state.fading.action.stop();
    state.fading = null;
  }
  state.mixer.update(dt);
}
