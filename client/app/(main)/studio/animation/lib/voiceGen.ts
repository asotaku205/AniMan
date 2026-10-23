/**
 * Cổng tạo giọng bằng AI cho dòng thoại — để NGỎ theo cùng triết lý với
 * cổng sinh video (videoGen.ts): hiện CHƯA có dịch vụ tạo giọng AI miễn
 * phí ổn định để nối vào, nên danh sách provider rỗng và giao diện ghi rõ
 * "chưa kết nối" thay vì giả lập kết quả. Khi có dịch vụ phù hợp (hoặc
 * ngân sách), đăng ký provider tại đây là đủ để mở tính năng.
 */

export interface VoiceGenProvider {
  id: string;
  label: string;
}

export const VOICE_GEN_PROVIDERS: VoiceGenProvider[] = [];

export function voiceGenStatus(): { connected: boolean; label: string } {
  if (VOICE_GEN_PROVIDERS.length > 0) {
    return {
      connected: true,
      label: `Đã kết nối: ${VOICE_GEN_PROVIDERS.map((p) => p.label).join(", ")}`,
    };
  }
  return {
    connected: false,
    label:
      "Chưa kết nối dịch vụ tạo giọng AI — hiện dùng giọng đọc thử của trình duyệt để nghe nhịp thoại, bản xuất phim dùng bản thu của bạn.",
  };
}

/**
 * Đọc thử một câu thoại bằng giọng có sẵn của trình duyệt (chỉ để nghe
 * nhịp/thời lượng — KHÔNG thu được vào bản xuất). Trả về false nếu trình
 * duyệt không hỗ trợ.
 */
export function speakPreview(text: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "vi-VN";
  const voice =
    synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("vi")) ??
    null;
  if (voice) utter.voice = voice;
  synth.speak(utter);
  return true;
}

export function stopPreview(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
