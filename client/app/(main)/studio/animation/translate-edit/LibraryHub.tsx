"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, Clapperboard, Plus, Trash2 } from "lucide-react";
import {
  createEpisode,
  createSeason,
  createSeries,
  EPISODE_STATUS_OPTIONS,
  episodeProgress,
  newLibraryId,
  type Episode,
  type Season,
  type Series,
} from "../lib/library";
import {
  listCues,
  listEpisodes,
  listSeasons,
  listSeries,
  migrateLegacyIfNeeded,
  saveEpisode,
  saveSeason,
  saveSeries,
} from "../lib/libraryStorage";

interface SeriesTree {
  series: Series;
  seasons: Array<{
    season: Season;
    episodes: Array<{ episode: Episode; progress: number; totalCues: number }>;
  }>;
}

/**
 * THƯ VIỆN STUDIO DỊCH & LỒNG TIẾNG — quản lý theo cây
 * Series → Season → Episode (chuẩn OOONA), mỗi tập có trạng thái công
 * việc và % tiến độ. Thay cho mô hình "1 dự án duy nhất" trước đây.
 */
export function LibraryHub() {
  const [trees, setTrees] = useState<SeriesTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSeriesTitle, setNewSeriesTitle] = useState("");
  const [openSettingsId, setOpenSettingsId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      await refreshInner();
      setLoadError(null);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "Không tải/lưu được dữ liệu thư viện",
      );
      setLoading(false);
    }
  }, []);

  const refreshInner = async () => {
    await migrateLegacyIfNeeded();
    const allSeries = await listSeries();
    const out: SeriesTree[] = [];
    for (const series of allSeries) {
      const seasons = await listSeasons(series.id);
      const seasonTrees: SeriesTree["seasons"] = [];
      for (const season of seasons) {
        const episodes = await listEpisodes(season.id);
        const rows = [];
        for (const episode of episodes) {
          const cues = await listCues(episode.id);
          rows.push({
            episode,
            progress: episodeProgress(cues).percent,
            totalCues: cues.length,
          });
        }
        seasonTrees.push({ season, episodes: rows });
      }
      out.push({ series, seasons: seasonTrees });
    }
    setTrees(out);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addSeries = async () => {
    const series = createSeries(newSeriesTitle);
    const season = createSeason(series.id, 1);
    const episode = createEpisode(season.id, 1);
    await saveSeries(series);
    await saveSeason(season);
    await saveEpisode(episode);
    setNewSeriesTitle("");
    await refresh();
  };

  return (
    <div className="relative space-y-8">
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 w-[480px] h-[320px] rounded-full bg-fuchsia-600/15 blur-[110px]" />
      <div aria-hidden className="pointer-events-none absolute top-10 -right-24 w-[420px] h-[300px] rounded-full bg-pink-500/10 blur-[110px]" />
      <div className="relative">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.3em] text-fuchsia-300/70">
          <BookOpen className="w-3.5 h-3.5" /> THƯ VIỆN STUDIO
        </div>
        <h1 className="text-[28px] font-bold tracking-tight mt-1.5 bg-gradient-to-r from-fuchsia-300 via-pink-200 to-rose-200 bg-clip-text text-transparent">Dịch & lồng tiếng — thư viện series</h1>
        
      </div>

      {loadError && (
        <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200 flex items-center gap-3">
          <span className="flex-1">
            ⚠ Lỗi dữ liệu: {loadError} — dữ liệu có thể chưa được lưu. Hãy
            đóng các tab AniMan khác rồi thử lại.
          </span>
          <button
            onClick={() => void refresh()}
            className="px-3 h-8 rounded-lg bg-rose-500/25 border border-rose-400/40 text-[12px] font-medium hover:bg-rose-500/35"
          >
            Thử lại
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={newSeriesTitle}
          onChange={(e) => setNewSeriesTitle(e.currentTarget.value)}
          placeholder="Tên series mới — VD: BokuYaba bản lồng tiếng…"
          className="flex-1 h-11 rounded-2xl bg-white/[0.04] backdrop-blur border border-white/10 px-3.5 text-sm outline-none focus:border-fuchsia-400/60 transition"
        />
        <button
          onClick={() => void addSeries()}
          className="flex items-center gap-2 px-4 h-11 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-400 text-sm font-semibold shadow-[0_8px_26px_rgba(217,70,239,0.4)] hover:shadow-[0_12px_32px_rgba(217,70,239,0.55)] hover:-translate-y-0.5 transition-all"
        >
          <Plus className="w-4 h-4" /> Tạo series
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-white/40">Đang tải thư viện…</p>
      ) : trees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center">
          <Clapperboard className="w-10 h-10 mx-auto text-white/25" />
          <p className="mt-3 text-white/70 font-medium">Chưa có series nào</p>
          <p className="mt-1 text-sm text-white/40">
            Tạo series đầu tiên ở ô phía trên — một mùa và một tập mẫu sẽ được
            tạo sẵn để bắt đầu.
          </p>
        </div>
      ) : (
        trees.map(({ series, seasons }) => (
          <section
            key={series.id}
            className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur p-5 space-y-4 shadow-[0_16px_44px_rgba(0,0,0,0.35)]"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold flex-1 min-w-[180px]">{series.title}</h2>
              <span className="text-[12px] text-white/40">
                {series.sourceLang.toUpperCase()} → {series.targetLang.toUpperCase()} ·{" "}
                {series.characters.length} nhân vật
              </span>
              <button
                onClick={() =>
                  setOpenSettingsId(openSettingsId === series.id ? null : series.id)
                }
                className="px-3 h-9 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10"
              >
                Thuật ngữ & nhân vật
              </button>
              {series.useSeasons && (
                <button
                  onClick={async () => {
                    const season = createSeason(series.id, seasons.length + 1);
                    const episode = createEpisode(season.id, 1);
                    await saveSeason(season);
                    await saveEpisode(episode);
                    await refresh();
                  }}
                  className="px-3 h-9 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10"
                >
                  + Thêm mùa
                </button>
              )}
            </div>

            {openSettingsId === series.id && (
              <SeriesSettings
                series={series}
                onSaved={async (next) => {
                  await saveSeries(next);
                  await refresh();
                }}
              />
            )}

            {!series.useSeasons && (
              <div className="rounded-3xl border border-white/[0.07] bg-black/25 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-white/75">Danh sách tập</h3>
                  <button
                    onClick={async () => {
                      const host = seasons[0]?.season ?? createSeason(series.id, 1);
                      if (!seasons[0]) await saveSeason(host);
                      const total = seasons.reduce((n, x) => n + x.episodes.length, 0);
                      await saveEpisode(createEpisode(host.id, total + 1));
                      await refresh();
                    }}
                    className="px-2.5 h-7 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
                  >
                    + Thêm tập
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {seasons.flatMap((x) => x.episodes).map(({ episode, progress, totalCues }) => (
                  <EpisodeRow
                    key={episode.id}
                    episode={episode}
                    progress={progress}
                    totalCues={totalCues}
                    onStatusChange={async (status) => {
                      await saveEpisode({ ...episode, status });
                      await refresh();
                    }}
                  />
                ))}
                </div>
                {seasons.every((x) => x.episodes.length === 0) && (
                  <p className="text-[12px] text-white/30">Chưa có tập nào.</p>
                )}
              </div>
            )}

            {series.useSeasons && seasons.map(({ season, episodes }) => (
              <div key={season.id} className="rounded-3xl border border-white/[0.07] bg-black/25 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-white/75">
                    {season.title}
                  </h3>
                  <button
                    onClick={async () => {
                      const episode = createEpisode(
                        season.id,
                        episodes.length + 1,
                      );
                      await saveEpisode(episode);
                      await refresh();
                    }}
                    className="px-2.5 h-7 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
                  >
                    + Thêm tập
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {episodes.map(({ episode, progress, totalCues }) => (
                  <EpisodeRow
                    key={episode.id}
                    episode={episode}
                    progress={progress}
                    totalCues={totalCues}
                    onStatusChange={async (status) => {
                      await saveEpisode({ ...episode, status });
                      await refresh();
                    }}
                  />
                ))}
                </div>
                {episodes.length === 0 && (
                  <p className="text-[12px] text-white/30">Chưa có tập nào trong mùa này.</p>
                )}
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}

const EPISODE_POSTERS = [
  "from-fuchsia-600 via-pink-500 to-rose-400",
  "from-violet-600 via-fuchsia-500 to-pink-400",
  "from-pink-600 via-rose-500 to-fuchsia-400",
  "from-purple-700 via-violet-500 to-fuchsia-400",
];

/** 4 bước quy trình studio: Dịch → Lồng tiếng → QC → Xuất. */
function stepStates(
  status: Episode["status"],
): Array<"done" | "doing" | "todo"> {
  switch (status) {
    case "translating":
      return ["doing", "todo", "todo", "todo"];
    case "dubbing":
      return ["done", "doing", "todo", "todo"];
    case "qc":
      return ["done", "done", "done", "todo"];
    case "exported":
      return ["done", "done", "done", "done"];
    default:
      return ["todo", "todo", "todo", "todo"];
  }
}

function fmtDur(sec: number): string {
  if (!sec) return "--:--";
  const m = Math.floor(sec / 60);
  const s2 = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s2).padStart(2, "0")}`;
}

function EpisodeRow({
  episode,
  progress,
  totalCues,
  onStatusChange,
}: {
  episode: Episode;
  progress: number;
  totalCues: number;
  onStatusChange: (status: Episode["status"]) => void;
}) {
  const poster = EPISODE_POSTERS[episode.number % EPISODE_POSTERS.length];
  const steps = stepStates(episode.status);
  const statusLabel =
    EPISODE_STATUS_OPTIONS.find((o) => o.id === episode.status)?.label ?? "";
  return (
    <article className="anim-fade-up group rounded-3xl overflow-hidden border border-white/10 bg-white/[0.04] backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-fuchsia-400/50 hover:shadow-[0_18px_38px_rgba(0,0,0,0.5),0_10px_30px_rgba(217,70,239,0.22)]">
      <div className={`relative h-24 bg-gradient-to-br ${poster}`}>
        <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <span className="absolute left-3.5 bottom-2.5 font-bold text-[13px] drop-shadow">
          Tập {episode.number}
        </span>
        <span className="absolute right-3 bottom-2.5 text-[11px] font-mono tabular-nums bg-black/50 px-2 py-0.5 rounded-full">
          {fmtDur(episode.durationSec)}
        </span>
      </div>
      <div className="p-4">
        <div className="font-semibold text-[14.5px] leading-snug">{episode.title}</div>
        <div className="text-[11.5px] text-white/40 mt-1">
          {totalCues} cue · {progress}% có bản dịch
          {episode.videoName ? ` · ${episode.videoName}` : " · Chưa chọn video"}
        </div>
        <div className="flex gap-1.5 mt-3" title="Dịch → Lồng tiếng → QC → Xuất">
          {steps.map((st, i) => (
            <span key={i} className="flex-1 h-[5px] rounded-full bg-white/10 overflow-hidden relative">
              {st === "done" && (
                <span className="absolute inset-0 bg-gradient-to-r from-fuchsia-500 to-pink-400" />
              )}
              {st === "doing" && (
                <span className="step-doing-fill absolute inset-y-0 left-0 bg-gradient-to-r from-fuchsia-500 to-pink-400" />
              )}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3.5">
          <select
            value={episode.status}
            onChange={(e) => onStatusChange(e.currentTarget.value as Episode["status"])}
            aria-label={`Trạng thái tập — hiện: ${statusLabel}`}
            className="h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[11.5px] outline-none"
          >
            {EPISODE_STATUS_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <Link
            href={`/studio/animation/translate-edit/episode/${episode.id}`}
            className="ml-auto flex items-center gap-1 px-3.5 h-9 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-400 text-[12px] font-semibold shadow-[0_6px_18px_rgba(217,70,239,0.35)] hover:shadow-[0_10px_24px_rgba(217,70,239,0.5)] transition-all"
          >
            Mở biên tập <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function SeriesSettings({
  series,
  onSaved,
}: {
  series: Series;
  onSaved: (next: Series) => void;
}) {
  const [draft, setDraft] = useState(series);
  return (
    <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/[0.04] p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block text-[12px] text-white/50">
          Bảng thuật ngữ của series (tự động đính kèm khi dịch)
          <textarea
            value={draft.glossary}
            onChange={(e) => setDraft({ ...draft, glossary: e.currentTarget.value })}
            rows={3}
            placeholder="VD: Haru = giữ nguyên tên; 'senpai' → 'tiền bối'…"
            className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-2.5 py-2 text-[13px] text-white outline-none placeholder:text-white/25"
          />
        </label>
        <label className="block text-[12px] text-white/50">
          Ghi chú phong cách
          <textarea
            value={draft.styleNote}
            onChange={(e) => setDraft({ ...draft, styleNote: e.currentTarget.value })}
            rows={3}
            placeholder="VD: giọng trẻ trung, tránh từ Hán-Việt nặng…"
            className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-2.5 py-2 text-[13px] text-white outline-none placeholder:text-white/25"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex items-start gap-2.5 rounded-lg bg-black/30 border border-white/10 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.useSeasons}
            onChange={(e) => setDraft({ ...draft, useSeasons: e.currentTarget.checked })}
            className="mt-0.5 accent-fuchsia-500"
          />
          <span className="text-[12px] leading-relaxed">
            <span className="block font-medium text-white/80">Quản lý theo mùa (3 cấp)</span>
            <span className="text-white/40">Bật: Series → Mùa → Tập. Tắt: Series → Tập trực tiếp, gọn cho series ngắn.</span>
          </span>
        </label>
        <div className="rounded-lg bg-black/30 border border-white/10 p-3 space-y-2">
          <div className="text-[12px] font-medium text-white/80">Chế độ ngôn ngữ của các tập</div>
          <select
            value={draft.languageMode}
            onChange={(e) =>
              setDraft({ ...draft, languageMode: e.currentTarget.value as Series["languageMode"] })
            }
            className="w-full h-9 rounded-lg bg-black/50 border border-white/10 px-2 text-[13px] outline-none"
          >
            <option value="single">Mỗi tập 1 bản dịch</option>
            <option value="multi">Nhiều ngôn ngữ cùng lúc</option>
          </select>
          {draft.languageMode === "multi" ? (
            <input
              value={draft.targetLangs.join(", ")}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  targetLangs: e.currentTarget.value
                    .split(",")
                    .map((x) => x.trim().toLowerCase())
                    .filter(Boolean),
                })
              }
              placeholder="Mã ngôn ngữ, cách nhau dấu phẩy — VD: vi, en, ja"
              className="w-full h-9 rounded-lg bg-black/50 border border-white/10 px-2.5 text-[13px] outline-none placeholder:text-white/25"
            />
          ) : (
            <select
              value={draft.targetLang}
              onChange={(e) => setDraft({ ...draft, targetLang: e.currentTarget.value })}
              className="w-full h-9 rounded-lg bg-black/50 border border-white/10 px-2 text-[13px] outline-none"
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
              <option value="ja">Tiếng Nhật</option>
              <option value="ko">Tiếng Hàn</option>
              <option value="zh">Tiếng Trung</option>
            </select>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-[12px] text-white/50">Dàn nhân vật (dùng cho gán người nói, dịch nhất quán, cue sheet lồng tiếng)</div>
        {draft.characters.map((ch) => (
          <div key={ch.id} className="flex flex-wrap items-center gap-2">
            <input
              type="color"
              value={ch.color}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  characters: draft.characters.map((x) =>
                    x.id === ch.id ? { ...x, color: e.currentTarget.value } : x,
                  ),
                })
              }
              aria-label="Màu nhân vật"
              className="w-8 h-8 bg-transparent cursor-pointer"
            />
            <input
              value={ch.name}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  characters: draft.characters.map((x) =>
                    x.id === ch.id ? { ...x, name: e.currentTarget.value } : x,
                  ),
                })
              }
              placeholder="Tên nhân vật"
              className="w-40 h-9 rounded-lg bg-black/40 border border-white/10 px-2.5 text-[13px] outline-none"
            />
            <input
              value={ch.voiceNote}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  characters: draft.characters.map((x) =>
                    x.id === ch.id ? { ...x, voiceNote: e.currentTarget.value } : x,
                  ),
                })
              }
              placeholder="Giọng/xưng hô — VD: nam, lạnh lùng, xưng 'tôi'…"
              className="flex-1 min-w-[200px] h-9 rounded-lg bg-black/40 border border-white/10 px-2.5 text-[13px] outline-none placeholder:text-white/25"
            />
            <button
              onClick={() =>
                setDraft({
                  ...draft,
                  characters: draft.characters.filter((x) => x.id !== ch.id),
                })
              }
              aria-label="Xoá nhân vật"
              className="text-white/35 hover:text-rose-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            setDraft({
              ...draft,
              characters: [
                ...draft.characters,
                {
                  id: newLibraryId("char"),
                  name: "",
                  voiceNote: "",
                  color: "#f472b6",
                },
              ],
            })
          }
          className="px-3 h-8 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10"
        >
          + Thêm nhân vật
        </button>
      </div>
      <button
        onClick={() => onSaved(draft)}
        className="px-4 h-9 rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-400 text-[13px] font-medium hover:opacity-90"
      >
        Lưu cài đặt series
      </button>
    </div>
  );
}
