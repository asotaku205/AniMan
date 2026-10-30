import { Sakura } from "../components/ui/Sakura";

export function PageHeader({ eyebrow, title, desc, children }: { eyebrow: string; title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#3a0d3a_0%,_#0b0612_60%,_#000_100%)]" />
      <div className="absolute right-[-6%] top-10 w-[260px] h-[260px] rounded-full bg-[radial-gradient(circle,#ff5e9c_0%,#ff2e7e_45%,transparent_70%)] blur-2xl opacity-60" />
      <Sakura count={10} />
      <div className="relative max-w-[1400px] mx-auto px-6 pt-20 pb-12">
        <div className="flex items-center gap-3 text-pink-300/80">
          <span className="h-px w-10 bg-pink-300/40" />
          <span className="tracking-[0.4em] text-xs uppercase">{eyebrow}</span>
        </div>
        <h1 style={{ fontFamily: "Shippori Mincho, serif" }} className="mt-4 text-white text-5xl md:text-6xl tracking-tight max-w-3xl">{title}</h1>
        {desc ? <p className="mt-4 text-white/60 max-w-2xl">{desc}</p> : null}
        {children}
      </div>
    </section>
  );
}

export function SectionEyebrow({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <div className="flex items-center gap-3 text-pink-300/80">
          <span className="h-px w-10 bg-pink-300/40" />
          <span className="tracking-[0.4em] text-xs uppercase">{eyebrow}</span>
        </div>
        <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="mt-3 text-white text-4xl md:text-5xl tracking-tight max-w-xl">{title}</h2>
      </div>
      {desc ? <p className="text-white/60 max-w-md">{desc}</p> : null}
    </div>
  );
}
