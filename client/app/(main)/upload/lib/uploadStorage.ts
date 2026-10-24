/**
 * Kho tác phẩm đã đăng (Upload): IndexedDB `animan_uploads_db` v1, store
 * `uploads` (keyPath "id"). Khác với các studio (dữ liệu làm việc), đây
 * là bản ghi "đã đăng" — sau khi đăng, tác phẩm hiện trong trang
 * "Sáng tác của tôi" (/my-works). File/ảnh lưu dạng dataUrl kèm bản ghi
 * (giới hạn ở form: file tác phẩm ≤10MB, ảnh bìa ≤5MB).
 */

export type UploadWorkType = "manga" | "novel" | "animation" | "fanart";
export type UploadVisibility = "public" | "unlisted" | "private";

export interface UploadSourceRef {
  kind: "manga" | "anim" | "novel";
  id: string;
  label: string;
}

export interface UploadRecord {
  id: string;
  type: UploadWorkType;
  title: string;
  desc: string;
  genre: string;
  tags: string[];
  visibility: UploadVisibility;
  coverDataUrl: string | null;
  fileName: string | null;
  fileSize: number;
  fileDataUrl: string | null;
  sourceRef: UploadSourceRef | null;
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = "animan_uploads_db";
const DB_VERSION = 1;
const STORE_UPLOADS = "uploads";

const isBrowser = typeof indexedDB !== "undefined";

let counter = 0;
export function newUploadId(prefix = "up"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_UPLOADS)) {
        db.createObjectStore(STORE_UPLOADS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listUploads(): Promise<UploadRecord[]> {
  if (!isBrowser) return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_UPLOADS, "readonly");
    const req = tx.objectStore(STORE_UPLOADS).getAll();
    req.onsuccess = () => resolve((req.result ?? []) as UploadRecord[]);
    req.onerror = () => reject(req.error);
  });
}

export async function saveUpload(record: UploadRecord): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_UPLOADS, "readwrite");
    const req = tx.objectStore(STORE_UPLOADS).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteUpload(id: string): Promise<void> {
  if (!isBrowser) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_UPLOADS, "readwrite");
    const req = tx.objectStore(STORE_UPLOADS).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Giới hạn file ở form upload (byte). */
export const WORK_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const COVER_MAX_BYTES = 5 * 1024 * 1024;

/** Accept cho input file tác phẩm theo từng loại. */
export function workFileAccept(type: UploadWorkType): string {
  switch (type) {
    case "manga":
    case "fanart":
      return "image/*";
    case "novel":
      return ".pdf,.doc,.docx,.txt,.md";
    case "animation":
      return "video/*";
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
