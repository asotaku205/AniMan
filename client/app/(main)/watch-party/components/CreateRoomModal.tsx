import { useEffect, useMemo, useState } from "react";
import { Check, Globe, Lock, Search, Sparkles, X } from "lucide-react";
import { ImageWithFallback } from "../../../components/ImageWithFallback";
import { animeList } from "../../../components/data/catalog";

type CreateRoomModalProps = {
  onClose: () => void;
  onCreated: (name: string) => void;
};

export default function CreateRoomModal({ onClose, onCreated }: CreateRoomModalProps) {
  const [title, setTitle] = useState("");
  const [mediaSlug, setMediaSlug] = useState<string>(animeList[0]?.slug ?? "");
  const [capacity, setCapacity] = useState(50);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [pickerQuery, setPickerQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const mediaResults = useMemo(() => {
    const q = pickerQuery.toLowerCase();
    return animeList.filter((item) => !q || item.t.toLowerCase().includes(q)).slice(0, 6);
  }, [pickerQuery]);

  const selected = animeList.find((item) => item.slug === mediaSlug);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreated(title.trim() || `Phòng của bạn · ${selected?.t ?? ""}`);
  };

  return (
    <div className="fixed inset-0 z-55 flex items-end md:items-center justify-center p-0 md:p-6 overscroll-contain">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <form onSubmit={submit} className="relative w-full md:max-w-2xl max-h-[92dvh] flex flex-col bg-[#130d20] border border-white/10 md:rounded-3xl rounded-t-3xl shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#130d20]/95 backdrop-blur md:rounded-t-3xl">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-pink-300/70">TẠO PHÒNG MỚI</div>
            <div className="text-lg text-white mt-0.5" style={{ fontFamily: "Shippori Mincho, serif" }}>Sắp xếp một buổi xem</div>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 grid place-items-center text-white/70">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 overscroll-contain">
          <div>
            <label className="text-[11px] tracking-widest uppercase text-white/40">Tên phòng</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Marathon cuối tuần với hội bạn"
              className="mt-1.5 w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-pink-400/50"
            />
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-white/40">Chọn anime / phim</label>
            {selected && (
              <div className="mt-1.5 flex items-center gap-3 p-3 rounded-xl bg-pink-500/10 border border-pink-400/30">
                <ImageWithFallback src={selected.img} alt={selected.t} className="w-12 h-16 object-cover rounded" />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm truncate">{selected.t}</div>
                  <div className="text-white/50 text-xs">Đã chọn</div>
                </div>
                <Check className="w-4 h-4 text-pink-300" />
              </div>
            )}

            <div className="mt-2 relative">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Tìm anime khác…"
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-pink-400/40"
              />
            </div>

            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {mediaResults.map((item) => (
                <button
                  type="button"
                  key={item.slug}
                  onClick={() => setMediaSlug(item.slug)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left transition ${
                    mediaSlug === item.slug ? "bg-pink-500/15 border-pink-400/50" : "bg-white/5 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <ImageWithFallback src={item.img} alt={item.t} className="w-8 h-11 object-cover rounded shrink-0" />
                  <span className="text-xs text-white truncate">{item.t}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] tracking-widest uppercase text-white/40">Sức chứa</label>
              <span className="text-sm text-white tabular-nums">{capacity} người</span>
            </div>
            <input
              type="range"
              min={5}
              max={500}
              step={5}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="mt-2 w-full accent-pink-500"
            />
            <div className="flex justify-between text-[10px] text-white/30 mt-1"><span>5</span><span>500</span></div>
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-white/40">Hiển thị</label>
            <div className="mt-1.5 grid grid-cols-2 gap-3">
              {([
                { k: "public", icon: <Globe className="w-4 h-4" />, t: "Công khai", d: "Ai cũng có thể tham gia" },
                { k: "private", icon: <Lock className="w-4 h-4" />, t: "Riêng tư", d: "Chỉ người được mời" },
              ] as const).map((option) => (
                <button
                  type="button"
                  key={option.k}
                  onClick={() => setVisibility(option.k)}
                  className={`text-left p-4 rounded-xl border transition ${
                    visibility === option.k ? "bg-pink-500/10 border-pink-400/50" : "bg-white/5 border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center gap-2 text-white">{option.icon}<span className="text-sm">{option.t}</span></div>
                  <div className="text-xs text-white/50 mt-1">{option.d}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-white/10 bg-[#130d20]/95 backdrop-blur md:rounded-b-3xl">
          <button type="button" onClick={onClose} className="px-5 h-11 rounded-full bg-white/5 hover:bg-white/10 text-sm text-white/80 transition">
            Hủy
          </button>
          <button
            type="submit"
            disabled={!selected}
            className="inline-flex items-center gap-2 px-5 h-11 rounded-full bg-linear-to-r from-pink-500 to-rose-400 text-white text-sm shadow-[0_0_20px_rgba(255,90,150,0.4)] hover:from-pink-400 hover:to-rose-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Sparkles className="w-4 h-4" /> Tạo phòng
          </button>
        </div>
      </form>
    </div>
  );
}
