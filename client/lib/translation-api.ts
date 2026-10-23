import type { AuthenticatedFetch } from "./auth-api";

export type TranslationTargetLang = "en" | "ja" | "ko" | "zh" | "vi";

export const TRANSLATION_TARGET_OPTIONS: Array<{
  id: TranslationTargetLang;
  label: string;
}> = [
  { id: "en", label: "English" },
  { id: "ja", label: "Tiếng Nhật" },
  { id: "ko", label: "Tiếng Hàn" },
  { id: "zh", label: "Tiếng Trung" },
  { id: "vi", label: "Tiếng Việt" },
];

export interface TranslateDialoguePayload {
  targetLang: TranslationTargetLang;
  sceneName: string;
  sceneNote?: string;
  glossary?: string;
  lines: Array<{ id: string; text: string; speaker?: string }>;
}

export interface TranslateDialogueResponse {
  translations: Array<{ id: string; text: string }>;
  model: string;
}

/**
 * Dịch cả cảnh trong 1 lượt qua server (POST /ai/translate-dialogue).
 * Server giữ ngữ cảnh (ghi chú cảnh + glossary + các câu liên tiếp) và
 * dùng chung hạn mức AI với tính năng vẽ (5/phút, 30/ngày).
 */
export async function translateDialogue(
  authenticatedFetch: AuthenticatedFetch,
  payload: TranslateDialoguePayload,
): Promise<TranslateDialogueResponse> {
  const response = await authenticatedFetch("/ai/translate-dialogue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    let message = `Dịch thất bại (HTTP ${response.status})`;
    try {
      const data = (await response.json()) as { message?: string };
      if (data?.message) message = data.message;
    } catch {
      // giữ thông báo mặc định
    }
    throw new Error(message);
  }
  return (await response.json()) as TranslateDialogueResponse;
}
