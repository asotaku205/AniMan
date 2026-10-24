"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Clapperboard,
  Feather,
  Globe,
  Languages,
  Trash2,
  Upload,
} from "lucide-react";
import { SectionHeader } from "../../components/sections/SectionHeader";
import {
  formatCount,
  formatDurationSec,
  relativeTime,
  sortWorksByUpdated,
  WORK_KIND_LABEL,
  type WorkCard,
  type WorkKind,
} from "./lib/myWorks";
import {
  listNovels,
  listChapters,
  listScenes,
} from "../studio/novel/lib/novelStorage";
import { novelWords } from "../studio/novel/lib/novel";
import { getAllProjectsFromDB } from "../studio/manga-ai/lib/mangaStorage";
import { listAnimProjects } from "../studio/animation/lib/animStorage";
import { projectDurationSec } from "../studio/animation/lib/animProject";
import { listWorlds } from "../studio/world-builder/lib/dioramaStorage";
import {
  listEpisodes,
  listSeasons,
  listSeries,
} from "../studio/animation/lib/libraryStorage";
import { EPISODE_STATUS_OPTIONS } from "../studio/animation/lib/library";
import {
  deleteUpload,
  listUploads,
  type UploadRecord,
} from "../upload/lib/uploadStorage";

const MANGA_ACTIVE_KEY = "animan_manga_active_project_id_v1";
const KIND_ICON: Record<WorkKind, React.ReactNode> = {
  novel: <Feather className="w-4 h-4" />,
  manga: <BookOpen className="w-4 h-4" />,
  anim: <Clapperboard className="w-4 h-4" />,
  world: <Globe className="w-4 h-4" />,
  translate: <Languages className="w-4 h-4" />,
  upload: <Upload className="w-4 h-4" />,
};

function WorkCardView({ card }: { card: WorkCard }) {
  const inner = (
    <>
      <div className="flex items-center gap-2 text-[11px] tracking-widest uppercase text-pink-300/70">
        {KIND_ICON[card.kind]}
        {WORK_KIND_LABEL[card.kind]}
      </div>
      <div className="mt-2 flex gap-3">
        {card.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.cover}
            alt=""
            className="w-14 h-20 object-cover rounded-lg border border-white/10 shrink-0"
          />
        )}
        <div className="min-w-0">
          <div className="text-white font-medium leading-snug line-clamp-2">
            {card.title}
          </div>
          <div className="text-white/55 text-xs mt-1">{card.detail}</div>
          <div className="text-white/40 text-xs mt-1">
            Cập nhật {relativeTime(card.updatedAt)}
          </div>
        </div>
      </div>
    </>
  );
  const cls =
    "rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-pink-400/40 transition text-left w-full";
  if (!card.href) return <div className={cls}>{inner}</div>;
  return (
    <Link href={card.href} className={`block ${cls}`}>
      {inner}
    </Link>
  );
}

function WorkGrid({ cards }: { cards: WorkCard[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <WorkCardView key={`${c.kind}-${c.id}`} card={c} />
      ))}
    </div>
  );
}

function EmptyState({ to, label }: { to: string; label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center">
      <p className="text-white/60 text-sm">Chưa có gì ở đây.</p>
      <Link
        href={to}
        className="inline-block mt-3 px-4 h-10 leading-10 rounded-full btn-son text-sm"
      >
        {label}
      </Link>
    </div>
  );
}

export default function MyWorksClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const [novels, setNovels] = useState<WorkCard[]>([]);
  const [mangas, setMangas] = useState<WorkCard[]>([]);
  const [anims, setAnims] = useState<WorkCard[]>([]);
  const [worlds, setWorlds] = useState<WorkCard[]>([]);
  const [translates, setTranslates] = useState<WorkCard[]>([]);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [totalWords, setTotalWords] = useState(0);
  const [totalMangaPages, setTotalMangaPages] = useState(0);
  const [totalAnimSec, setTotalAnimSec] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const fails: string[] = [];
      // Tiểu thuyết
      try {
        const [ns, chs, scs] = await Promise.all([
          listNovels(),
          listChapters(),
          listScenes(),
        ]);
        if (!alive) return;
        let words = 0;
        setNovels(
          sortWorksByUpdated(
            ns.map((n) => {
              const myScenes = scs.filter((sc) =>
                chs.some((c) => c.id === sc.chapterId && c.novelId === n.id),
              );
              const w = novelWords(myScenes);
              words += w;
              const chCount = chs.filter((c) => c.novelId === n.id).length;
              return {
                id: n.id,
                kind: "novel" as const,
                title: n.title,
                detail: `${chCount} chương · ${formatCount(w)} từ`,
                updatedAt: n.updatedAt,
                href: "/studio/novel",
                cover: null,
              };
            }),
          ),
        );
        setTotalWords(words);
      } catch {
        fails.push("Tiểu thuyết");
      }
      // Manga
      try {
        const projects = await getAllProjectsFromDB();
        if (!alive) return;
        setTotalMangaPages(
          projects.reduce((sum, p) => sum + (p.pages?.length ?? 0), 0),
        );
        setMangas(
          sortWorksByUpdated(
            projects.map((p) => ({
              id: p.id,
              kind: "manga" as const,
              title: p.title,
              detail: `${p.pages?.length ?? 0} trang · ${p.genre}`,
              updatedAt: p.updatedAt,
              href: "/studio/manga-ai",
              cover: p.coverUrl ?? null,
            })),
          ),
        );
      } catch {
        fails.push("Manga");
      }
      // Animation
      try {
        const projects = await listAnimProjects();
        if (!alive) return;
        setTotalAnimSec(
          projects.reduce((sum, p) => sum + projectDurationSec(p), 0),
        );
        setAnims(
          sortWorksByUpdated(
            projects.map((p) => ({
              id: p.id,
              kind: "anim" as const,
              title: p.name,
              detail: `${p.scenes.length} cảnh · ${formatDurationSec(projectDurationSec(p))}`,
              updatedAt: p.updatedAt,
              href: `/studio/animation/project/${p.id}`,
              cover: null,
            })),
          ),
        );
      } catch {
        fails.push("Hoạt hình");
      }
      // World Builder
      try {
        const recs = await listWorlds();
        if (!alive) return;
        setWorlds(
          sortWorksByUpdated(
            recs.map((w) => ({
              id: w.id,
              kind: "world" as const,
              title: w.name,
              detail: `${w.state?.entities?.length ?? 0} thực thể trên sa bàn`,
              updatedAt: w.updatedAt,
              href: "/studio/world-builder",
              cover: null,
            })),
          ),
        );
      } catch {
        fails.push("Thế giới");
      }
      // Dịch/lồng tiếng
      try {
        const series = await listSeries();
        const eps: WorkCard[] = [];
        for (const sr of series) {
          const seasons = await listSeasons(sr.id);
          for (const season of seasons) {
            const episodes = await listEpisodes(season.id);
            for (const ep of episodes) {
              const status =
                EPISODE_STATUS_OPTIONS.find((o) => o.id === ep.status)?.label ??
                ep.status;
              eps.push({
                id: ep.id,
                kind: "translate" as const,
                title: `${sr.title} — Tập ${ep.number}`,
                detail: `${status} · ${formatDurationSec(ep.durationSec)}`,
                updatedAt: ep.updatedAt,
                href: `/studio/animation/translate-edit/episode/${ep.id}`,
                cover: null,
              });
            }
          }
        }
        if (!alive) return;
        setTranslates(sortWorksByUpdated(eps));
      } catch {
        fails.push("Bản dịch");
      }
      // Tác phẩm đã đăng
      try {
        const ups = await listUploads();
        if (!alive) return;
        setUploads(
          [...ups].sort((a, b) => b.createdAt - a.createdAt),
        );
      } catch {
        fails.push("Tác phẩm đã đăng");
      }
      if (alive) {
        setFailed(fails);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const uploadCards: WorkCard[] = uploads.map((u) => ({
    id: u.id,
    kind: "upload" as const,
    title: u.title,
    detail: `${u.tags.length > 0 ? u.tags.join(" · ") : u.genre || "Chưa gắn thẻ"} · ${u.visibility === "public" ? "Công khai" : u.visibility === "unlisted" ? "Có link" : "Riêng tư"}`,
    updatedAt: u.createdAt,
    href: null,
    cover: u.coverDataUrl,
  }));
  const recent = sortWorksByUpdated([
    ...novels,
    ...mangas,
    ...anims,
    ...worlds,
    ...translates,
    ...uploadCards,
  ]).slice(0, 8);

  const openManga = (id: string) => {
    try {
      window.localStorage.setItem(MANGA_ACTIVE_KEY, id);
    } catch {
      /* mở manga-ai vẫn được, chỉ không chọn sẵn dự án */
    }
    router.push("/studio/manga-ai");
  };

  const removeUpload = async (id: string) => {
    await deleteUpload(id);
    setUploads((prev) => prev.filter((u) => u.id !== id));
    setConfirmDeleteId(null);
  };

  return (
    <div className="bg-[#0b0612] min-h-screen">
      <div className="max-w-[1400px] mx-auto px-6 py-10 space-y-14">
        <div>
          <div className="text-pink-300/70 tracking-[0.4em] text-xs uppercase mb-2">
            Không gian sáng tác
          </div>
          <h1
            style={{ fontFamily: "Shippori Mincho, serif" }}
            className="text-white text-3xl md:text-4xl"
          >
            Sáng tác <span className="bg-gradient-to-r from-pink-300 to-fuchsia-300 bg-clip-text text-transparent">của tôi</span>
          </h1>
          <p className="text-white/55 text-sm mt-2 max-w-2xl">
            Mọi thứ Sơn đã làm trong các studio — tiểu thuyết, manga, phim,
            thế giới và bản dịch — gom lại một chỗ, cập nhật theo dữ liệu
            thật trên máy này.
          </p>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 h-32 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {failed.length > 0 && (
              <p className="text-sm text-amber-300">
                Không tải được: {failed.join(", ")}. Thử tải lại trang.
              </p>
            )}

            {/* Thống kê thật */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: "Tiểu thuyết", value: formatCount(novels.length) },
                { label: "Tổng số từ", value: formatCount(totalWords) },
                {
                  label: "Dự án manga",
                  value: `${formatCount(mangas.length)} · ${formatCount(totalMangaPages)} trang`,
                },
                {
                  label: "Dự án phim",
                  value: `${formatCount(anims.length)} · ${formatDurationSec(totalAnimSec)}`,
                },
                { label: "Thế giới", value: formatCount(worlds.length) },
                { label: "Tập dịch", value: formatCount(translates.length) },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="text-white text-xl font-semibold">
                    {s.value}
                  </div>
                  <div className="text-white/50 text-xs mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Tiếp tục sáng tác */}
            <section>
              <SectionHeader eyebrow="Mới nhất" title="Tiếp tục sáng tác" />
              {recent.length === 0 ? (
                <EmptyState to="/studio" label="Mở Studio bắt đầu" />
              ) : (
                <WorkGrid cards={recent} />
              )}
            </section>

            {/* Tiểu thuyết */}
            <section>
              <SectionHeader
                eyebrow="Novel Studio"
                title="Tiểu thuyết của bạn"
                seeAll="/studio/novel"
              />
              {novels.length === 0 ? (
                <EmptyState to="/studio/novel" label="Viết tiểu thuyết đầu tiên" />
              ) : (
                <WorkGrid cards={novels.slice(0, 8)} />
              )}
            </section>

            {/* Manga — bấm thẻ chọn sẵn dự án rồi mới sang studio */}
            <section>
              <SectionHeader
                eyebrow="Manga Studio"
                title="Manga của bạn"
                seeAll="/studio/manga-ai"
              />
              {mangas.length === 0 ? (
                <EmptyState to="/studio/manga-ai" label="Vẽ manga đầu tiên" />
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {mangas.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => openManga(c.id)}
                      className="text-left"
                    >
                      <WorkCardView card={{ ...c, href: null }} />
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Hoạt hình */}
            <section>
              <SectionHeader
                eyebrow="Animation Studio"
                title="Phim của bạn"
                seeAll="/studio/animation"
              />
              {anims.length === 0 ? (
                <EmptyState to="/studio/animation" label="Dựng phim đầu tiên" />
              ) : (
                <WorkGrid cards={anims.slice(0, 8)} />
              )}
            </section>

            {/* Thế giới */}
            <section>
              <SectionHeader
                eyebrow="World Builder"
                title="Thế giới của bạn"
                seeAll="/studio/world-builder"
              />
              {worlds.length === 0 ? (
                <EmptyState to="/studio/world-builder" label="Dựng thế giới đầu tiên" />
              ) : (
                <WorkGrid cards={worlds.slice(0, 8)} />
              )}
            </section>

            {/* Bản dịch */}
            <section>
              <SectionHeader
                eyebrow="Dịch & lồng tiếng"
                title="Bản dịch của bạn"
                seeAll="/studio/animation/translate-edit"
              />
              {translates.length === 0 ? (
                <EmptyState to="/studio/animation/translate-edit" label="Dịch tập đầu tiên" />
              ) : (
                <WorkGrid cards={translates.slice(0, 8)} />
              )}
            </section>

            {/* Tác phẩm đã đăng */}
            <section>
              <SectionHeader eyebrow="Upload" title="Tác phẩm đã đăng" />
              {uploadCards.length === 0 ? (
                <EmptyState to="/upload" label="Đăng tác phẩm đầu tiên" />
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {uploadCards.map((c) => (
                    <div key={c.id} className="relative">
                      <WorkCardView card={c} />
                      <button
                        type="button"
                        className="absolute top-3 right-3 flex items-center gap-1 text-xs text-red-300 bg-black/50 rounded-full px-2 py-1"
                        onClick={() =>
                          confirmDeleteId === c.id
                            ? void removeUpload(c.id)
                            : setConfirmDeleteId(c.id)
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {confirmDeleteId === c.id ? "Chắc chắn?" : "Xoá"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
