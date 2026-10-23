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

  const refresh = useCallback(async () => {
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
  }, []);

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
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-[11px] tracking-[0.3em] text-fuchsia-300/70">
          <BookOpen className="w-3.5 h-3.5" /> THƯ VIỆN STUDIO
        </div>
        <h1 className="text-2xl font-semibold mt-1">Dịch & lồng tiếng — thư viện series</h1>
        <p className="text-sm text-white/50 mt-1 max-w-2xl leading-relaxed">
          Quản lý theo cây Series → Mùa → Tập như studio localization chuyên
          nghiệp. Mỗi series có glossary và dàn nhân vật riêng dùng chung cho
          mọi tập khi dịch và lồng tiếng.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={newSeriesTitle}
          onChange={(e) => setNewSeriesTitle(e.currentTarget.value)}
          placeholder="Tên series mới — VD: BokuYaba bản lồng tiếng…"
          className="flex-1 h-11 rounded-xl bg-black/40 border border-white/10 px-3 text-sm outline-none focus:border-fuchsia-400/60"
        />
        <button
          onClick={() => void addSeries()}
          className="flex items-center gap-2 px-4 h-11 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-400 text-sm font-medium hover:opacity-90 transition"
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
            className="rounded-2xl border border-white/10 bg-[#0d0817] p-5 space-y-4"
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
                Glossary & nhân vật
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
              <div className="rounded-xl border border-white/[0.07] bg-black/25 p-3.5 space-y-2">
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
                {seasons.every((x) => x.episodes.length === 0) && (
                  <p className="text-[12px] text-white/30">Chưa có tập nào.</p>
                )}
              </div>
            )}

            {series.useSeasons && seasons.map(({ season, episodes }) => (
              <div key={season.id} className="rounded-xl border border-white/[0.07] bg-black/25 p-3.5 space-y-2">
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
                {episodes.map(({ episode, progress, totalCues }) => (
                  <div
                    key={episode.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                  >
                    <span className="w-9 h-9 rounded-lg bg-fuchsia-500/15 text-fuchsia-200 grid place-items-center text-[13px] font-bold">
                      {episode.number}
                    </span>
                    <div className="flex-1 min-w-[160px]">
                      <div className="text-[13px] font-medium">{episode.title}</div>
                      <div className="text-[11px] text-white/35">
                        {totalCues} cue
                        {episode.videoName ? ` · Video: ${episode.videoName}` : " · Chưa chọn video"}
                      </div>
                    </div>
                    <div className="w-32">
                      <div className="h-1.5 rounded bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-400"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-white/35 mt-0.5">{progress}% có bản dịch</div>
                    </div>
                    <select
                      value={episode.status}
                      onChange={async (e) => {
                        await saveEpisode({
                          ...episode,
                          status: e.currentTarget.value as Episode["status"],
                        });
                        await refresh();
                      }}
                      aria-label="Trạng thái tập"
                      className="h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] outline-none"
                    >
                      {EPISODE_STATUS_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <Link
                      href={`/studio/animation/translate-edit/episode/${episode.id}`}
                      className="flex items-center gap-1 px-3 h-9 rounded-lg bg-fuchsia-500/25 border border-fuchsia-400/40 text-[12px] font-medium hover:bg-fuchsia-500/35"
                    >
                      Mở biên tập <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
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
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <span className="w-9 h-9 rounded-lg bg-fuchsia-500/15 text-fuchsia-200 grid place-items-center text-[13px] font-bold">
        {episode.number}
      </span>
      <div className="flex-1 min-w-[160px]">
        <div className="text-[13px] font-medium">{episode.title}</div>
        <div className="text-[11px] text-white/35">
          {totalCues} cue
          {episode.videoName ? ` · Video: ${episode.videoName}` : " · Chưa chọn video"}
        </div>
      </div>
      <div className="w-32">
        <div className="h-1.5 rounded bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-400"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-[10px] text-white/35 mt-0.5">{progress}% có bản dịch</div>
      </div>
      <select
        value={episode.status}
        onChange={(e) => onStatusChange(e.currentTarget.value as Episode["status"])}
        aria-label="Trạng thái tập"
        className="h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] outline-none"
      >
        {EPISODE_STATUS_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <Link
        href={`/studio/animation/translate-edit/episode/${episode.id}`}
        className="flex items-center gap-1 px-3 h-9 rounded-lg bg-fuchsia-500/25 border border-fuchsia-400/40 text-[12px] font-medium hover:bg-fuchsia-500/35"
      >
        Mở biên tập <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
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
          Glossary / thuật ngữ của series (tự đính kèm khi dịch)
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
