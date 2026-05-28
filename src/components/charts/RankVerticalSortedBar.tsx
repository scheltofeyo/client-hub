"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useChartContext } from "./ChartContext";
import { CHART_TOKENS } from "./ChartTheme";
import type { RankItemDatum } from "./RankPodium";

interface RankVerticalSortedBarProps {
  items: RankItemDatum[];
  /** Bar area height in px. Default 220 (projector-readable). */
  height?: number;
  className?: string;
}

/**
 * Vertical bar chart for ranking results. Items along the x-axis,
 * scores rising up. Items render in the order they're passed in; labels
 * wrap below each bar. Score numbers sit above each bar so they stay
 * readable when bars are short.
 *
 * Pairs with the existing horizontal RankSortedBar — pick this when you
 * want a "ranked top-down" reading instead of "ranked left-to-right".
 */
export function RankVerticalSortedBar({
  items,
  height = 220,
  className,
}: RankVerticalSortedBarProps) {
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
  const max = items.reduce((m, item) => (item.score > m ? item.score : m), 0) || 1;
  const duration = (reduceMotion ? 0 : ctx.enter.durationMs) / 1000;
  const stagger = (reduceMotion ? 0 : ctx.enter.staggerMs) / 1000;

  if (items.length === 0) {
    return (
      <div className={className}>
        <p className="text-xs italic text-text-muted">No responses yet.</p>
      </div>
    );
  }

  return (
    <div ref={ref} className={className}>
      <div
        className="grid items-end gap-3"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
          height,
        }}
      >
        {items.map((item, i) => {
          const pct = max > 0 ? (item.score / max) * 100 : 0;
          const color = item.color ?? CHART_TOKENS.primary;
          return (
            <div key={item.id} className="flex h-full flex-col items-center justify-end">
              <span
                className="mb-1 text-xs font-semibold tabular-nums"
                style={{ color: CHART_TOKENS.textPrimary }}
              >
                {item.scoreLabel}
              </span>
              <div className="relative w-full max-w-[60px]" style={{ height: "100%" }}>
                <div
                  className="absolute inset-x-0 bottom-0 rounded-sm"
                  style={{
                    backgroundColor: color,
                    opacity: 0.12,
                    height: "100%",
                  }}
                />
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: shown ? `${pct}%` : 0 }}
                  transition={{
                    duration,
                    delay: shown ? i * stagger : 0,
                    ease: ctx.enter.ease,
                  }}
                  style={{ backgroundColor: color }}
                  className="absolute inset-x-0 bottom-0 rounded-sm"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Baseline — sits 2 px below the bar area */}
      <div
        className="w-full"
        style={{
          marginTop: 2,
          background: CHART_TOKENS.textMuted,
          opacity: 0.35,
          height: 2,
          borderRadius: 2,
        }}
      />

      {/* Labels under bars */}
      <div
        className="mt-2 grid gap-3"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <div key={item.id} className="text-center">
            <p
              className="line-clamp-2 text-[11px] leading-tight"
              style={{ color: CHART_TOKENS.textPrimary }}
              title={item.label}
            >
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
