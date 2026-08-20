import { VISIBILITY_OPTIONS, type VisibilityMode } from "../types";

type UploadVisibilityPickerProps = {
  visibility: VisibilityMode;
  setVisibility: (value: VisibilityMode) => void;
};

export default function UploadVisibilityPicker({ visibility, setVisibility }: UploadVisibilityPickerProps) {
  return (
    <div>
      <label className="text-[11px] tracking-widest uppercase text-white/40">Hiển thị</label>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {VISIBILITY_OPTIONS.map((option) => {
          const Icon = option.icon;

          return (
            <button
              key={option.k}
              type="button"
              onClick={() => setVisibility(option.k)}
              className={`p-3 rounded-xl border transition flex flex-col items-start gap-1 ${
                visibility === option.k ? "bg-pink-500/10 border-pink-400/50" : "bg-white/5 border-white/10 hover:border-white/20"
              }`}
            >
              <span className="text-white flex items-center gap-1.5 text-sm">
                <Icon className="w-4 h-4" />
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
