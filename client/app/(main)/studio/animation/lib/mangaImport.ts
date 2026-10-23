/**
 * Nạp panel từ Manga Studio vào Animation Studio (pipeline gợi ý
 * Manga → Animation): mỗi panel đã vẽ thành một cảnh, chữ trong panel
 * thành track thoại. Đọc qua chính storage của Manga Studio — không sao
 * chép logic lưu trữ, lỗi/không có dữ liệu thì trả danh sách rỗng.
 */

export interface MangaPanelImport {
  page: number;
  panelId: string;
  imageDataUrl: string;
  /** Câu thoại trong panel, xếp theo thứ tự đọc (trên xuống, trái sang). */
  texts: string[];
}

export async function loadMangaPanels(
  mangaProjectId: string,
): Promise<MangaPanelImport[]> {
  try {
    const { getAllProjectsFromDB, getPageDrawingRecordFromDB } = await import(
      "../../manga-ai/lib/mangaStorage"
    );
    const projects = await getAllProjectsFromDB();
    const manga = projects.find((p) => p.id === mangaProjectId);
    if (!manga) return [];
    const pages = [...manga.pages].sort((a, b) => a.pageNumber - b.pageNumber);
    const out: MangaPanelImport[] = [];
    for (const page of pages) {
      const record = await getPageDrawingRecordFromDB(
        mangaProjectId,
        page.pageNumber,
      );
      if (!record?.panels) continue;
      for (const [panelId, imageDataUrl] of Object.entries(record.panels)) {
        if (!imageDataUrl) continue;
        const items = record.texts?.[panelId] ?? [];
        const texts = [...items]
          .sort((a, b) => a.y - b.y || a.x - b.x)
          .map((t) => t.text)
          .filter(Boolean);
        out.push({ page: page.pageNumber, panelId, imageDataUrl, texts });
      }
    }
    return out;
  } catch {
    return [];
  }
}
