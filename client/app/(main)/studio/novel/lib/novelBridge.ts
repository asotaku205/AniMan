/**
 * Builder thuần cho cầu nối N5 (Novel → Animation/Manga, Animation →
 * Manga/Dịch). Không chạm IndexedDB — phần ghi do bridgeActions lo.
 * Mọi kết quả đều là bản nháp chỉnh được trước khi tạo dự án đích.
 */

import type { AnimProject } from "../../animation/lib/animProject";
import type { CueV2 } from "../../animation/lib/library";
import { newLibraryId } from "../../animation/lib/library";
import { estimateLineDurationSec } from "../../animation/lib/dialogue";
import {
  extractDialogue,
  splitNovelChunks,
  stripDialogue,
} from "../../animation/lib/sceneSuggest";
import type { PanelTextItems } from "../../manga-ai/lib/textItems";
import {
  createTextItem,
  DEFAULT_TEXT_STYLE,
} from "../../manga-ai/lib/textItems";
import { LAYOUTS } from "../../manga-ai/data";
import type { PanelPlan } from "../../manga-ai/lib/panelPlans";
import type { NovelBreakdown } from "../../../../../lib/novel-ai";

/** Một panel nháp: phần kể + các câu thoại trong panel đó. */
export interface PanelDraft {
  narration: string;
  dialogues: string[];
}

/** Một trang nháp Manga (tối đa 5 panel — khớp layout classic-5). */
export interface MangaPageDraft {
  panels: PanelDraft[];
}

/**
 * Một trang kế hoạch từ AI phân tích (cầu nối Novel -> Manga, thay cách
 * tách trực tiếp theo đoạn văn): layout do AI gợi ý theo số khung,
 * mỗi khung có prompt sinh ảnh mẫu + thoại tham khảo + ghi chú bố cục.
 * Kế hoạch là bản nháp, Sơn duyệt/sửa trước khi tạo dự án Manga.
 */
export interface MangaPlanPage {
  layoutId: string;
  /** Khung theo thứ tự p1, p2, ... trong layout. */
  plans: PanelPlan[];
  /** Tên cảnh nguồn trong Novel. */
  sourceSceneTitle: string;
}

/** Số khung của một layout, lấy từ LAYOUTS của Manga Studio. */
export function planLayoutPanelCount(layoutId: string): number {
  return LAYOUTS.find((l) => l.id === layoutId)?.panels.length ?? 5;
}

/** Đổi đáp án breakdown của AI thành trang kế hoạch, gắn tên cảnh nguồn. */
export function planPagesFromBreakdown(
  breakdown: NovelBreakdown,
  sourceSceneTitle: string,
): MangaPlanPage[] {
  return breakdown.pages
    .map((pg) => ({
      layoutId: pg.layout,
      sourceSceneTitle,
      plans: pg.panels.map((pn) => ({
        prompt: pn.prompt,
        sceneType: pn.sceneType,
        dialogue: pn.dialogue,
        note: pn.note,
        sourceSceneTitle,
      })),
    }))
    .filter((pg) => pg.plans.length > 0);
}

/**
 * Đổi layout của một trang kế hoạch. Khung thừa so với layout mới thì
 * dồn sang trang mới ngay sau đó (cùng cảnh nguồn), không mất khung
 * nào. Layout rộng hơn thì khung trống để Sơn vẽ thêm sau.
 */
export function changePlanPageLayout(
  pages: MangaPlanPage[],
  pageIndex: number,
  layoutId: string,
): MangaPlanPage[] {
  const target = pages[pageIndex];
  if (!target || target.layoutId === layoutId) return pages;
  const capacity = planLayoutPanelCount(layoutId);
  const updated: MangaPlanPage[] = pages.map((pg, i) =>
    i === pageIndex ? { ...pg, layoutId } : pg,
  );
  const overflow = updated[pageIndex].plans.slice(capacity);
  if (overflow.length === 0) return updated;
  updated[pageIndex] = {
    ...updated[pageIndex],
    plans: updated[pageIndex].plans.slice(0, capacity),
  };
  const rest: MangaPlanPage[] = [];
  for (let i = 0; i < overflow.length; i += capacity) {
    rest.push({
      layoutId,
      sourceSceneTitle: target.sourceSceneTitle,
      plans: overflow.slice(i, i + capacity),
    });
  }
  updated.splice(pageIndex + 1, 0, ...rest);
  return updated;
}

/**
 * Khối chữ cho một trang kế hoạch: chỉ thoại trích từ cảnh, xếp từ
 * trên xuống (vị trí mặc định  -  Sơn kéo lại trong Manga Studio). Phần
 * kể và ghi chú bố cục KHÔNG thành khối chữ: chúng chỉ nằm trong kế
 * hoạch để sinh ảnh mẫu và tham khảo.
 */
export function mangaPlanPageTexts(
  page: MangaPlanPage,
  pageNumber: number,
): PanelTextItems {
  const texts: PanelTextItems = {};
  page.plans.forEach((plan, pi) => {
    const panelId = `p${pi + 1}`;
    const items = [];
    let y = 0.04;
    for (let di = 0; di < plan.dialogue.length; di += 1) {
      items.push({
        ...createTextItem(
          `txt-${pageNumber}-${pi}-d${di}`,
          0.05,
          Math.min(y, 0.86),
          plan.dialogue[di],
          0.05,
          DEFAULT_TEXT_STYLE,
        ),
        w: 0.9,
      });
      y += 0.16;
    }
    if (items.length > 0) texts[panelId] = items;
  });
  return texts;
}

export const MANGA_PANELS_PER_PAGE = 5;
export const MANGA_SKELETON_LAYOUT_ID = "classic-5";

/**
 * Tách văn bản novel thành panel nháp: mỗi chunk thành một panel, thoại
 * trong ngoặc kép tách riêng khỏi phần kể. Panel chỉ có thoại (không có
 * phần kể) vẫn giữ — panel thuần thoại là chuyện thường trong manga.
 */
export function panelDraftsForText(text: string): PanelDraft[] {
  return splitNovelChunks(text)
    .map((chunk) => ({
      narration: stripDialogue(chunk),
      dialogues: extractDialogue(chunk),
    }))
    .filter((p) => p.narration || p.dialogues.length > 0);
}

/** Gom panel nháp thành trang, tối đa 5 panel/trang. */
export function pagesForPanels(panels: PanelDraft[]): MangaPageDraft[] {
  const pages: MangaPageDraft[] = [];
  for (let i = 0; i < panels.length; i += MANGA_PANELS_PER_PAGE) {
    pages.push({ panels: panels.slice(i, i + MANGA_PANELS_PER_PAGE) });
  }
  return pages;
}

/** Panel nháp cho một cảnh Animation: 1 cảnh = 1 panel (cảnh đã là đơn vị). */
export function panelDraftForAnimScene(scene: {
  note?: string;
  dialogue?: Array<{ text: string }>;
}): PanelDraft | null {
  const narration = stripDialogue(scene.note ?? "");
  const dialogues = (scene.dialogue ?? [])
    .map((d) => d.text.trim())
    .filter(Boolean);
  if (!narration && dialogues.length === 0) return null;
  return { narration, dialogues };
}

/** Trang nháp Manga cho cả dự án Animation (bỏ cảnh trống). */
export function pagesForAnimProject(project: AnimProject): MangaPageDraft[] {
  const panels = project.scenes
    .map((s) => panelDraftForAnimScene(s))
    .filter((p): p is PanelDraft => p !== null);
  return pagesForPanels(panels);
}

/**
 * Khối chữ cho một trang nháp: panel p1..pN, mỗi panel xếp phần kể lên
 * trên rồi thoại xuống dưới (vị trí mặc định — Sơn kéo lại trong Manga
 * Studio). Dùng createTextItem của Manga Studio để đúng định dạng.
 */
export function mangaPageTexts(
  page: MangaPageDraft,
  pageNumber: number,
): PanelTextItems {
  const texts: PanelTextItems = {};
  page.panels.forEach((panel, pi) => {
    const panelId = `p${pi + 1}`;
    const items = [];
    let y = 0.04;
    if (panel.narration) {
      items.push({
        ...createTextItem(
          `txt-${pageNumber}-${pi}-nar`,
          0.05,
          y,
          panel.narration,
          0.045,
          DEFAULT_TEXT_STYLE,
        ),
        w: 0.9,
      });
      y += 0.18;
    }
    for (let di = 0; di < panel.dialogues.length; di += 1) {
      items.push({
        ...createTextItem(
          `txt-${pageNumber}-${pi}-d${di}`,
          0.05,
          Math.min(y, 0.86),
          panel.dialogues[di],
          0.05,
          DEFAULT_TEXT_STYLE,
        ),
        w: 0.9,
      });
      y += 0.16;
    }
    texts[panelId] = items;
  });
  return texts;
}

/**
 * Cue dịch cho cả dự án Animation: mỗi dòng thoại thành một cue, mốc
 * thời gian cộng dồn theo thứ tự cảnh → thoại. Bản dịch khởi đầu = lời
 * gốc (Sơn sửa lại khi dịch thật); tập mới ở trạng thái "not-started".
 */
export function cuesForAnimProject(
  project: AnimProject,
  episodeId: string,
): CueV2[] {
  const cues: CueV2[] = [];
  let cursor = 0;
  for (const scene of project.scenes) {
    for (const line of scene.dialogue ?? []) {
      const text = line.text.trim();
      if (!text) continue;
      const durationSec =
        line.durationSec && line.durationSec > 0
          ? line.durationSec
          : estimateLineDurationSec(text);
      cues.push({
        id: newLibraryId("cue"),
        episodeId,
        startSec: Math.round(cursor * 100) / 100,
        durationSec: Math.round(durationSec * 100) / 100,
        sourceText: text,
        text,
        takes: [],
      });
      cursor += durationSec + 0.15;
    }
  }
  return cues;
}
