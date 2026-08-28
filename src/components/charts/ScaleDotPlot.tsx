"use client";

import { motion, useReducedMotion } from "motion/react";
import { useChartContext } from "./ChartContext";
import { CHART_TOKENS } from "./ChartTheme";
import { ScaleStatCell } from "./ScaleStatCell";
import {
  halfColumnPct,
  maxStack,
  observedRange,
  scalePoints,
  scorePct,
  softFill,
  totalResponses,
  type ScaleBounds,
  type ScaleSeries,
} from "./scale-series";

interface ScaleDotPlotProps {
  series: ScaleSeries[];
  bounds: ScaleBounds;
  /** Question-level respondent count; rows matching it omit their own n. */
  groupN?: number;
  className?: string;
}

/**
 * One dot per respondent, stacked over the point they picked.
 *
 * The reason this is the default view: at the group sizes these surveys see,
 * "who sat where" is the conversation, and a percentage bar hides it — 50% of
 * two people is one person. Here the individual answers are countable, the mean
 * is a rule through them, and the spread is both the shaded ±1 SD band and the
 * visible width of the cloud. All three at once, in one row per value.
 *
 * Rows share a dot size and a row height computed from the tallest column in
 * the whole set, so two values are directly comparable by eye.
 */
export function ScaleDotPlot({ series, bounds, groupN, className }: ScaleDotPlotProps) {
  const ctx = useChartContext();
  const reduceMotion = useReducedMotion();

  const points = scalePoints(bounds);
  const stack = maxStack(series);

  if (series.length === 0 || stack === 0) {
    return (
      <p className="text-xs italic" style={{ color: CHART_TOKENS.textMuted }}>
        No responses yet.
      </p>
    );
  }

  const dot = stack <= 4 ? 14 : stack <= 8 ? 10 : stack <= 14 ? 7 : 5;
  const gapY = 2;
  const plotHeight = Math.max(30, stack * (dot + gapY) + 6);
  const duration = (reduceMotion ? 0 : ctx.enter.durationMs) / 1000;
  const pad = halfColumnPct(bounds);

  let dotIndex = 0;

  return (
    <div className={"overflow-x-auto " + (className ?? "")}>
      <div className="min-w-[420px]">
        <p className="typo-caption mb-3">
          One dot = one respondent · band = lowest to highest answer · rule = mean
        </p>

        <div
          className="grid items-center gap-x-3 gap-y-3"
          style={{ gridTemplateColumns: "minmax(5rem,9rem) minmax(170px,1fr) auto" }}
        >
          {series.map((s) => {
            const color = s.color || CHART_TOKENS.primary;
            const total = totalResponses(s.distribution);
            const range = observedRange(s.distribution, bounds.min);

            return (
              <div key={s.id} className="contents">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ background: color }}
                  />
                  <span
                    className="truncate text-xs font-medium"
                    style={{ color: CHART_TOKENS.textPrimary }}
                    title={s.label}
                  >
                    {s.label}
                  </span>
                </div>

                <div className="relative" style={{ height: plotHeight }}>
                  {points.map((p) => (
                    <span
                      key={p}
                      aria-hidden
                      className="absolute top-0 bottom-0 w-px"
                      style={{ left: `${scorePct(p, bounds)}%`, background: CHART_TOKENS.gridline }}
                    />
                  ))}

                  {/* Also drawn when every answer is identical: the padding alone
                      makes a pill around that one column, which reads as "no
                      spread" rather than as a row that failed to render. */}
                  {range && (
                    <span
                      aria-hidden
                      className="absolute top-0 bottom-0"
                      style={{
                        // Padded by a dot radius so the band encloses the outermost
                        // dots rather than ending on their centres — the point of
                        // showing the range is that every answer sits inside it.
                        left: `calc(${scorePct(range[0], bounds)}% - ${dot / 2 + 3}px)`,
                        width: `calc(${
                          scorePct(range[1], bounds) - scorePct(range[0], bounds)
                        }% + ${dot + 6}px)`,
                        background: softFill(color, 0.14),
                        borderRadius: 8,
                      }}
                    />
                  )}

                  {s.mean !== null && (
                    <span
                      aria-hidden
                      className="absolute top-0 bottom-0"
                      style={{
                        left: `calc(${scorePct(s.mean, bounds)}% - 1px)`,
                        width: 2,
                        background: CHART_TOKENS.textMuted,
                      }}
                    />
                  )}

                  {points.map((p, i) => {
                    const count = s.distribution[i] ?? 0;
                    // Each column's stack is centred on the row rather than sitting
                    // on its floor, so a single dot reads as "on the axis" and a
                    // tall column grows evenly in both directions.
                    const stackHeight = count * dot + (count - 1) * gapY;
                    const stackTop = (plotHeight - stackHeight) / 2;
                    return Array.from({ length: count }).map((_, j) => {
                      const delay = reduceMotion ? 0 : Math.min(dotIndex * 0.02, 0.6);
                      dotIndex += 1;
                      return (
                        <motion.span
                          key={`${p}-${j}`}
                          initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration, delay, ease: ctx.enter.ease }}
                          className="absolute rounded-full"
                          style={{
                            left: `calc(${scorePct(p, bounds)}% - ${dot / 2}px)`,
                            top: stackTop + j * (dot + gapY),
                            width: dot,
                            height: dot,
                            background: color,
                            boxShadow: `0 0 0 2px ${CHART_TOKENS.surface}`,
                          }}
                          title={`${s.label} — score ${p}: ${count} of ${total}`}
                        />
                      );
                    });
                  })}
                </div>

                <ScaleStatCell mean={s.mean} sd={s.sd} n={s.n} groupN={groupN} />
              </div>
            );
          })}

          <div aria-hidden />
          <div className="relative h-4" style={{ paddingInline: `${pad}%` }}>
            {points.map((p) => (
              <span
                key={p}
                className="absolute -translate-x-1/2 text-[11px] tabular-nums"
                style={{ left: `${scorePct(p, bounds)}%`, color: CHART_TOKENS.textMuted }}
              >
                {p}
              </span>
            ))}
          </div>
          <div aria-hidden />
        </div>
      </div>
    </div>
  );
}
