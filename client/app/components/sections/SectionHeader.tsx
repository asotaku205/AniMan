import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function SectionHeader({
  eyebrow,
  title,
  seeAll,
}: {
  eyebrow: string;
  title: React.ReactNode;
  seeAll?: string;
}) {
  return (
    <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
      <div>
        <div className="flex items-center gap-2 text-pink-300/70 tracking-[0.4em] text-xs uppercase mb-2">
          <span className="w-5 h-px bg-pink-400/60" />
          {eyebrow}
        </div>
        <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-2xl md:text-3xl">
          {title}
        </h2>
      </div>
      {seeAll && (
        <Link href={seeAll} className="flex items-center gap-1 text-pink-300/70 text-sm hover:text-pink-300 transition">
          Xem tất cả <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}
