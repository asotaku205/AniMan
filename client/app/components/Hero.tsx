"use client";
import { motion } from "motion/react";
import { Play, Sparkles, BookOpen, Film } from "lucide-react";
import { Sakura } from "./ui/Sakura";
import { Button } from "./ui/Button";
import  Link  from "next/link";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#3a0d3a_0%,_#0b0612_55%,_#000_100%)]" />
      <div className="absolute inset-0 opacity-40 [background:repeating-linear-gradient(0deg,transparent_0,transparent_3px,rgba(255,255,255,0.03)_3px,rgba(255,255,255,0.03)_4px)]" />
      <svg className="absolute bottom-0 left-0 w-full h-[55%]" viewBox="0 0 1440 400" preserveAspectRatio="none">
        <defs>
          <linearGradient id="mt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff5e9c" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0b0612" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path d="M0,400 L0,260 L420,80 L520,140 L620,90 L780,200 L900,140 L1100,240 L1280,160 L1440,260 L1440,400 Z" fill="url(#mt)" />
      </svg>
      <div className="absolute right-[8%] top-24 w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle,#ff5e9c_0%,#ff2e7e_45%,transparent_70%)] blur-2xl opacity-70" />
      <div className="absolute right-[14%] top-32 w-[320px] h-[320px] rounded-full bg-[#ff2e7e]" />
      <div className="absolute inset-x-0 bottom-0 h-[40%] [perspective:600px]">
        <div className="absolute inset-0 [transform:rotateX(60deg)] [background:linear-gradient(transparent_95%,#ff2e7e_95%),linear-gradient(90deg,transparent_97%,#ff2e7e_97%)] [background-size:60px_60px] opacity-40" />
      </div>

      <Sakura count={22} />

      <div className="relative max-w-[1400px] mx-auto px-6 pt-24 pb-40">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-pink-300/30 backdrop-blur mb-6">
            <Sparkles className="w-3.5 h-3.5 text-pink-300" />
            <span className="text-xs text-pink-100">Nền tảng giải trí & sáng tạo tác phẩm chính chủ</span>
          </div>

          <h1 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white leading-[0.95] ">
            <span className="block text-[clamp(48px,7vw,104px)] tracking-tight">
              Nơi <span className="bg-gradient-to-r from-pink-300 via-rose-300 to-orange-200 bg-clip-text text-transparent">câu chuyện</span>
            </span>
            <span className="block text-[clamp(48px,7vw,104px)] tracking-tight pt-6">
              của bạn <em className="not-italic bg-gradient-to-r from-fuchsia-300 to-pink-400 bg-clip-text text-transparent">bắt đầu</em>.
            </span>
          </h1>

          <p className="mt-8 text-white/70 max-w-xl leading-relaxed">
            Xem hoạt hình &amp; phim bản quyền, đọc truyện và tiểu thuyết, đồng thời tự sáng tác bằng các công cụ AI
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full bg-gradient-to-r from-pink-500 to-rose-400 text-white border-0 px-7 h-12 shadow-[0_0_30px_rgba(255,90,150,0.5)]">
              <Link href="/anime"><Play className="w-4 h-4 mr-2 fill-white" /> Xem ngay</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full bg-white/5 border-white/20 text-white hover:bg-white/10 h-12 px-7">
              <Link href="/studio"><Sparkles className="w-4 h-4 mr-2" /> Vào Studio</Link>
            </Button>
          </div>

          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl">
            {[
              { k: "12,400+", v: "Anime & phim", i: <Film className="w-4 h-4" /> },
              { k: "85,000+", v: "Manga bản quyền", i: <BookOpen className="w-4 h-4" /> },
              { k: "320K", v: "Sáng tác viên", i: <Sparkles className="w-4 h-4" /> },
              { k: "2.4M", v: "Bài thảo luận", i: <Sparkles className="w-4 h-4" /> },
            ].map((s) => (
              <div key={s.v}>
                <div className="text-pink-300/70 mb-1">{s.i}</div>
                <div style={{ fontFamily: "Kaisei Decol, serif" }} className="text-white text-2xl">{s.k}</div>
                <div className="text-xs text-white/50">{s.v}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
