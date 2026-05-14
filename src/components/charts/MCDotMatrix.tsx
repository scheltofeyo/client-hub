"use client";

import { motion, useReducedMotion } from "motion/react";
import { useChartContext } from "./ChartContext";
import { CHART_TOKENS, colorForCategory } from "./ChartTheme";
import type { MCChoiceDatum } from "./MCSortedBar";

interface MCDotMatrixProps {
  choices: MCChoiceDatum[];
  /** Dot diameter in px. Default 24 (projector-readable). */
  dotSize?: number;
  className?: string;
}

/**
 * One dot per respondent, colour-coded by their choice. Choices ordered
 * by popularity descending; within a choice, dots in submission order.
 * Works for both single- and multi-select — for multi-select, callers
 * still pass a flattened `MCChoiceDatum[]` (each "dot" represents one
 * vote, so dot count may exceed respondent count).
 */
export function MCDotMatrix({ choices, dotSize = 24, className }: MCDotMatrixProps) {
  const ctx = useChartContext();
  const reduceMotion = useReducedMotion();
  const sorted = [...choices].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((sum, c) => sum + c.count, 0);
  const duration = (reduceMotion ? 0 : ctx.enter.durationMs) / 1000;

  if (total === 0) {
    return (
      <div className={className}>
        <p className="text-xs italic" style={{ color: CHART_TOKENS.textMuted }}>
          No responses yet.
        </p>
      </div>
    );
  }

  // Flatten to one dot per vote so motion stagger looks natural.
  const dots: { key: string; color: string; index: number }[] = [];
  let idx = 0;
  for (const c of sorted) {
    const color = colorForCategory(c.id);
    for (let i = 0; i < c.count; i += 1) {
      dots.push({ key: `${c.id}-${i}`, color, index: idx });
      idx += 1;
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2.5">
        {dots.map((d) => (
          <motion.span
            key={d.key}
            aria-hidden
            initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration,
              delay: reduceMotion ? 0 : Math.min(d.index * 0.012, 0.6),
              ease: ctx.enter.ease,
            }}
            style={{
              width: dotSize,
              height: dotSize,
              backgroundColor: d.color,
              borderRadius: "9999px",
              display: "inline-block",
            }}
          />
        ))}
      </div>

      <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {sorted.map((c) => (
          <li key={c.id} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block size-2.5 rounded-sm"
              style={{ backgroundColor: colorForCategory(c.id) }}
            />
            <span style={{ color: CHART_TOKENS.textPrimary }}>{c.label}</span>
            <span className="tabular-nums" style={{ color: CHART_TOKENS.textMuted }}>
              ({c.count})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
