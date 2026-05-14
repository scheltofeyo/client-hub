"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useChartContext } from "./ChartContext";
import { CHART_TOKENS } from "./ChartTheme";
import type { RankItemDatum } from "./RankPodium";

interface RankSortedBarProps {
  items: RankItemDatum[];
  className?: string;
}

/**
 * Ranking alternative: a flat sorted bar of scores. Caller pre-computes
 * `score` (the bar value, larger = higher rank) and `scoreLabel` (the
 * display string — Borda % or formatted avg rank).
 *
 * For general-ranking, callers typically invert avg-rank (so lower rank
 * yields a longer bar) before passing in.
 */
export function RankSortedBar({ items, className }: RankSortedBarProps) {
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
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const max = sorted[0]?.score || 1;
  const duration = (reduceMotion ? 0 : ctx.enter.durationMs) / 1000;
  const stagger = (reduceMotion ? 0 : ctx.enter.staggerMs) / 1000;

  return (
    <div ref={ref} className={className}>
      <ul className="flex flex-col gap-3">
        {sorted.map((item, i) => {
          const pct = max > 0 ? (item.score / max) * 100 : 0;
          const color = item.color ?? CHART_TOKENS.primary;
          return (
            <li key={item.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium" style={{ color: CHART_TOKENS.textPrimary }}>
                  {item.label}
                </span>
                <span className="shrink-0 text-sm tabular-nums" style={{ color: CHART_TOKENS.textMuted }}>
                  {item.scoreLabel}
                </span>
              </div>
              <div
                className="relative mt-1 h-7 w-full overflow-hidden rounded-sm"
                style={{ backgroundColor: CHART_TOKENS.gridline }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: shown ? `${pct}%` : 0 }}
                  transition={{
                    duration,
                    delay: shown ? i * stagger : 0,
                    ease: ctx.enter.ease,
                  }}
                  style={{ backgroundColor: color }}
                  className="h-full"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
