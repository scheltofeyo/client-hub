"use client";

import { motion, useReducedMotion } from "motion/react";
import { useChartContext } from "./ChartContext";
import { CHART_TOKENS } from "./ChartTheme";
import { RankMiniHistogram } from "./RankMiniHistogram";

export interface RankItemDatum {
  id: string;
  label: string;
  /** Sort key — larger is better. */
  score: number;
  /** Number formatted for display ("31%", "1.6"). */
  scoreLabel: string;
  /** Sub-line under the score, clarifying the unit ("12 / 38 pts", "avg rank of 5"). */
  scoreUnit?: string;
  /** Counts per rank position (index 0 = rank 1). */
  distribution: number[];
  /** Optional explicit color (e.g. archetype.color from the snapshot). */
  color?: string;
}

interface RankPodiumProps {
  items: RankItemDatum[];
  className?: string;
}

const PODIUM_HISTOGRAM_WIDTH = 110;
const PODIUM_HISTOGRAM_HEIGHT = 44;

/**
 * Default chart for both archetype-ranking and general-ranking results.
 * Top 3 rendered as podium cards with a vertical rank-distribution
 * histogram inside; same chart size and same score typography across all
 * three so the eye reads the rank order from the #1/#2/#3 label and
 * scores side-by-side rather than from chart sizing.
 *
 * Card background is a faint tint of the item's own color (archetype
 * color when available, otherwise hashed category color), so the podium
 * doesn't feel "branded purple" regardless of which item won.
 */
export function RankPodium({ items, className }: RankPodiumProps) {
  const ctx = useChartContext();
  const reduceMotion = useReducedMotion();
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const duration = (reduceMotion ? 0 : ctx.enter.durationMs) / 1000;
  const stagger = (reduceMotion ? 0 : ctx.enter.staggerMs) / 1000;

  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {top3.map((item, i) => {
          const color = item.color ?? CHART_TOKENS.primary;
          return (
            <motion.div
              key={item.id}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration,
                delay: reduceMotion ? 0 : i * stagger,
                ease: ctx.enter.ease,
              }}
              className="relative flex flex-col items-center gap-2 rounded-card px-4 pt-3 pb-4"
              style={{
                background: `color-mix(in srgb, ${color} 9%, var(--bg-surface))`,
              }}
            >
              <span
                className="text-[10px] font-semibold uppercase tracking-wide tabular-nums"
                style={{ color: CHART_TOKENS.textMuted }}
              >
                #{i + 1}
              </span>
              <span
                className="text-center text-sm font-medium leading-snug"
                style={{ color: CHART_TOKENS.textPrimary }}
              >
                {item.label}
              </span>

              <RankMiniHistogram
                distribution={item.distribution}
                color={color}
                width={PODIUM_HISTOGRAM_WIDTH}
                height={PODIUM_HISTOGRAM_HEIGHT}
              />

              <div className="flex flex-col items-center">
                <span
                  className="text-xl font-semibold tabular-nums tracking-tight"
                  style={{ color }}
                >
                  {item.scoreLabel}
                </span>
                {item.scoreUnit && (
                  <span className="text-[11px] tabular-nums" style={{ color: CHART_TOKENS.textMuted }}>
                    {item.scoreUnit}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <ul className="mt-4 flex flex-col">
          {rest.map((item, i) => {
            const color = item.color ?? CHART_TOKENS.primary;
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 py-2.5 text-xs"
              >
                <span
                  className="w-6 shrink-0 text-right tabular-nums"
                  style={{ color: CHART_TOKENS.textMuted }}
                >
                  #{i + 4}
                </span>
                <span
                  className="min-w-0 flex-1 truncate"
                  style={{ color: CHART_TOKENS.textPrimary }}
                  title={item.label}
                >
                  {item.label}
                </span>
                <RankMiniHistogram
                  distribution={item.distribution}
                  color={color}
                  width={84}
                  height={22}
                  showLabels={false}
                />
                <span
                  className="w-20 text-right tabular-nums font-medium"
                  style={{ color: CHART_TOKENS.textPrimary }}
                >
                  {item.scoreLabel}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
