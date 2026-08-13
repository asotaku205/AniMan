export function SakuraMark({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <g transform="translate(16 16)">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cx="0" cy="-9" rx="4.5" ry="7" fill="white" transform={`rotate(${r})`} />
        ))}
        <circle r="2.5" fill="#ff7aa8" />
      </g>
    </svg>
  );
}
