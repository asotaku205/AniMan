import Link from "next/link";
import { Check, ChevronRight, Palette } from "lucide-react";

export default function UploadPublishInfo() {
  return (
    <div className="rounded-xl border border-[#d4a648]/30 bg-linear-to-br from-[#d72638]/8 to-[#d4a648]/6 p-4">
      <div className="text-[11px] tracking-[0.25em] uppercase text-[#f0c75e]/80 mb-2">Sau khi đăng, tác phẩm sẽ xuất hiện ở</div>
      <Link
        href="/tac-pham"
        className="flex items-start gap-3 p-3 rounded-lg bg-[#d72638]/10 border border-[#d72638]/30 hover:border-[#d72638]/60 transition group mb-2"
      >
        <span className="w-9 h-9 rounded-lg bg-linear-to-br from-[#d72638] to-[#b81e2e] grid place-items-center text-white shrink-0 ring-1 ring-[#f0c75e]/40">
          <Palette className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-white text-sm flex items-center gap-1.5">
            Sáng tác cộng đồng
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f0c75e]/20 text-[#f0c75e] tracking-wider">CHÍNH</span>
          </div>
          <div className="text-white/55 text-[11px] mt-0.5">
            Nơi mọi người xem, thả tim, lưu &amp; góp ý chi tiết cho tác phẩm của bạn
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-[#f0c75e] transition self-center" />
      </Link>
      <ul className="space-y-1.5 text-sm text-white/70 pt-1">
        <li className="flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-[#f0c75e]" />
          Tab <b className="text-white/90">"Tác phẩm của tôi"</b> trên hồ sơ <Link href="/ho-so" className="text-pink-300 hover:underline">/ho-so</Link>
        </li>
        <li className="flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-[#f0c75e]" />
          Bảng tin Cộng đồng <Link href="/forum" className="text-pink-300 hover:underline">/forum</Link> (nếu Công khai)
        </li>
        <li className="flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-[#f0c75e]" />
          Studio Hub <Link href="/studio" className="text-pink-300 hover:underline">/studio</Link> — "Dự án của bạn"
        </li>
      </ul>
    </div>
  );
}
