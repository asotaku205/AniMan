"use client"
import  Link from "next/link";
import { useState } from "react";
import {
  Star, Bookmark, Share2, BookMarked, Headphones, Download,
  BookOpen, Users, Clock, ChevronRight, ThumbsUp, MessageCircle,
  Play, Feather, TrendingUp, Quote
} from "lucide-react";
import { Novel, novelList } from "../../../components/data/novels";
import { ImageWithFallback } from "../../../components/ImageWithFallback";

const MOCK_REVIEWS = [
  { user: "hana_reader", color: "from-violet-500 to-fuchsia-500", rating: 9.5, comment: "Lối viết tinh tế, giàu cảm xúc. Từng đoạn văn như một bức tranh ký ức. Hiếm khi tôi đọc một cuốn mà phải đọc lại từng đoạn nhiều lần như vậy.", time: "2 ngày", likes: 142 },
  { user: "tsuki_biblio", color: "from-pink-500 to-rose-400", rating: 10, comment: "Kiệt tác. Tác giả có khả năng biến những điều bình thường thành triết lý. Nhân vật sống động đến mức tôi nghĩ mình đã gặp họ ở đâu đó.", time: "1 tuần", likes: 89 },
  { user: "sakura_reads", color: "from-sky-500 to-cyan-400", rating: 8.5, comment: "Nhịp văn hơi chậm ở đầu nhưng càng đọc càng cuốn. Ending cực kỳ ám ảnh, ngồi ngẫm mãi.", time: "3 ngày", likes: 67 },
];

export function NovelDetailPage({novel}:{novel:Novel}) {
  const n = novel;

  const [activeTab, setActiveTab] = useState<"overview" | "chapters" | "reviews">("overview");
  const related = novelList.filter((x) => x.slug !== n.slug && x.tags.some((t) => n.tags.includes(t))).slice(0, 4);
  const readProgress = Math.floor(Math.random() * 40); // mock

  const avgRating = ((MOCK_REVIEWS.reduce((s, r) => s + r.rating, 0) / MOCK_REVIEWS.length) + n.score) / 2;

  return (
    <div className="min-h-screen bg-[#0b0612]">
      {/* ── Cinematic hero ── */}
      <section className="relative overflow-hidden">
        {/* Blurred background */}
        <div className="absolute inset-0">
          <ImageWithFallback src={n.cover} alt={n.t} className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a0f06]/80 via-[#0b0612]/90 to-[#0b0612]" />
          <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,#3a2412_0%,transparent_70%)] opacity-50" />
        </div>

        <div className="relative max-w-[1400px] mx-auto px-6 pt-16 pb-20">
          <div className="grid md:grid-cols-[280px_1fr] gap-10 items-start">
            {/* Book cover */}
            <div className="relative mx-auto md:mx-0 w-56 md:w-auto animate-fadeInUp">
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-amber-200/10" style={{ transform: "perspective(800px) rotateY(-5deg)" }}>
                <ImageWithFallback src={n.cover} alt={n.t} className="absolute inset-0 w-full h-full object-cover" />
                {/* Book spine */}
                <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/70 to-transparent" />
              </div>
              {/* Floating badge */}
              <div className="absolute -bottom-3 -right-3 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-black text-xs shadow-lg">
                ✦ {n.score} / 10
              </div>
            </div>

            {/* Info */}
            <div className="animate-fadeInUp delay-100">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs tracking-widest uppercase">Tiểu thuyết</span>
                <span className={`px-3 py-1 rounded-full text-xs ${n.status === "Đang viết" ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300" : "bg-white/10 border border-white/20 text-white/60"}`}>
                  {n.status}
                </span>
              </div>

              <h1 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-amber-50 text-4xl md:text-5xl lg:text-6xl leading-tight max-w-3xl">
                {n.t}
              </h1>

              <div className="mt-3 text-amber-100/70 text-lg">
                — {n.author}
                <span className="mx-2 text-amber-100/30">·</span>
                <span className="text-amber-100/50">{n.publisher}</span>
              </div>

              {/* Stats row */}
              <div className="mt-5 flex flex-wrap items-center gap-5 text-sm">
                <div className="flex items-center gap-1.5 text-yellow-300">
                  <Star className="w-4 h-4 fill-yellow-300" />
                  <span className="text-white">{n.score}</span>
                  <span className="text-white/40">/ 10</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/60">
                  <BookMarked className="w-4 h-4" />
                  {n.words} chữ
                </div>
                <div className="flex items-center gap-1.5 text-white/60">
                  <BookOpen className="w-4 h-4" />
                  {n.chapters.length} chương
                </div>
                <div className="flex items-center gap-1.5 text-white/60">
                  <Users className="w-4 h-4" />
                  {(Math.floor(n.score * 10000)).toLocaleString()} đọc giả
                </div>
                <div className="flex items-center gap-1.5 text-white/60">
                  <Clock className="w-4 h-4" />
                  {n.year}
                </div>
              </div>

              {/* Tags */}
              <div className="mt-5 flex flex-wrap gap-2">
                {n.tags.map((t) => (
                  <span key={t} className="px-3 h-7 leading-7 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 hover:border-pink-400/30 hover:text-pink-300 transition cursor-pointer">
                    {t}
                  </span>
                ))}
              </div>

              {/* CTAs */}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                   href={`/novel/${n.slug}/1`}
                  className="h-12 px-6 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-black inline-flex items-center gap-2 shadow-[0_0_30px_rgba(245,158,11,0.4)] hover:shadow-[0_0_40px_rgba(245,158,11,0.6)] transition-all"
                >
                  <Feather className="w-4 h-4" /> Đọc từ đầu
                </Link>
                {readProgress > 0 && (
                  <Link
                    href={`/novel/${n.slug}/${Math.ceil((readProgress / 100) * n.chapters.length)}`}
                    className="h-12 px-6 rounded-full bg-white/5 border border-amber-200/30 text-amber-100 inline-flex items-center gap-2 hover:bg-white/10 transition"
                  >
                    <Play className="w-4 h-4 fill-current" /> Tiếp tục đọc ({readProgress}%)
                  </Link>
                )}
                <button className="h-12 px-5 rounded-full bg-white/5 border border-white/15 text-white inline-flex items-center gap-2 hover:bg-white/10 transition">
                  <Headphones className="w-4 h-4" /> Audiobook
                </button>
                <button className="h-12 px-5 rounded-full bg-white/5 border border-white/15 text-white inline-flex items-center gap-2 hover:bg-white/10 transition">
                  <Download className="w-4 h-4" /> EPUB
                </button>
                <button className="h-12 w-12 rounded-full bg-white/5 border border-white/15 text-white grid place-items-center hover:bg-white/10 transition">
                  <Bookmark className="w-4 h-4" />
                </button>
                <button className="h-12 w-12 rounded-full bg-white/5 border border-white/15 text-white grid place-items-center hover:bg-white/10 transition">
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tabs ── */}
      <div className="sticky top-16 z-30 bg-[#0b0612]/90 backdrop-blur border-y border-white/5">
        <div className="max-w-[1400px] mx-auto px-6 flex gap-6">
          {[
            { k: "overview", l: "Tổng quan" },
            { k: "chapters", l: `Mục lục (${n.chapters.length})` },
            { k: "reviews", l: `Đánh giá (${MOCK_REVIEWS.length})` },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setActiveTab(t.k as any)}
              className={`relative py-4 text-sm transition ${activeTab === t.k ? "text-white" : "text-white/50 hover:text-white"}`}
            >
              {t.l}
              {activeTab === t.k && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-orange-300" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <section className="py-12 bg-[#0b0612]">
        <div className="max-w-[1400px] mx-auto px-6 grid lg:grid-cols-[1fr_360px] gap-10">
          {/* Main content */}
          <div>
            {activeTab === "overview" && (
              <div className="space-y-8 animate-fadeInUp">
                {/* Synopsis */}
                <div>
                  <div className="text-white/50 text-xs uppercase tracking-widest mb-4">Giới thiệu</div>
                  <p className="text-white/80 leading-relaxed text-base">{n.synopsis}</p>
                </div>

                {/* Excerpt */}
                <div className="relative rounded-2xl bg-gradient-to-br from-amber-950/30 to-amber-900/10 border border-amber-400/15 p-8">
                  <Quote className="w-8 h-8 text-amber-300/30 mb-4" />
                  <p className="text-amber-100/90 text-xl leading-relaxed italic" style={{ fontFamily: "Shippori Mincho, serif" }}>
                    {n.excerpt}
                  </p>
                  <div className="mt-5 text-amber-400/60 text-sm">— Trích chương đầu</div>
                  <Link
                    href={`/novel/${n.slug}/1`}
                    className="mt-4 inline-flex items-center gap-2 text-amber-300 text-sm hover:text-amber-200 transition"
                  >
                    Đọc tiếp <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                {/* About author */}
                <div>
                  <div className="text-white/50 text-xs uppercase tracking-widest mb-4">Tác giả</div>
                  <div className="flex items-center gap-4 p-5 rounded-2xl bg-white/[0.025] border border-white/8">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 grid place-items-center shrink-0">
                      <Feather className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <div className="text-white">{n.author}</div>
                      <div className="text-white/50 text-sm">{n.publisher}</div>
                      <div className="text-white/40 text-xs mt-1">Tác phẩm xuất bản: {n.year}</div>
                    </div>
                  </div>
                </div>

                {/* Achievement badges */}
                <div>
                  <div className="text-white/50 text-xs uppercase tracking-widest mb-4">Giải thưởng & Nổi bật</div>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { icon: "🏆", label: "Tác phẩm của năm 2025" },
                      { icon: "📚", label: "Bán chạy Nhật Bản" },
                      { icon: "⭐", label: "Độc giả bình chọn" },
                    ].map((b) => (
                      <div key={b.label} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/8">
                        <span>{b.icon}</span>
                        <span className="text-white/70 text-sm">{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reading stats */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Lượt đọc", value: `${(n.score * 12000).toLocaleString()}`, icon: <Users className="w-4 h-4" /> },
                    { label: "Đánh giá", value: avgRating.toFixed(1), icon: <Star className="w-4 h-4" /> },
                    { label: "Hoàn thành", value: `${Math.floor(n.score * 8)}%`, icon: <TrendingUp className="w-4 h-4" /> },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl bg-white/[0.025] border border-white/8 p-4 text-center">
                      <div className="text-amber-300/70 flex justify-center mb-2">{s.icon}</div>
                      <div className="text-white text-xl" style={{ fontFamily: "Kaisei Decol, serif" }}>{s.value}</div>
                      <div className="text-white/40 text-xs mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "chapters" && (
              <div className="animate-fadeInUp">
                <div className="flex items-center justify-between mb-5">
                  <div className="text-white/50 text-xs uppercase tracking-widest">Danh sách chương</div>
                  <div className="text-white/40 text-sm">{n.chapters.length} chương · {n.words}</div>
                </div>
                <div className="space-y-2">
                  {n.chapters.map((ch, i) => (
                    <Link
                      key={ch.n}
                      href={`/novel/${n.slug}/${ch.n}`}
                      className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.025] border border-white/8 hover:bg-white/[0.05] hover:border-amber-400/20 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-sm text-white/40 group-hover:text-amber-300 transition shrink-0">
                        {ch.n}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm truncate group-hover:text-amber-200 transition">
                          Chương {ch.n}: {ch.title}
                        </div>
                        <div className="text-white/40 text-xs mt-0.5 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {(ch.words / 1000).toFixed(1)}k chữ · ~{Math.ceil(ch.words / 250)} phút
                          {i === 0 && <span className="px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 text-[9px]">MIỄN PHÍ</span>}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-amber-300 transition shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "reviews" && (
              <div className="space-y-4 animate-fadeInUp">
                {/* Write review */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 text-sm text-white/70 mb-3">
                    <MessageCircle className="w-4 h-4 text-amber-300" /> Viết đánh giá
                  </div>
                  {/* Star rating input */}
                  <div className="flex gap-1 mb-3">
                    {[1,2,3,4,5,6,7,8,9,10].map((v) => (
                      <button key={v} className="text-white/20 hover:text-yellow-300 transition text-xs">{v}</button>
                    ))}
                  </div>
                  <textarea className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm outline-none placeholder:text-white/30 resize-none" rows={3} placeholder="Chia sẻ cảm nhận của bạn về cuốn tiểu thuyết..." />
                  <div className="mt-2 flex justify-end">
                    <button className="px-4 h-9 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-black text-sm hover:from-amber-300 hover:to-orange-300 transition">Đăng đánh giá</button>
                  </div>
                </div>

                {/* Score summary */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-4xl text-white" style={{ fontFamily: "Kaisei Decol, serif" }}>{avgRating.toFixed(1)}</div>
                      <div className="flex gap-0.5 mt-1 justify-center">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(avgRating / 2) ? "fill-yellow-300 text-yellow-300" : "text-white/20"}`} />
                        ))}
                      </div>
                      <div className="text-white/40 text-xs mt-1">{MOCK_REVIEWS.length} đánh giá</div>
                    </div>
                    <div className="flex-1 space-y-1">
                      {[10,9,8,7,6].map((v) => {
                        const cnt = MOCK_REVIEWS.filter((r) => Math.round(r.rating) === v).length;
                        return (
                          <div key={v} className="flex items-center gap-2">
                            <span className="text-xs text-white/40 w-4">{v}</span>
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full" style={{ width: `${(cnt / MOCK_REVIEWS.length) * 100}%` }} />
                            </div>
                            <span className="text-xs text-white/30">{cnt}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {MOCK_REVIEWS.map((r) => (
                  <article key={r.user} className="rounded-2xl border border-white/10 bg-[#0d0817] p-5">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${r.color} shrink-0`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <span className="text-white">{r.user}</span>
                          <span className="text-white/40 text-xs">· {r.time} trước</span>
                          <span className="ml-auto flex items-center gap-1 text-yellow-300 text-sm">
                            <Star className="w-3.5 h-3.5 fill-yellow-300" />{r.rating}
                          </span>
                        </div>
                        <p className="mt-2 text-white/80 leading-relaxed">{r.comment}</p>
                        <div className="mt-3 flex items-center gap-4 text-xs text-white/50">
                          <button className="flex items-center gap-1 hover:text-amber-300 transition">
                            <ThumbsUp className="w-3.5 h-3.5" /> {r.likes}
                          </button>
                          <button className="flex items-center gap-1 hover:text-amber-300 transition">
                            <MessageCircle className="w-3.5 h-3.5" /> Trả lời
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            {/* Quick start CTA */}
            <div className="rounded-2xl bg-gradient-to-br from-amber-950/50 to-amber-900/20 border border-amber-400/20 p-6">
              <div className="text-amber-300/80 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                <Feather className="w-3.5 h-3.5" /> Bắt đầu đọc
              </div>
              <div className="text-white mb-2" style={{ fontFamily: "Shippori Mincho, serif" }}>Chương đầu miễn phí</div>
              <p className="text-white/50 text-sm mb-4">Đọc thử {Math.ceil(n.chapters[0].words / 250)} phút · {(n.chapters[0].words / 1000).toFixed(1)}k chữ</p>
              <Link
                href={`/novel/${n.slug}/1`}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-black text-sm hover:from-amber-300 hover:to-orange-300 transition"
              >
                <Feather className="w-4 h-4" /> Đọc chương 1
              </Link>
            </div>

            {/* Book info */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-white mb-4">Thông tin sách</div>
              {[
                { label: "Trạng thái", value: n.status },
                { label: "Năm", value: String(n.year) },
                { label: "Nhà xuất bản", value: n.publisher },
                { label: "Số chương", value: String(n.chapters.length) },
                { label: "Tổng số chữ", value: n.words },
                { label: "Thể loại", value: n.tags.join(", ") },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2 border-b border-white/5 last:border-0 text-sm">
                  <span className="text-white/40">{label}</span>
                  <span className="text-white/80 text-right max-w-[60%]">{value}</span>
                </div>
              ))}
            </div>

            {/* Reading time */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-white/80 text-sm mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-300" /> Thời gian đọc ước tính
              </div>
              {[
                { speed: "Chậm (150 chữ/phút)", time: `${Math.ceil((parseInt(n.words) * 1000) / 150 / 60)} giờ` },
                { speed: "Trung bình (250 chữ/phút)", time: `${Math.ceil((parseInt(n.words) * 1000) / 250 / 60)} giờ` },
                { speed: "Nhanh (400 chữ/phút)", time: `${Math.ceil((parseInt(n.words) * 1000) / 400 / 60)} giờ` },
              ].map((r) => (
                <div key={r.speed} className="flex justify-between text-xs py-1.5 text-white/50">
                  <span>{r.speed}</span>
                  <span className="text-white/70">{r.time}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>

        {/* Related novels */}
        {related.length > 0 && (
          <div className="max-w-[1400px] mx-auto px-6 mt-14">
            <div className="text-white/50 text-xs uppercase tracking-widest mb-5">Tiểu thuyết tương tự</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/novel/${r.slug}`}
                  className="group rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-amber-400/30 transition flex"
                >
                  <div className="w-20 shrink-0 relative">
                    <ImageWithFallback src={r.cover} alt={r.t} className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-y-0 right-0 w-2 bg-gradient-to-r from-transparent to-black/60" />
                  </div>
                  <div className="p-3 flex-1">
                    <div className="text-white text-sm group-hover:text-amber-200 transition" style={{ fontFamily: "Shippori Mincho, serif" }}>{r.t}</div>
                    <div className="text-xs text-white/40 mt-1">{r.author}</div>
                    <div className="flex items-center gap-1 text-xs text-yellow-300 mt-2">
                      <Star className="w-3 h-3 fill-yellow-300" />{r.score}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}