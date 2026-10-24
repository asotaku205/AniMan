import type { AuthenticatedFetch } from "./auth-api";

export interface NovelAiResponse {
  summary?: string;
  issues?: string[];
  model: string;
}

function errorMessage(status: number, fallback: string): string {
  if (status === 401) return "Cần đăng nhập để dùng AI.";
  if (status === 429) return "Đã hết lượt AI (5/phút, 30/ngày), thử lại sau.";
  return fallback;
}

async function callNovelAi(
  authenticatedFetch: AuthenticatedFetch,
  payload: { task: "summarize" | "consistency"; text: string; bible?: string },
): Promise<NovelAiResponse> {
  const response = await authenticatedFetch("/ai/novel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    let message = errorMessage(
      response.status,
      `AI thất bại (HTTP ${response.status})`,
    );
    try {
      const data = (await response.json()) as { message?: string };
      if (data?.message && response.status !== 429) message = data.message;
    } catch {
      // giữ thông báo mặc định
    }
    throw new Error(message);
  }
  return (await response.json()) as NovelAiResponse;
}

/**
 * Tóm tắt cảnh (N3) — kết quả là bản nháp, client lưu vào aiSummary,
 * không ghi đè tóm tắt tay.
 */
export async function summarizeScene(
  authenticatedFetch: AuthenticatedFetch,
  text: string,
): Promise<string> {
  const result = await callNovelAi(authenticatedFetch, { task: "summarize", text });
  return result.summary ?? "";
}

/** Kiểm tra nhất quán của cảnh với sổ tay (N3) — trả về danh sách vấn đề. */
export async function checkSceneConsistency(
  authenticatedFetch: AuthenticatedFetch,
  text: string,
  bible: string,
): Promise<string[]> {
  const result = await callNovelAi(authenticatedFetch, {
    task: "consistency",
    text,
    bible,
  });
  return result.issues ?? [];
}
