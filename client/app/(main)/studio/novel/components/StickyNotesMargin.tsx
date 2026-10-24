"use client";

import { StickyNote } from "lucide-react";
import type { Note } from "../data";

interface StickyNotesMarginProps {
  notes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
}

export function StickyNotesMargin({ notes, setNotes }: StickyNotesMarginProps) {
  return (
    <div className="absolute -right-6 top-0 bottom-0 w-44 hidden xl:block pointer-events-none">
      {notes.map((n) => (
        <div
          key={n.id}
          onClick={() => setNotes((arr) => arr.map((x) => (x.id === n.id ? { ...x, expanded: !x.expanded } : x)))}
          style={{ top: `${n.top}%` }}
          className="group absolute right-0 w-40 text-left pointer-events-auto bg-amber-200 text-amber-950 rounded-sm shadow-[4px_6px_18px_rgba(0,0,0,0.5)] rotate-[2deg] hover:rotate-0 transition p-2 cursor-pointer"
        >
          <div className="flex items-center gap-1 text-[10px] text-amber-900 mb-1 font-medium">
            <StickyNote className="w-3 h-3" /> Ghi chú
            <button
              type="button"
              title="Xoá ghi chú"
              aria-label="Xoá ghi chú"
              onClick={(e) => {
                e.stopPropagation();
                setNotes((arr) => arr.filter((x) => x.id !== n.id));
              }}
              className="ml-auto h-4 w-4 rounded-full text-sm leading-none text-amber-900 opacity-0 hover:bg-amber-300 group-hover:opacity-100 focus:opacity-100"
            >
              ×
            </button>
          </div>
          <div className={`text-xs leading-snug ${n.expanded ? "" : "line-clamp-2"}`}>{n.text}</div>
        </div>
      ))}
    </div>
  );
}
