/**
 * Kho thông báo thật (Notification): IndexedDB `animan_notifications_db`
 * v1, store `notifications` (keyPath "id"). Thông báo chỉ sinh ra từ
 * hành động thật trong app (đăng tác phẩm, tạo dự án từ cầu nối, chụp
 * snapshot) — không còn danh sách mẫu. Cài đặt loại nào được ghi nằm
 * ở localStorage và do SettingPanel / trang Cài đặt sửa.
 */

export type AppNotifType = "upload" | "bridge" | "snapshot" | "system";

export const NOTIF_TYPE_LABEL: Record<AppNotifType, string> = {
  upload: "Đăng tác phẩm",
  bridge: "Cầu nối",
  snapshot: "Snapshot",
  system: "Hệ thống",
};

export interface AppNotification {
  id: string;
  type: AppNotifType;
  title: string;
  body: string;
  link: string | null;
  createdAt: number;
  read: boolean;
}

export interface NotifSettings {
  uploads: boolean;
  bridges: boolean;
  snapshots: boolean;
  system: boolean;
}

export const DEFAULT_NOTIF_SETTINGS: NotifSettings = {
  uploads: true,
  bridges: true,
  snapshots: true,
  system: true,
};

const DB_NAME = "animan_notifications_db";
const DB_VERSION = 1;
const STORE = "notifications";
const SETTINGS_KEY = "animan_notif_settings_v1";
export const NOTIF_CHANGED_EVENT = "animan:notifications-changed";

const isBrowser = typeof indexedDB !== "undefined";

let counter = 0;
export function newNotifId(): string {
  counter += 1;
  return `notif-${Date.now().toString(36)}-${counter.toString(36)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.onerror = () => reject(t.error);
      }),
  );
}

export async function listNotifications(): Promise<AppNotification[]> {
  if (!isBrowser) return [];
  const all = (await tx("readonly", (s) => s.getAll())) ?? [];
  return (all as AppNotification[]).sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveNotification(n: AppNotification): Promise<void> {
  if (!isBrowser) return;
  await tx("readwrite", (s) => s.put(n));
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!isBrowser) return;
  const all = await listNotifications();
  const found = all.find((n) => n.id === id);
  if (found) await saveNotification({ ...found, read: true });
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!isBrowser) return;
  const all = await listNotifications();
  for (const n of all) {
    if (!n.read) await saveNotification({ ...n, read: true });
  }
}

export async function deleteNotification(id: string): Promise<void> {
  if (!isBrowser) return;
  await tx("readwrite", (s) => s.delete(id));
}

export function loadNotifSettings(): NotifSettings {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return DEFAULT_NOTIF_SETTINGS;
    }
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_NOTIF_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<NotifSettings>;
    return { ...DEFAULT_NOTIF_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_NOTIF_SETTINGS;
  }
}

export function saveNotifSettings(next: NotifSettings): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    }
  } catch {
    /* không chặn ghi khi storage bị chặn */
  }
}

/** Báo cho chuông Navbar và các nơi khác tải lại số chưa đọc. */
export function notifyNotificationsChanged(): void {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(NOTIF_CHANGED_EVENT));
    }
  } catch {
    /* bỏ qua */
  }
}

const SETTING_BY_TYPE: Record<AppNotifType, keyof NotifSettings> = {
  upload: "uploads",
  bridge: "bridges",
  snapshot: "snapshots",
  system: "system",
};

/**
 * Ghi một thông báo thật — tôn trọng toggle loại tương ứng: tắt rồi
 * thì không ghi nữa (thông báo cũ vẫn còn cho đến khi Sơn xoá tay).
 */
export async function recordNotification(
  type: AppNotifType,
  title: string,
  body: string,
  link: string | null,
): Promise<AppNotification | null> {
  if (!isBrowser) return null;
  if (!loadNotifSettings()[SETTING_BY_TYPE[type]]) return null;
  const n: AppNotification = {
    id: newNotifId(),
    type,
    title,
    body,
    link,
    createdAt: Date.now(),
    read: false,
  };
  await saveNotification(n);
  notifyNotificationsChanged();
  return n;
}
