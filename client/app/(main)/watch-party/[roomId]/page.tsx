import { ImageWithFallback } from "@/app/components/ImageWithFallback";
import { SectionEyebrow } from "@/app/components/PageHeader";
import { Users, Send, Heart, Smile, Volume2 } from "lucide-react";


const messages = [
  { u: "Hina_94", c: "Cảnh này quá đỉnh 🌸", t: "12:04", color: "from-pink-400 to-rose-400" },
  { u: "RenAozora", c: "Soundtrack lên là nổi da gà luôn", t: "12:05", color: "from-violet-400 to-fuchsia-400" },
  { u: "kyoto_dreamer", c: "ai đoán được plot twist không 👀", t: "12:06", color: "from-sky-400 to-cyan-400" },
  { u: "Aoi", c: "Mình tin nhân vật chính sẽ quay lại", t: "12:07", color: "from-orange-400 to-pink-400" },
  { u: "ShiroNeko", c: "🍿🍿🍿", t: "12:07", color: "from-emerald-400 to-teal-400" },
];

const viewers = [
  "from-pink-500 to-rose-400",
  "from-violet-500 to-fuchsia-400",
  "from-sky-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-orange-500 to-pink-400",
  "from-yellow-500 to-orange-400",
];

export default function WatchParty() {
  return (
    <section className="relative py-24 bg-gradient-to-b from-[#0b0612] to-[#15081f]">
      <div className="max-w-[1400px] mx-auto px-6">
        <SectionEyebrow
          eyebrow="Watch Party"
          title="Cùng xem, cùng cảm — phòng xem trực tiếp"
          desc="Phòng xem ảo theo thời gian thực: đồng bộ video, chat, biểu cảm, gọi voice và bình luận theo timeline."
        />

        <div className="mt-12 grid lg:grid-cols-[1fr_360px] gap-6">
          {/* Player */}
          <div className="rounded-3xl overflow-hidden border border-white/10 bg-black relative">
            <div className="relative aspect-video">
              <ImageWithFallback src="https://images.unsplash.com/photo-1493514789931-586cb221d7a7?w=1600" alt="movie" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-red-500 text-white text-[10px] tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                </span>
                <span className="px-2 py-1 rounded bg-black/60 backdrop-blur text-white text-[10px]">Phòng #2410 · "Hoa Anh Đào Cuối Mùa"</span>
              </div>
              {/* floating reactions */}
              {["💖", "🌸", "✨", "🍿", "😭"].map((e, i) => (
                <span key={i} className="absolute text-2xl animate-bounce" style={{ left: `${20 + i * 14}%`, bottom: `${30 + (i % 3) * 10}%`, animationDelay: `${i * 0.3}s` }}>{e}</span>
              ))}
              {/* timeline */}
              <div className="absolute bottom-4 inset-x-4">
                <div className="flex items-center gap-3 text-xs text-white/80">
                  <span>00:32:15</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/20 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-[42%] bg-gradient-to-r from-pink-500 to-rose-400" />
                    {[12, 28, 35, 50, 68].map((p) => (
                      <span key={p} className="absolute -top-1 w-3 h-3 rounded-full bg-pink-300 border-2 border-black" style={{ left: `${p}%` }} />
                    ))}
                  </div>
                  <span>01:48:00</span>
                </div>
              </div>
            </div>
            {/* viewers row */}
            <div className="flex items-center gap-4 px-5 py-4 border-t border-white/10 bg-black/40">
              <div className="flex -space-x-2">
                {viewers.map((c, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full bg-gradient-to-br ${c} ring-2 ring-black`} />
                ))}
                <div className="w-8 h-8 rounded-full bg-white/10 ring-2 ring-black grid place-items-center text-[10px] text-white">+218</div>
              </div>
              <div className="text-white/70 text-sm flex items-center gap-1"><Users className="w-4 h-4" /> 224 người đang xem</div>
              <div className="flex-1" />
              <button className="px-3 h-8 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs flex items-center gap-1"><Volume2 className="w-3 h-3" /> Voice room · 6</button>
            </div>
          </div>

          {/* Chat */}
          <div className="rounded-3xl border border-white/10 bg-[#0e0717] flex flex-col h-[560px]">
            <div className="px-4 h-12 border-b border-white/10 flex items-center justify-between">
              <div className="text-white/90">Trò chuyện trực tiếp</div>
              <span className="text-xs text-pink-300/70">đồng bộ ±0.2s</span>
            </div>
            <div className="flex-1 p-4 space-y-3 overflow-hidden">
              {messages.map((m) => (
                <div key={m.t + m.u} className="flex gap-3">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${m.color} shrink-0`} />
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-white text-sm">{m.u}</span>
                      <span className="text-[10px] text-white/40">{m.t}</span>
                    </div>
                    <div className="text-white/70 text-sm">{m.c}</div>
                  </div>
                </div>
              ))}
              <div className="flex gap-3 opacity-70">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-violet-400 shrink-0" />
                <div className="px-3 py-2 rounded-2xl rounded-tl-sm bg-white/5 text-white/60 text-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-300 animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-300 animate-pulse [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-300 animate-pulse [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
            <div className="p-3 border-t border-white/10 flex items-center gap-2">
              <button className="w-9 h-9 grid place-items-center rounded-full bg-white/5 text-white/70 hover:bg-white/10"><Smile className="w-4 h-4" /></button>
              <button className="w-9 h-9 grid place-items-center rounded-full bg-white/5 text-pink-300 hover:bg-white/10"><Heart className="w-4 h-4" /></button>
              <input placeholder="Gửi tin nhắn..." className="flex-1 bg-white/5 rounded-full px-4 h-9 outline-none text-sm text-white placeholder:text-white/30" />
              <button className="w-9 h-9 grid place-items-center rounded-full bg-gradient-to-br from-pink-500 to-rose-400 text-white"><Send className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
