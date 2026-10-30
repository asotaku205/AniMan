/**
 * Action ghi cầu nối N5: tạo dự án đích thật trong DB của studio đích
 * (Animation / Manga / Dịch) rồi trả về thông tin để Novel Studio ghi
 * nhận cầu nối. Mỗi hàm chỉ tạo mới, không sửa/xoá dữ liệu đích cũ.
 */

import type { SceneDraft } from "../../animation/lib/sceneSuggest";
import { sceneDraftToAnimScene } from "../../animation/lib/sceneSuggest";
import { createAnimProject } from "../../animation/lib/animProject";
import type { AnimProject } from "../../animation/lib/animProject";
import { saveAnimProject } from "../../animation/lib/animStorage";
import {
  saveProjectToDB,
  savePageDrawingToDB,
} from "../../manga-ai/lib/mangaStorage";
import {
  listSeries,
  saveSeries,
  listSeasons,
  saveSeason,
  listEpisodes,
  saveEpisode,
  saveCues,
} from "../../animation/lib/libraryStorage";
import type {
  Episode,
  Season,
  Series,
} from "../../animation/lib/library";
import { newLibraryId } from "../../animation/lib/library";
import type {
  MangaPageDraft,
} from "./novelBridge";
import {
  mangaPageTexts,
  mangaPlanPageTexts,
  cuesForAnimProject,
  pagesForAnimProject,
  type MangaPlanPage,
} from "./novelBridge";
import { savePanelPlans } from "../../manga-ai/lib/panelPlans";
import type { PanelPlan } from "../../manga-ai/lib/panelPlans";

const MANGA_ACTIVE_KEY = "animan_manga_active_project_id_v1";

/** Novel → Animation: cảnh nháp đã duyệt thành dự án 2D mới. */
export async function createAnimProjectFromDrafts(
  name: string,
  drafts: SceneDraft[],
  sourceNote: string,
): Promise<AnimProject> {
  const project = createAnimProject(name, "2d");
  project.scenes = drafts.map((d, i) =>
    sceneDraftToAnimScene(d, `n5-${Date.now()}-${i}`),
  );
  project.sourceNote = sourceNote;
  await saveAnimProject(project);
  return project;
}

/** Tạo dự án Manga khung xương từ các trang nháp (tranh trống, chữ sẵn). */
export async function createMangaProjectFromPages(
  title: string,
  description: string,
  genre: string,
  pages: MangaPageDraft[],
): Promise<{ id: string; pageCount: number }> {
  const now = Date.now();
  const project = {
    id: `proj-${now}`,
    title: title.trim() || "Tác phẩm Manga mới",
    genre: genre.trim() || "Action",
    description: description.trim(),
    createdAt: now,
    updatedAt: now,
    status: "draft" as const,
    pages: pages.map((pg, i) => ({
      pageNumber: i + 1,
      layoutId: "classic-5",
      panels: {} as Record<string, string>,
    })),
  };
  await saveProjectToDB(project);
  for (let i = 0; i < pages.length; i += 1) {
    await savePageDrawingToDB(
      project.id,
      i + 1,
      {},
      "classic-5",
      {},
      mangaPageTexts(pages[i], i + 1),
    );
  }
  // Mở Manga Studio sẽ thấy ngay dự án mới (hub đọc key này lúc nạp).
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(MANGA_ACTIVE_KEY, project.id);
    }
  } catch {
    /* không chặn tạo dự án nếu storage bị chặn */
  }
  return { id: project.id, pageCount: pages.length };
}

/** Novel -> Manga theo kế hoạch AI phân tích: trang đúng layout đã duyệt,
 * thoại thành khối chữ, kế hoạch khung lưu riêng để Manga Studio điền
 * sẵn prompt + loại cảnh khi Sơn mở từng khung. Tranh trống để Sơn vẽ. */
export async function createMangaProjectFromPlan(
  title: string,
  description: string,
  genre: string,
  planPages: MangaPlanPage[],
): Promise<{ id: string; pageCount: number; panelCount: number }> {
  const now = Date.now();
  const project = {
    id: `proj-${now}`,
    title: title.trim() || "Tác phẩm Manga mới",
    genre: genre.trim() || "Action",
    description: description.trim(),
    createdAt: now,
    updatedAt: now,
    status: "draft" as const,
    pages: planPages.map((pg, i) => ({
      pageNumber: i + 1,
      layoutId: pg.layoutId,
      panels: {} as Record<string, string>,
    })),
  };
  await saveProjectToDB(project);
  let panelCount = 0;
  for (let i = 0; i < planPages.length; i += 1) {
    const planPage = planPages[i];
    panelCount += planPage.plans.length;
    await savePageDrawingToDB(
      project.id,
      i + 1,
      {},
      planPage.layoutId,
      {},
      mangaPlanPageTexts(planPage, i + 1),
    );
    const plans: Record<string, PanelPlan> = {};
    planPage.plans.forEach((plan, pi) => {
      plans[`p${pi + 1}`] = plan;
    });
    await savePanelPlans(project.id, i + 1, plans);
  }
  // Mở Manga Studio sẽ thấy ngay dự án mới (hub đọc key này lúc nạp).
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(MANGA_ACTIVE_KEY, project.id);
    }
  } catch {
    /* không chặn tạo dự án nếu storage bị chặn */
  }
  return { id: project.id, pageCount: planPages.length, panelCount };
}

/** Animation → Manga: cảnh thành panel (1 cảnh = 1 panel). Ghi chú cảnh
 * đã chứa thoại trong ngoặc kép nên panelDraftForAnimScene tách thoại
 * khỏi phần kể để thoại không xuất hiện 2 lần trong panel. */
export async function createMangaProjectFromAnim(
  animProject: AnimProject,
  genre: string,
): Promise<{ id: string; pageCount: number; panelCount: number }> {
  const pages = pagesForAnimProject(animProject);
  const panelCount = pages.reduce((sum, pg) => sum + pg.panels.length, 0);
  const created = await createMangaProjectFromPages(
    animProject.name,
    animProject.sourceNote ?? "",
    genre,
    pages,
  );
  return { ...created, panelCount };
}

export interface TranslateTarget {
  series: Series;
  season: Season;
  episode: Episode;
  cueCount: number;
}

/**
 * Animation → Dịch/lồng tiếng: toàn bộ thoại thành tập mới (cue nối tiếp).
 * seriesId có sẵn thì dùng mùa đầu của series đó; không thì tạo series
 * mới (nguồn vi, đích theo lựa chọn) + Mùa 1.
 */
export async function createTranslateEpisodeFromAnim(
  animProject: AnimProject,
  opts:
    | { seriesId: string }
    | { newSeriesTitle: string; targetLang: string },
): Promise<TranslateTarget> {
  const now = Date.now();
  let series: Series;
  let season: Season;
  if ("seriesId" in opts) {
    const all = await listSeries();
    const found = all.find((s) => s.id === opts.seriesId);
    if (!found) throw new Error("Series đã chọn không còn tồn tại.");
    series = found;
    const seasons = await listSeasons(series.id);
    seasons.sort((a, b) => a.number - b.number);
    if (seasons.length > 0) {
      season = seasons[0];
    } else {
      season = {
        id: newLibraryId("season"),
        seriesId: series.id,
        number: 1,
        title: "Mùa 1",
      };
      await saveSeason(season);
    }
  } else {
    series = {
      id: newLibraryId("series"),
      title: opts.newSeriesTitle.trim() || animProject.name,
      sourceLang: "vi",
      targetLang: opts.targetLang,
      glossary: "",
      styleNote: "",
      characters: [],
      useSeasons: true,
      languageMode: "single",
      targetLangs: [],
      createdAt: now,
      updatedAt: now,
    };
    await saveSeries(series);
    season = {
      id: newLibraryId("season"),
      seriesId: series.id,
      number: 1,
      title: "Mùa 1",
    };
    await saveSeason(season);
  }
  const episodes = await listEpisodes(season.id);
  const number =
    episodes.reduce((max, e) => Math.max(max, e.number), 0) + 1;
  const episodeId = newLibraryId("episode");
  const cues = cuesForAnimProject(animProject, episodeId);
  const durationSec = cues.reduce(
    (sum, c) => sum + c.durationSec + 0.15,
    0,
  );
  const episode: Episode = {
    id: episodeId,
    seasonId: season.id,
    number,
    title: animProject.name,
    status: "not-started",
    videoName: null,
    durationSec: Math.round(durationSec * 100) / 100,
    updatedAt: now,
  };
  await saveEpisode(episode);
  if (cues.length > 0) await saveCues(cues);
  return { series, season, episode, cueCount: cues.length };
}
