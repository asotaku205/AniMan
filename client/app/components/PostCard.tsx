"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUp, MessageCircle, Share2, Bookmark, UserPlus, UserCheck, MoreHorizontal, Heart, Reply, Send, Check, BarChart3, ChevronDown } from "lucide-react";
import { ImageWithFallback } from "./ImageWithFallback";
import type { Post, Comment, ReactionKey } from "../(main)/types/forum";
import { REACTIONS } from "../(main)/types/forum";
export default function PostCard({
  post,
  isExpanded,
  isFollowing,
  comments,
  commentInput,
  onToggleExpand,
  onToggleUpvote,
  onToggleSave,
  onCommentChange,
  onCommentSubmit,
  onCommentLike,
  onReact,
  onVotePoll,
  onToggleFollow,
}: {
  post: Post;
  isExpanded: boolean;
  isFollowing: boolean;
  comments: Comment[];
  commentInput: string;
  onToggleExpand: () => void;
  onToggleUpvote: () => void;
  onToggleSave: () => void;
  onCommentChange: (v: string) => void;
  onCommentSubmit: () => void;
  onCommentLike: (cid: number) => void;
  onReact: (k: ReactionKey) => void;
  onVotePoll: (oid: string) => void;
  onToggleFollow: () => void;
}) {
  const [showAllComments, setShowAllComments] = useState(false);
  const displayedComments = showAllComments ? comments : comments.slice(0, 2);

  return (
    <article className="rounded-2xl border border-white/8 bg-[#0d0817] overflow-hidden hover:border-white/15 transition-colors">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-2">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${post.color} shrink-0 flex items-center justify-center text-white text-xs`}>
          {post.user.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/ho-so/${post.user}`} className="text-white text-sm hover:text-pink-300 transition">{post.user}</Link>
            <span className="text-[11px] text-white/40">{post.time} trước</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] px-2 py-0.5 rounded bg-pink-500/15 border border-pink-400/20 text-pink-200">{post.badge}</span>
            {post.tags?.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-white/40">#{tag}</span>
            ))}
          </div>
        </div>
        <button onClick={onToggleFollow} className={`hidden sm:inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] transition ${isFollowing ? "bg-white/10 text-white/80 border border-white/15" : "bg-pink-500/15 border border-pink-400/40 text-pink-200 hover:bg-pink-500/25"}`}>
          {isFollowing ? <><UserCheck className="w-3 h-3" /> Đang theo</> : <><UserPlus className="w-3 h-3" /> Theo dõi</>}
        </button>
        <button className="p-1 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Title */}
      <h3 className="px-4 pb-2 text-white" style={{ fontFamily: "Shippori Mincho, serif", fontSize: "clamp(14px, 1.5vw, 17px)", lineHeight: "1.5" }}>
        {post.title}
      </h3>

      {/* Body text */}
      {post.body && (
        <p className="px-4 pb-3 text-white/60 text-sm leading-relaxed line-clamp-2">{post.body}</p>
      )}

      {/* Poll */}
      {post.poll && (
        <div className="px-4 pb-3 space-y-2">
          {(() => {
            const total = post.poll!.options.reduce((s, o) => s + o.votes, 0) || 1;
            const voted = post.poll!.votedId;
            return post.poll!.options.map((o) => {
              const pct = Math.round((o.votes / total) * 100);
              const isMine = voted === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => onVotePoll(o.id)}
                  disabled={!!voted}
                  className={`relative w-full text-left px-3 py-2.5 rounded-xl border overflow-hidden transition ${isMine ? "border-pink-400/60 bg-pink-500/10" : voted ? "border-white/10 bg-white/[0.03]" : "border-white/10 bg-white/[0.03] hover:border-pink-400/40 hover:bg-pink-500/5 cursor-pointer"}`}
                >
                  {voted && (
                    <div className={`absolute inset-y-0 left-0 ${isMine ? "bg-pink-500/15" : "bg-white/5"}`} style={{ width: `${pct}%` }} />
                  )}
                  <div className="relative flex items-center justify-between gap-3">
                    <span className="text-sm text-white flex items-center gap-2">
                      {isMine && <Check className="w-3.5 h-3.5 text-pink-300" />}
                      {o.text}
                    </span>
                    {voted && <span className="text-xs text-white/70 tabular-nums">{pct}% · {o.votes.toLocaleString()}</span>}
                  </div>
                </button>
              );
            });
          })()}
          <div className="text-[11px] text-white/40 flex items-center gap-1.5 pt-1">
            <BarChart3 className="w-3 h-3" />
            {post.poll!.options.reduce((s, o) => s + o.votes, 0).toLocaleString()} lượt bình chọn
            {!post.poll!.votedId && <span className="text-pink-300/70">· Chạm để bình chọn</span>}
          </div>
        </div>
      )}

      {/* Image */}
      {post.img && (
        <div className="relative aspect-[16/9] overflow-hidden">
          <ImageWithFallback src={post.img} alt={post.title} className="absolute inset-0 w-full h-full object-cover hover:scale-[1.02] transition duration-500" />
          {post.type === "clip" && (
            <>
              <div className="absolute inset-0 bg-black/30" />
              <div className="absolute inset-0 grid place-items-center">
                <div className="w-14 h-14 rounded-full bg-white/90 grid place-items-center hover:bg-white transition cursor-pointer shadow-xl">
                  <div className="w-0 h-0 border-l-[14px] border-l-black border-y-[10px] border-y-transparent ml-1" />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Reactions */}
      <div className="px-4 pt-3 flex items-center gap-1.5 flex-wrap">
        {REACTIONS.map((r) => {
          const count = post.reactions?.[r.k] ?? 0;
          const active = post.myReaction === r.k;
          return (
            <button
              key={r.k}
              onClick={() => onReact(r.k)}
              title={r.label}
              className={`inline-flex items-center gap-1 h-7 px-2 rounded-full border text-xs transition ${active ? "bg-pink-500/20 border-pink-400/50 text-pink-200" : "bg-white/[0.04] border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20"}`}
            >
              <span className="text-[13px] leading-none">{r.emoji}</span>
              {count > 0 && <span className="tabular-nums">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-4 py-3 text-sm">
        <button
          onClick={onToggleUpvote}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${post.upvoted ? "bg-pink-500/20 text-pink-300 border border-pink-400/30" : "text-white/60 hover:text-pink-300 hover:bg-white/5"}`}
        >
          <ArrowUp className={`w-4 h-4 ${post.upvoted ? "fill-pink-400" : ""}`} />
          {post.up.toLocaleString()}
        </button>
        <button
          onClick={onToggleExpand}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${isExpanded ? "bg-blue-500/15 text-blue-300 border border-blue-400/20" : "text-white/60 hover:text-blue-300 hover:bg-white/5"}`}
        >
          <MessageCircle className="w-4 h-4" /> {post.cm}
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition">
          <Share2 className="w-4 h-4" /> <span className="hidden sm:inline">Chia sẻ</span>
        </button>
        <div className="flex-1" />
        <button
          onClick={onToggleSave}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${post.saved ? "bg-amber-500/15 text-amber-300 border border-amber-400/20" : "text-white/50 hover:text-amber-300 hover:bg-white/5"}`}
        >
          <Bookmark className={`w-4 h-4 ${post.saved ? "fill-amber-400" : ""}`} />
          {post.saves}
        </button>
      </div>

      {/* Comments section */}
      {isExpanded && (
        <div className="border-t border-white/5 px-4 py-4 bg-white/[0.01]">
          {/* Comment list */}
          {displayedComments.length > 0 && (
            <div className="space-y-3 mb-4">
              {displayedComments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${c.color} shrink-0 flex items-center justify-center text-white text-[10px]`}>
                    {c.user.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-xs">{c.user}</span>
                      <span className="text-white/30 text-[11px]">{c.time}</span>
                    </div>
                    <p className="text-white/70 text-xs mt-1 leading-relaxed">{c.text}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <button
                        onClick={() => onCommentLike(c.id)}
                        className={`flex items-center gap-1 text-[11px] transition ${c.liked ? "text-pink-300" : "text-white/40 hover:text-pink-300"}`}
                      >
                        <Heart className={`w-3 h-3 ${c.liked ? "fill-pink-400" : ""}`} /> {c.likes}
                      </button>
                      <button className="text-[11px] text-white/40 hover:text-white transition flex items-center gap-1">
                        <Reply className="w-3 h-3" /> Trả lời
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Show more comments */}
          {comments.length > 2 && !showAllComments && (
            <button
              onClick={() => setShowAllComments(true)}
              className="flex items-center gap-1.5 text-pink-400/70 text-xs hover:text-pink-300 transition mb-4"
            >
              <ChevronDown className="w-3.5 h-3.5" /> Xem thêm {comments.length - 2} bình luận
            </button>
          )}

          {/* New comment input */}
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 shrink-0 flex items-center justify-center text-white text-[10px]">
              Bạn
            </div>
            <div className="flex-1 flex gap-2">
              <input
                value={commentInput}
                onChange={(e) => onCommentChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), onCommentSubmit())}
                placeholder="Viết bình luận..."
                className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/30 outline-none focus:border-pink-400/40 transition"
              />
              {commentInput && (
                <button
                  onClick={onCommentSubmit}
                  className="px-3 h-8 rounded-xl bg-gradient-to-r from-pink-500 to-rose-400 text-white text-xs flex items-center gap-1"
                >
                  <Send className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}