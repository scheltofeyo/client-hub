"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useChartContext } from "./ChartContext";
import { CHART_TOKENS, colorForCategory } from "./ChartTheme";

export interface MCChoiceDatum {
  id: string;
  label: string;
  count: number;
  /** Pre-computed percentage 0..100 (caller normalises). */
  percentage: number;
}

interface MCSortedBarProps {
  choices: MCChoiceDatum[];
  className?: string;
}

/**
 * Default chart for multiple-choice question results.
 * Label on top, full-width bar, count + % right-aligned.
 * Sorted by percentage descending. Bars use a stable colorForCategory()
 * mapping so the same choice keeps its colour across variant switches.
 */
export function MCSortedBar({ choices, className }: MCSortedBarProps) {
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
  const sorted = [...choices].sort((a, b) => b.percentage - a.percentage);
  const duration = (reduceMotion ? 0 : ctx.enter.durationMs) / 1000;
  const stagger = (reduceMotion ? 0 : ctx.enter.staggerMs) / 1000;

  return (
    <div ref={ref} className={className}>
      <ul className="flex flex-col gap-3">
        {sorted.map((choice, i) => (
          <li key={choice.id}>
            <div className="flex items-baseline justify-between gap-3">
              <span
                className="text-text-primary text-sm font-medium"
                title={choice.label}
              >
                {choice.label}
              </span>
              <span className="shrink-0 text-sm tabular-nums text-text-muted">
                {choice.count} · {choice.percentage}%
              </span>
            </div>
            <div
              className="relative mt-1 h-7 w-full overflow-hidden rounded-sm"
              style={{ backgroundColor: CHART_TOKENS.gridline }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: shown ? `${choice.percentage}%` : 0 }}
                transition={{
                  duration,
                  delay: shown ? i * stagger : 0,
                  ease: ctx.enter.ease,
                }}
                style={{ backgroundColor: colorForCategory(choice.id) }}
                className="h-full"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
