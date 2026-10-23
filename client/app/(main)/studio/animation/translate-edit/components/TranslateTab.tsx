"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import type { DialogueLine } from "../../lib/dialogue";
import {
  TRANSLATION_TARGET_OPTIONS,
  translateDialogue,
  type TranslationTargetLang,
} from "@/lib/translation-api";
import { useAuth } from "@/app/auth/AuthProvider";

/**
 * Tab DỊCH — dùng endpoint dịch có ngữ cảnh của server (cùng tính năng
 * với dịch thoại trong Animation Studio): dịch TOÀN BỘ cue của video
 * trong 1 lượt kèm tiêu đề video + glossary; bản dịch là NHÁP, duyệt
 * rồi mới áp vào phụ đề.
 */
export function TranslateTab({
  title,
  cues,
  onCuesChange,
}: {
  title: string;
  cues: DialogueLine[];
  onCuesChange: (cues: DialogueLine[]) => void;
}) {
  const { authenticatedFetch } = useAuth();
  const [targetLang, setTargetLang] = useState<TranslationTargetLang>("vi");
  const [glossary, setGlossary] = useState<string>(() =>
    typeof window === "undefined"
      ? ""
      : (window.localStorage.getItem("animan-translate-glossary") ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Array<{ id: string; text: string }> | null>(null);

  const run = async () => {
    const lines = cues.filter((c) => c.text.trim());
    if (lines.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      window.localStorage.setItem("animan-translate-glossary", glossary);
      const result = await translateDialogue(authenticatedFetch, {
        targetLang,
        sceneName: title || "Video",
        sceneNote: "Phụ đề của một tập phim có sẵn, dịch để lồng tiếng/phụ đề lại.",
        glossary,
        lines: lines.map((l) => ({ id: l.id, text: l.text, speaker: l.speaker })),
      });
      setDraft(result.translations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dịch thất bại, thử lại sau.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Languages className="w-4 h-4 text-fuchsia-300" />
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.currentTarget.value as TranslationTargetLang)}
          aria-label="Ngôn ngữ đích"
          className="h-9 rounded-lg bg-black/50 border border-white/10 px-2 text-[13px] outline-none"
        >
          {TRANSLATION_TARGET_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              Dịch sang {o.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => void run()}
          disabled={busy || cues.every((c) => !c.text.trim())}
          className="px-4 h-9 rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-400 text-[13px] font-medium hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Đang dịch toàn bộ…" : `Dịch ${cues.filter((c) => c.text.trim()).length} cue (1 lượt AI)`}
        </button>
      </div>
      <textarea
        value={glossary}
        onChange={(e) => setGlossary(e.currentTarget.value)}
        rows={2}
        placeholder="Bảng thuật ngữ/tên riêng (tuỳ chọn) — giữ nhất quán tên nhân vật, chiêu thức, địa danh…"
        className="w-full rounded-lg bg-black/40 border border-white/10 px-2.5 py-2 text-[13px] outline-none placeholder:text-white/25"
      />
      {error && <p className="text-[12px] text-rose-300 leading-relaxed">{error}</p>}
      {draft && (
        <div className="space-y-2">
          <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1">
            {draft.map((t) => {
              const original = cues.find((c) => c.id === t.id);
              return (
                <div key={t.id} className="rounded-lg bg-fuchsia-500/[0.06] border border-fuchsia-400/20 p-2.5 text-[13px] leading-relaxed">
                  <div className="text-white/40">{original?.text}</div>
                  <div className="text-fuchsia-100">{t.text}</div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onCuesChange(
                  cues.map((c) => {
                    const t = draft.find((x) => x.id === c.id);
                    return t ? { ...c, text: t.text } : c;
                  }),
                );
                setDraft(null);
              }}
              className="flex-1 h-9 rounded-lg bg-fuchsia-500/40 border border-fuchsia-300/40 text-[13px] font-medium hover:bg-fuchsia-500/55"
            >
              Áp dụng bản dịch vào phụ đề
            </button>
            <button
              onClick={() => setDraft(null)}
              className="px-3 h-9 rounded-lg bg-white/5 border border-white/10 text-[13px] hover:bg-white/10"
            >
              Bỏ qua
            </button>
          </div>
        </div>
      )}
      <p className="text-[11px] text-white/30 leading-relaxed">
        Dịch dùng chung hạn mức AI (5 lượt/phút, 30 lượt/ngày) và cần đăng
        nhập. Mốc thời gian giữ nguyên — chỉ thay nội dung chữ.
      </p>
    </div>
  );
}
