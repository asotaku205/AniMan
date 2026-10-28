/**
 * Kho lưu ảnh mẫu tham khảo, tách biệt hoàn toàn khỏi kho vẽ của Manga Studio.
 *
 * - Database riêng `animan-reference-images`, store `reference-images`,
 *   khóa theo id khung (`panelId`). Không chung store với lớp vẽ, không nằm
 *   trong `pixels` của `PanelLayerStack`, không vào lịch sử hoàn tác.
 * - Mỗi khung giữ tối đa `MAX_REFERENCE_IMAGES` ảnh; ảnh cũ nhất bị loại
 *   khi thêm ảnh thứ tư (xem `addReferenceImageToHistory`).
 * - Ảnh mẫu không bao giờ được đưa vào xuất PNG/PDF: đường xuất chỉ đọc
 *   lớp của người dùng từ kho vẽ, không đọc kho này.
 */

import {
  MAX_REFERENCE_IMAGES,
  addReferenceImageToHistory,
  removeReferenceImageFromHistory,
  type ReferenceImageItem,
} from "./referenceImages";

const DB_NAME = "animan-reference-images";
const STORE_NAME = "reference-images";
const DB_VERSION = 1;

interface ReferenceImageRecord {
  panelId: string;
  images: ReferenceImageItem[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "panelId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readRecord(panelId: string): Promise<ReferenceImageRecord | undefined> {
  return openDb().then(
    (db) =>
      new Promise<ReferenceImageRecord | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(panelId);
        request.onsuccess = () =>
          resolve(request.result as ReferenceImageRecord | undefined);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

function writeRecord(record: ReferenceImageRecord): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const request = tx.objectStore(STORE_NAME).put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

/** Đọc lịch sử ảnh mẫu của một khung; chưa có gì thì trả mảng rỗng. */
export async function loadReferenceImages(
  panelId: string,
): Promise<ReferenceImageItem[]> {
  const record = await readRecord(panelId);
  const images = record?.images ?? [];
  return images.slice(0, MAX_REFERENCE_IMAGES);
}

/**
 * Ghi đè lịch sử ảnh mẫu của một khung (đã áp giới hạn 3 ảnh, ảnh mới
 * nhất trước). Dùng cho xóa và cho đường sinh ảnh trong tương lai.
 */
export async function saveReferenceImages(
  panelId: string,
  images: ReferenceImageItem[],
): Promise<ReferenceImageItem[]> {
  const next = images.slice(0, MAX_REFERENCE_IMAGES);
  await writeRecord({ panelId, images: next });
  return next;
}

/** Thêm một ảnh mẫu vào lịch sử của khung, loại ảnh cũ nhất nếu quá 3. */
export async function addReferenceImage(
  panelId: string,
  item: ReferenceImageItem,
): Promise<ReferenceImageItem[]> {
  const current = await loadReferenceImages(panelId);
  return saveReferenceImages(panelId, addReferenceImageToHistory(current, item));
}

/** Xóa một ảnh mẫu khỏi lịch sử của khung. */
export async function deleteReferenceImage(
  panelId: string,
  id: string,
): Promise<ReferenceImageItem[]> {
  const current = await loadReferenceImages(panelId);
  return saveReferenceImages(
    panelId,
    removeReferenceImageFromHistory(current, id),
  );
}

/** Xóa toàn bộ lịch sử ảnh mẫu của một khung. */
export async function clearReferenceImages(panelId: string): Promise<void> {
  await openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const request = tx.objectStore(STORE_NAME).delete(panelId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      }),
  );
}
