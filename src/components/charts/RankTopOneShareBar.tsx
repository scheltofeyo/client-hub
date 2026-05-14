"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useChartContext } from "./ChartContext";
import { CHART_TOKENS } from "./ChartTheme";

export interface RankTopOneItem {
  id: string;
  label: string;
  /** Count of respondents who put this item at rank #1. */
  topOneCount: number;
  /** Optional explicit color (archetype.color). */
  color?: string;
}

interface RankTopOneShareBarProps {
  items: RankTopOneItem[];
  /** Total respondents who answered the question. Used to compute %. */
  n: number;
  className?: string;
}

/**
 * Per item: % of respondents who ranked it first. "X of N" suffix is
 * always shown so consultants can speak the counts directly. Items
 * with 0 first-place votes still render with an empty rail.
 */
export function RankTopOneShareBar({ items, n, className }: RankTopOneShareBarProps) {
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
  const sorted = [...items].sort((a, b) => b.topOneCount - a.topOneCount);
  const duration = (reduceMotion ? 0 : ctx.enter.durationMs) / 1000;
  const stagger = (reduceMotion ? 0 : ctx.enter.staggerMs) / 1000;

  return (
    <div ref={ref} className={className}>
      <p className="mb-3 text-xs" style={{ color: CHART_TOKENS.textMuted }}>
        % of respondents who ranked this item first
      </p>
      <ul className="flex flex-col gap-3">
        {sorted.map((item, i) => {
          const pct = n > 0 ? (item.topOneCount / n) * 100 : 0;
          const color = item.color ?? CHART_TOKENS.primary;
          return (
            <li key={item.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium" style={{ color: CHART_TOKENS.textPrimary }}>
                  {item.label}
                </span>
                <span className="shrink-0 text-sm tabular-nums" style={{ color: CHART_TOKENS.textMuted }}>
                  {Math.round(pct)}% · ({item.topOneCount} of {n})
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
