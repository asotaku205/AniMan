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

      let response: Awaited<ReturnType<typeof client.models.generateContent>>;
      try {
        response = await client.models.generateContent({
          model: request.modelId,
          contents,
          config: {
            systemInstruction: request.systemInstruction,
            responseMimeType: "application/json",
            maxOutputTokens: request.maxOutputTokens,
            // abortSignal is forwarded so the driver's timeout AbortController
            // can cancel an in-flight request cleanly.
            abortSignal: signal,
          },
        });
      } catch (error) {
        throw mapGeminiError(error);
      }

      const text = response.text;
      if (typeof text !== "string" || text.trim().length === 0) {
        throw new AiDrawingProviderError(
          "Gemini returned an empty or non-text response",
        );
      }

      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new AiDrawingProviderError(
          "Gemini response could not be parsed as JSON",
        );
      }
    },
  };
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
