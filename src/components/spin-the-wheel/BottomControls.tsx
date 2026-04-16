"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";

interface BottomControlsProps {
  onSpin: () => void;
  isSpinning: boolean;
  hasNames: boolean;
  hasWinner: boolean;
  removeWinner: boolean;
  onRemoveWinnerChange: (value: boolean) => void;
  selectionMode: string;
  onSelectionModeChange: (mode: string) => void;
}

export default function BottomControls({
  onSpin,
  isSpinning,
  hasNames,
  hasWinner,
  removeWinner,
  onRemoveWinnerChange,
  selectionMode,
  onSelectionModeChange,
}: BottomControlsProps) {
  const modeButton = (mode: string, label: string, sizeClass: string) => (
    <button
      onClick={() => onSelectionModeChange(mode)}
      className={cn(
        "rounded-full font-medium transition-all",
        sizeClass,
        selectionMode === mode
          ? "text-white shadow-md"
          : "hover:opacity-80"
      )}
      style={{
        background:
          selectionMode === mode
            ? "linear-gradient(to right, var(--primary), var(--accent-1))"
            : "transparent",
        color: selectionMode === mode ? "#fff" : "var(--text-muted)",
      }}
    >
      {label}
    </button>
  );

  const spinButton = (sizeClass: string) => (
    <button
      onClick={onSpin}
      disabled={!hasNames || isSpinning}
      className={cn(
        "btn-secondary border-2 font-semibold shadow-xl transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
        sizeClass
      )}
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
        color: "var(--text-primary)",
      }}
    >
      {isSpinning ? "Selecting..." : hasWinner ? "Randomize Next!" : "Randomize!"}
    </button>
  );

  const removeToggle = (id: string, textSize: string) => (
    <div
      className={cn("flex items-center gap-3 px-4 py-2.5 rounded-full shadow-lg border", textSize)}
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      <button
        role="switch"
        aria-checked={removeWinner}
        onClick={() => onRemoveWinnerChange(!removeWinner)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors",
          removeWinner ? "bg-[var(--danger)]" : "bg-[var(--border)]"
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5",
            removeWinner ? "translate-x-4 ml-0.5" : "translate-x-0.5"
          )}
        />
      </button>
      <label
        htmlFor={id}
        className="font-medium cursor-pointer select-none"
        style={{ color: "var(--text-primary)" }}
        onClick={() => onRemoveWinnerChange(!removeWinner)}
      >
        Remove winners from list
      </label>
    </div>
  );

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none pb-4"
    >
      <div className="relative p-4 md:p-6">
        {/* Mobile Layout */}
        <div className="md:hidden flex flex-col items-center gap-3 pointer-events-auto">
          {!isSpinning && (
            <div
              className="rounded-full shadow-lg border p-1.5 flex gap-1"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
            >
              {modeButton("wheel", "Wheel", "px-5 py-2 text-sm")}
              {modeButton("slot", "List", "px-5 py-2 text-sm")}
            </div>
          )}
          {spinButton("px-10 py-5 text-lg w-full max-w-xs")}
          {removeToggle("remove-winner-mobile", "text-xs")}
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex items-end justify-between">
          {!isSpinning && (
            <div className="pointer-events-auto">
              <div
                className="rounded-full shadow-lg border p-2 flex gap-2"
                style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
              >
                {modeButton("wheel", "Wheel", "px-6 py-3 text-base")}
                {modeButton("slot", "List", "px-6 py-3 text-base")}
              </div>
            </div>
          )}

          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 flex flex-col items-center gap-4 pointer-events-auto">
            {spinButton("px-12 py-6 text-xl")}
            <div className="mb-4">
              {removeToggle("remove-winner-desktop", "text-sm")}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
