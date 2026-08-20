
import type { ReactNode } from "react";

export default function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] tracking-widest uppercase text-white/40">
        {label}
      </span>
      <div className="mt-1.5 flex items-center gap-2 h-12 px-3.5 rounded-xl bg-white/5 border border-white/10 focus-within:border-pink-400/50 focus-within:bg-white/[0.07] transition">
        <span className="text-pink-300/80">{icon}</span>
        {children}
      </div>
    </label>
  );
}
