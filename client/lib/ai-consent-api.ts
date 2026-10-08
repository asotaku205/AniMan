export interface AiDrawingConsentStatus {
  eligible: boolean;
  ageConfirmedAt: string | null;
  noticeVersion: string | null;
  currentNoticeVersion: string;
  notice: string;
}

export class AiConsentApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AiConsentApiError";
  }
}

export type AuthenticatedFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function getAiDrawingConsent(
  authenticatedFetch: AuthenticatedFetch,
): Promise<AiDrawingConsentStatus> {
  return requestConsent(authenticatedFetch, "GET");
}

export function confirmAiDrawingConsent(
  authenticatedFetch: AuthenticatedFetch,
  noticeVersion: string,
): Promise<AiDrawingConsentStatus> {
  return requestConsent(authenticatedFetch, "POST", {
    ageConfirmed: true,
    dataNoticeAccepted: true,
    noticeVersion,
  });
}

export function revokeAiDrawingConsent(
  authenticatedFetch: AuthenticatedFetch,
): Promise<AiDrawingConsentStatus> {
  return requestConsent(authenticatedFetch, "DELETE");
}

async function requestConsent(
  authenticatedFetch: AuthenticatedFetch,
  method: "GET" | "POST" | "DELETE",
  body?: object,
): Promise<AiDrawingConsentStatus> {
  const response = await authenticatedFetch("/ai/consent", {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload: unknown = await readPayload(response);

  if (!response.ok) {
    throw new AiConsentApiError(getErrorMessage(payload), response.status);
  }
  if (!isConsentStatus(payload)) {
    throw new Error("Máy chủ trả về trạng thái đồng ý AI không hợp lệ.");
  }

  return payload;
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown): string {
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const message = payload.message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "Không thể tải trạng thái đồng ý sử dụng AI.";
}

function isConsentStatus(value: unknown): value is AiDrawingConsentStatus {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const status = value as Record<string, unknown>;
  return (
    typeof status.eligible === "boolean" &&
    (typeof status.ageConfirmedAt === "string" ||
      status.ageConfirmedAt === null) &&
    (typeof status.noticeVersion === "string" ||
      status.noticeVersion === null) &&
    typeof status.currentNoticeVersion === "string" &&
    typeof status.notice === "string"
  );
}
