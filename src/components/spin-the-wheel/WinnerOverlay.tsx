"use client";

import { motion, AnimatePresence } from "motion/react";
import { Award, Sparkles } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

const WHEEL_COLORS = [
  "#7C3AED", "#2563EB", "#059669", "#D97706",
  "#DC2626", "#DB2777", "#0891B2", "#0D9488",
  "#8B5CF6", "#6366F1", "#3B82F6", "#F59E0B",
];

function lightenColor(hex: string, percent = 20): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}

interface WinnerOverlayProps {
  winner: string | null;
  winnerIndex: number;
  isVisible: boolean;
}

export default function WinnerOverlay({ winner, winnerIndex, isVisible }: WinnerOverlayProps) {
  const [colorStyle, setColorStyle] = useState("");

  // Pre-compute random confetti values so they're stable across re-renders
  const confettiParticles = useMemo(
    () =>
      Array.from({ length: 30 }, () => {
        const angle = (Math.random() * 360 * Math.PI) / 180;
        const distance = 200 + Math.random() * 400;
        return {
          finalX: Math.cos(angle) * distance,
          finalY: Math.sin(angle) * distance - 100,
          initRotate: Math.random() * 360,
          animRotate: (Math.random() - 0.5) * 720,
          duration: 2.5 + Math.random() * 1.5,
        };
      }),
    // Re-generate particles each time a new winner appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [winner]
  );

  useEffect(() => {
    if (winner && isVisible) {
      const baseColor = WHEEL_COLORS[winnerIndex % WHEEL_COLORS.length];
      const lighterColor = lightenColor(baseColor, 15);
      setColorStyle(`linear-gradient(to bottom right, ${baseColor}, ${lighterColor})`);
    }
  }, [winner, winnerIndex, isVisible]);

  return (
    <AnimatePresence>
      {isVisible && winner && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none px-4"
        >
          {/* Background Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: colorStyle }}
            className="absolute inset-0 opacity-20"
          />

          {/* Confetti/Sparkles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {confettiParticles.map((p, i) => (
              <motion.div
                key={i}
                className="absolute top-1/2 left-1/2"
                initial={{
                  opacity: 0,
                  x: 0,
                  y: 0,
                  rotate: p.initRotate,
                  scale: 0.3,
                }}
                animate={{
                  opacity: [0, 1, 0.8, 0],
                  x: p.finalX,
                  y: p.finalY,
                  rotate: p.animRotate,
                  scale: [0.3, 1, 1.2, 0.3],
                }}
                transition={{
                  duration: p.duration,
                  delay: i * 0.05,
                  ease: "easeOut",
                }}
              >
                <Sparkles className="w-8 h-8 text-yellow-400/60" />
              </motion.div>
            ))}
          </div>

          {/* Winner Content */}
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 10 }}
            transition={{
              type: "spring",
              damping: 15,
              stiffness: 200,
              delay: 0.1,
            }}
            className="relative z-10 text-center max-w-4xl w-full mb-32 md:mb-24 pointer-events-auto"
          >
            {/* Trophy Icon */}
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring", damping: 10 }}
              className="flex justify-center mb-4"
            >
              <div style={{ background: colorStyle }} className="rounded-full p-5 shadow-2xl">
                <Award className="w-16 h-16 text-white" />
              </div>
            </motion.div>

            {/* Winner Text */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="space-y-3"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.6, type: "spring", damping: 10 }}
                style={{ background: colorStyle }}
                className="rounded-3xl px-8 md:px-12 py-6 md:py-8 shadow-2xl border-4 border-white"
              >
                <p className="text-3xl md:text-5xl font-bold text-white break-words">{winner}</p>
              </motion.div>
            </motion.div>

            {/* Pulsing Glow */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{ background: colorStyle }}
              className="absolute inset-0 rounded-full blur-3xl -z-10"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
