/**
 * Waveform — trích đỉnh sóng âm từ file video để vẽ lên timeline
 * (Slice S3). `computePeaks` là hàm thuần trên dữ liệu kênh (test
 * được); `extractWaveformPeaks` lo phần WebAudio decode ở trình duyệt.
 */

/** Thu gọn dữ liệu kênh thành `buckets` đỉnh trị tuyệt đối 0..1. */
export function computePeaks(
  channelData: Float32Array,
  buckets: number,
): number[] {
  if (buckets <= 0 || channelData.length === 0) return [];
  const peaks = new Array<number>(buckets).fill(0);
  const perBucket = channelData.length / buckets;
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * perBucket);
    const end = Math.max(start + 1, Math.floor((i + 1) * perBucket));
    let max = 0;
    for (let j = start; j < end && j < channelData.length; j++) {
      const v = Math.abs(channelData[j]);
      if (v > max) max = v;
    }
    peaks[i] = Math.min(1, max);
  }
  return peaks;
}

/**
 * Decode âm thanh của file video bằng WebAudio và tính peaks.
 * Trả null nếu trình duyệt không decode được định dạng (vd mkv).
 */
export async function extractWaveformPeaks(
  file: File,
  buckets = 1200,
): Promise<number[] | null> {
  try {
    const buffer = await file.arrayBuffer();
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const audio = await ctx.decodeAudioData(buffer);
    const peaks = computePeaks(audio.getChannelData(0), buckets);
    void ctx.close();
    return peaks;
  } catch {
    return null;
  }
}
