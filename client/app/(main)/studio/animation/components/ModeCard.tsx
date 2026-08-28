"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface ModeCardProps {
  href: string;
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  desc: string;
  gradient: string;
  glow: string;
  steps: string[];
  cta: string;
}

export function ModeCard({ href, icon, eyebrow, title, desc, gradient, glow, steps, cta }: ModeCardProps) {
  return (
    <Link
      href={href}
      className="group relative text-left rounded-3xl overflow-hidden border border-white/10 bg-[#0d0817] p-8 hover:border-white/25 transition block"
      style={{ boxShadow: `0 30px 80px -20px ${glow}` }}
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-br ${gradient}`} style={{ mixBlendMode: "overlay" }} />
      <div className="relative">
        <div className="flex items-center gap-3">
          <span className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} grid place-items-center text-white shadow-lg`}>
            {icon}
          </span>
          <span className="text-[11px] tracking-[0.3em] text-white/50">{eyebrow.toUpperCase()}</span>
        </div>
        <div className="mt-5 text-3xl" style={{ fontFamily: "Shippori Mincho, serif" }}>{title}</div>
        <p className="mt-3 text-white/60 leading-relaxed max-w-md text-sm">{desc}</p>
        <ul className="mt-6 grid grid-cols-2 gap-2">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-2 text-xs text-white/70">
              <span className={`w-5 h-5 rounded-full bg-gradient-to-br ${gradient} grid place-items-center text-[10px] text-white shrink-0`}>
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 inline-flex items-center gap-2 text-sm text-white group-hover:gap-3 transition font-medium">
          {cta} <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}
