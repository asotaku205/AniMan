/**
 * Âm thanh tổng của phim (giai đoạn D): nhạc nền tự hạ xuống dưới thoại
 * + cân âm lượng toàn phim về một mức chuẩn. Toàn hàm thuần, test được;
 * bản trộn (filmAudio) và phát thử (filmPreview) dùng chung.
 *
 * Lưu ý trung thực: cân mức ở đây theo đỉnh + mẫu (peak), không phải
 * đo LUFS chuẩn phòng thu — đủ để phim không cảnh to cảnh nhỏ và
 * không vỡ tiếng, không tự nhận là chuẩn phát sóng.
 */

export interface AudioMasterSettings {
  enabled: boolean;
  /** Mức nhạc còn lại khi có thoại (0..1 — 0.25 nghĩa là còn 25%). */
  duckLevel: number;
  /** Thời gian hạ nhạc xuống (giây). */
  attackSec: number;
  /** Thời gian nhạc trở lại sau thoại (giây). */
  releaseSec: number;
  /** Đỉnh mục tiêu sau khi cân (0..1 — 0.89 ≈ -1dB). */
  targetPeak: number;
  /** Hệ số khuếch đại tối đa khi cân (tránh thổi phồng tiếng nhỏ). */
  maxGain: number;
}

export const DEFAULT_AUDIO_MASTER: AudioMasterSettings = {
  enabled: true,
  duckLevel: 0.25,
  attackSec: 0.15,
  releaseSec: 0.4,
  targetPeak: 0.89,
  maxGain: 3,
};

export function audioMasterOf(project: {
  master?: AudioMasterSettings;
}): AudioMasterSettings {
  const m = project.master;
  if (!m) return DEFAULT_AUDIO_MASTER;
  const clamp = (v: number, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.min(max, Math.max(min, v))
      : fallback;
  return {
    enabled: m.enabled !== false,
    duckLevel: clamp(m.duckLevel, 0.05, 0.9, 0.25),
    attackSec: clamp(m.attackSec, 0.02, 1, 0.15),
    releaseSec: clamp(m.releaseSec, 0.05, 2, 0.4),
    targetPeak: clamp(m.targetPeak, 0.5, 0.99, 0.89),
    maxGain: clamp(m.maxGain, 1, 10, 3),
  };
}

export interface DuckWindow {
  startSec: number;
  endSec: number;
}

/** Gộp các khoảng thoại chồng lấp, nới mỗi đầu một chút cho hạ/nhả êm. */
export function mergeDuckWindows(
  windows: readonly DuckWindow[],
  padSec = 0.1,
): DuckWindow[] {
  const raw = windows
    .map((w) => ({
      startSec: Math.max(0, w.startSec - padSec),
      endSec: Math.max(0, w.endSec + padSec),
    }))
    .filter((w) => w.endSec > w.startSec)
    .sort((a, b) => a.startSec - b.startSec);
  const merged: DuckWindow[] = [];
  for (const w of raw) {
    const last = merged[merged.length - 1];
    if (last && w.startSec <= last.endSec) {
      last.endSec = Math.max(last.endSec, w.endSec);
    } else {
      merged.push({ ...w });
    }
  }
  return merged;
}

/**
 * Đường cong âm lượng nhạc nền: [thời gian, hệ số] — bắt đầu ở mức gốc,
 * hạ dần trong attackSec khi vào thoại, giữ mức hạ suốt thoại, nhả dần
 * trong releaseSec sau thoại, và tắt dần 2 giây cuối phim (như trước).
 */
export function bgmGainEnvelope(
  windows: readonly DuckWindow[],
  totalSec: number,
  baseVolume: number,
  settings: AudioMasterSettings,
): Array<[number, number]> {
  const merged = mergeDuckWindows(windows);
  const ducked = baseVolume * settings.duckLevel;
  const pts: Array<[number, number]> = [[0, baseVolume]];
  const push = (t: number, v: number) => {
    const last = pts[pts.length - 1];
    const ct = Math.min(Math.max(0, t), Math.max(0, totalSec));
    if (last && Math.abs(last[0] - ct) < 1e-6) {
      last[1] = v;
      return;
    }
    pts.push([ct, v]);
  };
  for (const w of merged) {
    const downStart = Math.max(0, w.startSec - settings.attackSec);
    const downEnd = w.startSec;
    const upStart = w.endSec;
    const upEnd = w.endSec + settings.releaseSec;
    push(downStart, baseVolume);
    push(downEnd, ducked);
    push(upStart, ducked);
    push(upEnd, baseVolume);
  }
  // Tắt dần 2 giây cuối phim.
  const fadeStart = Math.max(0, totalSec - 2);
  push(fadeStart, baseVolume);
  push(totalSec, 0.0001);
  return pts.sort((a, b) => a[0] - b[0]);
}

/** Giá trị đường cong tại t (nội suy tuyến tính giữa hai mốc). */
export function gainAtEnvelope(
  envelope: ReadonlyArray<readonly [number, number]>,
  t: number,
): number {
  if (envelope.length === 0) return 1;
  if (t <= envelope[0][0]) return envelope[0][1];
  const last = envelope[envelope.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 0; i < envelope.length - 1; i++) {
    const [t0, v0] = envelope[i];
    const [t1, v1] = envelope[i + 1];
    if (t >= t0 && t <= t1) {
      const k = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * k;
    }
  }
  return last[1];
}

/** Đỉnh lớn nhất qua mọi kênh. */
export function measurePeak(channels: readonly Float32Array[]): number {
  let peak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const v = Math.abs(ch[i]);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

/** Hệ số cân về đỉnh mục tiêu (im lặng → 1, không vượt maxGain). */
export function computeMasterGain(
  peak: number,
  settings: AudioMasterSettings,
): number {
  if (!(peak > 0)) return 1;
  return Math.min(settings.maxGain, settings.targetPeak / peak);
}

/**
 * Cân các kênh tại chỗ về đỉnh mục tiêu + kẹp chống vỡ (±0.99).
 * Trả về hệ số đã áp.
 */
export function normalizeChannels(
  channels: Float32Array[],
  settings: AudioMasterSettings,
): number {
  const gain = computeMasterGain(measurePeak(channels), settings);
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      let v = ch[i] * gain;
      if (v > 0.99) v = 0.99;
      else if (v < -0.99) v = -0.99;
      ch[i] = v;
    }
  }
  return gain;
}
