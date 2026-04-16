"use client";

import { useState } from "react";
import DOMPurify from "dompurify";

interface BehaviorDisplayProps {
  levels: string[];
  behaviors: { level: string; content: string }[];
  /** Base color of the DNA card (hex) — used for active tab styling */
  color: string;
  /** "card" = on the gradient card, "modal" = in modal (theme text) */
  variant?: "card" | "modal";
  /** When variant="card", true = white text (dark bg), false = dark text (light bg). Defaults to true. */
  lightText?: boolean;
}

function darkenHex(hex: string, factor: number): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.substring(0, 2), 16) * (1 - factor));
  const g = Math.round(parseInt(h.substring(2, 4), 16) * (1 - factor));
  const b = Math.round(parseInt(h.substring(4, 6), 16) * (1 - factor));
  return `rgb(${r}, ${g}, ${b})`;
}

export default function BehaviorDisplay({ levels, behaviors, color, variant = "card", lightText = true }: BehaviorDisplayProps) {
  const [activeLevel, setActiveLevel] = useState(levels[0] ?? "");

  // Only show levels that have behavior content
  const behaviorMap = new Map(behaviors.map((b) => [b.level, b.content]));
  const activeLevels = levels.filter((l) => behaviorMap.has(l) && behaviorMap.get(l)!.trim());
  if (activeLevels.length === 0) return null;

  // If current active isn't valid, reset
  const currentLevel = activeLevels.includes(activeLevel) ? activeLevel : activeLevels[0];
  const currentContent = behaviorMap.get(currentLevel) ?? "";

  const isCard = variant === "card";
  // For card variant: lightText=true means white-on-dark, false means dark-on-light
  const useWhite = isCard && lightText;
  const useDark = isCard && !lightText;

  return (
    <div className="mt-4">
      {/* Section header */}
      <p
        className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: useWhite ? "rgba(255,255,255,0.6)" : useDark ? "rgba(0,0,0,0.4)" : "var(--text-muted)" }}
      >
        Gedragsvoorbeelden
      </p>

      {/* Level tabs */}
      {activeLevels.length > 1 && (
        <div className="flex gap-1.5 mb-2">
          {activeLevels.map((level) => {
            const isActive = level === currentLevel;
            return (
              <button
                key={level}
                type="button"
                onClick={() => setActiveLevel(level)}
                className="px-3 py-1 rounded-md text-xs font-semibold transition-colors"
                style={
                  isActive
                    ? {
                        backgroundColor: isCard ? darkenHex(color, 0.25) : color,
                        color: "#fff",
                      }
                    : {
                        backgroundColor: useWhite ? "rgba(255,255,255,0.15)" : useDark ? "rgba(0,0,0,0.06)" : "var(--bg-hover)",
                        color: useWhite ? "rgba(255,255,255,0.7)" : useDark ? "rgba(0,0,0,0.5)" : "var(--text-muted)",
                        border: useWhite ? "1px solid rgba(255,255,255,0.2)" : useDark ? "1px solid rgba(0,0,0,0.1)" : "1px solid var(--border)",
                      }
                }
              >
                {level}
              </button>
            );
          })}
        </div>
      )}

      {/* Content container */}
      <div
        className="rounded-lg p-3"
        style={{
          backgroundColor: useWhite ? "rgba(255,255,255,0.12)" : useDark ? "rgba(0,0,0,0.06)" : "var(--bg-elevated)",
          border: isCard ? "none" : "1px solid var(--border)",
        }}
      >
        <div
          className="behavior-html text-sm leading-relaxed"
          style={{ color: useWhite ? "rgba(255,255,255,0.85)" : useDark ? "rgba(0,0,0,0.7)" : "var(--text-primary)" }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentContent) }}
        />
      </div>
    </div>
  );
}
