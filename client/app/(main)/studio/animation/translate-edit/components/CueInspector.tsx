"use client";

import { Trash2 } from "lucide-react";
import type { CueV2, Series } from "../../lib/library";

/**
 * Inspector của cue đang chọn (panel phải, kiểu Premiere/OOONA):
 * mốc In/Out, nhân vật nói, bản gốc, bản dịch chính và — khi series ở
 * chế độ nhiều ngôn ngữ — các bản dịch theo từng ngôn ngữ đích.
 */
export function CueInspector({
  cue,
  series,
  onPatch,
  onDelete,
}: {
  cue: CueV2;
  series: Series | null;
  onPatch: (patch: Partial<CueV2>) => void;
  onDelete: () => void;
}) {
  const multi = series?.languageMode === "multi";
  const langs = series?.targetLangs ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold tracking-wide text-white/70">
          INSPECTOR — CUE
        </h3>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 text-[11px] text-white/40 hover:text-rose-400"
        >
          <Trash2 className="w-3.5 h-3.5" /> Xoá cue
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px] text-white/50">
        <label className="block">
          In (giây)
          <input
            type="number"
            min={0}
            step={0.1}
            value={cue.startSec}
            onChange={(e) => onPatch({ startSec: Number(e.currentTarget.value) })}
            className="mt-0.5 w-full h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none"
          />
        </label>
        <label className="block">
          Dài (giây)
          <input
            type="number"
            min={0.3}
            step={0.1}
            value={cue.durationSec}
            onChange={(e) => onPatch({ durationSec: Number(e.currentTarget.value) })}
            className="mt-0.5 w-full h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none"
          />
        </label>
        <label className="block">
          Out
          <div className="mt-0.5 h-8 leading-8 px-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[12px] text-white/70 tabular-nums">
            {(cue.startSec + cue.durationSec).toFixed(1)}s
          </div>
        </label>
      </div>

      <label className="block text-[11px] text-white/50">
        Nhân vật nói
        <select
          value={cue.speakerId ?? ""}
          onChange={(e) =>
            onPatch({ speakerId: e.currentTarget.value || undefined })
          }
          className="mt-0.5 w-full h-9 rounded-lg bg-black/50 border border-white/10 px-2 text-[13px] text-white outline-none"
        >
          <option value="">— Chưa gán —</option>
          {(series?.characters ?? []).map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name || "(chưa đặt tên)"}
            </option>
          ))}
        </select>
        {(!series || series.characters.length === 0) && (
          <span className="block mt-1 text-white/30">
            Chưa có nhân vật — thêm ở Thư viện › Glossary & nhân vật của series.
          </span>
        )}
      </label>

      <label className="block text-[11px] text-white/50">
        Lời thoại gốc ({series?.sourceLang.toUpperCase() ?? "gốc"})
        <textarea
          value={cue.sourceText}
          onChange={(e) => onPatch({ sourceText: e.currentTarget.value })}
          rows={2}
          placeholder="Lời thoại trong video gốc…"
          className="mt-0.5 w-full rounded-lg bg-black/40 border border-white/10 px-2.5 py-2 text-[13px] text-white outline-none placeholder:text-white/25"
        />
      </label>

      <label className="block text-[11px] text-white/50">
        Bản chính hiển thị ({series?.targetLang.toUpperCase() ?? "đích"})
        <textarea
          value={cue.text}
          onChange={(e) => onPatch({ text: e.currentTarget.value })}
          rows={2}
          placeholder="Phụ đề/bản dịch chính…"
          className="mt-0.5 w-full rounded-lg bg-black/40 border border-fuchsia-400/30 px-2.5 py-2 text-[13px] text-white outline-none placeholder:text-white/25"
        />
      </label>

      {multi &&
        langs.map((lang) => (
          <label key={lang} className="block text-[11px] text-white/50">
            Bản dịch {lang.toUpperCase()}
            <textarea
              value={cue.translations?.[lang] ?? ""}
              onChange={(e) =>
                onPatch({
                  translations: {
                    ...(cue.translations ?? {}),
                    [lang]: e.currentTarget.value,
                  },
                })
              }
              rows={2}
              className="mt-0.5 w-full rounded-lg bg-black/40 border border-white/10 px-2.5 py-2 text-[13px] text-white outline-none"
            />
          </label>
        ))}

      {cue.flag && (
        <p className="text-[11px] text-amber-200/85 leading-relaxed">
          ⚑ {cue.flag}
        </p>
      )}
    </div>
  );
}
