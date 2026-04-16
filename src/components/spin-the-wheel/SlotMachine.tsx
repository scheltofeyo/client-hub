"use client";

import { useRef, useEffect, useState } from "react";
import { motion } from "motion/react";
import { SLOT_SPIN_DURATION_MIN, SLOT_SPIN_DURATION_MAX } from "./timings";

const SLOT_COLORS = [
  { bg: "var(--accent-0)", text: "#fff" },
  { bg: "var(--accent-1)", text: "#fff" },
  { bg: "var(--accent-2)", text: "#fff" },
  { bg: "var(--accent-3)", text: "#fff" },
  { bg: "var(--accent-4)", text: "#fff" },
  { bg: "var(--accent-5)", text: "#fff" },
  { bg: "var(--accent-6)", text: "#fff" },
  { bg: "var(--accent-7)", text: "#fff" },
];

const ITEM_HEIGHT = 140;

interface SlotMachineProps {
  names: string[];
  isSpinning: boolean;
  onSpinComplete: (winner: string, index: number) => void;
  onAnimationStart: (duration: number) => void;
}

export default function SlotMachine({
  names,
  isSpinning,
  onSpinComplete,
  onAnimationStart,
}: SlotMachineProps) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [displayNames, setDisplayNames] = useState<string[]>([]);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [animationDuration, setAnimationDuration] = useState(4);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousScrollRef = useRef(0);
  const previousIsSpinningRef = useRef(isSpinning);
  const [easingCurve, setEasingCurve] = useState<[number, number, number, number]>([0.37, 0, 0.2, 1]);

  useEffect(() => {
    if (names.length === 0) return;
    const repeats = 40;
    const repeated = Array(repeats).fill(names).flat();
    setDisplayNames(repeated);
    const middlePosition = -(20 * names.length * ITEM_HEIGHT);
    setScrollPosition(middlePosition);
    previousScrollRef.current = middlePosition;
  }, [names]);

  useEffect(() => {
    if (!isSpinning && previousIsSpinningRef.current && selectedWinner) {
      const centeredIndex = Math.round(-scrollPosition / ITEM_HEIGHT);
      const centeredName = displayNames[centeredIndex];
      if (centeredName === selectedWinner) {
        onSpinComplete(selectedWinner, names.indexOf(selectedWinner));
      } else {
        const winnerIndex = names.indexOf(centeredName || selectedWinner);
        onSpinComplete(centeredName || selectedWinner, winnerIndex >= 0 ? winnerIndex : 0);
      }
    }
    previousIsSpinningRef.current = isSpinning;
  }, [isSpinning, selectedWinner, onSpinComplete, scrollPosition, displayNames, names]);

  useEffect(() => {
    if (isSpinning && names.length > 0) {
      const winnerIndex = Math.floor(Math.random() * names.length);
      const winner = names[winnerIndex];
      setSelectedWinner(winner);

      const x1 = 0.35 + Math.random() * 0.1;
      const x2 = 0.15 + Math.random() * 0.2;
      const y2 = 0.92 + Math.random() * 0.08;
      setEasingCurve([x1, 0, x2, y2]);

      const totalItems = names.length;
      const middlePosition = -(20 * names.length * ITEM_HEIGHT);
      const currentCenteredIndex = Math.round(-previousScrollRef.current / ITEM_HEIGHT);
      const maxSafeIndex = 30 * names.length;

      if (currentCenteredIndex > maxSafeIndex) {
        setScrollPosition(middlePosition);
        previousScrollRef.current = middlePosition;
      }

      const minCycles = 8;
      const maxCycles = 12;
      const cycles = minCycles + Math.random() * (maxCycles - minCycles);

      const adjustedCurrentIndex = Math.round(-previousScrollRef.current / ITEM_HEIGHT);
      const fullCyclesToScroll = Math.floor(cycles);
      const itemsInFullCycles = fullCyclesToScroll * totalItems;

      const currentIndexInCycle = adjustedCurrentIndex % totalItems;
      const offsetToWinner = (winnerIndex - currentIndexInCycle + totalItems) % totalItems;

      const totalItemsToScroll = itemsInFullCycles + offsetToWinner;
      const targetScroll = previousScrollRef.current - totalItemsToScroll * ITEM_HEIGHT;

      const totalDuration =
        SLOT_SPIN_DURATION_MIN + Math.random() * (SLOT_SPIN_DURATION_MAX - SLOT_SPIN_DURATION_MIN);

      setScrollPosition(targetScroll);
      previousScrollRef.current = targetScroll;
      setAnimationDuration(totalDuration);

      onAnimationStart(totalDuration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpinning, names]);

  if (names.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-xl" style={{ color: "var(--text-muted)" }}>
          Add some participants to get started
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full max-w-6xl mx-auto flex items-center justify-center">
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden"
        style={{
          maskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
        }}
      >
        <motion.div
          className="absolute w-full"
          style={{ top: "50%" }}
          animate={{ y: scrollPosition }}
          initial={{ y: scrollPosition }}
          transition={{
            duration: isSpinning ? animationDuration : 0,
            ease: isSpinning ? easingCurve : "linear",
          }}
        >
          {displayNames.map((name, index) => {
            const colorIndex = index % SLOT_COLORS.length;
            const color = SLOT_COLORS[colorIndex];
            return (
              <div
                key={index}
                className="flex items-center justify-center px-6 md:px-12"
                style={{
                  height: `${ITEM_HEIGHT}px`,
                  marginTop: index === 0 ? `-${ITEM_HEIGHT / 2}px` : "0",
                }}
              >
                <div
                  className="w-full rounded-2xl flex items-center justify-center px-8 shadow-lg"
                  style={{
                    height: `${ITEM_HEIGHT}px`,
                    background: color.bg,
                    color: color.text,
                  }}
                >
                  <p className="text-2xl md:text-4xl font-bold text-center truncate">{name}</p>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Selection indicator */}
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 z-20 pointer-events-none px-6 md:px-12">
        <div
          style={{ height: `${ITEM_HEIGHT}px` }}
          className="border-4 border-white bg-white/10 rounded-2xl shadow-2xl"
        />
      </div>
    </div>
  );
}
