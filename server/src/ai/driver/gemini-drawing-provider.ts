import { GoogleGenAI } from "@google/genai";
import {
  AiDrawingProvider,
  AiDrawingProviderError,
  AiDrawingProviderTransientError,
} from "./ai-drawing-driver.js";
import type { AiDrawingProviderRequest } from "./ai-drawing-driver.js";

/**
 * Gemini provider adapter for the AI drawing driver.
 *
 * Responsibilities:
 * - Converts the provider-neutral AiDrawingProviderRequest into the Gemini SDK payload.
 * - Handles inline image input (base64 + mimeType) according to the Gemini vision API.
 * - Requests structured JSON output from the model.
 * - Maps Gemini-specific error shapes into the application's error hierarchy so the
 *   driver can apply its retry/timeout policy without knowing provider internals.
 * - Returns the raw parsed JSON object; the driver validates it against the application
 *   response contract via parseAiDrawingResponse.
 *
 * What this adapter does NOT do:
 * - It never writes to or mutates the user's canvas.
 * - It never serialises prompts, images or responses to persistent storage.
 * - It never accepts arbitrary system instructions or model IDs from the client.
 * - It does not fall back to another provider on its own; that decision belongs to the
 *   application's model registry.
 */
const FALLBACK_MODELS = [
  "gemini-flash-latest",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
];

export function createGeminiDrawingProvider(apiKey: string): AiDrawingProvider {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("GEMINI_API_KEY is required to create the Gemini provider");
  }

  const client = new GoogleGenAI({ apiKey });

  return {
    async generate(
      request: AiDrawingProviderRequest,
      signal: AbortSignal,
    ): Promise<unknown> {
      // Gemini structured output: ask the model to return pure JSON.
      // The system instruction already mandates JSON-only output; adding
      // responseMimeType reinforces this at the SDK/API level.
      const contents = buildContents(request);

      const candidateModels = Array.from(
        new Set([request.modelId, ...FALLBACK_MODELS]),
      );

      let lastError: unknown;

      for (let i = 0; i < candidateModels.length; i++) {
        const modelToTry = candidateModels[i];
        if (signal.aborted) {
          throw new AiDrawingProviderError("Request aborted");
        }

        let response: Awaited<ReturnType<typeof client.models.generateContent>>;
        try {
          response = await client.models.generateContent({
            model: modelToTry,
            contents,
            config: {
              systemInstruction: request.systemInstruction,
              responseMimeType: "application/json",
              maxOutputTokens: request.maxOutputTokens,
              abortSignal: signal,
            },
          });
        } catch (error) {
          lastError = error;
          if (signal.aborted) {
            throw error;
          }

          const message = error instanceof Error ? error.message : String(error);
          const statusCode =
            (error as { statusCode?: number; status?: number }).statusCode ??
            (error as { statusCode?: number; status?: number }).status ??
            extractStatusFromMessage(message);

          // If model is discontinued/not found (404) or experiencing temporary overload (503/429)
          const isRecoverableWithNextModel =
            statusCode === 404 || statusCode === 503 || statusCode === 429;

          if (isRecoverableWithNextModel && i < candidateModels.length - 1) {
            console.warn(
              `[GeminiDrawingProvider] Model "${modelToTry}" returned ${statusCode || "error"}, attempting fallback to "${candidateModels[i + 1]}"...`,
            );
            continue;
          }

          throw mapGeminiError(error);
        }

        const text = response.text;
        if (typeof text !== "string" || text.trim().length === 0) {
          throw new AiDrawingProviderError(
            "Gemini returned an empty or non-text response",
          );
        }

        try {
          const cleanedText = cleanJsonText(text);
          const parsed = JSON.parse(cleanedText) as unknown;
          return normalizeGeminiOutput(parsed, request);
        } catch {
          throw new AiDrawingProviderError(
            "Gemini response could not be parsed as JSON",
          );
        }
      }

      throw mapGeminiError(lastError);
    },
  };
}

function cleanJsonText(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return cleaned.trim();
}

function clamp(
  num: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof num !== "number" || !Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

const ALLOWED_PRINCIPLES = new Set([
  "composition",
  "proportion",
  "color",
  "flow",
  "perspective",
  "lighting",
  "shadow",
]);

function normalizeGeminiOutput(
  raw: unknown,
  request: AiDrawingProviderRequest,
): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;

  const obj = raw as Record<string, unknown>;
  obj.schemaVersion = "1";
  obj.task = request.task;

  if (typeof obj.summary !== "string" || obj.summary.trim().length === 0) {
    obj.summary = "Gợi ý nét vẽ từ AI.";
  } else if (obj.summary.length > 600) {
    obj.summary = obj.summary.slice(0, 597) + "...";
  }

  // Filter hallucinated citations: only keep IDs in request.evidence
  const validEvidenceIds = new Set(request.evidence?.map((e) => e.id) ?? []);
  if (Array.isArray(obj.sourceIds)) {
    obj.sourceIds = obj.sourceIds.filter(
      (id) => typeof id === "string" && validEvidenceIds.has(id),
    );
  } else {
    obj.sourceIds = [];
  }

  // Normalize ghost strokes
  if (
    request.task === "stroke_guidance" ||
    request.task === "composition_overlay" ||
    request.task === "pose_guidance"
  ) {
    const rawStrokes = Array.isArray(obj.strokes) ? obj.strokes : [];
    const normalizedStrokes: Array<Record<string, unknown>> = [];

    for (const stroke of rawStrokes) {
      if (typeof stroke !== "object" || stroke === null) continue;
      if (normalizedStrokes.length >= 20) break;

      const s = stroke as Record<string, unknown>;
      let kind = s.kind;
      if (
        kind !== "path" &&
        kind !== "line" &&
        kind !== "ellipse" &&
        kind !== "rectangle"
      ) {
        if (Array.isArray(s.points) && s.points.length > 0) kind = "path";
        else if (s.from && s.to) kind = "line";
        else if (s.region) kind = "ellipse";
        else kind = "path";
      }

      const style = ALLOWED_PRINCIPLES.has(s.style as string)
        ? (s.style as string)
        : "flow";
      const opacity = clamp(s.opacity, 0.05, 0.25, 0.15);
      const strokeWidth = clamp(s.strokeWidth, 0.002, 0.02, 0.005);
      const dashed = typeof s.dashed === "boolean" ? s.dashed : undefined;

      if (kind === "path") {
        const rawPoints = Array.isArray(s.points) ? s.points : [];
        const points: Array<{ x: number; y: number }> = [];
        for (const pt of rawPoints) {
          if (typeof pt !== "object" || pt === null) continue;
          if (points.length >= 30) break;
          const p = pt as Record<string, unknown>;
          points.push({
            x: clamp(p.x, 0, 1, 0.5),
            y: clamp(p.y, 0, 1, 0.5),
          });
        }
        if (points.length === 0) continue;
        normalizedStrokes.push({
          kind: "path",
          points,
          style,
          opacity,
          strokeWidth,
          ...(dashed !== undefined ? { dashed } : {}),
        });
      } else if (kind === "line") {
        if (
          !s.from ||
          !s.to ||
          typeof s.from !== "object" ||
          typeof s.to !== "object"
        )
          continue;
        const fromRaw = s.from as Record<string, unknown>;
        const toRaw = s.to as Record<string, unknown>;
        normalizedStrokes.push({
          kind: "line",
          from: {
            x: clamp(fromRaw.x, 0, 1, 0.1),
            y: clamp(fromRaw.y, 0, 1, 0.1),
          },
          to: {
            x: clamp(toRaw.x, 0, 1, 0.9),
            y: clamp(toRaw.y, 0, 1, 0.9),
          },
          style,
          opacity,
          strokeWidth,
          ...(dashed !== undefined ? { dashed } : {}),
        });
      } else {
        if (!s.region || typeof s.region !== "object") continue;
        const r = s.region as Record<string, unknown>;
        const x = clamp(r.x, 0, 0.98, 0.1);
        const y = clamp(r.y, 0, 0.98, 0.1);
        const width = clamp(r.width, 0.01, 1 - x, 0.2);
        const height = clamp(r.height, 0.01, 1 - y, 0.2);
        normalizedStrokes.push({
          kind: kind as "ellipse" | "rectangle",
          region: { x, y, width, height },
          style,
          opacity,
          strokeWidth,
          ...(dashed !== undefined ? { dashed } : {}),
        });
      }
    }

    obj.strokes = normalizedStrokes;
    delete obj.recommendations;
    delete obj.findings;
  }

  return obj;
}

/**
 * Build the Gemini `contents` array for the request.
 * The panel image is sent as an inline base64 part so Gemini receives both the
 * user's text context and the canvas snapshot in a single turn.
 */
function buildContents(
  request: AiDrawingProviderRequest,
): Array<{ role: string; parts: Array<Record<string, unknown>> }> {
  const textPart: Record<string, unknown> = {
    text: request.prompt.trim().length > 0 ? request.prompt : "(panel gửi để đánh giá)",
  };

  const imagePart: Record<string, unknown> = {
    inlineData: {
      mimeType: request.image.mimeType,
      data: request.image.data,
    },
  };

  return [{ role: "user", parts: [textPart, imagePart] }];
}

/**
 * Map Gemini SDK/API error shapes to the application's AiDrawingProviderError
 * hierarchy so the driver can apply uniform retry/timeout handling.
 *
 * Transient errors (429, 503, network resets) → AiDrawingProviderTransientError
 *   → driver retries once then re-throws as ServiceUnavailableException.
 * Everything else → AiDrawingProviderError
 *   → driver maps to ServiceUnavailableException without retrying.
 */
function mapGeminiError(error: unknown): AiDrawingProviderError {
  if (error instanceof AiDrawingProviderError) {
    return error;
  }

  const message =
    error instanceof Error ? error.message : String(error);

  // Gemini SDK surfaces HTTP status codes in the error message or as a
  // statusCode/status property on the thrown Error-like object.
  const statusCode =
    (error as { statusCode?: number; status?: number }).statusCode ??
    (error as { statusCode?: number; status?: number }).status ??
    extractStatusFromMessage(message);

  if (statusCode === 429 || statusCode === 503) {
    return new AiDrawingProviderTransientError();
  }

  return new AiDrawingProviderError(
    `Gemini request failed (status ${statusCode ?? "unknown"})`,
  );
}

function extractStatusFromMessage(message: string): number | undefined {
  const match = /\b(4\d{2}|5\d{2})\b/.exec(message);
  return match ? Number(match[1]) : undefined;
}
