"use client";
import { useState } from "react";
import {
  ArrowUp, MessageCircle, Share2, Bookmark, Image as ImageIcon,
  Film, Sparkles, TrendingUp, Clock, Star, Search,
  Send, Heart, Reply, UserPlus, UserCheck, BarChart3, Check
} from "lucide-react";
import Link from "next/link";
import PostCard from "../../components/PostCard";

import type { Post, Comment, ReactionKey,Category,FilterTab,PostType } from "../types/forum";
import { COMMENTS_MAP, INIT_POSTS,CATEGORY_TABS,TOP_USERS,trends } from "./data";
import TypePill from "./components/TypePill";


export default function ForumClient() {
  const [posts, setPosts] = useState<Post[]>(INIT_POSTS);
  const [filterTab, setFilterTab] = useState<FilterTab>("hot");
  const [category, setCategory] = useState<Category>("all");
  const [expandedPost, setExpandedPost] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, Comment[]>>(COMMENTS_MAP);
  const [newComment, setNewComment] = useState<Record<number, string>>({});
  const [composerText, setComposerText] = useState("");
  const [composerType, setComposerType] = useState<PostType>("discussion");
  const [savedFilter, setSavedFilter] = useState(false);
  const [search, setSearch] = useState("");
  const [following, setFollowing] = useState<Set<string>>(new Set());

  const toggleFollow = (user: string) => setFollowing((prev) => {
    const next = new Set(prev);
    if (next.has(user)) next.delete(user); else next.add(user);
    return next;
  });

  const reactPost = (postId: number, key: ReactionKey) => {
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      const reactions = { ...(p.reactions ?? {}) };
      const prevKey = p.myReaction ?? null;
      if (prevKey) reactions[prevKey] = Math.max(0, (reactions[prevKey] ?? 1) - 1);
      const newKey: ReactionKey | null = prevKey === key ? null : key;
      if (newKey) reactions[newKey] = (reactions[newKey] ?? 0) + 1;
      return { ...p, reactions, myReaction: newKey };
    }));
  };

  const votePoll = (postId: number, optionId: string) => {
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId || !p.poll) return p;
      if (p.poll.votedId) return p;
      return {
        ...p,
        poll: {
          ...p.poll,
          votedId: optionId,
          options: p.poll.options.map((o) => o.id === optionId ? { ...o, votes: o.votes + 1 } : o),
        },
      };
    }));
  };

  const toggleUpvote = (postId: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, up: p.upvoted ? p.up - 1 : p.up + 1, upvoted: !p.upvoted }
          : p
      )
    );
  };

  const toggleSave = (postId: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, saves: p.saved ? p.saves - 1 : p.saves + 1, saved: !p.saved }
          : p
      )
    );
  };

  const submitComment = (postId: number) => {
    const text = (newComment[postId] ?? "").trim();
    if (!text) return;
    const newC: Comment = {
      id: Date.now(),
      user: "Bạn",
      color: "from-pink-500 to-violet-500",
      text,
      time: "Vừa xong",
      likes: 0,
      liked: false,
    };
    setComments((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] ?? []), newC],
    }));
    setNewComment((prev) => ({ ...prev, [postId]: "" }));
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, cm: p.cm + 1 } : p))
    );
  };

  const toggleCommentLike = (postId: number, commentId: number) => {
    setComments((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? []).map((c) =>
        c.id === commentId
          ? { ...c, likes: c.liked ? c.likes - 1 : c.likes + 1, liked: !c.liked }
          : c
      ),
    }));
  };

  const submitNewPost = () => {
    if (!composerText.trim()) return;
    const newPost: Post = {
      id: Date.now(),
      type: composerType,
      user: "Bạn",
      color: "from-pink-500 to-violet-500",
      badge: composerType === "discussion" ? "Thảo luận" : composerType === "theory" ? "Lý thuyết" : "Bài viết",
      title: composerText.trim(),
      up: 0, cm: 0, saves: 0,
      time: "Vừa xong",
      category: "anime",
    };
    setPosts((prev) => [newPost, ...prev]);
    setComposerText("");
  };

  const filtered = posts.filter((p) => {
    if (savedFilter && !p.saved) return false;
    if (category !== "all" && p.category !== category) return false;
    if (filterTab === "following" && !following.has(p.user)) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = `${p.title} ${p.body ?? ""} ${p.user} ${(p.tags ?? []).join(" ")}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const sorted =
    filterTab === "hot"
      ? [...filtered].sort((a, b) => b.up - a.up)
      : filterTab === "new"
      ? [...filtered].reverse()
      : filtered;

  return (
    <section className="relative py-16 bg-[#07040d] min-h-screen">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          {/* ── Feed ── */}
          <div>
            {/* Composer */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-4">
              <div className="flex gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 shrink-0" />
                <textarea
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  placeholder="Bạn đang nghĩ gì về câu chuyện hôm nay?"
                  rows={composerText ? 3 : 1}
                  className="flex-1 bg-transparent outline-none text-white placeholder:text-white/40 resize-none text-sm leading-relaxed pt-2"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <TypePill active={composerType === "discussion"} onClick={() => setComposerType("discussion")} icon={<MessageCircle className="w-3.5 h-3.5" />} label="Thảo luận" />
                <TypePill active={composerType === "art"} onClick={() => setComposerType("art")} icon={<ImageIcon className="w-3.5 h-3.5" />} label="Ảnh / Tranh" />
                <TypePill active={composerType === "clip"} onClick={() => setComposerType("clip")} icon={<Film className="w-3.5 h-3.5" />} label="Video clip" />
                <TypePill active={composerType === "theory"} onClick={() => setComposerType("theory")} icon={<Sparkles className="w-3.5 h-3.5" />} label="Giả thuyết" />
                <div className="flex-1" />
                {composerText && (
                  <button
                    onClick={submitNewPost}
                    className="px-4 h-8 rounded-full bg-gradient-to-r from-pink-500 to-rose-400 text-white text-sm flex items-center gap-1.5 hover:from-pink-400 hover:to-rose-300 transition"
                  >
                    <Send className="w-3.5 h-3.5" /> Đăng
                  </button>
                )}
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm bài viết, tác giả, hashtag…"
                className="w-full pl-10 pr-3 h-11 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-pink-400/40"
              />
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              {/* Tab filter */}
              <div className="flex bg-white/[0.04] rounded-xl p-1 gap-0.5">
                {([
                  { key: "hot", icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Nổi bật" },
                  { key: "new", icon: <Clock className="w-3.5 h-3.5" />, label: "Mới nhất" },
                  { key: "following", icon: <Star className="w-3.5 h-3.5" />, label: "Đang theo dõi" },
                ] as { key: FilterTab; icon: React.ReactNode; label: string }[]).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setFilterTab(t.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition ${filterTab === t.key ? "bg-white/15 text-white" : "text-white/50 hover:text-white"}`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Save filter */}
              <button
                onClick={() => setSavedFilter(!savedFilter)}
                className={`flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs transition ${savedFilter ? "bg-pink-500/20 border border-pink-400/30 text-pink-300" : "bg-white/[0.04] border border-white/10 text-white/50 hover:text-white"}`}
              >
                <Bookmark className="w-3.5 h-3.5" /> Đã lưu
              </button>

              {/* Category filter */}
              <div className="flex-1 overflow-x-auto [scrollbar-width:none]">
                <div className="flex gap-1.5 min-w-max">
                  {CATEGORY_TABS.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setCategory(c.key)}
                      className={`px-3 h-8 rounded-xl text-xs whitespace-nowrap transition ${category === c.key ? "bg-pink-500/20 border border-pink-400/30 text-pink-300" : "bg-white/[0.04] border border-white/5 text-white/50 hover:text-white"}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Posts */}
            <div className="space-y-4">
              {sorted.length === 0 ? (
                <div className="text-center py-20 text-white/30">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>Không có bài viết nào</p>
                </div>
              ) : (
                sorted.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    isExpanded={expandedPost === p.id}
                    isFollowing={following.has(p.user)}
                    comments={comments[p.id] ?? []}
                    commentInput={newComment[p.id] ?? ""}
                    onToggleExpand={() => setExpandedPost(expandedPost === p.id ? null : p.id)}
                    onToggleUpvote={() => toggleUpvote(p.id)}
                    onToggleSave={() => toggleSave(p.id)}
                    onCommentChange={(v) => setNewComment((prev) => ({ ...prev, [p.id]: v }))}
                    onCommentSubmit={() => submitComment(p.id)}
                    onCommentLike={(cid) => toggleCommentLike(p.id, cid)}
                    onReact={(k) => reactPost(p.id, k)}
                    onVotePoll={(oid) => votePoll(p.id, oid)}
                    onToggleFollow={() => toggleFollow(p.user)}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-4">
            {/* Trending */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-pink-300" />
                <div className="text-white/90 text-sm">Đang thịnh hành</div>
              </div>
              <div className="space-y-1">
                {trends.map((t, i) => (
                  <button
                    key={t}
                    className="w-full flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:bg-white/5 -mx-2 px-2 rounded-lg transition group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-white/20 text-xs w-4 text-right">{i + 1}</span>
                      <span className="text-pink-300/90 text-sm group-hover:text-pink-200 transition">{t}</span>
                    </div>
                    <span className="text-[11px] text-white/40">{(8 - i) * 1.2}k bài</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Top creators */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-4 h-4 text-yellow-300" />
                <div className="text-white/90 text-sm">Nhà sáng tạo nổi bật</div>
              </div>
              <div className="space-y-3">
                {TOP_USERS.map((u) => {
                  const isFol = following.has(u.user);
                  return (
                    <div key={u.user} className="flex items-center gap-3 -mx-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition">
                      <Link href={`/ho-so/${u.user}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${u.color} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-xs truncate group-hover:text-pink-300 transition">@{u.user}</div>
                          <div className="text-white/35 text-[11px]">{u.posts} bài · {u.followers.toLocaleString()} followers</div>
                        </div>
                      </Link>
                      <button onClick={() => toggleFollow(u.user)} className={`shrink-0 inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] transition ${isFol ? "bg-white/10 text-white/80 border border-white/15" : "bg-gradient-to-r from-pink-500 to-rose-400 text-white"}`}>
                        {isFol ? <><UserCheck className="w-3 h-3" /> Đang theo</> : <><UserPlus className="w-3 h-3" /> Theo dõi</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Event CTA */}
            <div className="rounded-2xl border border-pink-400/30 bg-gradient-to-br from-pink-500/10 via-fuchsia-500/5 to-transparent p-5">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-pink-300" />
                <div className="text-white text-sm">Sakura Festival 2026</div>
              </div>
              <div className="text-pink-200/80 text-xs tracking-[0.2em] uppercase mt-0.5">15/05 → 15/06</div>
              <p className="text-white/60 text-xs mt-3 leading-relaxed">
                Cuộc thi Sketch-to-Manga toàn cầu. Giải thưởng tổng trị giá <span className="text-pink-300">500 triệu VNĐ</span>.
              </p>
              <Link
                href="/studio"
                className="mt-4 flex items-center justify-center gap-1.5 h-9 rounded-full bg-gradient-to-r from-pink-500 to-rose-400 text-white text-sm hover:from-pink-400 hover:to-rose-300 transition"
              >
                Đăng ký ngay
              </Link>
            </div>

            {/* Active rooms */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-white/90 text-sm">Watch Party đang diễn ra</div>
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              </div>
              <div className="space-y-3">
                {[
                  { title: "Tokyo Neon — Tập 12", viewers: 47, live: true },
                  { title: "Hoa Anh Đào — Rewatch S1", viewers: 23, live: true },
                ].map((room) => (
                  <Link
                    key={room.title}
                    href="/watch-party"
                    className="flex items-center justify-between hover:bg-white/5 -mx-2 px-2 py-2 rounded-xl transition group"
                  >
                    <div>
                      <div className="text-white text-xs group-hover:text-pink-300 transition">{room.title}</div>
                      <div className="text-white/40 text-[11px] mt-0.5">{room.viewers} người xem</div>
                    </div>
                    {room.live && (
                      <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-400/30 text-red-300 text-[10px]">LIVE</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
