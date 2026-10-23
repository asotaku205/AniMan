/**
 * QC Engine — kiểm tra phụ đề theo chuẩn Netflix Timed Text (Slice S4,
 * Sơn chốt: dựa theo Netflix làm mặc định, ngưỡng chỉnh được). Hàm
 * thuần: `validateCues` cho báo cáo, `applyMechanicalFixes` sửa các
 * lỗi cơ học an toàn (không đụng nội dung chữ).
 */

import type { CueV2 } from "./library";

export interface QcProfile {
  /** Ký tự/giây tối đa (Netflix người lớn: 20). */
  maxCps: number;
  /** Ký tự tối đa mỗi dòng (Netflix: 42). */
  maxCharsPerLine: number;
  /** Số dòng tối đa mỗi cue (Netflix: 2). */
  maxLines: number;
  /** Thời lượng cue tối thiểu, giây (Netflix: 5/6s ≈ 0,83). */
  minDurationSec: number;
  /** Thời lượng cue tối đa, giây (Netflix: 7). */
  maxDurationSec: number;
  /** Khoảng cách tối thiểu giữa 2 cue liên tiếp, tính bằng frame (Netflix: 2). */
  minGapFrames: number;
}

export const NETFLIX_QC_PROFILE: QcProfile = {
  maxCps: 20,
  maxCharsPerLine: 42,
  maxLines: 2,
  minDurationSec: 5 / 6,
  maxDurationSec: 7,
  minGapFrames: 2,
};

export type QcIssueKind =
  | "empty"
  | "cps"
  | "line-length"
  | "lines"
  | "duration-short"
  | "duration-long"
  | "overlap"
  | "gap"
  | "whitespace";

export interface QcIssue {
  cueId: string;
  kind: QcIssueKind;
  /** error = chặn xuất "đạt chuẩn"; warn = nên xem lại. */
  severity: "error" | "warn";
  message: string;
}

export const QC_KIND_LABEL: Record<QcIssueKind, string> = {
  empty: "Cue trống",
  cps: "CPS quá cao",
  "line-length": "Dòng quá dài",
  lines: "Quá nhiều dòng",
  "duration-short": "Cue quá ngắn",
  "duration-long": "Cue quá dài",
  overlap: "Chồng lấp cue sau",
  gap: "Gap < 2 frame",
  whitespace: "Thừa khoảng trắng",
};

/** CPS của 1 cue (không tính khoảng trắng — cùng cách tính ở bảng cue). */
export function cueCpsOf(cue: CueV2): number {
  const chars = cue.text.replace(/\s/g, "").length;
  return cue.durationSec > 0 ? chars / cue.durationSec : 0;
}

/** Kiểm tra toàn bộ cue của 1 tập theo profile. Mảng vào không cần sort. */
export function validateCues(
  cues: readonly CueV2[],
  profile: QcProfile,
  fps: number,
): QcIssue[] {
  const sorted = [...cues].sort((a, b) => a.startSec - b.startSec);
  const minGapSec = profile.minGapFrames / fps;
  const issues: QcIssue[] = [];

  sorted.forEach((cue, i) => {
    const text = cue.text ?? "";
    if (!text.trim()) {
      issues.push({
        cueId: cue.id,
        kind: "empty",
        severity: "warn",
        message: "Cue chưa có nội dung bản chính.",
      });
    }
    if (text !== text.trim() || / {2,}/.test(text) || text.split("\n").some((l) => l !== l.trim())) {
      issues.push({
        cueId: cue.id,
        kind: "whitespace",
        severity: "warn",
        message: "Có khoảng trắng thừa ở đầu/cuối hoặc giữa câu.",
      });
    }
    const lines = text.split("\n");
    if (lines.length > profile.maxLines) {
      issues.push({
        cueId: cue.id,
        kind: "lines",
        severity: "error",
        message: `${lines.length} dòng — chuẩn cho phép tối đa ${profile.maxLines}.`,
      });
    }
    lines.forEach((line, li) => {
      if (line.length > profile.maxCharsPerLine) {
        issues.push({
          cueId: cue.id,
          kind: "line-length",
          severity: "error",
          message: `Dòng ${li + 1} dài ${line.length} ký tự — tối đa ${profile.maxCharsPerLine}.`,
        });
      }
    });
    const cps = cueCpsOf(cue);
    if (text.trim() && cps > profile.maxCps) {
      issues.push({
        cueId: cue.id,
        kind: "cps",
        severity: "error",
        message: `CPS ${cps.toFixed(1)} — vượt ngưỡng ${profile.maxCps}, khán giả đọc không kịp.`,
      });
    }
    if (cue.durationSec < profile.minDurationSec) {
      issues.push({
        cueId: cue.id,
        kind: "duration-short",
        severity: "error",
        message: `Chỉ ${cue.durationSec.toFixed(2)}s — tối thiểu ${profile.minDurationSec.toFixed(2)}s.`,
      });
    }
    if (cue.durationSec > profile.maxDurationSec) {
      issues.push({
        cueId: cue.id,
        kind: "duration-long",
        severity: "warn",
        message: `${cue.durationSec.toFixed(1)}s — chuẩn tối đa ${profile.maxDurationSec}s.`,
      });
    }
    const next = sorted[i + 1];
    if (next) {
      const gap = next.startSec - (cue.startSec + cue.durationSec);
      if (gap < 0) {
        issues.push({
          cueId: cue.id,
          kind: "overlap",
          severity: "error",
          message: `Chồng lấp cue sau ${(-gap).toFixed(2)}s.`,
        });
      } else if (gap < minGapSec) {
        issues.push({
          cueId: cue.id,
          kind: "gap",
          severity: "warn",
          message: `Gap với cue sau chỉ ${(gap * fps).toFixed(0)} frame — tối thiểu ${profile.minGapFrames}.`,
        });
      }
    }
  });
  return issues;
}

/** Đếm lỗi theo loại (cho panel QC). */
export function countIssuesByKind(
  issues: readonly QcIssue[],
): Partial<Record<QcIssueKind, number>> {
  const out: Partial<Record<QcIssueKind, number>> = {};
  for (const issue of issues) out[issue.kind] = (out[issue.kind] ?? 0) + 1;
  return out;
}

/**
 * Sửa cơ học an toàn: (1) cắt khoảng trắng thừa; (2) cue quá ngắn —
 * kéo dài tới mức tối thiểu nếu không vi phạm gap với cue sau;
 * (3) chồng lấp — thu ngắn cue trước tới sát cue sau trừ gap tối thiểu.
 * Không sửa nội dung chữ/CPS (việc của người dịch). Trả mô tả đã sửa.
 */
export function applyMechanicalFixes(
  cues: readonly CueV2[],
  profile: QcProfile,
  fps: number,
): { cues: CueV2[]; applied: string[] } {
  const minGapSec = profile.minGapFrames / fps;
  const applied: string[] = [];
  const list = [...cues]
    .sort((a, b) => a.startSec - b.startSec)
    .map((c) => ({ ...c }));

  for (const cue of list) {
    const cleaned = cue.text
      .split("\n")
      .map((l) => l.trim().replace(/ {2,}/g, " "))
      .join("\n")
      .trim();
    if (cleaned !== cue.text) {
      cue.text = cleaned;
      applied.push(`Đã cắt khoảng trắng thừa ở cue ${cue.startSec.toFixed(1)}s`);
    }
  }
  for (let i = 0; i < list.length; i++) {
    const cue = list[i];
    const next = list[i + 1];
    const maxEnd = next ? next.startSec - minGapSec : Number.POSITIVE_INFINITY;
    if (cue.durationSec < profile.minDurationSec) {
      const wanted = profile.minDurationSec;
      const allowed = maxEnd - cue.startSec;
      if (allowed >= wanted) {
        cue.durationSec = wanted;
        applied.push(`Đã kéo cue ${cue.startSec.toFixed(1)}s lên ${wanted.toFixed(2)}s`);
      } else if (allowed > cue.durationSec) {
        cue.durationSec = allowed;
        applied.push(`Đã kéo cue ${cue.startSec.toFixed(1)}s tới sát cue sau`);
      }
    }
    const end = cue.startSec + cue.durationSec;
    if (next && end > next.startSec - minGapSec && next.startSec - minGapSec > cue.startSec + 0.1) {
      cue.durationSec = next.startSec - minGapSec - cue.startSec;
      applied.push(`Đã thu cue ${cue.startSec.toFixed(1)}s để hết chồng lấp`);
    }
  }
  return { cues: list, applied };
}

const PROFILE_KEY = "animan-qc-profile";

export function loadQcProfile(): QcProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return NETFLIX_QC_PROFILE;
    const parsed = JSON.parse(raw) as Partial<QcProfile>;
    return { ...NETFLIX_QC_PROFILE, ...parsed };
  } catch {
    return NETFLIX_QC_PROFILE;
  }
}

export function saveQcProfile(profile: QcProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* bỏ qua nếu localStorage bị chặn */
  }
}
