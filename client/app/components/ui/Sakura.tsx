"use client";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

type Petal = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  rotate: number;
  drift: number;
};

export function Sakura({ count = 18 }: { count?: number }) {
  const [petals, setPetals] = useState<Petal[]>([]);

  useEffect(() => {
    setPetals(
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 8,
        duration: 9 + Math.random() * 9,
        size: 10 + Math.random() * 14,
        rotate: Math.random() * 360,
        drift: (Math.random() - 0.5) * 200,
      })),
    );
  }, [count]);

  if (petals.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {petals.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -50, x: 0, rotate: p.rotate, opacity: 0 }}
          animate={{
            y: ["-5%", "110%"],
            x: [0, p.drift, 0, -p.drift, 0],
            rotate: [p.rotate, p.rotate + 360],
            opacity: [0, 1, 1, 0.6, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{ left: `${p.left}%`, width: p.size, height: p.size }}
          className="absolute"
        >
          <svg viewBox="0 0 32 32" fill="none" className="w-full h-full drop-shadow-[0_0_6px_rgba(255,182,193,0.6)]">
            <path
              d="M16 4 C20 10, 26 12, 28 18 C24 20, 20 24, 16 28 C12 24, 8 20, 4 18 C6 12, 12 10, 16 4 Z"
              fill="url(#petal)"
            />
            <defs>
              <linearGradient id="petal" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffd6e7" />
                <stop offset="100%" stopColor="#ff7aa8" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>
      ))}
    </div>
  );
}
