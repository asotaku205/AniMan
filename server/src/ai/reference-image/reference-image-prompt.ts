import { REFERENCE_IMAGE_SYSTEM_PROMPT } from "./reference-image.constants.js";

export interface AssembleReferenceImagePromptInput {
  /** Loại cảnh người dùng đã chọn trong Manga Studio. */
  sceneType: string;
  /** Mô tả ý tưởng người dùng tự gõ (ô prompt). */
  userPrompt?: string;
  /**
   * Gợi ý sửa lấy từ kết quả drawing_review gần nhất: mỗi mục là một
   * câu "vấn đề -> cách sửa", đã cắt ngắn phía client. Chỉ là gợi ý
   * thêm vào prompt, không phải lệnh bắt buộc model phải làm theo.
   */
  fixHints?: string[];
}

/**
 * Ghép prompt gửi tới model: system prompt nguyên văn, loại cảnh, mô tả
 * của người dùng và danh sách lỗi cần sửa (nếu có). Client không bao giờ
 * được gửi system prompt: server tự ghép từ hằng số của chính nó.
 */
export function assembleReferenceImagePrompt(
  input: AssembleReferenceImagePromptInput,
): string {
  const parts: string[] = [REFERENCE_IMAGE_SYSTEM_PROMPT];
  parts.push(`Scene type: ${input.sceneType}.`);
  const userPrompt = input.userPrompt?.trim();
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
  return parts.join("\n\n");
}
