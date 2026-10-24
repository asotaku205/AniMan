"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/auth/AuthProvider";
import CoverPhoto from "./components/CoverPhoto";
import ProfileHeader from "./components/ProfileHeader";
import ProfileStats, { type ProfileStat } from "./components/ProfileStats";
import ProfileBadges, { type ProfileBadge } from "./components/ProfileBadges";
import ProfileTab from "./components/ProfileTab";
import ProfileActivity, { type ActivityItem } from "./components/ProfileActivity";
import ProfileAbout from "./components/ProfileAbout";
import { Tab } from "./data";
import {
  listChapters,
  listNovels,
  listScenes,
} from "../studio/novel/lib/novelStorage";
import { novelWords } from "../studio/novel/lib/novel";
import { getAllProjectsFromDB } from "../studio/manga-ai/lib/mangaStorage";
import { listAnimProjects } from "../studio/animation/lib/animStorage";
import { listWorlds } from "../studio/world-builder/lib/dioramaStorage";
import {
  listEpisodes,
  listSeasons,
  listSeries,
} from "../studio/animation/lib/libraryStorage";
import { listUploads } from "../upload/lib/uploadStorage";
import {
  formatCount,
  relativeTime,
  sortWorksByUpdated,
  WORK_KIND_LABEL,
  type WorkCard,
} from "../my-works/lib/myWorks";

/**
 * Hồ sơ thật: danh tính từ tài khoản, thống kê + hoạt động + huy hiệu
 * tính từ 5 studio và tác phẩm đã đăng. Không còn tên giả, số liệu
 * mock hay tab Xem sau/Bộ sưu tập bịa.
 */
export default function ProfilePageClient() {
  const { user, isLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("activity");
  const [stats, setStats] = useState<ProfileStat[]>([]);
  const [badges, setBadges] = useState<ProfileBadge[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [works, setWorks] = useState<WorkCard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failedSources, setFailedSources] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    const failed: string[] = [];
    const cards: WorkCard[] = [];
    let novelCount = 0;
    let totalWords = 0;
    let mangaCount = 0;
    let animCount = 0;
    let worldCount = 0;
    let episodeCount = 0;
    let uploadCount = 0;

    void (async () => {
      try {
        const [novels, chapters, scenes] = await Promise.all([
          listNovels(),
          listChapters(),
          listScenes(),
        ]);
        novelCount = novels.length;
        const wordsByNovel = new Map<string, number>();
        for (const n of novels) {
          const chIds = new Set(
            chapters.filter((c) => c.novelId === n.id).map((c) => c.id),
          );
          const w = novelWords(
            scenes.filter((s) => chIds.has(s.chapterId)),
          );
          wordsByNovel.set(n.id, w);
          totalWords += w;
          const chCount = chapters.filter((c) => c.novelId === n.id).length;
          cards.push({
            id: `novel-${n.id}`,
            kind: "novel",
            title: n.title,
            detail: `${chCount} chương · ${formatCount(w)} từ`,
            updatedAt: n.updatedAt,
            href: "/studio/novel",
            cover: null,
          });
        }
      } catch {
        failed.push("Tiểu thuyết");
      }
      try {
        const projects = await getAllProjectsFromDB();
        mangaCount = projects.length;
        for (const p of projects) {
          cards.push({
            id: `manga-${p.id}`,
            kind: "manga",
            title: p.title || "Dự án manga",
            detail: `${p.pages?.length ?? 0} trang · ${p.genre}`,
            updatedAt: p.updatedAt,
            href: "/my-works",
            cover: p.coverUrl ?? null,
          });
        }
      } catch {
        failed.push("Manga");
      }
      try {
        const projects = await listAnimProjects();
        animCount = projects.length;
        for (const p of projects) {
          cards.push({
            id: `anim-${p.id}`,
            kind: "anim",
            title: p.name,
            detail: `${p.scenes.length} cảnh`,
            updatedAt: p.updatedAt,
            href: `/studio/animation/project/${p.id}`,
            cover: null,
          });
        }
      } catch {
        failed.push("Animation");
      }
      try {
        const worlds = await listWorlds();
        worldCount = worlds.length;
        for (const w of worlds) {
          cards.push({
            id: `world-${w.id}`,
            kind: "world",
            title: w.name,
            detail: `${w.state.entities.length} thực thể`,
            updatedAt: w.updatedAt,
            href: "/my-works",
            cover: null,
          });
        }
      } catch {
        failed.push("World Builder");
      }
      try {
        const series = await listSeries();
        for (const sr of series) {
          const seasons = await listSeasons(sr.id);
          for (const season of seasons) {
            const episodes = await listEpisodes(season.id);
            episodeCount += episodes.length;
            for (const ep of episodes) {
              cards.push({
                id: `ep-${ep.id}`,
                kind: "translate",
                title: `${sr.title} — Tập ${ep.number}`,
                detail: ep.title || "Tập dịch",
                updatedAt: ep.updatedAt,
                href: `/studio/animation/translate-edit/episode/${ep.id}`,
                cover: null,
              });
            }
          }
        }
      } catch {
        failed.push("Dịch/lồng tiếng");
      }
      try {
        const uploads = await listUploads();
        uploadCount = uploads.length;
        for (const u of uploads) {
          cards.push({
            id: `upload-${u.id}`,
            kind: "upload",
            title: u.title,
            detail: u.genre || WORK_KIND_LABEL.upload,
            updatedAt: u.updatedAt,
            href: "/my-works",
            cover: u.coverDataUrl ?? null,
          });
        }
      } catch {
        failed.push("Tác phẩm đã đăng");
      }
      if (!alive) return;
      const sorted = sortWorksByUpdated(cards);
      setWorks(sorted);
      setActivity(
        sorted.slice(0, 8).map((w) => ({
          id: w.id,
          text:
            w.kind === "upload" ? "Đã đăng tác phẩm" : "Đã cập nhật",
          target: w.title,
          link: w.href ?? "/my-works",
          time: relativeTime(w.updatedAt),
        })),
      );
      setStats([
        {
          value: formatCount(novelCount),
          label: "Tiểu thuyết",
          color: "text-amber-300",
        },
        {
          value: formatCount(totalWords),
          label: "Tổng số từ",
          color: "text-amber-300",
        },
        {
          value: formatCount(mangaCount),
          label: "Dự án manga",
          color: "text-violet-300",
        },
        {
          value: formatCount(animCount),
          label: "Dự án phim",
          color: "text-sky-300",
        },
      ]);
      setBadges([
        {
          icon: "📖",
          label: "Mọt tiểu thuyết",
          color: "from-amber-500 to-orange-400",
          unlocked: totalWords >= 10000,
        },
        {
          icon: "🎨",
          label: "Fan Art Creator",
          color: "from-violet-500 to-fuchsia-400",
          unlocked: mangaCount >= 1,
        },
        {
          icon: "🎬",
          label: "Đạo diễn",
          color: "from-sky-500 to-blue-400",
          unlocked: animCount >= 1,
        },
        {
          icon: "🌍",
          label: "Kiến trúc sư thế giới",
          color: "from-emerald-500 to-teal-400",
          unlocked: worldCount >= 1,
        },
        {
          icon: "🎧",
          label: "Dịch giả",
          color: "from-pink-500 to-rose-400",
          unlocked: episodeCount >= 1,
        },
        {
          icon: "⭐",
          label: "Người đăng bài",
          color: "from-yellow-400 to-amber-400",
          unlocked: uploadCount >= 1,
        },
      ]);
      setFailedSources(failed);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const displayName = user?.displayName ?? "Khách";
  const username = user?.username ?? "guest";
  const roleLabel = user?.role === "admin" ? "Quản trị viên" : "Người dùng";
  const joinedLabel = user
    ? `Tham gia từ ${new Date(user.createdAt).toLocaleDateString("vi-VN")}`
    : "Chưa đăng nhập — đăng nhập để xem hồ sơ thật của Sơn.";

  return (
    <div className="min-h-screen bg-[#07040e]">
      <CoverPhoto isOwnProfile={!!user} />

      <div className="max-w-[1000px] mx-auto px-4 sm:px-6">
        <ProfileHeader
          isOwnProfile={!!user}
          displayName={displayName}
          username={username}
          roleLabel={roleLabel}
          joinedLabel={joinedLabel}
        />

        {!isLoading && !user && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-6 text-sm text-white/70">
            Chưa đăng nhập — hồ sơ đang hiện trạng thái khách.{" "}
            <Link href="/auth" className="text-pink-300 hover:text-pink-200">
              Đăng nhập
            </Link>{" "}
            để xem danh tính và thống kê thật.
          </div>
        )}

        {failedSources.length > 0 && (
          <p className="text-amber-200/70 text-xs mb-4">
            Không tải được: {failedSources.join(", ")}.
          </p>
        )}

        <ProfileStats stats={stats} />
        <ProfileBadges badges={badges} />

        <ProfileTab tab={tab} setTab={setTab} />

        {tab === "activity" && (
          <ProfileActivity items={loaded ? activity : []} />
        )}

        {tab === "works" && (
          <div className="pb-16">
            {works.length === 0 ? (
              <p className="text-white/30 text-sm py-16 text-center">
                Chưa có sáng tác nào.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {works.map((w) => (
                  <Link
                    key={w.id}
                    href={w.href ?? "/my-works"}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition"
                  >
                    <p className="text-white/40 text-xs">
                      {WORK_KIND_LABEL[w.kind]} · {relativeTime(w.updatedAt)}
                    </p>
                    <p className="text-white text-sm font-medium mt-1 truncate">
                      {w.title}
                    </p>
                    <p className="text-white/50 text-xs mt-1">{w.detail}</p>
                  </Link>
                ))}
              </div>
            )}
            <Link
              href="/my-works"
              className="mt-6 inline-block rounded-xl bg-gradient-to-r from-sky-500 to-indigo-400 px-5 py-2.5 text-sm font-medium text-white"
            >
              Xem tất cả trong Sáng tác của tôi →
            </Link>
          </div>
        )}

        {tab === "about" && (
          <ProfileAbout
            displayName={displayName}
            username={username}
            roleLabel={roleLabel}
            joinedLabel={joinedLabel}
            isOwnProfile={!!user}
          />
        )}
      </div>
    </div>
  );
}
