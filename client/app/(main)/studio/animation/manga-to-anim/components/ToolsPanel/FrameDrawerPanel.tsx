"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser as EraserIcon, PencilLine, Plus, Trash2 } from "lucide-react";

export function FrameDrawerPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#111111");
  const [size, setSize] = useState(4);
  const [erasing, setErasing] = useState(false);
  const drawing = useRef(false);
  const [frames, setFrames] = useState<string[]>([]);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * e.currentTarget.width, y: ((e.clientY - r.top) / r.height) * e.currentTarget.height };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = e.currentTarget.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = pos(e);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = erasing ? "#ffffff" : color;
    ctx.lineWidth = erasing ? size * 4 : size;
    ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const up = () => { drawing.current = false; };
  const clear = () => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
  };
  const saveFrame = () => {
    const c = canvasRef.current; if (!c) return;
    setFrames((f) => [...f, c.toDataURL()]);
    clear();
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-5">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setErasing(false); }} className="w-8 h-8 rounded cursor-pointer bg-transparent" />
          <button onClick={() => setErasing(false)} className={`px-3 h-8 rounded-md text-xs flex items-center gap-1.5 ${!erasing ? "bg-pink-500 text-white" : "bg-white/5 border border-white/10 text-white/70"}`}><PencilLine className="w-3.5 h-3.5" /> Bút</button>
          <button onClick={() => setErasing(true)} className={`px-3 h-8 rounded-md text-xs flex items-center gap-1.5 ${erasing ? "bg-pink-500 text-white" : "bg-white/5 border border-white/10 text-white/70"}`}><EraserIcon className="w-3.5 h-3.5" /> Tẩy</button>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[10px] text-white/40">Cỡ</span>
            <input type="range" min={1} max={24} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-24 accent-pink-500" />
            <span className="text-[10px] text-pink-300 tabular-nums w-6">{size}px</span>
          </div>
          <button onClick={clear} className="px-2 h-8 rounded-md bg-white/5 border border-white/10 text-xs text-white/70 hover:text-white" title="Xoá toàn bộ"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
        <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 p-2">
          <canvas
            ref={canvasRef}
            width={960}
            height={540}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={up}
            className="w-full aspect-video bg-white rounded-md cursor-crosshair touch-none"
          />
        </div>
        <button onClick={saveFrame} className="mt-3 px-4 h-10 rounded-lg bg-gradient-to-r from-pink-500 to-rose-400 text-sm inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Lưu thành frame mới
        </button>
      </div>
      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
        <div className="text-[11px] tracking-[0.25em] text-white/40 mb-2">FRAME ĐÃ VẼ ({frames.length})</div>
        {frames.length === 0 ? (
          <div className="text-xs text-white/40 leading-relaxed">Chưa có frame. Vẽ bên trái rồi nhấn <span className="text-pink-300">Lưu</span> để thêm vào timeline.</div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {frames.map((src, i) => (
              <div key={i} className="relative rounded-md overflow-hidden border border-white/10 group">
                <img src={src} alt={`frame ${i}`} className="w-full aspect-video object-cover bg-white" />
                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[10px]">F{i + 1}</div>
                <button onClick={() => setFrames((f) => f.filter((_, j) => j !== i))} className="absolute top-1 right-1 w-6 h-6 rounded bg-black/70 grid place-items-center opacity-0 group-hover:opacity-100 transition">
                  <Trash2 className="w-3 h-3 text-red-300" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
