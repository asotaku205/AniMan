"use client";

import Link from "next/link";
import { ArrowLeft, Film } from "lucide-react";

interface WorkspaceHeaderProps {
  title: string;
  subtitle: string;
  accent: "pink" | "violet";
  children?: React.ReactNode;
}

export function WorkspaceHeader({ title, subtitle, accent, children }: WorkspaceHeaderProps) {
  const grad = accent === "pink" ? "from-pink-500 to-rose-400" : "from-fuchsia-500 to-violet-500";
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0d0817] px-4 h-14">
      <Link href="/studio/animation" className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition">
        <ArrowLeft className="w-4 h-4" /> Hub
      </Link>
      <span className="w-px h-6 bg-white/10" />
      <span className={`w-7 h-7 rounded-lg bg-gradient-to-br ${grad} grid place-items-center`}>
        <Film className="w-3.5 h-3.5 text-white" />
      </span>
      <div className="leading-tight">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-[11px] text-white/40">{subtitle}</div>
      </div>
      <div className="flex-1" />
      {children}
    </div>
  );
}
