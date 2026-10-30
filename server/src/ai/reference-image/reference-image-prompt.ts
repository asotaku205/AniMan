import {
  REFERENCE_IMAGE_LINE_STYLE,
  REFERENCE_IMAGE_SCENE_PHRASES,
} from "./reference-image.constants.js";
import { ReferenceImageSource } from "./reference-image.dto.js";

export interface AssembleReferenceImagePromptInput {
  /** Loại cảnh người dùng đã chọn trong Manga Studio. */
  sceneType: string;
  /** Nguồn sinh: prompt-only hay có kèm phác thảo. */
  source: ReferenceImageSource;
  /** Mô tả ý tưởng người dùng tự gõ (ô prompt). */
  userPrompt?: string;
  /**
   * Gợi ý sửa lấy từ kết quả drawing_review gần nhất: mỗi mục là một
   * câu "vấn đề -> cách sửa", đã cắt ngắn phía client. Chỉ dùng cho
   * nguồn có phác thảo; nguồn chỉ prompt không có gì để sửa.
   */
  fixHints?: string[];
  /** Kích thước ảnh đầu ra đã tính theo đúng tỉ lệ khung đang vẽ. */
  outputWidth?: number;
  /** Kích thước ảnh đầu ra đã tính theo đúng tỉ lệ khung đang vẽ. */
  outputHeight?: number;
  /**
   * Ghi chú sửa của người dùng về ảnh trước đó (tối đa 300 ký tự, đã
   * cắt ngắn): model hiểu sai chỗ nào. Ghi chú giữ nguyên văn, đặt ở
   * khối cuối prompt, áp dụng cho cả 2 nguồn. Không có thì bỏ hẳn.
   */
  correction?: string;
}

/** Câu bắt model theo mô tả theo đúng từng từ, không thay chủ thể khác. */
const LITERAL_DESCRIPTION_INSTRUCTION =
  "Follow the description literally, word by word. If the description names a place, draw that place, not a person. Do not substitute a different subject.";

/**
 * Cụm từ định dạng khung theo kích thước đầu ra đã tính: ảnh ngang thì
 * dặn lấp đầy chiều ngang, ảnh dọc thì dặn lấp đầy chiều dọc, để model
 * bố cục theo đúng tỉ lệ khung đang vẽ thay vì để khoảng trắng lớn.
 */
export function referenceImageFormatPhrase(
  outputWidth?: number,
  outputHeight?: number,
): string | null {
  if (
    !Number.isFinite(outputWidth) ||
    !Number.isFinite(outputHeight) ||
    !outputWidth ||
    !outputHeight
  ) {
    return null;
  }
  const ratio = outputWidth / outputHeight;
  if (ratio > 1.05) {
    return "Wide landscape format. Fill the full width and full height of the frame.";
  }
  if (ratio < 0.95) {
    return "Tall portrait format. Fill the full width and full height of the frame.";
  }
  return "Square format. Fill the full width and full height of the frame.";
}

/**
 * Ghép prompt ẢNH gửi tới model klein, khác nhau theo nguồn.
 *
 * Model ảnh không phải chatbot: prompt phải là mô tả ảnh ngắn, đặt mô
 * tả của người dùng lên sớm, không phải khối hướng dẫn dài kiểu
 * "You are a drawing reference assistant... RESPONSE: Return the
 * image only plus one sentence" như bản cũ. Bản cũ chôn mô tả của
 * người dùng sau hơn 200 từ hướng dẫn, nên nguồn chỉ prompt sai
 * prompt, trong khi 2 nguồn có phác thảo vẫn đúng nhờ ảnh neo giữ.
 *
 * - Chỉ prompt: phong cách nét vẽ + định dạng khung (ngang/dọc/vuông,
 *   theo đúng tỉ lệ khung đang vẽ) + loại cảnh + câu theo đúng từng từ
 *   + "Draw this scene" + mô tả của người dùng. Không có phác thảo,
 *   không có gợi ý sửa, không được thêm nhân vật/đạo cụ/nền ngoài mô tả.
 * - Có phác thảo: phong cách nét vẽ + định dạng khung + lệnh dọn và sửa
 *   phác thảo kèm theo + câu theo đúng từng từ + loại cảnh + mô tả +
 *   gợi ý sửa. Giữ nguyên bố cục, tư thế, khung hình của phác thảo, chỉ
 *   sửa phần giải phẫu sai rõ ràng.
 * - Loại cảnh "auto" thì bỏ hẳn, không gửi chữ "auto".
 * - Có ghi chú sửa thì thêm khối cuối, cho cả 2 nguồn: ghi chú của
 *   người dùng giữ nguyên văn, dặn vẽ lại từ đầu theo mô tả gốc và
 *   ghi chú, không lặp lại lỗi cũ.
 *
 * Client không bao giờ được gửi prompt này: server tự ghép từ hằng số
 * của chính nó.
 */
export function assembleReferenceImagePrompt(
  input: AssembleReferenceImagePromptInput,
): string {
  const parts: string[] = [REFERENCE_IMAGE_LINE_STYLE];
  const formatPhrase = referenceImageFormatPhrase(
    input.outputWidth,
    input.outputHeight,
  );
  if (formatPhrase) {
    parts.push(formatPhrase);
  }
  const scenePhrase = REFERENCE_IMAGE_SCENE_PHRASES[input.sceneType];
  if (scenePhrase) {
    parts.push(scenePhrase);
  }
  const userPrompt = input.userPrompt?.trim();
  const correction = input.correction?.trim();
  if (input.source === ReferenceImageSource.Prompt) {
    parts.push(LITERAL_DESCRIPTION_INSTRUCTION);
    if (userPrompt) {
      parts.push(`Draw this scene: ${userPrompt}`);
    }
    parts.push(
      "Draw only what is described above. Do not add characters, props, or backgrounds that were not described.",
    );
  } else {
    parts.push(
      "Clean up and correct the attached sketch into a finished reference drawing. Keep the exact composition, camera angle, character pose, and framing of the sketch. Fix only anatomy and proportions that are clearly wrong (head size, limb length, joint placement, symmetry). If the sketch is incomplete, complete only the lines needed to make the existing pose readable, and leave the rest simple.",
    );
    parts.push(LITERAL_DESCRIPTION_INSTRUCTION);
    if (userPrompt) {
      parts.push(`User description: ${userPrompt}`);
    }
    const fixHints = (input.fixHints ?? [])
      .map((hint) => hint.trim())
      .filter((hint) => hint.length > 0);
    if (fixHints.length > 0) {
      parts.push(
        "Fix these specific problems in the sketch, keeping the composition, pose, and framing exactly as drawn:\n" +
          fixHints.map((hint) => `- ${hint}`).join("\n"),
      );
    }
  }
  if (correction) {
    parts.push(
      `Correction from the user about the previous image. The previous image was wrong in this way: ${correction}. Redraw from scratch following the original description and this correction. Do not repeat the previous mistake. Follow the description literally, word by word. If the description names a place, draw that place, not a person.`,
    );
  }
  return parts.join("\n\n");
}
