import { AiDrawingTask } from "./ai-drawing-request.dto.js";

export const AI_DRAWING_RESPONSE_SCHEMA_VERSION = "1" as const;
export const MAX_AI_RESPONSE_SUMMARY_LENGTH = 600;
export const MAX_AI_RECOMMENDATIONS = 6;
export const MAX_AI_FINDINGS = 8;
export const MAX_AI_OVERLAY_PRIMITIVES = 12;
export const MAX_AI_SOURCE_IDS = 8;
export const MAX_AI_EXPLANATION_LENGTH = 400;

export type AiDrawingPrinciple =
  | "composition"
  | "proportion"
  | "color"
  | "flow"
  | "perspective"
  | "lighting"
  | "shadow";

export type AiOverlayStyle = AiDrawingPrinciple;

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface NormalizedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AiOverlayLine {
  kind: "line";
  from: NormalizedPoint;
  to: NormalizedPoint;
  style: AiOverlayStyle;
  opacity: number;
}

export interface AiOverlayEllipse {
  kind: "ellipse";
  region: NormalizedRegion;
  style: AiOverlayStyle;
  opacity: number;
}

export interface AiOverlayRectangle {
  kind: "rectangle";
  region: NormalizedRegion;
  style: AiOverlayStyle;
  opacity: number;
}

export type AiOverlayPrimitive =
  AiOverlayLine | AiOverlayEllipse | AiOverlayRectangle;

export interface AiDrawingResponseBase {
  schemaVersion: typeof AI_DRAWING_RESPONSE_SCHEMA_VERSION;
  task: AiDrawingTask;
  summary: string;
  sourceIds: string[];
}

export interface AiCompositionRecommendation {
  principle: AiDrawingPrinciple;
  explanation: string;
  overlay: AiOverlayPrimitive[];
}

export interface AiCompositionGuidanceResponse extends AiDrawingResponseBase {
  task: AiDrawingTask.CompositionGuidance;
  recommendations: AiCompositionRecommendation[];
}

export interface AiDrawingFinding {
  principle: AiDrawingPrinciple;
  region: NormalizedRegion;
  issue: string;
  recommendation: string;
  severity: "low" | "medium" | "high";
  confidence: number;
}

export interface AiDrawingReviewResponse extends AiDrawingResponseBase {
  task: AiDrawingTask.DrawingReview;
  findings: AiDrawingFinding[];
}

export type AiDrawingResponse =
  AiCompositionGuidanceResponse | AiDrawingReviewResponse;

export class AiDrawingResponseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiDrawingResponseValidationError";
  }
}

const PRINCIPLES = new Set<AiDrawingPrinciple>([
  "composition",
  "proportion",
  "color",
  "flow",
  "perspective",
  "lighting",
  "shadow",
]);

const RESPONSE_KEYS = new Set([
  "schemaVersion",
  "task",
  "summary",
  "sourceIds",
  "recommendations",
  "findings",
]);

const BASE_RESPONSE_KEYS = [
  "schemaVersion",
  "task",
  "summary",
  "sourceIds",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function requireExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
): void {
  if (
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !(key in value))
  ) {
    throw new AiDrawingResponseValidationError(
      `${path} must contain exactly: ${keys.join(", ")}`,
    );
  }
}

function requireString(
  value: unknown,
  path: string,
  maximumLength: number,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maximumLength
  ) {
    throw new AiDrawingResponseValidationError(
      `${path} must be a non-empty string of at most ${maximumLength} characters`,
    );
  }
}

function requirePrinciple(
  value: unknown,
  path: string,
): asserts value is AiDrawingPrinciple {
  if (
    typeof value !== "string" ||
    !PRINCIPLES.has(value as AiDrawingPrinciple)
  ) {
    throw new AiDrawingResponseValidationError(`${path} is not supported`);
  }
}

function requireUnitCoordinate(value: unknown, path: string): void {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new AiDrawingResponseValidationError(
      `${path} must be a finite number between 0 and 1`,
    );
  }
}

function validateRegion(value: unknown, path: string): void {
  if (!isRecord(value)) {
    throw new AiDrawingResponseValidationError(`${path} must be an object`);
  }
  requireExactKeys(value, ["x", "y", "width", "height"], path);

  for (const key of ["x", "y", "width", "height"] as const) {
    requireUnitCoordinate(value[key], `${path}.${key}`);
  }

  const { x, y, width, height } = value;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number" ||
    width <= 0 ||
    height <= 0 ||
    x + width > 1 ||
    y + height > 1
  ) {
    throw new AiDrawingResponseValidationError(
      `${path} must have positive dimensions and remain inside the canvas`,
    );
  }
}

function validateOverlay(value: unknown, path: string): void {
  if (!isRecord(value)) {
    throw new AiDrawingResponseValidationError(`${path} must be an object`);
  }

  if (value.kind === "line") {
    requireExactKeys(value, ["kind", "from", "to", "style", "opacity"], path);
    for (const pointKey of ["from", "to"] as const) {
      const point = value[pointKey];
      if (!isRecord(point)) {
        throw new AiDrawingResponseValidationError(
          `${path}.${pointKey} must be an object`,
        );
      }
      requireExactKeys(point, ["x", "y"], `${path}.${pointKey}`);
      requireUnitCoordinate(point.x, `${path}.${pointKey}.x`);
      requireUnitCoordinate(point.y, `${path}.${pointKey}.y`);
    }
  } else if (value.kind === "ellipse" || value.kind === "rectangle") {
    requireExactKeys(value, ["kind", "region", "style", "opacity"], path);
    validateRegion(value.region, `${path}.region`);
  } else {
    throw new AiDrawingResponseValidationError(
      `${path}.kind is not a supported overlay primitive`,
    );
  }

  requirePrinciple(value.style, `${path}.style`);
  if (
    typeof value.opacity !== "number" ||
    !Number.isFinite(value.opacity) ||
    value.opacity < 0.05 ||
    value.opacity > 0.3
  ) {
    throw new AiDrawingResponseValidationError(
      `${path}.opacity must be between 0.05 and 0.3`,
    );
  }
}

function validateSourceIds(
  value: unknown,
  availableSourceIds: ReadonlySet<string>,
): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.length > MAX_AI_SOURCE_IDS ||
    value.some(
      (sourceId) =>
        typeof sourceId !== "string" ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(sourceId) ||
        !availableSourceIds.has(sourceId),
    )
  ) {
    throw new AiDrawingResponseValidationError(
      "sourceIds must only reference retrieved knowledge sources",
    );
  }
}

function validateCompositionRecommendation(
  value: unknown,
  index: number,
): asserts value is AiCompositionRecommendation {
  const path = `recommendations[${index}]`;
  if (!isRecord(value)) {
    throw new AiDrawingResponseValidationError(`${path} must be an object`);
  }
  requireExactKeys(value, ["principle", "explanation", "overlay"], path);
  requirePrinciple(value.principle, `${path}.principle`);
  requireString(
    value.explanation,
    `${path}.explanation`,
    MAX_AI_EXPLANATION_LENGTH,
  );
  if (
    !Array.isArray(value.overlay) ||
    value.overlay.length > MAX_AI_OVERLAY_PRIMITIVES
  ) {
    throw new AiDrawingResponseValidationError(
      `${path}.overlay must contain at most ${MAX_AI_OVERLAY_PRIMITIVES} primitives`,
    );
  }
  value.overlay.forEach((primitive, primitiveIndex) =>
    validateOverlay(primitive, `${path}.overlay[${primitiveIndex}]`),
  );
}

function validateRecommendations(
  value: unknown,
): asserts value is AiCompositionRecommendation[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_AI_RECOMMENDATIONS
  ) {
    throw new AiDrawingResponseValidationError(
      `recommendations must contain between 1 and ${MAX_AI_RECOMMENDATIONS} items`,
    );
  }
  value.forEach(validateCompositionRecommendation);
}

function validateFinding(
  value: unknown,
  index: number,
): asserts value is AiDrawingFinding {
  const path = `findings[${index}]`;
  if (!isRecord(value)) {
    throw new AiDrawingResponseValidationError(`${path} must be an object`);
  }
  requireExactKeys(
    value,
    [
      "principle",
      "region",
      "issue",
      "recommendation",
      "severity",
      "confidence",
    ],
    path,
  );
  requirePrinciple(value.principle, `${path}.principle`);
  validateRegion(value.region, `${path}.region`);
  requireString(value.issue, `${path}.issue`, MAX_AI_EXPLANATION_LENGTH);
  requireString(
    value.recommendation,
    `${path}.recommendation`,
    MAX_AI_EXPLANATION_LENGTH,
  );
  if (
    value.severity !== "low" &&
    value.severity !== "medium" &&
    value.severity !== "high"
  ) {
    throw new AiDrawingResponseValidationError(
      `${path}.severity is not supported`,
    );
  }
  if (
    typeof value.confidence !== "number" ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1
  ) {
    throw new AiDrawingResponseValidationError(
      `${path}.confidence must be between 0 and 1`,
    );
  }
}

function validateFindings(value: unknown): asserts value is AiDrawingFinding[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_AI_FINDINGS
  ) {
    throw new AiDrawingResponseValidationError(
      `findings must contain between 1 and ${MAX_AI_FINDINGS} items`,
    );
  }
  value.forEach(validateFinding);
}

export function parseAiDrawingResponse(
  value: unknown,
  expectedTask: AiDrawingTask,
  availableSourceIds: ReadonlySet<string>,
): AiDrawingResponse {
  if (!isRecord(value) || !hasOnlyKeys(value, RESPONSE_KEYS)) {
    throw new AiDrawingResponseValidationError(
      "AI response must be an object using only the application response fields",
    );
  }

  const summary = value.summary;
  requireString(summary, "summary", MAX_AI_RESPONSE_SUMMARY_LENGTH);
  if (value.schemaVersion !== AI_DRAWING_RESPONSE_SCHEMA_VERSION) {
    throw new AiDrawingResponseValidationError(
      "AI response schema version is not supported",
    );
  }
  if (value.task !== expectedTask) {
    throw new AiDrawingResponseValidationError(
      "AI response task does not match the request task",
    );
  }
  const sourceIds = value.sourceIds;
  validateSourceIds(sourceIds, availableSourceIds);

  if (expectedTask === AiDrawingTask.CompositionGuidance) {
    requireExactKeys(
      value,
      [...BASE_RESPONSE_KEYS, "recommendations"],
      "response",
    );
    const recommendations = value.recommendations;
    validateRecommendations(recommendations);
    return {
      schemaVersion: AI_DRAWING_RESPONSE_SCHEMA_VERSION,
      task: AiDrawingTask.CompositionGuidance,
      summary,
      sourceIds,
      recommendations,
    };
  }

  requireExactKeys(value, [...BASE_RESPONSE_KEYS, "findings"], "response");
  const findings = value.findings;
  validateFindings(findings);
  return {
    schemaVersion: AI_DRAWING_RESPONSE_SCHEMA_VERSION,
    task: AiDrawingTask.DrawingReview,
    summary,
    sourceIds,
    findings,
  };
}
