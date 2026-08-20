import { ImageIcon } from "lucide-react";

type UploadCoverFieldProps = {
  coverPreview: string | null;
  onFile: (file?: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
};

export default function UploadCoverField({ coverPreview, onFile, inputRef }: UploadCoverFieldProps) {
  return (
    <div>
      <label className="text-[11px] tracking-widest uppercase text-white/40">Ảnh bìa</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`mt-1.5 w-full h-56 rounded-xl border-2 border-dashed transition overflow-hidden grid place-items-center ${
          coverPreview ? "border-pink-400/40" : "border-white/15 hover:border-pink-400/40 bg-white/2"
        }`}
      >
        {coverPreview ? (
          <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center text-white/50">
            <ImageIcon className="w-7 h-7 mx-auto mb-2 text-pink-300/70" />
            <div className="text-sm">Chọn ảnh bìa</div>
            <div className="text-[11px] text-white/30 mt-0.5">PNG · JPG · tỉ lệ 3:4 cho manga / novel</div>
          </div>
        )}
      </button>
    </div>
  );
}
