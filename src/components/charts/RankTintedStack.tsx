"use client";

import { motion, useReducedMotion } from "motion/react";
import { useChartContext } from "./ChartContext";
import { CHART_TOKENS, ordinalRampStep, ordinalRampVars } from "./ChartTheme";

export interface RankTintedItem {
  id: string;
  label: string;
  /** Identity colour — the cultural value's own colour. Tints derive from it. */
  color?: string;
  /** Counts per rank position, index 0 = rank 1. */
  distribution: number[];
  meanRank: number | null;
}

interface RankTintedStackProps {
  items: RankTintedItem[];
  /** Total rank positions. Inferred from the longest distribution if omitted. */
  ranks?: number;
  className?: string;
}

/**
 * One 100%-wide bar per item, split by the rank position respondents gave it,
 * in tints of that item's own colour — strongest at rank 1.
 *
 * A shared ramp cannot work here: every row is a different cultural value with
 * its own colour, and that colour is the identity readers already know from the
 * rest of the survey. So the hue carries identity down the rows and the tint
 * carries rank across each bar, which are the two things being asked at once.
 *
 * No segment labels and no colour legend, deliberately. Segment order and tint
 * both run in the same direction, so "left and strongest = ranked first" is the
 * only reading available; the exact counts sit in the tooltips. Note "strongest"
 * is darkest on the light theme and brightest on the dark one — the ramp anchors
 * flip so a top rank never sinks into the background.
 */
export function RankTintedStack({ items, ranks, className }: RankTintedStackProps) {
  const ctx = useChartContext();
  const reduceMotion = useReducedMotion();

  const scored = items.filter((i) => i.distribution.some((c) => c > 0));
  if (scored.length === 0) {
    return (
      <p className="text-xs italic" style={{ color: CHART_TOKENS.textMuted }}>
        No responses yet.
      </p>
    );
  }

  const rankCount = ranks ?? Math.max(1, ...scored.map((i) => i.distribution.length));
  const sorted = [...scored].sort((a, b) => (a.meanRank ?? Infinity) - (b.meanRank ?? Infinity));
  const duration = (reduceMotion ? 0 : ctx.enter.durationMs) / 1000;

  return (
    <div className={"overflow-x-auto " + (className ?? "")}>
      <div className="min-w-[420px]">
        <p className="typo-caption mb-3">
          Each bar = 100% of respondents · left to right is rank 1 to {rankCount}, full to
          faint · sorted by mean rank
        </p>

        <div
          className="grid items-center gap-x-3 gap-y-2.5"
          style={{ gridTemplateColumns: "minmax(5rem,9rem) minmax(190px,1fr) auto" }}
        >
          {sorted.map((item, rowIndex) => {
            const color = item.color || CHART_TOKENS.primary;
            const total = item.distribution.reduce((sum, c) => sum + c, 0);
            let cursor = 0;

            return (
              <div key={item.id} className="contents">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ background: color }}
                  />
                  <span
                    className="truncate text-xs font-medium"
                    style={{ color: CHART_TOKENS.textPrimary }}
                    title={item.label}
                  >
                    {item.label}
                  </span>
                </div>

                <div className="ramp-scope relative h-5" style={ordinalRampVars(color)}>
                  {Array.from({ length: rankCount }).map((_, i) => {
                    const count = item.distribution[i] ?? 0;
                    if (count === 0) return null;
                    const left = (cursor / total) * 100;
                    const width = (count / total) * 100;
                    cursor += count;
                    const first = left === 0;
                    const last = cursor === total;
                    return (
                      <motion.span
                        key={i}
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          duration,
                          delay: reduceMotion ? 0 : (rowIndex * ctx.enter.staggerMs) / 1000,
                          ease: ctx.enter.ease,
                        }}
                        className="absolute top-0 bottom-0"
                        style={{
                          left: `${left}%`,
                          // 2px surface gap between fills, never a border.
                          width: `max(2px, calc(${width}% - 2px))`,
                          background: ordinalRampStep(i, rankCount),
                          borderTopLeftRadius: first ? 4 : 0,
                          borderBottomLeftRadius: first ? 4 : 0,
                          borderTopRightRadius: last ? 4 : 0,
                          borderBottomRightRadius: last ? 4 : 0,
                        }}
                        title={`${item.label} — rank ${i + 1}: ${count} of ${total}`}
                      />
                    );
                  })}
                </div>

                <div className="text-right whitespace-nowrap">
                  <div
                    className="text-[15px] font-semibold leading-tight tabular-nums"
                    style={{ color: CHART_TOKENS.textPrimary }}
                  >
                    {item.meanRank === null
                      ? "—"
                      : item.meanRank.toLocaleString("nl-NL", { maximumFractionDigits: 1 })}
                  </div>
                  <div
                    className="text-[11px] leading-tight tabular-nums"
                    style={{ color: CHART_TOKENS.textMuted }}
                  >
                    of {rankCount}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
