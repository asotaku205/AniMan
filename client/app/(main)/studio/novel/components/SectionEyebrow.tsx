"use client";

interface SectionEyebrowProps {
  eyebrow: string;
  title: string;
  desc: string;
}

export function SectionEyebrow({ eyebrow, title, desc }: SectionEyebrowProps) {
  return (
    <div className="text-center max-w-2xl mx-auto space-y-2">
      <div className="text-[11px] tracking-[0.3em] text-pink-300/80 uppercase font-mono font-medium">{eyebrow}</div>
      <h1 className="text-3xl lg:text-4xl text-amber-50 font-bold" style={{ fontFamily: "Shippori Mincho, serif" }}>{title}</h1>
      <p className="text-amber-100/60 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
