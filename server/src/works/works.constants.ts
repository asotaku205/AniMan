import { resolve } from "node:path";
import { WorkType } from "./work-type.enum.js";

/** Giới hạn file tác phẩm theo loại, Sơn chốt 29/10/2026. */
export const WORK_FILE_MAX_BYTES: Record<WorkType, number> = {
  [WorkType.Animation]: 1024 * 1024 * 1024,
  [WorkType.Manga]: 100 * 1024 * 1024,
  [WorkType.Novel]: 100 * 1024 * 1024,
  [WorkType.Fanart]: 100 * 1024 * 1024,
};

export const COVER_MAX_BYTES = 5 * 1024 * 1024;

export const DEFAULT_UPLOADS_DIR = "uploads";

/** Thư mục lưu file tuyệt đối, đọc từ UPLOADS_DIR hoặc mặc định. */
export function resolveUploadsDir(raw?: string | null): string {
  const dir = raw?.trim() ? raw.trim() : DEFAULT_UPLOADS_DIR;
  return resolve(process.cwd(), dir);
}
