// ─── SVG Sub-components ────────────────────────────────────────────────────────

import type { GuideId } from "../data";

export function Person({ cx, cy, h, color = "#374151", sw = 1.5, poseKey = "stand" }: {
  cx: number; cy: number; h: number; color?: string; sw?: number; poseKey?: string;
}) {
  const r = h * 0.12;
  const hy = cy - h * 0.38;
  const wy = cy - h * 0.15;
  const ky = cy + h * 0.15;
  const ey = cy + h * 0.45;
  const ax = h * 0.22;
  const lx = h * 0.15;

  if (poseKey === "run") {
    return (
      <g stroke={color} strokeWidth={sw} fill="none">
        <circle cx={cx} cy={hy - r} r={r} />
        <line x1={cx} y1={hy} x2={cx} y2={ky} />
        <line x1={cx} y1={wy} x2={cx - ax} y2={wy + h * 0.18} />
        <line x1={cx} y1={wy} x2={cx + ax * 1.2} y2={wy + h * 0.1} />
        <line x1={cx} y1={ky} x2={cx - lx} y2={ey} />
        <line x1={cx} y1={ky} x2={cx + lx * 1.2} y2={ey - h * 0.08} />
      </g>
    );
  }
  if (poseKey === "fight") {
    return (
      <g stroke={color} strokeWidth={sw} fill="none">
        <circle cx={cx} cy={hy - r} r={r} />
        <line x1={cx} y1={hy} x2={cx + 2} y2={ky} />
        <line x1={cx} y1={wy} x2={cx - ax * 1.4} y2={wy - h * 0.05} />
        <line x1={cx} y1={wy} x2={cx + ax} y2={wy + h * 0.12} />
        <line x1={cx + 2} y1={ky} x2={cx - lx} y2={ey} />
        <line x1={cx + 2} y1={ky} x2={cx + lx * 1.1} y2={ey - h * 0.05} />
      </g>
    );
  }
  return (
    <g stroke={color} strokeWidth={sw} fill="none">
      <circle cx={cx} cy={hy - r} r={r} />
      <line x1={cx} y1={hy} x2={cx} y2={ky} />
      <line x1={cx} y1={wy} x2={cx - ax} y2={wy + h * 0.22} />
      <line x1={cx} y1={wy} x2={cx + ax} y2={wy + h * 0.22} />
      <line x1={cx} y1={ky} x2={cx - lx} y2={ey} />
      <line x1={cx} y1={ky} x2={cx + lx} y2={ey} />
    </g>
  );
}

export function GhostComp({ id, opacity = 0.35 }: { id: string; opacity?: number }) {
  const s: React.CSSProperties = { opacity, pointerEvents: "none", position: "absolute", inset: 0, width: "100%", height: "100%" };
  if (id.includes("act-c1") || id.includes("wid-c3")) return (
    <svg style={s} viewBox="0 0 100 100" preserveAspectRatio="none">
      <line x1="0" y1="0" x2="100" y2="100" stroke="#a855f7" strokeWidth="0.8" strokeDasharray="3,2" />
      <line x1="100" y1="0" x2="0" y2="100" stroke="#a855f7" strokeWidth="0.5" strokeDasharray="2,3" />
    </svg>
  );
  if (id.includes("c2") || id.includes("lan-c1") || id.includes("wid-c1")) return (
    <svg style={s} viewBox="0 0 100 100" preserveAspectRatio="none">
      {[33,67].map(v => <line key={`v${v}`} x1={v} y1="0" x2={v} y2="100" stroke="#a855f7" strokeWidth="0.6" strokeDasharray="2,2" />)}
      {[33,67].map(v => <line key={`h${v}`} x1="0" y1={v} x2="100" y2={v} stroke="#a855f7" strokeWidth="0.6" strokeDasharray="2,2" />)}
      <Person cx={33} cy={33} h={40} color="#a855f7" sw={0.7} />
    </svg>
  );
  if (id.includes("c3") || id.includes("wid-c2")) return (
    <svg style={s} viewBox="0 0 100 100" preserveAspectRatio="none">
      <line x1="0" y1="60" x2="100" y2="60" stroke="#60a5fa" strokeWidth="0.6" strokeDasharray="2,2" />
      <Person cx={50} cy={50} h={60} color="#a855f7" sw={0.7} />
    </svg>
  );
  if (id.includes("c4") || id.includes("lan-c2") || id.includes("wid-c4")) return (
    <svg style={s} viewBox="0 0 100 100" preserveAspectRatio="none">
      <line x1="61.8" y1="0" x2="61.8" y2="100" stroke="#a855f7" strokeWidth="0.6" strokeDasharray="2,2" />
      <line x1="0" y1="38.2" x2="100" y2="38.2" stroke="#a855f7" strokeWidth="0.6" strokeDasharray="2,2" />
      <Person cx={33} cy={66} h={55} color="#a855f7" sw={0.7} />
    </svg>
  );
  if (id.includes("lan-c3") || id.includes("wid-c3")) return (
    <svg style={s} viewBox="0 0 100 100" preserveAspectRatio="none">
      {[10,20,30,40,50,60,70,80,90].map(x => <line key={x} x1={x} y1="0" x2="50" y2="60" stroke="#a855f7" strokeWidth="0.4" opacity="0.7" />)}
    </svg>
  );
  // default: frame-in-frame
  return (
    <svg style={s} viewBox="0 0 100 100" preserveAspectRatio="none">
      <rect x="10" y="10" width="80" height="80" fill="none" stroke="#a855f7" strokeWidth="0.7" strokeDasharray="3,2" />
      <rect x="22" y="22" width="56" height="56" fill="none" stroke="#a855f7" strokeWidth="0.5" strokeDasharray="2,3" />
    </svg>
  );
}

export function GhostPose({ id, opacity = 0.3 }: { id: string; opacity?: number }) {
  const s: React.CSSProperties = { opacity, pointerEvents: "none", position: "absolute", inset: 0, width: "100%", height: "100%" };
  const c = "#c084fc";
  const sw = 1.5;

  if (id === "run" || id === "action") return (
    <svg style={s} viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet">
      <circle cx="50" cy="18" r="8" fill="none" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="26" x2="50" y2="70" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="40" x2="30" y2="60" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="40" x2="72" y2="52" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="70" x2="35" y2="100" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="70" x2="68" y2="95" stroke={c} strokeWidth={sw} />
    </svg>
  );
  if (id === "fight") return (
    <svg style={s} viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet">
      <circle cx="50" cy="18" r="8" fill="none" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="26" x2="52" y2="72" stroke={c} strokeWidth={sw} />
      <line x1="52" y1="42" x2="20" y2="36" stroke={c} strokeWidth={sw + 0.5} />
      <line x1="52" y1="42" x2="78" y2="55" stroke={c} strokeWidth={sw} />
      <line x1="52" y1="72" x2="38" y2="105" stroke={c} strokeWidth={sw} />
      <line x1="52" y1="72" x2="70" y2="100" stroke={c} strokeWidth={sw} />
    </svg>
  );
  if (id === "jump") return (
    <svg style={s} viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet">
      <circle cx="50" cy="15" r="8" fill="none" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="23" x2="50" y2="62" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="38" x2="25" y2="28" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="38" x2="75" y2="28" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="62" x2="32" y2="88" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="62" x2="68" y2="85" stroke={c} strokeWidth={sw} />
    </svg>
  );
  if (id === "sit-chair" || id === "sit-floor" || id === "sit-kneel") return (
    <svg style={s} viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet">
      <circle cx="50" cy="22" r="8" fill="none" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="30" x2="50" y2="70" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="45" x2="32" y2="58" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="45" x2="68" y2="58" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="70" x2="30" y2="72" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="70" x2="70" y2="72" stroke={c} strokeWidth={sw} />
      <line x1="30" y1="72" x2="30" y2="95" stroke={c} strokeWidth={sw} />
      <line x1="70" y1="72" x2="70" y2="95" stroke={c} strokeWidth={sw} />
    </svg>
  );
  if (id === "cry" || id === "reach" || id === "point") return (
    <svg style={s} viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet">
      <circle cx="50" cy="18" r="8" fill="none" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="26" x2="50" y2="80" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="42" x2="22" y2="32" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="42" x2="72" y2="62" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="80" x2="38" y2="112" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="80" x2="62" y2="112" stroke={c} strokeWidth={sw} />
    </svg>
  );
  // default stand
  return (
    <svg style={s} viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet">
      <circle cx="50" cy="18" r="8" fill="none" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="26" x2="50" y2="80" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="42" x2="28" y2="62" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="42" x2="72" y2="62" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="80" x2="38" y2="112" stroke={c} strokeWidth={sw} />
      <line x1="50" y1="80" x2="62" y2="112" stroke={c} strokeWidth={sw} />
    </svg>
  );
}

export function GuideOverlay({ guides }: { guides: GuideId[] }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
      {guides.includes("thirds") && <>
        {[33,67].map(v => <line key={`tv${v}`} x1={v} y1="0" x2={v} y2="100" stroke="#fbbf24" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.7" />)}
        {[33,67].map(v => <line key={`th${v}`} x1="0" y1={v} x2="100" y2={v} stroke="#fbbf24" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.7" />)}
      </>}
      {guides.includes("horizon") && (
        <line x1="0" y1="50" x2="100" y2="50" stroke="#60a5fa" strokeWidth="0.6" strokeDasharray="3,2" opacity="0.8" />
      )}
      {guides.includes("proportions") && <>
        <line x1="50" y1="0" x2="50" y2="100" stroke="#f472b6" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.6" />
        <rect x="25" y="10" width="50" height="80" fill="none" stroke="#f472b6" strokeWidth="0.4" strokeDasharray="2,3" opacity="0.5" />
      </>}
      {guides.includes("vanishing") && <>
        {[10,30,50,70,90].map(x => <line key={x} x1={x} y1="0" x2="50" y2="55" stroke="#4ade80" strokeWidth="0.4" opacity="0.5" />)}
        {[10,30,50,70,90].map(y => <line key={`y${y}`} x1="0" y1={y} x2="50" y2="55" stroke="#4ade80" strokeWidth="0.4" opacity="0.5" />)}
      </>}
    </svg>
  );
}
export function PoseThumb({ id }: { id: string }) {
  const c = "#7c3aed";
  const sw = 1.2;
  if (id === "run" || id === "action") return (
    <svg viewBox="0 0 40 56" className="w-full h-full">
      <circle cx="20" cy="8" r="4" fill="none" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="12" x2="20" y2="30" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="18" x2="10" y2="26" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="18" x2="31" y2="22" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="30" x2="13" y2="44" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="30" x2="28" y2="40" stroke={c} strokeWidth={sw} />
    </svg>
  );
  if (id === "fight") return (
    <svg viewBox="0 0 40 56" className="w-full h-full">
      <circle cx="20" cy="7" r="4" fill="none" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="11" x2="21" y2="31" stroke={c} strokeWidth={sw} />
      <line x1="21" y1="19" x2="6" y2="16" stroke={c} strokeWidth={sw + 0.3} />
      <line x1="21" y1="19" x2="33" y2="24" stroke={c} strokeWidth={sw} />
      <line x1="21" y1="31" x2="14" y2="46" stroke={c} strokeWidth={sw} />
      <line x1="21" y1="31" x2="29" y2="44" stroke={c} strokeWidth={sw} />
    </svg>
  );
  if (id === "jump") return (
    <svg viewBox="0 0 40 56" className="w-full h-full">
      <circle cx="20" cy="6" r="4" fill="none" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="10" x2="20" y2="28" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="16" x2="8" y2="11" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="16" x2="32" y2="11" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="28" x2="13" y2="44" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="28" x2="27" y2="42" stroke={c} strokeWidth={sw} />
    </svg>
  );
  if (id === "sit-chair" || id === "sit-floor" || id === "sit-kneel") return (
    <svg viewBox="0 0 40 56" className="w-full h-full">
      <circle cx="20" cy="9" r="4" fill="none" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="13" x2="20" y2="30" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="20" x2="11" y2="27" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="20" x2="29" y2="27" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="30" x2="10" y2="32" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="30" x2="30" y2="32" stroke={c} strokeWidth={sw} />
      <line x1="10" y1="32" x2="10" y2="46" stroke={c} strokeWidth={sw} />
      <line x1="30" y1="32" x2="30" y2="46" stroke={c} strokeWidth={sw} />
    </svg>
  );
  // default stand / emotion
  return (
    <svg viewBox="0 0 40 56" className="w-full h-full">
      <circle cx="20" cy="7" r="4" fill="none" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="11" x2="20" y2="34" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="18" x2="11" y2="27" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="18" x2="29" y2="27" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="34" x2="14" y2="48" stroke={c} strokeWidth={sw} />
      <line x1="20" y1="34" x2="26" y2="48" stroke={c} strokeWidth={sw} />
    </svg>
  );
}
export function CompThumb({ id }: { id: string }) {
  const c = "#818cf8";
  if (id.includes("c2") || id.includes("lan-c1") || id.includes("wid-c1")) return (
    <svg viewBox="0 0 44 44" className="w-full h-full">
      {[14,28].map(v => <line key={`v${v}`} x1={v} y1="0" x2={v} y2="44" stroke={c} strokeWidth="0.8" strokeDasharray="2,2" />)}
      {[14,28].map(v => <line key={`h${v}`} x1="0" y1={v} x2="44" y2={v} stroke={c} strokeWidth="0.8" strokeDasharray="2,2" />)}
    </svg>
  );
  if (id.includes("c1") || id.includes("act-c1")) return (
    <svg viewBox="0 0 44 44" className="w-full h-full">
      <line x1="0" y1="0" x2="44" y2="44" stroke="#f472b6" strokeWidth="1" strokeDasharray="3,2" />
      <line x1="44" y1="0" x2="0" y2="44" stroke="#f472b6" strokeWidth="1" strokeDasharray="3,2" />
    </svg>
  );
  if (id.includes("c4") || id.includes("lan-c2")) return (
    <svg viewBox="0 0 44 44" className="w-full h-full">
      <path d="M 4 4 Q 40 4 40 40 Q 40 22 22 22 Q 13 22 13 31" fill="none" stroke="#fbbf24" strokeWidth="1" strokeDasharray="3,2" />
    </svg>
  );
  if (id.includes("c3") || id.includes("lan-c3")) return (
    <svg viewBox="0 0 44 44" className="w-full h-full">
      {[5,12,19,26,33,40].map(x => <line key={x} x1={x} y1="0" x2="22" y2="44" stroke="#4ade80" strokeWidth="0.7" opacity="0.8" />)}
    </svg>
  );
  return (
    <svg viewBox="0 0 44 44" className="w-full h-full">
      <rect x="4" y="4" width="36" height="36" fill="none" stroke={c} strokeWidth="0.8" strokeDasharray="2,2" />
      <rect x="11" y="11" width="22" height="22" fill="none" stroke={c} strokeWidth="0.6" strokeDasharray="2,3" />
    </svg>
  );
}

export function AiToolPreview({ id }: { id: string }) {
  if (id === "clean-lines") return (
    <svg viewBox="0 0 80 44" className="w-full h-full">
      <rect width="80" height="44" fill="#0f172a" />
      <text x="20" y="8" fill="#475569" fontSize="4" textAnchor="middle">Trước</text>
      <text x="60" y="8" fill="#475569" fontSize="4" textAnchor="middle">Sau</text>
      <line x1="40" y1="0" x2="40" y2="44" stroke="#1e293b" strokeWidth="0.5" />
      <path d="M5 20 Q10 18 15 22 Q20 26 25 20" fill="none" stroke="#4b5563" strokeWidth="1.2" />
      <path d="M8 28 Q13 26 18 30" fill="none" stroke="#4b5563" strokeWidth="1" />
      <path d="M45 20 Q52 16 60 20 Q67 24 73 20" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M48 28 Q55 26 62 28" fill="none" stroke="#6366f1" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
  if (id === "screentone") return (
    <svg viewBox="0 0 80 44" className="w-full h-full">
      <rect width="80" height="44" fill="#0f172a" />
      <text x="20" y="8" fill="#475569" fontSize="4" textAnchor="middle">Trước</text>
      <text x="60" y="8" fill="#475569" fontSize="4" textAnchor="middle">Sau</text>
      <line x1="40" y1="0" x2="40" y2="44" stroke="#1e293b" strokeWidth="0.5" />
      <rect x="5" y="12" width="28" height="26" fill="#1e293b" rx="1" />
      {Array.from({ length: 4 }, (_, r) => Array.from({ length: 5 }, (_, col) => (
        <circle key={`${r}${col}`} cx={45 + col * 6} cy={14 + r * 7} r="1.2" fill="#38bdf8" opacity="0.7" />
      )))}
    </svg>
  );
  if (id === "speech-bubble") return (
    <svg viewBox="0 0 80 44" className="w-full h-full">
      <rect width="80" height="44" fill="#0f172a" />
      <text x="20" y="8" fill="#475569" fontSize="4" textAnchor="middle">Trước</text>
      <text x="60" y="8" fill="#475569" fontSize="4" textAnchor="middle">Sau</text>
      <line x1="40" y1="0" x2="40" y2="44" stroke="#1e293b" strokeWidth="0.5" />
      <rect x="5" y="12" width="28" height="26" fill="#1e293b" rx="1" />
      <ellipse cx="62" cy="22" rx="14" ry="9" fill="#f9a8d4" fillOpacity="0.15" stroke="#f472b6" strokeWidth="0.8" />
      <text x="62" y="25" fill="#f9a8d4" fontSize="4" textAnchor="middle">...</text>
      <polygon points="54,30 50,36 58,32" fill="#f472b6" fillOpacity="0.7" />
    </svg>
  );
  if (id === "speed-lines") return (
    <svg viewBox="0 0 80 44" className="w-full h-full">
      <rect width="80" height="44" fill="#0f172a" />
      <text x="20" y="8" fill="#475569" fontSize="4" textAnchor="middle">Trước</text>
      <text x="60" y="8" fill="#475569" fontSize="4" textAnchor="middle">Sau</text>
      <line x1="40" y1="0" x2="40" y2="44" stroke="#1e293b" strokeWidth="0.5" />
      <rect x="5" y="12" width="28" height="26" fill="#1e293b" rx="1" />
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return <line key={i} x1={62 + Math.cos(angle) * 3} y1={22 + Math.sin(angle) * 3} x2={62 + Math.cos(angle) * 16} y2={22 + Math.sin(angle) * 16} stroke="#34d399" strokeWidth="0.8" opacity="0.8" />;
      })}
    </svg>
  );
  if (id === "fix-comp") return (
    <svg viewBox="0 0 80 44" className="w-full h-full">
      <rect width="80" height="44" fill="#0f172a" />
      <text x="20" y="8" fill="#475569" fontSize="4" textAnchor="middle">Trước</text>
      <text x="60" y="8" fill="#475569" fontSize="4" textAnchor="middle">Sau</text>
      <line x1="40" y1="0" x2="40" y2="44" stroke="#1e293b" strokeWidth="0.5" />
      <rect x="5" y="12" width="28" height="26" fill="#1e293b" rx="1" />
      <rect x="20" y="22" width="8" height="12" fill="#fbbf24" fillOpacity="0.4" rx="1" />
      <rect x="45" y="12" width="28" height="26" fill="#1e293b" rx="1" />
      <line x1="54.3" y1="12" x2="54.3" y2="38" stroke="#fbbf24" strokeWidth="0.4" strokeDasharray="1,1" opacity="0.5" />
      <line x1="63.7" y1="12" x2="63.7" y2="38" stroke="#fbbf24" strokeWidth="0.4" strokeDasharray="1,1" opacity="0.5" />
      <rect x="52" y="22" width="8" height="12" fill="#fbbf24" fillOpacity="0.5" rx="1" />
    </svg>
  );
  return <svg viewBox="0 0 80 44" className="w-full h-full"><rect width="80" height="44" fill="#1e293b" /></svg>;
}