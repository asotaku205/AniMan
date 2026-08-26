"use client";

import Link from "next/link";
import { MessageCircle, Plus, Share2, ThumbsUp, Download, Star } from "lucide-react";
import type { Review, Title } from "./data/catalog";

type BreadcrumbProps = {
  basePath: "anime" | "film";
  content: Title;
  currentEp: number;
  type: "anime" | "film";
};

export function MediaBreadcrumb({ basePath, content, currentEp, type }: BreadcrumbProps) {
  return (
    <div className="bg-black/60 backdrop-blur border-b border-white/5 px-4 sm:px-6 h-12 flex items-center gap-2 text-sm">
      <Link href="/" className="text-white/40 hover:text-white/70 transition">Trang chủ</Link>
      <span className="text-white/20">/</span>
      <Link href={`/${basePath}`} className="text-white/40 hover:text-white/70 transition">
        {type === "anime" ? "Anime" : "Phim"}
      </Link>
      <span className="text-white/20">/</span>
      <Link href={`/${basePath}/${content.slug}`} className="text-white/50 hover:text-white/80 transition truncate max-w-[160px]">
        {content.t}
      </Link>
      {type === "anime" && (
        <>
          <span className="text-white/20">/</span>
          <span className="text-pink-300 truncate">Tập {currentEp}</span>
        </>
      )}
    </div>
  );
}

export function MediaActionButtons() {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button className="h-9 px-3 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white text-sm flex items-center gap-1.5 transition hover:bg-white/10">
        <Plus className="w-3.5 h-3.5" /> Lưu
      </button>
      <button className="h-9 px-3 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white text-sm flex items-center gap-1.5 transition hover:bg-white/10">
        <ThumbsUp className="w-3.5 h-3.5" /> 2.4K
      </button>
      <button className="h-9 px-3 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white text-sm flex items-center gap-1.5 transition hover:bg-white/10">
        <Share2 className="w-3.5 h-3.5" /> Chia sẻ
      </button>
      <button className="h-9 px-3 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white text-sm flex items-center gap-1.5 transition hover:bg-white/10">
        <Download className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function WatchPartyCta() {
  return (
    <div className="mt-6 rounded-xl border border-pink-400/20 bg-gradient-to-r from-pink-500/10 to-fuchsia-500/5 p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center shrink-0 text-white">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm">Xem cùng bạn bè</div>
        <div className="text-white/50 text-xs mt-0.5">Tạo phòng Watch Party — đồng bộ hoàn hảo</div>
      </div>
      <Link href="/watch-party" className="px-4 h-9 rounded-full bg-white text-black text-sm flex items-center shrink-0">
        Tạo phòng
      </Link>
    </div>
  );
}

type ReviewsProps = {
  reviews: Review[];
  currentEp: number;
  comment: string;
  setComment: (comment: string) => void;
};

export function MediaReviews({ reviews, currentEp, comment, setComment }: ReviewsProps) {
  return (
    <div className="mt-10">
      <div className="flex items-center gap-3 mb-6">
        <MessageCircle className="w-5 h-5 text-pink-300" />
        <span className="text-white" style={{ fontFamily: "Shippori Mincho, serif" }}>Bình luận</span>
        <span className="text-white/40 text-sm px-2 py-0.5 rounded bg-white/5">{1200 + currentEp * 37}</span>
      </div>
      <div className="flex gap-3 mb-8">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 shrink-0 flex items-center justify-center text-white text-xs">You</div>
        <div className="flex-1">
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Chia sẻ cảm nhận của bạn..." rows={2} className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/30 outline-none focus:border-pink-400/40 resize-none transition" />
          {comment && (
            <div className="flex justify-end mt-2 gap-2">
              <button onClick={() => setComment("")} className="px-4 h-8 rounded-full text-white/50 text-sm hover:text-white transition">Huỷ</button>
              <button className="px-4 h-8 rounded-full bg-gradient-to-r from-pink-500 to-rose-400 text-white text-sm">Đăng</button>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-5">
        {reviews.map((review, index) => (
          <div key={review.user} className="flex gap-3">
            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${review.color} shrink-0 flex items-center justify-center text-white text-[10px]`}>
              {review.user.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-white">{review.user}</span>
                <span className="text-white/30 text-xs">· {review.time} trước</span>
                <div className="ml-auto flex items-center gap-1 text-yellow-300 text-xs">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className={`w-3 h-3 ${star <= Math.round(review.rating / 2) ? "fill-yellow-300" : "fill-white/10 text-white/10"}`} />
                  ))}
                  <span className="text-white/50 ml-1">{review.rating}/10</span>
                </div>
              </div>
              <p className="mt-1.5 text-white/70 text-sm leading-relaxed">{review.comment}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
                <button className="flex items-center gap-1 hover:text-pink-300 transition"><ThumbsUp className="w-3 h-3" /> {84 + index * 40}</button>
                <button className="hover:text-pink-300 transition">Trả lời</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
