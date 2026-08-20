import { WORK_TYPES, type WorkType } from "../types";

type UploadTypePickerProps = {
  type: WorkType;
  setType: (value: WorkType) => void;
};

export default function UploadTypePicker({ type, setType }: UploadTypePickerProps) {
  return (
    <div>
      <label className="text-[11px] tracking-widest uppercase text-white/40">Loại tác phẩm</label>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {WORK_TYPES.map((work) => {
          const Icon = work.icon;

          return (
            <button
              key={work.k}
              type="button"
              onClick={() => setType(work.k)}
              className={`text-left p-3 rounded-xl border transition ${
                type === work.k ? "bg-pink-500/10 border-pink-400/50" : "bg-white/5 border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-1.5 text-white">
                <Icon className="w-4 h-4" />
                <span className="text-sm">{work.label}</span>
              </div>
              <div className="text-[11px] text-white/45 mt-1 leading-snug">{work.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
