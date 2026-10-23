/**
 * Motion prompt (bản tool, không AI): người dùng mô tả chuyển động bằng
 * lời ("phóng to dần vào mặt nhân vật") → chấm điểm từ khoá trên thư
 * viện preset có sẵn → gợi ý preset phù hợp nhất để ÁP DỤNG và sửa tiếp.
 * Deterministic, miễn phí, không tốn quota — bản AI hiểu ngữ nghĩa sâu
 * hơn có thể thay thế sau này qua cùng giao diện gợi ý này.
 */

import { CAMERA_PRESETS, LAYER_PRESETS } from "./motionPresets";

export interface MotionSuggestion {
  target: "camera" | "layer";
  presetId: string;
  name: string;
  score: number;
}

const KEYWORDS: Record<string, string[]> = {
  "ken-burns-in": ["phóng to", "phóng vào", "zoom in", "zoom vào", "cận cảnh dần", "đẩy vào", "tiến gần", "push in"],
  "ken-burns-out": ["thu nhỏ", "thu ra", "zoom out", "toàn cảnh dần", "rút ra", "pull back", "xa dần"],
  "pan-left": ["lia trái", "pan left", "quét trái", "sang trái"],
  "pan-right": ["lia phải", "pan right", "quét phải", "sang phải"],
  "push-in-fast": ["đẩy nhanh", "lao vào", "căng thẳng", "bất ngờ", "giật", "push-in", "xộc vào"],
  "shake-light": ["rung", "chấn động", "run", "shake", "động đất", "va chạm", "hồi hộp"],
  "float-in": ["trôi vào", "hiện lên", "mờ dần hiện", "xuất hiện nhẹ", "fade in", "bay lên"],
  "pop-in": ["bật vào", "nảy vào", "pop", "ló ra", "nhảy ra"],
  "slide-in-left": ["trượt vào", "bước vào", "đi vào từ trái", "slide in", "vào khung"],
  "fade-out": ["mờ dần", "biến mất", "kết thúc", "fade out", "tan biến", "chìm dần"],
};

/** Gợi ý tối đa `limit` preset từ mô tả, xếp theo điểm khớp từ khoá. */
export function suggestMotionPresets(
  description: string,
  limit = 3,
): MotionSuggestion[] {
  const text = description.toLowerCase().trim();
  if (!text) return [];
  const results: MotionSuggestion[] = [];
  const consider = (
    target: "camera" | "layer",
    presetId: string,
    name: string,
  ) => {
    const words = KEYWORDS[presetId] ?? [];
    let score = 0;
    for (const kw of words) {
      if (text.includes(kw)) score += kw.length; // khớp cụm dài đáng tin hơn
    }
    if (score > 0) results.push({ target, presetId, name, score });
  };
  for (const p of CAMERA_PRESETS) consider("camera", p.id, p.name);
  for (const p of LAYER_PRESETS) consider("layer", p.id, p.name);
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
