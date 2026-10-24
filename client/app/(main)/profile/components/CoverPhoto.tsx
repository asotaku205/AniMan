import { ImageWithFallback } from "@/app/components/ImageWithFallback";
import { Edit3, Trash2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

const COVER_KEY = "animan_profile_cover_v1";
const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1400";

/**
 * Ảnh bìa hồ sơ: mặc định là ảnh stock; nút "Sửa bìa" trước đây bấm
 * không làm gì nên giờ cho tải ảnh thật lên (nén về tối đa 1400px,
 * lưu localStorage) và gỡ về ảnh mặc định khi muốn.
 */
const CoverPhoto = ({ isOwnProfile }: { isOwnProfile: boolean }) => {
  const [cover, setCover] = useState<string>(DEFAULT_COVER);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(COVER_KEY);
      if (saved) setCover(saved);
    } catch {
      /* bỏ qua khi storage bị chặn */
    }
  }, []);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Chỉ nhận file ảnh.");
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 1400 / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setError("Không xử lý được ảnh này.");
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      try {
        window.localStorage.setItem(COVER_KEY, dataUrl);
      } catch {
        setError("Ảnh quá lớn, không lưu được.");
        return;
      }
      setCover(dataUrl);
      setError(null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Không đọc được file ảnh.");
    };
    img.src = url;
  };

  const removeCover = () => {
    try {
      window.localStorage.removeItem(COVER_KEY);
    } catch {
      /* bỏ qua */
    }
    setCover(DEFAULT_COVER);
    setError(null);
  };

  return (
    <div className="relative h-48 sm:h-64 overflow-hidden">
      <ImageWithFallback
        src={cover}
        alt="cover"
        className="w-full h-full object-cover brightness-50"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#07040e]" />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse at 30% 50%, rgba(255,90,150,0.4) 0%, transparent 60%), radial-gradient(ellipse at 80% 30%, rgba(150,50,255,0.3) 0%, transparent 50%)",
        }}
      />
      {isOwnProfile && (
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {error && (
            <span className="text-xs text-rose-300 bg-black/50 rounded-full px-3 py-1">
              {error}
            </span>
          )}
          {cover !== DEFAULT_COVER && (
            <button
              type="button"
              onClick={removeCover}
              title="Gỡ bìa về ảnh mặc định"
              className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-black/50 backdrop-blur border border-white/20 text-white/80 text-sm hover:bg-black/70 transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Gỡ bìa
            </button>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-black/50 backdrop-blur border border-white/20 text-white/80 text-sm hover:bg-black/70 transition"
          >
            <Edit3 className="w-3.5 h-3.5" /> Sửa bìa
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
};

export default CoverPhoto;
