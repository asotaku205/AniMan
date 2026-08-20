"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Heart, MessageCircle, Bookmark, Share2, Eye, Sparkles, Upload, Search, X,
  Star, Send, ChevronDown, TrendingUp, Clock, Award, Check,
} from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { ImageWithFallback } from "../../components/ImageWithFallback";
import { Work, TYPE_META, SEED_WORKS, Feedback, SEED_FEEDBACK,SortKey,WorkType } from "./data";


export default function CommunityWorksPageClient() {
  const [works, setWorks] = useState<Work[]>(SEED_WORKS);
  const [feedback, setFeedback] = useState<Record<string, Feedback[]>>(SEED_FEEDBACK);
  const [filter, setFilter] = useState<WorkType | "all">("all");
  const [sort, setSort] = useState<SortKey>("hot");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Work | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const toggleLike = (id: string) => setWorks((prev) => prev.map((w) => w.id === id ? { ...w, liked: !w.liked, likes: w.likes + (w.liked ? -1 : 1) } : w));
  const toggleSave = (id: string) => setWorks((prev) => prev.map((w) => w.id === id ? { ...w, saved: !w.saved, saves: w.saves + (w.saved ? -1 : 1) } : w));

  const filtered = useMemo(() => {
    let list = works.filter((w) => filter === "all" || w.type === filter);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((w) => `${w.title} ${w.author} ${w.tags.join(" ")}`.toLowerCase().includes(q));
    }
    if (sort === "hot") list = [...list].sort((a, b) => (b.likes + b.feedbackCount * 2) - (a.likes + a.feedbackCount * 2));
    if (sort === "new") list = [...list].reverse();
    if (sort === "top") list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [works, filter, sort, query]);

  const stats = useMemo(() => ({
    total: works.length,
    feedback: works.reduce((s, w) => s + w.feedbackCount, 0),
    views: works.reduce((s, w) => s + w.views, 0),
  }), [works]);

  return (
    <>
      <PageHeader
        eyebrow="Sáng tác cộng đồng"
        title="Tác phẩm của người sáng tác"
        desc="Nơi cộng đồng đăng sáng tác cá nhân — manga, tiểu thuyết, animation, fan art — và nhận góp ý chân thành từ người xem."
      >
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 px-4 h-11 rounded-full glass-washi">
            <span className="text-[11px] tracking-[0.3em] uppercase text-[#f0c75e]/80">Hôm nay</span>
            <span className="w-px h-4 bg-white/15" />
            <span className="text-sm text-white/80"><b className="text-white">{stats.total}</b> tác phẩm</span>
            <span className="text-sm text-white/80"><b className="text-white">{stats.feedback}</b> góp ý</span>
            <span className="text-sm text-white/80 hidden sm:inline"><b className="text-white">{stats.views.toLocaleString()}</b> lượt xem</span>
          </div>
          <button
            onClick={() => document.dispatchEvent(new CustomEvent("sakura:open-upload"))}
            className="inline-flex items-center gap-2 px-5 h-11 rounded-full btn-son text-sm"
          >
            <Upload className="w-4 h-4" /> Đăng tác phẩm của bạn
          </button>
        </div>
      </PageHeader>

      <section className="relative py-8 md:py-12">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          {/* Filter bar */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <Chip active={filter === "all"} onClick={() => setFilter("all")} label="Tất cả" />
              {(Object.keys(TYPE_META) as WorkType[]).map((t) => (
                <Chip key={t} active={filter === t} onClick={() => setFilter(t)} icon={TYPE_META[t].icon} label={TYPE_META[t].label} />
              ))}
            </div>
            <div className="lg:ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tác phẩm, tác giả, thẻ…"
                  className="w-full lg:w-72 h-10 pl-9 pr-3 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-pink-400/40" />
              </div>
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1">
                {([
                  { k: "hot", icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Nổi bật" },
                  { k: "new", icon: <Clock className="w-3.5 h-3.5" />, label: "Mới" },
                  { k: "top", icon: <Award className="w-3.5 h-3.5" />, label: "Xếp hạng" },
                ] as const).map((s) => (
                  <button key={s.k} onClick={() => setSort(s.k)}
                    className={`flex items-center gap-1 px-3 h-8 rounded-full text-xs transition ${sort === s.k ? "bg-gradient-to-r from-pink-500 to-rose-400 text-white" : "text-white/60 hover:text-white"}`}>
                    {s.icon}<span className="hidden sm:inline">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-white/40">
              <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>Chưa có tác phẩm khớp bộ lọc — hãy là người đầu tiên đăng!</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {filtered.map((w) => (
                <WorkCard
                  key={w.id}
                  work={w}
                  feedbackCount={(feedback[w.id]?.length ?? w.feedbackCount)}
                  onOpen={() => setActive(w)}
                  onLike={() => toggleLike(w.id)}
                  onSave={() => toggleSave(w.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {active && (
        <WorkDetailModal
          work={active}
          feedback={feedback[active.id] ?? []}
          onClose={() => setActive(null)}
          onLike={() => toggleLike(active.id)}
          onSave={() => toggleSave(active.id)}
          onAddFeedback={(fb) => {
            setFeedback((prev) => ({ ...prev, [active.id]: [...(prev[active.id] ?? []), fb] }));
            setWorks((prev) => prev.map((w) => w.id === active.id ? { ...w, feedbackCount: w.feedbackCount + 1 } : w));
            setToast("Cảm ơn — góp ý của bạn đã được gửi");
          }}
          onLikeFeedback={(fid) => {
            setFeedback((prev) => ({
              ...prev,
              [active.id]: (prev[active.id] ?? []).map((f) => f.id === fid ? { ...f, liked: !f.liked, likes: f.likes + (f.liked ? -1 : 1) } : f),
            }));
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-full bg-[#1a0f2e] border border-pink-400/40 text-white text-sm shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center gap-2">
          <Check className="w-4 h-4 text-pink-300" /> {toast}
        </div>
      )}
    </>
  );
}

function Chip({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon?: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 md:px-4 h-9 rounded-full text-xs transition ${active ? "btn-son" : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"}`}>
      {icon}{label}
    </button>
  );
}

function WorkCard({ work, feedbackCount, onOpen, onLike, onSave }: {
  work: Work; feedbackCount: number; onOpen: () => void; onLike: () => void; onSave: () => void;
}) {
  const meta = TYPE_META[work.type];
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
  return (
    <article onClick={onOpen} className="group cursor-pointer rounded-2xl overflow-hidden border border-white/10 bg-[#0d0817] hover:border-pink-400/40 hover-lift transition flex flex-col">
      <div className="relative aspect-[4/3] overflow-hidden">
        <ImageWithFallback src={work.cover} alt={work.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className={`px-2 py-1 rounded-full bg-gradient-to-r ${meta.color} text-white text-[10px] flex items-center gap-1`}>
            {meta.icon} {meta.label}
          </span>
          <span className="px-2 py-1 rounded bg-black/60 backdrop-blur text-[#f0c75e] text-[10px] flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-current" /> {work.rating.toFixed(1)}
          </span>
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-white/80">
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {work.views.toLocaleString()}</span>
          <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {feedbackCount} góp ý</span>
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-white text-base line-clamp-1 font-jp-serif">{work.title}</h3>
        <p className="text-white/55 text-xs mt-1 line-clamp-2 leading-relaxed">{work.excerpt}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className={`w-7 h-7 rounded-full bg-gradient-to-br ${work.authorColor} ring-1 ring-white/20`} />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white/85 truncate">{work.author}</div>
            <div className="text-[10px] text-white/35">{work.time} trước</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {work.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/55">#{t}</span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1 pt-3 border-t border-white/5">
          <button onClick={(e) => { stop(e); onLike(); }} className={`flex items-center gap-1 px-2.5 h-8 rounded-lg text-xs transition ${work.liked ? "bg-pink-500/20 text-pink-300" : "text-white/60 hover:bg-white/5"}`}>
            <Heart className={`w-3.5 h-3.5 ${work.liked ? "fill-pink-400" : ""}`} /> {work.likes}
          </button>
          <button onClick={(e) => { stop(e); onOpen(); }} className="flex items-center gap-1 px-2.5 h-8 rounded-lg text-xs text-white/60 hover:bg-white/5 transition">
            <MessageCircle className="w-3.5 h-3.5" /> Góp ý
          </button>
          <button onClick={(e) => { stop(e); onSave(); }} className={`flex items-center gap-1 px-2.5 h-8 rounded-lg text-xs transition ${work.saved ? "bg-amber-500/15 text-amber-300" : "text-white/60 hover:bg-white/5"}`}>
            <Bookmark className={`w-3.5 h-3.5 ${work.saved ? "fill-amber-400" : ""}`} /> {work.saves}
          </button>
          <div className="flex-1" />
          <button onClick={(e) => { stop(e); }} className="p-2 rounded-lg text-white/40 hover:bg-white/5 transition">
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

function WorkDetailModal({ work, feedback, onClose, onLike, onSave, onAddFeedback, onLikeFeedback }: {
  work: Work;
  feedback: Feedback[];
  onClose: () => void;
  onLike: () => void;
  onSave: () => void;
  onAddFeedback: (fb: Feedback) => void;
  onLikeFeedback: (id: string) => void;
}) {
  const meta = TYPE_META[work.type];
  const [text, setText] = useState("");
  const [story, setStory] = useState(0);
  const [art, setArt] = useState(0);
  const [pacing, setPacing] = useState(0);
  const [showRating, setShowRating] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  const submit = () => {
    if (!text.trim()) return;
    const newFb: Feedback = {
      id: `f${Date.now()}`,
      user: "Bạn",
      color: "from-pink-500 to-violet-500",
      text: text.trim(),
      rating: showRating && (story || art || pacing) ? { story, art, pacing } : undefined,
      time: "Vừa xong",
      likes: 0,
      liked: false,
    };
    onAddFeedback(newFb);
    setText(""); setStory(0); setArt(0); setPacing(0); setShowRating(false);
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-end md:items-center justify-center p-0 md:p-6 overscroll-contain">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-4xl max-h-[94dvh] flex flex-col bg-[#130d20] border border-white/10 md:rounded-3xl rounded-t-3xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] overflow-hidden">
        {/* Header strip */}
        <div className="shrink-0 flex items-center justify-between px-5 md:px-6 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`px-2 py-1 rounded-full bg-gradient-to-r ${meta.color} text-white text-[10px] flex items-center gap-1 shrink-0`}>
              {meta.icon} {meta.label}
            </span>
            <span className="text-white/40 text-xs truncate">@{work.author} · {work.time} trước</span>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 grid place-items-center text-white/70 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="grid md:grid-cols-[1fr_360px]">
            {/* Left: work content */}
            <div>
              <div className="relative aspect-[16/10] overflow-hidden bg-black">
                <ImageWithFallback src={work.cover} alt={work.title} className="absolute inset-0 w-full h-full object-cover" />
              </div>
              <div className="p-5 md:p-6">
                <h2 className="text-white text-2xl font-jp-serif">{work.title}</h2>
                <div className="mt-2 flex items-center gap-3 text-xs text-white/55">
                  <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {work.views.toLocaleString()}</span>
                  <span className="flex items-center gap-1 text-[#f0c75e]"><Star className="w-3.5 h-3.5 fill-current" /> {work.rating.toFixed(1)}</span>
                  <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {work.likes}</span>
                </div>
                <p className="mt-4 text-white/75 leading-relaxed">{work.excerpt}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {work.tags.map((t) => (
                    <span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">#{t}</span>
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-2">
                  <button onClick={onLike} className={`inline-flex items-center gap-1.5 px-4 h-10 rounded-full text-sm transition ${work.liked ? "bg-pink-500/20 text-pink-300 border border-pink-400/40" : "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"}`}>
                    <Heart className={`w-4 h-4 ${work.liked ? "fill-pink-400" : ""}`} /> {work.liked ? "Đã thích" : "Thích"}
                  </button>
                  <button onClick={onSave} className={`inline-flex items-center gap-1.5 px-4 h-10 rounded-full text-sm transition ${work.saved ? "bg-amber-500/15 text-amber-300 border border-amber-400/30" : "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"}`}>
                    <Bookmark className={`w-4 h-4 ${work.saved ? "fill-amber-400" : ""}`} /> Lưu
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-4 h-10 rounded-full bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 text-sm transition">
                    <Share2 className="w-4 h-4" /> Chia sẻ
                  </button>
                </div>
              </div>
            </div>

            {/* Right: feedback panel */}
            <aside className="border-t md:border-t-0 md:border-l border-white/10 bg-black/20 flex flex-col">
              <div className="px-5 py-4 border-b border-white/10">
                <div className="text-[11px] tracking-[0.3em] uppercase text-[#f0c75e]/80">Góp ý cộng đồng</div>
                <div className="mt-1 text-white text-sm">{feedback.length} ý kiến · trung bình {work.rating.toFixed(1)}/5</div>
              </div>

              {/* Feedback list */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 max-h-[40vh] md:max-h-none">
                {feedback.length === 0 && (
                  <div className="text-center text-white/40 text-sm py-8">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Chưa có góp ý — hãy là người đầu tiên!
                  </div>
                )}
                {feedback.map((f) => (
                  <div key={f.id} className="flex gap-2.5">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${f.color} shrink-0 grid place-items-center text-white text-[10px]`}>
                      {f.user.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-xs">{f.user}</span>
                        <span className="text-white/30 text-[11px]">{f.time}</span>
                      </div>
                      {f.rating && (
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                          <RatingTag label="Truyện" value={f.rating.story} />
                          <RatingTag label="Vẽ" value={f.rating.art} />
                          <RatingTag label="Nhịp" value={f.rating.pacing} />
                        </div>
                      )}
                      <p className="text-white/75 text-xs mt-1.5 leading-relaxed">{f.text}</p>
                      <button onClick={() => onLikeFeedback(f.id)}
                        className={`mt-1.5 inline-flex items-center gap-1 text-[11px] transition ${f.liked ? "text-pink-300" : "text-white/40 hover:text-pink-300"}`}>
                        <Heart className={`w-3 h-3 ${f.liked ? "fill-pink-400" : ""}`} /> {f.likes} hữu ích
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Feedback composer */}
              <div className="shrink-0 border-t border-white/10 p-4 bg-[#130d20]">
                <button onClick={() => setShowRating((v) => !v)}
                  className="flex items-center gap-1 text-[11px] text-white/50 hover:text-pink-300 transition mb-2">
                  <Star className="w-3 h-3" /> {showRating ? "Ẩn đánh giá" : "Kèm đánh giá chi tiết"} <ChevronDown className={`w-3 h-3 transition ${showRating ? "rotate-180" : ""}`} />
                </button>
                {showRating && (
                  <div className="space-y-2 mb-3 p-3 rounded-xl bg-white/[0.03] border border-white/10">
                    <RatingRow label="Cốt truyện" value={story} onChange={setStory} />
                    <RatingRow label="Nét vẽ / hình ảnh" value={art} onChange={setArt} />
                    <RatingRow label="Nhịp truyện" value={pacing} onChange={setPacing} />
                  </div>
                )}
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
                  placeholder="Góp ý chân thành sẽ giúp tác giả tiến xa hơn…"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-pink-400/40 resize-none" />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-white/30">Tôn trọng tác giả · không spam</span>
                  <button onClick={submit} disabled={!text.trim()}
                    className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full btn-son text-xs disabled:opacity-40 disabled:cursor-not-allowed">
                    <Send className="w-3.5 h-3.5" /> Gửi góp ý
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function RatingTag({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#f0c75e]/10 border border-[#f0c75e]/30 text-[#f0c75e]">
      {label} {value}<Star className="w-2.5 h-2.5 fill-current" />
    </span>
  );
}

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-white/65">{label}</span>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n === value ? 0 : n)}>
            <Star className={`w-4 h-4 transition ${n <= value ? "text-[#f0c75e] fill-current" : "text-white/20 hover:text-white/40"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
