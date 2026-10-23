"use client";

/**
 * Khung vẽ trong Animation Studio (R4): bút vẽ + tẩy + hoàn tác/làm
 * lại trên nền TRONG SUỐT (lưu PNG giữ độ trong suốt để xếp lớp trong
 * cảnh). Dùng cho 3 việc: vẽ hình tự do vào thư viện, vẽ/sửa biểu cảm
 * của nhân vật tự tạo, và vẽ ngay cho layer đang chọn trong editor.
 * Nét vẽ lưu dạng điểm tương đối (lib/drawStrokes) nên hoàn tác vẽ lại
 * được toàn bộ từ đầu cộng hình gốc.
 */

import { useEffect, useRef, useState } from "react";
import {
  Eraser,
  Paintbrush,
  Redo2,
  Save,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  DRAW_PALETTE,
  createDrawHistory,
  newDrawStrokeId,
  paintStroke,
  pushDrawStroke,
  redoDrawStroke,
  renderDrawStrokes,
  undoDrawStroke,
  type DrawHistory,
  type DrawStroke,
  type DrawTool,
} from "../lib/drawStrokes";

interface Props {
  title: string;
  /** Hình hiện có để vẽ tiếp — null là trang giấy trắng trong suốt. */
  initialDataUrl?: string | null;
  canvasWidth: number;
  canvasHeight: number;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

export default function DrawStudioModal({
  title,
  initialDataUrl,
  canvasWidth,
  canvasHeight,
  onSave,
  onClose,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const historyRef = useRef<DrawHistory>(createDrawHistory());
  const currentRef = useRef<DrawStroke | null>(null);
  const [history, setHistory] = useState<DrawHistory>(historyRef.current);
  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState("#171717");
  const [widthPx, setWidthPx] = useState(6);
  const [confirmClear, setConfirmClear] = useState(false);
  const [bgPreview, setBgPreview] = useState<"checker" | "white" | "dark">(
    "checker",
  );

  const applyHistory = (h: DrawHistory) => {
    historyRef.current = h;
    setHistory(h);
  };

  const redrawAll = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    renderDrawStrokes(
      ctx,
      baseImageRef.current,
      historyRef.current.strokes,
      canvasWidth,
      canvasHeight,
    );
  };

  // Nạp hình gốc (nếu có) rồi vẽ lại
  useEffect(() => {
    if (!initialDataUrl) {
      redrawAll();
      return;
    }
    const img = new Image();
    img.onload = () => {
      baseImageRef.current = img;
      redrawAll();
    };
    img.src = initialDataUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDataUrl]);

  const pointOf = (e: React.PointerEvent): { x: number; y: number } => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const startStroke = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const stroke: DrawStroke = {
      id: newDrawStrokeId(),
      tool,
      color,
      widthPx,
      points: [pointOf(e)],
    };
    currentRef.current = stroke;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) paintStroke(ctx, stroke, canvasWidth, canvasHeight);
  };

  const moveStroke = (e: React.PointerEvent) => {
    const stroke = currentRef.current;
    if (!stroke) return;
    stroke.points.push(pointOf(e));
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      // Vẽ đoạn mới nhất nối điểm áp chót → điểm cuối
      const tail: DrawStroke = {
        ...stroke,
        points: stroke.points.slice(-2),
      };
      paintStroke(ctx, tail, canvasWidth, canvasHeight);
    }
  };

  const endStroke = () => {
    const stroke = currentRef.current;
    currentRef.current = null;
    if (!stroke) return;
    applyHistory(pushDrawStroke(historyRef.current, stroke));
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  };

  const bgClass =
    bgPreview === "checker"
      ? "[background:repeating-conic-gradient(#2a2a2e_0%_25%,#1c1c1f_0%_50%)_0_0/16px_16px]"
      : bgPreview === "white"
        ? "bg-white"
        : "bg-neutral-900";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#141216] p-4 space-y-3 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 text-[14px] font-semibold text-white/85">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Đóng khung vẽ"
            className="p-1.5 text-white/40 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <button
            onClick={() => setTool("pen")}
            className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg border ${tool === "pen" ? "bg-pink-500/25 border-pink-300/40 text-pink-100" : "bg-white/5 border-white/10 text-white/60"}`}
          >
            <Paintbrush className="w-3.5 h-3.5" /> Bút vẽ
          </button>
          <button
            onClick={() => setTool("eraser")}
            className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg border ${tool === "eraser" ? "bg-pink-500/25 border-pink-300/40 text-pink-100" : "bg-white/5 border-white/10 text-white/60"}`}
          >
            <Eraser className="w-3.5 h-3.5" /> Tẩy
          </button>
          <span className="flex items-center gap-1 ml-1">
            {DRAW_PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  setTool("pen");
                }}
                aria-label={`Màu ${c}`}
                className={`w-5 h-5 rounded-full border ${color === c ? "border-white ring-2 ring-pink-400/60" : "border-white/25"}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.currentTarget.value);
                setTool("pen");
              }}
              aria-label="Màu tuỳ chọn"
              className="w-7 h-7 rounded bg-transparent cursor-pointer"
            />
          </span>
          <label className="flex items-center gap-1.5 text-white/55 ml-1">
            Cỡ nét
            <input
              type="range"
              min={2}
              max={40}
              value={widthPx}
              onChange={(e) => setWidthPx(Number(e.currentTarget.value))}
              className="w-24 accent-pink-400"
            />
            <span className="w-6 text-white/75">{widthPx}</span>
          </label>
          <span className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => {
                applyHistory(undoDrawStroke(historyRef.current));
                redrawAll();
              }}
              disabled={history.strokes.length === 0}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/70 disabled:opacity-35"
              aria-label="Hoàn tác nét vẽ"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                applyHistory(redoDrawStroke(historyRef.current));
                redrawAll();
              }}
              disabled={history.undone.length === 0}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/70 disabled:opacity-35"
              aria-label="Làm lại nét vẽ"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            {confirmClear ? (
              <button
                onClick={() => {
                  applyHistory(createDrawHistory());
                  baseImageRef.current = null;
                  setConfirmClear(false);
                  requestAnimationFrame(redrawAll);
                }}
                className="px-2.5 h-8 rounded-lg bg-rose-500/25 border border-rose-300/40 text-rose-100"
              >
                Xoá hết thật?
              </button>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/70"
                aria-label="Xoá toàn bộ hình"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </span>
        </div>

        <div className={`rounded-xl overflow-hidden ${bgClass}`}>
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="block w-full touch-none cursor-crosshair"
            onPointerDown={startStroke}
            onPointerMove={moveStroke}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-white/45">Xem trên nền:</span>
          {(
            [
              ["checker", "Trong suốt"],
              ["white", "Trắng"],
              ["dark", "Tối"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setBgPreview(v)}
              className={`px-2.5 h-7 rounded-lg border ${bgPreview === v ? "bg-white/15 border-white/30 text-white" : "bg-white/5 border-white/10 text-white/55"}`}
            >
              {label}
            </button>
          ))}
          <span className="text-white/35 ml-1">
            Hình lưu dạng nền trong suốt để xếp lớp trong cảnh.
          </span>
          <span className="ml-auto flex gap-2">
            <button
              onClick={onClose}
              className="px-3.5 h-9 rounded-lg bg-white/5 border border-white/10 text-white/70"
            >
              Huỷ
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 h-9 rounded-lg bg-pink-500/80 hover:bg-pink-500 text-white font-medium"
            >
              <Save className="w-4 h-4" /> Lưu hình
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
