"use client";

import { useState } from "react";
import { BadgeCheck, ChevronDown, ShieldAlert, Wrench } from "lucide-react";
import {
  NETFLIX_QC_PROFILE,
  QC_KIND_LABEL,
  countIssuesByKind,
  type QcIssue,
  type QcProfile,
} from "../../lib/qcEngine";

/**
 * Panel QC (Slice S4): báo cáo kiểm tra theo chuẩn Netflix — đếm lỗi
 * theo loại, bấm từng lỗi để nhảy tới cue, tự sửa lỗi cơ học, chỉnh
 * ngưỡng profile. Đạt chuẩn khi không còn lỗi mức error.
 */
export function QcPanel({
  issues,
  profile,
  onProfileChange,
  onFix,
  onJump,
}: {
  issues: QcIssue[];
  profile: QcProfile;
  onProfileChange: (profile: QcProfile) => void;
  onFix: () => void;
  onJump: (cueId: string) => void;
}) {
  const [openSettings, setOpenSettings] = useState(false);
  const errors = issues.filter((i) => i.severity === "error");
  const byKind = countIssuesByKind(issues);
  const passed = errors.length === 0;

  const numField = (
    label: string,
    key: keyof QcProfile,
    step: number,
  ) => (
    <label className="block text-[11px] text-white/50">
      {label}
      <input
        type="number"
        step={step}
        value={profile[key]}
        onChange={(e) =>
          onProfileChange({ ...profile, [key]: Number(e.currentTarget.value) })
        }
        className="mt-0.5 w-full h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none"
      />
    </label>
  );

  return (
    <div
      className={`rounded-2xl border p-4 space-y-3 ${
        passed
          ? "border-emerald-400/25 bg-emerald-500/[0.05]"
          : "border-amber-400/25 bg-[#0d0817]"
      }`}
    >
      <div className="flex items-center gap-2">
        {passed ? (
          <BadgeCheck className="w-4.5 h-4.5 text-emerald-300" />
        ) : (
          <ShieldAlert className="w-4.5 h-4.5 text-amber-300" />
        )}
        <h3 className="text-[13px] font-semibold flex-1">
          QC phụ đề — chuẩn Netflix
        </h3>
        <span className="text-[11px] text-white/45">
          {errors.length} lỗi · {issues.length - errors.length} cảnh báo
        </span>
      </div>

      {passed ? (
        <p className="text-[12px] text-emerald-200/80 leading-relaxed">
          {issues.length === 0
            ? "Toàn bộ cue đạt chuẩn. Sẵn sàng xuất bản."
            : "Không còn lỗi chặn — chỉ còn cảnh báo nên xem lại bên dưới."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(byKind).map(([kind, count]) => (
            <span
              key={kind}
              className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] text-white/70"
            >
              {QC_KIND_LABEL[kind as QcIssue["kind"]]}: {count}
            </span>
          ))}
        </div>
      )}

      {issues.length > 0 && (
        <div className="max-h-44 overflow-y-auto space-y-1">
          {issues.map((issue, i) => (
            <button
              key={`${issue.cueId}-${issue.kind}-${i}`}
              onClick={() => onJump(issue.cueId)}
              className="w-full text-left px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/[0.06] hover:border-fuchsia-400/40 text-[11px] leading-relaxed"
            >
              <span
                className={
                  issue.severity === "error" ? "text-rose-300" : "text-amber-200"
                }
              >
                {issue.severity === "error" ? "● Lỗi" : "● Cảnh báo"} —{" "}
                {QC_KIND_LABEL[issue.kind]}:{" "}
              </span>
              <span className="text-white/70">{issue.message}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onFix}
          className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10"
        >
          <Wrench className="w-3.5 h-3.5" /> Tự sửa lỗi cơ học
        </button>
        <button
          onClick={() => setOpenSettings((v) => !v)}
          className="flex items-center gap-1 px-3 h-8 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10"
        >
          Ngưỡng QC <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {JSON.stringify(profile) !== JSON.stringify(NETFLIX_QC_PROFILE) && (
          <button
            onClick={() => onProfileChange(NETFLIX_QC_PROFILE)}
            className="px-3 h-8 rounded-lg text-[12px] text-fuchsia-300 hover:text-fuchsia-200"
          >
            Về chuẩn Netflix
          </button>
        )}
      </div>

      {openSettings && (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/30 border border-white/[0.07] p-3">
          {numField("CPS tối đa", "maxCps", 1)}
          {numField("Ký tự/dòng tối đa", "maxCharsPerLine", 1)}
          {numField("Số dòng tối đa", "maxLines", 1)}
          {numField("Cue ngắn nhất (giây)", "minDurationSec", 0.1)}
          {numField("Cue dài nhất (giây)", "maxDurationSec", 0.5)}
          {numField("Gap tối thiểu (frame)", "minGapFrames", 1)}
        </div>
      )}
    </div>
  );
}
