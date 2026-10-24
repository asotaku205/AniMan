import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatDurationSec,
  relativeTime,
  sortWorksByUpdated,
  type WorkCard,
} from "../lib/myWorks";

const card = (over: Partial<WorkCard>): WorkCard => ({
  id: "x",
  kind: "novel",
  title: "A",
  detail: "",
  updatedAt: 1000,
  href: null,
  cover: null,
  ...over,
});

describe("myWorks — sắp xếp + định dạng", () => {
  it("mới nhất trước, bằng nhau thì theo tên", () => {
    const items = [
      card({ id: "1", title: "B", updatedAt: 1000 }),
      card({ id: "2", title: "A", updatedAt: 2000 }),
      card({ id: "3", title: "C", updatedAt: 1000 }),
    ];
    expect(sortWorksByUpdated(items).map((c) => c.id)).toEqual([
      "2",
      "1",
      "3",
    ]);
  });

  it("thời gian tương đối theo mốc", () => {
    const now = Date.now();
    expect(relativeTime(now, now)).toBe("vừa xong");
    expect(relativeTime(now - 5 * 60000, now)).toBe("5 phút trước");
    expect(relativeTime(now - 3 * 3600000, now)).toBe("3 giờ trước");
    expect(relativeTime(now - 2 * 86400000, now)).toBe("2 ngày trước");
  });

  it("thời lượng phim gọn", () => {
    expect(formatDurationSec(45)).toBe("45 giây");
    expect(formatDurationSec(80)).toBe("1 phút 20 giây");
    expect(formatDurationSec(600)).toBe("10 phút");
  });

  it("đếm theo kiểu vi-VN", () => {
    expect(formatCount(1234)).toBe("1.234");
  });
});
