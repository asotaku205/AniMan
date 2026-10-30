/**
 * Kế hoạch khung từ cầu nối Novel -> Manga (AI phân tích).
 *
 * Kế hoạch lưu RIÊNG khỏi kho vẽ, giống kho ảnh mẫu: database riêng,
 * store riêng, khóa theo project + số trang. Lý do giống nhau: kế hoạch
 * là dữ liệu tham khảo để sinh ảnh mẫu, không bao giờ là lớp vẽ, không
 * vào lịch sử hoàn tác, không vào bản xuất. Lưu vẽ (savePageDrawingToDB)
 * không bao giờ chạm tới kho này, nên kế hoạch không mất khi Sơn vẽ/xóa
 * lớp, và ngược lại.
 */

import type { SceneType } from "../data";

/** Loại cảnh của kế hoạch khung: 5 loại thật, không có auto. */
export type PanelPlanSceneType = Exclude<SceneType, "auto">;

/** Kế hoạch của một khung: prompt sinh ảnh mẫu + tham khảo thoại/bố cục. */
export interface PanelPlan {
  /** Mô tả hình ảnh để sinh ảnh mẫu, Sơn sửa thoải mái trong Manga Studio. */
  prompt: string;
  /** Loại cảnh gợi ý, Manga Studio điền sẵn vào ô loại cảnh. */
  sceneType: PanelPlanSceneType;
  /** Thoại trích nguyên văn từ cảnh, chỉ để tham khảo và đặt khối chữ. */
  dialogue: string[];
  /** Ghi chú bố cục tham khảo. */
  note: string;
  /** Tên cảnh nguồn trong Novel, để Sơn biết khung này từ đâu ra. */
  sourceSceneTitle: string;
}

/** Kế hoạch của một trang: layout + khung theo thứ tự p1, p2, ... */
export interface PanelPlanPage {
  layoutId: string;
  plans: PanelPlan[];
}

const DB_NAME = "animan-panel-plans";
const STORE_NAME = "panel-plans";
const DB_VERSION = 1;

interface PanelPlanRecord {
  key: string;
  projectId: string;
  pageNumber: number;
  plans: Record<string, PanelPlan>;
}

function planKey(projectId: string, pageNumber: number): string {
  return `${projectId}:${pageNumber}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Lưu kế hoạch khung của một trang (ghi đè toàn bộ trang đó). */
export async function savePanelPlans(
  projectId: string,
  pageNumber: number,
  plans: Record<string, PanelPlan>,
): Promise<void> {
  if (!projectId || !pageNumber) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({
      key: planKey(projectId, pageNumber),
      projectId,
      pageNumber,
      plans,
    } satisfies PanelPlanRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Đọc kế hoạch khung của một trang, rỗng khi trang không có kế hoạch. */
export async function loadPanelPlans(
  projectId: string,
  pageNumber: number,
): Promise<Record<string, PanelPlan>> {
  if (!projectId || !pageNumber) return {};
  try {
    const db = await openDb();
    const record = await new Promise<PanelPlanRecord | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(planKey(projectId, pageNumber));
        request.onsuccess = () =>
          resolve(request.result as PanelPlanRecord | undefined);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      },
    );
    return record?.plans ?? {};
  } catch {
    return {};
  }
}
