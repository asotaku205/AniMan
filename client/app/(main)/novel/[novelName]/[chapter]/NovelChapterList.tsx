"use client";

import Link from "next/link";
import type { Novel } from "@/app/components/data/novels";

type NovelChapterListProps = {
  novel: Novel;
  currentChapter: number;
  onSelect?: () => void;
  itemClassName?: string;
};

export function NovelChapterList({ novel, currentChapter, onSelect, itemClassName = "" }: NovelChapterListProps) {
  return (
    <div className="overflow-y-auto scrollbar-thin flex-1 p-2">
      {novel.chapters.map((chapter, index) => (
        <Link
          key={chapter.n}
          href={`/novel/${novel.slug}/${chapter.n}`}
          onClick={onSelect}
          className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition ${index === currentChapter ? "bg-pink-400/15 text-pink-400" : `${itemClassName} opacity-70 hover:opacity-100 hover:bg-black/5`}`}
        >
          <div>
            <div className="text-xs opacity-60">Chương {chapter.n}</div>
            <div className="truncate max-w-[180px]">{chapter.title}</div>
          </div>
          <span className="text-[10px] opacity-40 shrink-0">{(chapter.words / 1000).toFixed(1)}k</span>
        </Link>
      ))}
    </div>
  );
}
