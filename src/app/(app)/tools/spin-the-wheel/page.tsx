"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import SpinningWheel from "@/components/spin-the-wheel/SpinningWheel";
import SlotMachine from "@/components/spin-the-wheel/SlotMachine";
import SidePanel from "@/components/spin-the-wheel/SidePanel";
import BottomControls from "@/components/spin-the-wheel/BottomControls";
import WinnerOverlay from "@/components/spin-the-wheel/WinnerOverlay";
import { WHEEL_TOTAL_TIME, WINNER_DISPLAY_DELAY } from "@/components/spin-the-wheel/timings";

export default function SpinTheWheelPage() {
  const [names, setNames] = useState<string[]>([
    "Alice Johnson",
    "Bob Smith",
    "Charlie Davis",
    "Diana Martinez",
    "Eve Wilson",
    "Frank Brown",
  ]);
  const [removedNames, setRemovedNames] = useState<{ name: string; timestamp: number }[]>([]);
  const [allWinners, setAllWinners] = useState<{ name: string; timestamp: number }[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [winnerIndex, setWinnerIndex] = useState(0);
  const [removeWinner, setRemoveWinner] = useState(false);
  const [selectionMode, setSelectionMode] = useState("slot");
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [spinTimeout, setSpinTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidePanelOpen(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSpin = () => {
    if (names.length === 0 || isSpinning) return;

    if (spinTimeout) {
      clearTimeout(spinTimeout);
      setSpinTimeout(null);
    }

    setWinner(null);
    setIsSpinning(true);

    if (removeWinner && winner) {
      const updatedNames = names.filter((name) => name !== winner);
      if (updatedNames.length > 0) {
        setNames(updatedNames);
        setRemovedNames((prev) => [{ name: winner, timestamp: Date.now() }, ...prev]);
      }
    }

    if (selectionMode === "wheel") {
      const spins = 3 + Math.random() * 2;
      const randomAngle = Math.random() * 360;
      const newRotation = rotation + spins * 360 + randomAngle;
      setRotation(newRotation);

      const timeout = setTimeout(() => {
        setIsSpinning(false);
      }, WHEEL_TOTAL_TIME * 1000);
      setSpinTimeout(timeout);
    }
  };

  const handleSlotAnimationStart = useCallback((duration: number) => {
    const timeout = setTimeout(() => {
      setIsSpinning(false);
    }, (duration + WINNER_DISPLAY_DELAY) * 1000);
    setSpinTimeout(timeout);
  }, []);

  const handleSpinComplete = useCallback((winnerName: string, index: number) => {
    setWinner(winnerName);
    setWinnerIndex(index);
    setAllWinners((prev) => [{ name: winnerName, timestamp: Date.now() }, ...prev]);
  }, []);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background: "linear-gradient(to bottom right, var(--bg-app), var(--bg-surface), var(--bg-elevated))",
      }}
    >
      {/* Back button */}
      <Link
        href="/tools"
        className="fixed top-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border shadow-sm"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          color: "var(--text-primary)",
        }}
      >
        <ArrowLeft size={16} />
        Back
      </Link>

      {/* Main Content Area */}
      <div className={`h-full transition-all duration-300 ${sidePanelOpen ? "md:mr-[420px]" : ""}`}>
        <div className="h-full flex items-center justify-center p-4 md:p-8 pb-48 md:pb-40">
          <AnimatePresence mode="wait">
            {selectionMode === "wheel" ? (
              <motion.div
                key="wheel"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full flex items-center justify-center"
              >
                {names.length === 0 ? (
                  <div className="text-center">
                    <p className="text-xl" style={{ color: "var(--text-muted)" }}>
                      Add some participants to get started
                    </p>
                  </div>
                ) : (
                  <SpinningWheel
                    names={names}
                    isSpinning={isSpinning}
                    onSpinComplete={handleSpinComplete}
                    rotation={rotation}
                  />
                )}
              </motion.div>
            ) : (
              <motion.div
                key="slot"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full flex items-center justify-center"
              >
                <SlotMachine
                  names={names}
                  isSpinning={isSpinning}
                  onSpinComplete={handleSpinComplete}
                  onAnimationStart={handleSlotAnimationStart}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <SidePanel
        isOpen={sidePanelOpen}
        onToggle={() => setSidePanelOpen(!sidePanelOpen)}
        activeNames={names}
        removedNames={removedNames}
        allWinners={allWinners}
        onActiveNamesChange={setNames}
        onRemovedNamesChange={setRemovedNames}
      />

      <BottomControls
        onSpin={handleSpin}
        isSpinning={isSpinning}
        hasNames={names.length > 0}
        hasWinner={winner !== null}
        removeWinner={removeWinner}
        onRemoveWinnerChange={setRemoveWinner}
        selectionMode={selectionMode}
        onSelectionModeChange={setSelectionMode}
      />

      <WinnerOverlay
        winner={winner}
        winnerIndex={winnerIndex}
        isVisible={winner !== null && !isSpinning}
      />
    </div>
  );
}
