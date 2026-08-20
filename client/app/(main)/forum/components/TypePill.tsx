export default function TypePill({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs px-3 h-8 rounded-full transition border ${
        active
          ? "bg-pink-500/20 border-pink-400/40 text-pink-300"
          : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
      }`}
    >
      <span className={active ? "text-pink-300" : "text-pink-300/50"}>{icon}</span> {label}
    </button>
  );
}
