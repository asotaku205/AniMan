import type { AuthenticatedFetch } from "./auth-api";

export interface NovelAiResponse {
  summary?: string;
  issues?: string[];
  breakdown?: NovelBreakdown;
  model: string;
}

export interface NovelBreakdownPanel {
  prompt: string;
  sceneType: "action" | "dialogue" | "landscape" | "closeup" | "wide";
  dialogue: string[];
  note: string;
}

export interface NovelBreakdownPage {
  layout: "classic-5" | "action-4" | "splash-3" | "manga-6";
  panels: NovelBreakdownPanel[];
}

export interface NovelBreakdown {
  pages: NovelBreakdownPage[];
}

function errorMessage(status: number, fallback: string): string {
  if (status === 401) return "Cần đăng nhập để dùng AI.";
  if (status === 429) return "Đã hết lượt AI (5/phút, 30/ngày), thử lại sau.";
  return fallback;
}

async function callNovelAi(
  authenticatedFetch: AuthenticatedFetch,
  payload: {
    task: "summarize" | "consistency" | "breakdown";
    text: string;
    bible?: string;
    context?: string;
  },
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

/**
 * Tách một cảnh thành trang/khung manga (cầu nối Novel -> Manga)  -  kết
 * quả là bản nháp, client hiển thị để người dùng duyệt/sửa trước khi
 * tạo dự án Manga. Mỗi cảnh tốn 1 lượt AI.
 */
export async function breakdownScene(
  authenticatedFetch: AuthenticatedFetch,
  text: string,
  context?: string,
): Promise<NovelBreakdown> {
  const result = await callNovelAi(authenticatedFetch, {
    task: "breakdown",
    text,
    context,
  });
  if (!result.breakdown || result.breakdown.pages.length === 0) {
    throw new Error("AI không tách được cảnh thành trang manga, thử lại sau.");
  }
  return result.breakdown;
}
