"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useChartContext } from "./ChartContext";
import { CHART_TOKENS, colorForCategory } from "./ChartTheme";

export interface RankSegment {
  /** Stable identity key — used for color hashing if `color` is not provided. */
  key: string;
  label: string;
  /** Raw value; segments are auto-normalized to 100% across the bar. */
  value: number;
  color?: string;
}

interface StackedRankBarProps {
  segments: RankSegment[];
  /** Show the inline legend under the bar. Default true. */
  showLegend?: boolean;
  /** Bar height in px. Default 22. */
  height?: number;
  /** Hide percentage label inside small segments. Default true. */
  hideLabelsBelowPercent?: number;
  /** Forces low-confidence (hatched) treatment regardless of context. */
  lowConfidence?: boolean;
  className?: string;
}

export function StackedRankBar({
  segments,
  showLegend = true,
  height = 22,
  hideLabelsBelowPercent = 8,
  lowConfidence = false,
  className,
}: StackedRankBarProps) {
  const ctx = useChartContext();
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    if (reduceMotion) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduceMotion]);

  const shown = visible || reduceMotion === true;

  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const pcts = segments.map((s) => (total > 0 ? (Math.max(0, s.value) / total) * 100 : 0));
  const duration = (reduceMotion ? 0 : ctx.enter.durationMs) / 1000;
  const stagger = (reduceMotion ? 0 : ctx.enter.staggerMs) / 1000;

  return (
    <div className={className} ref={ref}>
      <div
        className="flex w-full overflow-hidden rounded-md"
        style={{
          height,
          backgroundColor: CHART_TOKENS.gridline,
          opacity: lowConfidence ? 0.7 : 1,
          backgroundImage: lowConfidence
            ? "repeating-linear-gradient(45deg, transparent 0 6px, rgba(0,0,0,0.05) 6px 12px)"
            : undefined,
        }}
        role="img"
        aria-label={segments
          .map((s, i) => `${s.label} ${Math.round(pcts[i])}%`)
          .join(", ")}
      >
        {segments.map((s, i) => {
          const pct = pcts[i];
          const color = s.color ?? colorForCategory(s.key);
          const showInline = pct >= hideLabelsBelowPercent;
          return (
            <motion.div
              key={s.key}
              initial={{ flexBasis: 0 }}
              animate={{ flexBasis: `${shown ? pct : 0}%` }}
              transition={{
                duration,
                delay: shown ? i * stagger : 0,
                ease: ctx.enter.ease,
              }}
              style={{
                backgroundColor: color,
                color: "#ffffff",
                minWidth: shown && pct > 0 ? 2 : 0,
              }}
              className="flex items-center justify-end overflow-hidden whitespace-nowrap pr-1.5 text-[10px] font-semibold tabular-nums"
              title={`${s.label} · ${Math.round(pct)}%`}
            >
              {showInline ? `${Math.round(pct)}%` : null}
            </motion.div>
          );
        })}
      </div>
      {showLegend && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          {segments.map((s, i) => {
            const color = s.color ?? colorForCategory(s.key);
            return (
              <li key={s.key} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block size-2.5 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="text-text-primary">{s.label}</span>
                <span className="tabular-nums text-text-muted">{Math.round(pcts[i])}%</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
