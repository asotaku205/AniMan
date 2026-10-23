"use client";

import { useEffect, useState } from "react";
import { Languages, Wand2 } from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";
import {
  TRANSLATION_TARGET_OPTIONS,
  translateDialogue,
  type TranslationTargetLang,
} from "@/lib/translation-api";
import type { DialogueLine } from "../../lib/dialogue";
import {
  buildSeriesContext,
  characterName,
  type CueV2,
  type Series,
} from "../../lib/library";

const LANGS = TRANSLATION_TARGET_OPTIONS;

const FLAG_AI = "Bản dịch AI — cần xem lại trước khi xuất";

/**
 * Panel DỊCH (Slice S7): dịch từ LỜI GỐC (sourceText) của cue bằng
 * endpoint có ngữ cảnh. Glossary/ngữ cảnh nhân vật TỰ NẠP từ series
 * (buildSeriesContext) — hết nhập tay mỗi tập. Hỗ trợ dịch cả tập,
 * dịch lẻ 1 cue, áp dụng từng câu; bản dịch được ÁP sẽ gắn cờ "cần
 * xem lại" (tắt khi người dùng tự sửa nội dung ở Inspector). Ở chế
 * độ nhiều ngôn ngữ, chọn ngôn ngữ đích để dịch vào đúng ô ngôn ngữ.
 */
export function TranslateTab({
  title,
  cues,
  series,
  onCuesChange,
  onPatchCue,
  onTranslated,
}: {
  title: string;
  cues: CueV2[];
  series: Series | null;
  onCuesChange: (cues: DialogueLine[]) => void;
  onPatchCue: (cueId: string, patch: Partial<CueV2>) => void;
  onTranslated: (cueIds: string[]) => void;
}) {
  const { user, authenticatedFetch } = useAuth();
  const primaryLang = (series?.targetLang ?? "vi") as TranslationTargetLang;
  const langChoices =
    series?.languageMode === "multi" && series.targetLangs.length > 0
      ? LANGS.filter((l) => series.targetLangs.includes(l.id))
      : LANGS;
  const [targetLang, setTargetLang] = useState<TranslationTargetLang>(primaryLang);
  const [glossary, setGlossary] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [busyCueId, setBusyCueId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Ngữ cảnh series tự nạp khi mở tập (chỉ nạp 1 lần cho mỗi series)
  const seriesId = series?.id ?? null;
  useEffect(() => {
    if (series) setGlossary(buildSeriesContext(series));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId]);

  useEffect(() => {
    setTargetLang(primaryLang);
  }, [primaryLang]);

  const sourceLines: DialogueLine[] = cues.map((cue) => ({
    id: cue.id,
    text: cue.sourceText.trim() ? cue.sourceText : cue.text,
    startSec: cue.startSec,
    durationSec: cue.durationSec,
    speaker: characterName(series, cue.speakerId) ?? undefined,
  }));
  const translatable = sourceLines.filter((l) => l.text.trim());
  const hasDraft = Object.keys(draft).length > 0;

  const runTranslate = async (lines: DialogueLine[]) => {
    if (!authenticatedFetch || lines.length === 0) return null;
    setError(null);
    try {
      const result = await translateDialogue(authenticatedFetch, {
        sceneName: title || "Tập phim",
        sceneNote:
          "Phụ đề của một tập phim có sẵn, dịch để lồng tiếng/phụ đề lại.",
        targetLang,
        glossary: glossary.trim(),
        lines: lines.map((l) => ({ id: l.id, text: l.text, speaker: l.speaker })),
      });
      return result.translations;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Dịch thất bại — thử lại sau ít phút (giới hạn lượt AI/ngày).",
      );
      return null;
    }
  };

  const translateAll = async () => {
    setBusy(true);
    const result = await runTranslate(translatable);
    setBusy(false);
    if (result) {
      setDraft((prev) => ({
        ...prev,
        ...Object.fromEntries(result.map((r) => [r.id, r.text])),
      }));
    }
  };

  const translateOne = async (cue: CueV2) => {
    const line = sourceLines.find((l) => l.id === cue.id);
    if (!line?.text.trim()) return;
    setBusyCueId(cue.id);
    const result = await runTranslate([line]);
    setBusyCueId(null);
    if (result?.[0]) {
      setDraft((prev) => ({ ...prev, [cue.id]: result[0].text }));
    }
  };

  /** Áp 1 bản nháp vào cue: ngôn ngữ chính → text; ngôn ngữ phụ → translations. */
  const applyOne = (cueId: string) => {
    const text = draft[cueId];
    if (!text) return;
    if (targetLang === primaryLang) {
      onCuesChange(
        cues.map((cue) =>
          cue.id === cueId ? { ...cue, text } : cue,
        ) as DialogueLine[],
      );
    } else {
      const cue = cues.find((c) => c.id === cueId);
      if (cue) {
        onPatchCue(cueId, {
          translations: { ...(cue.translations ?? {}), [targetLang]: text },
        });
      }
    }
    onTranslated([cueId]);
    setDraft((prev) => {
      const next = { ...prev };
      delete next[cueId];
      return next;
    });
  };

  const applyAll = () => {
    const ids = Object.keys(draft);
    if (targetLang === primaryLang) {
      onCuesChange(
        cues.map((cue) =>
          draft[cue.id] ? { ...cue, text: draft[cue.id] } : cue,
        ) as DialogueLine[],
      );
    } else {
      for (const cue of cues) {
        if (draft[cue.id]) {
          onPatchCue(cue.id, {
            translations: {
              ...(cue.translations ?? {}),
              [targetLang]: draft[cue.id],
            },
          });
        }
      }
    }
    onTranslated(ids);
    setDraft({});
  };

  if (!user) {
    return (
      <p className="text-[13px] text-white/50 leading-relaxed">
        Cần đăng nhập để dùng dịch AI (endpoint dùng chung hạn mức AI của
        tài khoản). Các tính năng phụ đề và lồng tiếng vẫn dùng bình thường.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={targetLang}
          onChange={(e) =>
            setTargetLang(e.currentTarget.value as TranslationTargetLang)
          }
          aria-label="Ngôn ngữ đích"
          className="h-9 rounded-lg bg-black/50 border border-white/10 px-2 text-[13px] outline-none"
        >
          {langChoices.map((l) => (
            <option key={l.id} value={l.id}>
              Dịch sang {l.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => void translateAll()}
          disabled={busy || translatable.length === 0}
          className="flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-400 text-[13px] font-medium hover:opacity-90 disabled:opacity-40"
        >
          <Languages className="w-4 h-4" />
          {busy ? "Đang dịch cả tập…" : `Dịch cả tập (${translatable.length} câu)`}
        </button>
        {hasDraft && (
          <>
            <button
              onClick={applyAll}
              className="px-3.5 h-9 rounded-lg bg-emerald-500/25 border border-emerald-400/40 text-[13px] font-medium hover:bg-emerald-500/35"
            >
              Áp dụng tất cả ({Object.keys(draft).length})
            </button>
            <button
              onClick={() => setDraft({})}
              className="px-3 h-9 rounded-lg bg-white/5 border border-white/10 text-[13px] hover:bg-white/10"
            >
              Bỏ nháp
            </button>
          </>
        )}
      </div>

      <label className="block text-[11px] text-white/45">
        Ngữ cảnh dịch — tự nạp từ glossary + dàn nhân vật của series (sửa
        được cho lượt này)
        <textarea
          value={glossary}
          onChange={(e) => setGlossary(e.currentTarget.value)}
          rows={3}
          placeholder="Thuật ngữ/tên riêng giữ nguyên, giọng điệu…"
          className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-2.5 py-2 text-[12px] text-white outline-none placeholder:text-white/25"
        />
      </label>

      {error && <p className="text-[12px] text-rose-300">{error}</p>}

      <div className="space-y-1.5 max-h-[430px] overflow-y-auto pr-0.5">
        {cues.map((cue, i) => {
          const source = cue.sourceText.trim() ? cue.sourceText : cue.text;
          const current =
            targetLang === primaryLang
              ? cue.text
              : (cue.translations?.[targetLang] ?? "");
          return (
            <div
              key={cue.id}
              className="rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2 space-y-1"
            >
              <div className="text-[12px] leading-relaxed">
                <span className="text-white/35 mr-1.5 tabular-nums">
                  #{i + 1} {cue.startSec.toFixed(1)}s
                </span>
                <span className="text-white/85">{source || "(trống)"}</span>
              </div>
              {draft[cue.id] ? (
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-[12px] text-fuchsia-200 leading-relaxed">
                    → {draft[cue.id]}
                  </p>
                  <button
                    onClick={() => applyOne(cue.id)}
                    className="shrink-0 px-2 h-6 rounded-md bg-emerald-500/25 border border-emerald-400/40 text-[11px] hover:bg-emerald-500/35"
                  >
                    Áp dụng
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-[12px] text-white/40 leading-relaxed">
                    {current ? `Hiện tại: ${current}` : "Chưa có bản dịch"}
                    {cue.flag === FLAG_AI && targetLang === primaryLang
                      ? " · ⚑ cần xem lại"
                      : ""}
                  </p>
                  <button
                    onClick={() => void translateOne(cue)}
                    disabled={busyCueId === cue.id || !source.trim()}
                    className="shrink-0 flex items-center gap-1 px-2 h-6 rounded-md bg-white/5 border border-white/10 text-[11px] hover:bg-white/10 disabled:opacity-40"
                  >
                    <Wand2 className="w-3 h-3" />
                    {busyCueId === cue.id ? "Đang dịch…" : "Dịch câu này"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {cues.length === 0 && (
          <p className="text-[12px] text-white/35">
            Chưa có cue nào để dịch — tạo cue và nhập lời gốc ở Inspector (mode Phụ đề) trước.
          </p>
        )}
      </div>
    </div>
  );
}

export const FLAG_AI_TRANSLATION = FLAG_AI;
