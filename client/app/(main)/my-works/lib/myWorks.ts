/**
 * Helper thuần cho trang "Sáng tác của tôi" (/my-works): thẻ tác phẩm
 * thống nhất từ 6 nguồn (tiểu thuyết, manga, animation, world builder,
 * dịch/lồng tiếng, tác phẩm đã đăng) + định dạng thời gian/thời lượng.
 */

export type WorkKind =
  | "novel"
  | "manga"
  | "anim"
  | "world"
  | "translate"
  | "upload";

export const WORK_KIND_LABEL: Record<WorkKind, string> = {
  novel: "Tiểu thuyết",
  manga: "Manga",
  anim: "Hoạt hình",
  world: "Thế giới",
  translate: "Bản dịch",
  upload: "Đã đăng",
};

export interface WorkCard {
  id: string;
  kind: WorkKind;
  title: string;
  detail: string;
  updatedAt: number;
  /** Route mở tác phẩm (null = thẻ không dẫn đi đâu, vd tác phẩm đã đăng). */
  href: string | null;
  cover: string | null;
}

/** Mới nhất trước; bằng nhau thì theo tên cho ổn định. */
export function sortWorksByUpdated(items: WorkCard[]): WorkCard[] {
  return [...items].sort(
    (a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title),
  );
}

/** "vừa xong" / "X phút trước" / "X giờ trước" / "X ngày trước" / ngày vi-VN. */
export function relativeTime(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "vừa xong";
  if (min < 60) return `${min} phút trước`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} giờ trước`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} ngày trước`;
  return new Date(ts).toLocaleDateString("vi-VN");
}

/** "45 giây" / "1 phút 20 giây" / "12 phút". */
export function formatDurationSec(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  if (total < 60) return `${total} giây`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m} phút` : `${m} phút ${s} giây`;
}

/** "1.234 từ" — nhóm nghìn theo kiểu vi-VN. */
export function formatCount(n: number): string {
  return n.toLocaleString("vi-VN");
}
