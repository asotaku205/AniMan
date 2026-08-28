"use client";

import { TERRAIN, type TerrainType } from "../data";

export function ScenePreview({ terrains, cameraElevation }: { terrains: TerrainType[][]; cameraElevation: number }) {
  const W = 280, H = 180;
  const isTopDown = cameraElevation > 55;
  const isEyeLevel = cameraElevation < 20;

  const dominantTerrain = terrains.flat().reduce<Record<string, number>>((acc, t) => {
    acc[t] = (acc[t] || 0) + 1; return acc;
  }, {});
  const mainTerrain = (Object.entries(dominantTerrain).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "sea") as TerrainType;
  const hasMountain = terrains.flat().includes("mountain");
  const hasForest = terrains.flat().includes("forest");
  const hasCity = terrains.flat().includes("city");
  const hasSea = terrains.flat().includes("sea");

  const horizonY = isTopDown ? H * 0.1 : isEyeLevel ? H * 0.55 : H * 0.4;
  const skyColor = mainTerrain === "snow" ? "#dbeafe" : mainTerrain === "magic" ? "#3b0764" : mainTerrain === "desert" ? "#fef3c7" : "#dbeafe";
  const groundColor = TERRAIN[mainTerrain]?.fill ?? "#86efac";
  const groundDark = TERRAIN[mainTerrain]?.dark ?? "#166534";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full rounded-xl overflow-hidden">
      {/* Sky */}
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={mainTerrain === "magic" ? "#1e1b4b" : "#bfdbfe"} />
          <stop offset="100%" stopColor={skyColor} />
        </linearGradient>
        <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={groundColor} />
          <stop offset="100%" stopColor={groundDark} />
        </linearGradient>
      </defs>
      <rect width={W} height={horizonY} fill="url(#skyGrad)" />
      <rect y={horizonY} width={W} height={H - horizonY} fill="url(#groundGrad)" />

      {/* Horizon line */}
      {!isTopDown && <line x1="0" y1={horizonY} x2={W} y2={horizonY} stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />}

      {/* Mountains */}
      {hasMountain && !isTopDown && (
        <>
          <polygon points={`${W*0.55},${horizonY} ${W*0.7},${horizonY-50} ${W*0.85},${horizonY}`} fill="#6b7280" opacity="0.9" />
          <polygon points={`${W*0.3},${horizonY} ${W*0.48},${horizonY-65} ${W*0.66},${horizonY}`} fill="#9ca3af" opacity="0.85" />
          <polygon points={`${W*0.45},${horizonY-15} ${W*0.55},${horizonY-40} ${W*0.65},${horizonY-15}`} fill="white" opacity="0.7" />
        </>
      )}
      {hasMountain && isTopDown && (
        <>
          <ellipse cx={W*0.6} cy={H*0.35} rx={30} ry={22} fill="#9ca3af" opacity="0.8" />
          <ellipse cx={W*0.4} cy={H*0.6} rx={22} ry={16} fill="#78716c" opacity="0.8" />
        </>
      )}

      {/* Forest */}
      {hasForest && !isTopDown && (
        <>
          {[0.1, 0.2, 0.75, 0.85, 0.92].map((x, i) => (
            <g key={i}>
              <rect x={W*x - 3} y={horizonY + 5 + i*2} width="6" height={15 + i*3} fill="#78350f" />
              <ellipse cx={W*x} cy={horizonY + 2 + i} rx={12 + i*2} ry={14 + i} fill="#15803d" />
            </g>
          ))}
        </>
      )}
      {hasForest && isTopDown && (
        <>
          {[[0.25,0.3],[0.4,0.5],[0.6,0.7],[0.15,0.6]].map(([x,y],i) => (
            <circle key={i} cx={W*x} cy={H*y} r={12+i*3} fill="#15803d" opacity="0.85" />
          ))}
        </>
      )}

      {/* City buildings */}
      {hasCity && !isTopDown && (
        <g>
          {[[0.35,30,20],[0.45,45,18],[0.55,35,22],[0.65,28,16],[0.72,40,14]].map(([rx,rh,rw],i) => (
            <rect key={i} x={W*+rx - +rw/2} y={horizonY - +rh} width={rw} height={rh} fill="#374151" opacity={0.8 + i*0.02} />
          ))}
          <line x1={W*0.45} y1={horizonY-45} x2={W*0.45} y2={horizonY-52} stroke="#6b7280" strokeWidth="1.5" />
        </g>
      )}

      {/* Sea in foreground */}
      {hasSea && !isTopDown && mainTerrain !== "sea" && (
        <>
          <rect x={0} y={H - 35} width={W} height={35} fill="#0ea5e9" opacity="0.6" />
          <path d={`M0,${H-35} Q${W*0.25},${H-30} ${W*0.5},${H-35} Q${W*0.75},${H-40} ${W},${H-35}`} fill="none" stroke="white" strokeWidth="0.8" opacity="0.5" />
        </>
      )}

      {/* Magic particles */}
      {mainTerrain === "magic" && (
        <>
          {[[50,80],[120,60],[180,100],[230,50],[80,140]].map(([px,py],i) => (
            <g key={i}>
              <circle cx={px} cy={py} r={3} fill="#c084fc" opacity={0.7 + Math.sin(i)*0.2} />
              <circle cx={px} cy={py} r={7} fill="none" stroke="#a855f7" strokeWidth="0.5" opacity="0.4" />
            </g>
          ))}
        </>
      )}

      {/* Snow overlay */}
      {mainTerrain === "snow" && (
        <>
          {[[30,40],[80,20],[150,60],[220,30],[260,70]].map(([px,py],i) => (
            <text key={i} x={px} y={py} fontSize="12" opacity="0.6" fill="white">❄</text>
          ))}
        </>
      )}

      {/* Depth lines */}
      {!isTopDown && (
        <>
          <line x1={0} y1={horizonY} x2={W/2} y2={H} stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
          <line x1={W} y1={horizonY} x2={W/2} y2={H} stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
        </>
      )}

      {/* Grid overlay for top-down */}
      {isTopDown && (
        <g opacity="0.15">
          {Array.from({length: 6}, (_, i) => (
            <line key={`v${i}`} x1={W/5*(i+1)} y1={0} x2={W/5*(i+1)} y2={H} stroke="white" strokeWidth="0.5" />
          ))}
          {Array.from({length: 4}, (_, i) => (
            <line key={`h${i}`} x1={0} y1={H/4*(i+1)} x2={W} y2={H/4*(i+1)} stroke="white" strokeWidth="0.5" />
          ))}
        </g>
      )}

      {/* Camera angle indicator */}
      <rect x={0} y={H-14} width={W} height={14} fill="rgba(0,0,0,0.5)" />
      <text x={6} y={H-4} fill="rgba(255,255,255,0.7)" fontSize="8" fontFamily="monospace">
        Góc cam: {cameraElevation}° | {isTopDown ? "Góc chim" : isEyeLevel ? "Mắt thường" : "Bình thường"}
      </text>
    </svg>
  );
}
