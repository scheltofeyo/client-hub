"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useChartContext } from "./ChartContext";
import { CHART_TOKENS, colorForCategory } from "./ChartTheme";
import type { MCChoiceDatum } from "./MCSortedBar";

interface MCStackedSingleBarProps {
  choices: MCChoiceDatum[];
  /** Bar height in px. Default 56 (projector). */
  height?: number;
  /** Segments below this % render the label in the legend only. */
  inlineLabelThreshold?: number;
  className?: string;
}

/**
 * Single horizontal bar 100% wide, segmented by choice. Single-select
 * only — for multi-select the percentages don't sum to 100% and a
 * "parts-of-whole" stacked bar would misrepresent the math.
 */
export function MCStackedSingleBar({
  choices,
  height = 56,
  inlineLabelThreshold = 12,
  className,
}: MCStackedSingleBarProps) {
  const ctx = useChartContext();
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    if (reduceMotion) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [reduceMotion]);

  const shown = visible || reduceMotion === true;
  const sorted = [...choices].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((sum, c) => sum + c.count, 0);
  const duration = (reduceMotion ? 0 : ctx.enter.durationMs) / 1000;
  const stagger = (reduceMotion ? 0 : ctx.enter.staggerMs) / 1000;

  if (total === 0) {
    return (
      <div ref={ref} className={className}>
        <p className="text-xs italic" style={{ color: CHART_TOKENS.textMuted }}>
          No responses yet.
        </p>
      </div>
    );
  }

  return (
    <div ref={ref} className={className}>
      <div
        className="flex w-full overflow-hidden rounded-sm"
        style={{ height, backgroundColor: CHART_TOKENS.gridline }}
        role="img"
        aria-label={sorted.map((c) => `${c.label} ${c.percentage}%`).join(", ")}
      >
        {sorted.map((c, i) => {
          const inline = c.percentage >= inlineLabelThreshold;
          return (
            <motion.div
              key={c.id}
              initial={{ flexBasis: 0 }}
              animate={{ flexBasis: shown ? `${c.percentage}%` : 0 }}
              transition={{
                duration,
                delay: shown ? i * stagger : 0,
                ease: ctx.enter.ease,
              }}
              style={{ backgroundColor: colorForCategory(c.id), minWidth: shown ? 2 : 0 }}
              className="flex flex-col items-center justify-center overflow-hidden text-white"
            >
              {inline && (
                <>
                  <span className="text-xs font-medium leading-tight">{c.label}</span>
                  <span className="text-sm font-semibold tabular-nums leading-tight">
                    {c.count} · {c.percentage}%
                  </span>
                </>
              )}
            </motion.div>
          );
        })}
      </div>

      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {sorted.map((c) => (
          <li key={c.id} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block size-2.5 rounded-sm"
              style={{ backgroundColor: colorForCategory(c.id) }}
            />
            <span style={{ color: CHART_TOKENS.textPrimary }}>{c.label}</span>
            <span className="tabular-nums" style={{ color: CHART_TOKENS.textMuted }}>
              {c.percentage}% ({c.count})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
