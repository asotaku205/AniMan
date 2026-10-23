/**
 * Clip âm thanh của cảnh (R2 — phòng âm thanh): logic thuần cho đoạn
 * tiếng hiệu ứng/nhạc riêng của cảnh — tạo mới, kẹp giá trị hợp lệ.
 * File tiếng thật nằm ở kho Blob với key `audio-<clipId>` (dùng chung
 * kho với bản thu thoại qua các hàm saveVoiceBlob/loadVoiceBlob).
 */

import type { SceneAudioClip } from "./animProject";

let clipCounter = 0;

export function newAudioClipId(): string {
  clipCounter += 1;
  return `aclip-${Date.now().toString(36)}-${clipCounter.toString(36)}`;
}

export function audioClipBlobKey(clipId: string): string {
  return `audio-${clipId}`;
}

export function createSceneAudioClip(input: {
  name: string;
  kind: SceneAudioClip["kind"];
  sourceDurationSec: number;
  startSec?: number;
}): SceneAudioClip {
  const source = Math.max(0.1, input.sourceDurationSec);
  return {
    id: newAudioClipId(),
    name: input.name,
    kind: input.kind,
    startSec: Math.max(0, input.startSec ?? 0),
    offsetSec: 0,
    durationSec: source,
    sourceDurationSec: source,
    volume: 1,
    fadeInSec: 0,
    fadeOutSec: 0,
  };
}

/**
 * Kẹp clip vào giới hạn hợp lệ: phần nghe được nằm trong file gốc, mốc
 * bắt đầu + độ dài không vượt cuối cảnh, fade không dài quá nửa clip.
 */
export function clampAudioClip(
  clip: SceneAudioClip,
  sceneDurationSec: number,
): SceneAudioClip {
  const source = Math.max(0.1, clip.sourceDurationSec);
  const offsetSec = Math.min(
    Math.max(0, clip.offsetSec),
    Math.max(0, source - 0.1),
  );
  let durationSec = Math.min(
    Math.max(0.1, clip.durationSec),
    source - offsetSec,
  );
  const startSec = Math.min(
    Math.max(0, clip.startSec),
    Math.max(0, sceneDurationSec - 0.1),
  );
  durationSec = Math.min(durationSec, Math.max(0.1, sceneDurationSec - startSec));
  const fadeMax = durationSec / 2;
  return {
    ...clip,
    sourceDurationSec: source,
    offsetSec: round2(offsetSec),
    durationSec: round2(durationSec),
    startSec: round2(startSec),
    volume: Math.min(1.5, Math.max(0, clip.volume)),
    fadeInSec: round2(Math.min(Math.max(0, clip.fadeInSec), fadeMax)),
    fadeOutSec: round2(Math.min(Math.max(0, clip.fadeOutSec), fadeMax)),
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
