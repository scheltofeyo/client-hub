"use client";

import { motion, useReducedMotion } from "motion/react";
import { useChartContext } from "./ChartContext";
import { CHART_TOKENS } from "./ChartTheme";
import { ScaleStatCell } from "./ScaleStatCell";
import {
  fmtScore,
  halfColumnPct,
  observedRange,
  scalePoints,
  scorePct,
  softFill,
  totalResponses,
  type ScaleBounds,
  type ScaleSeries,
} from "./scale-series";

interface ScaleMeanSpreadProps {
  series: ScaleSeries[];
  bounds: ScaleBounds;
  /** Question-level respondent count; rows matching it omit their own n. */
  groupN?: number;
  className?: string;
}

/**
 * Ranked summary: a dot at the mean, a bar for ±1 SD, a hairline for the full
 * observed range. Sorted by mean, so "where do we score highest" and "where do
 * we disagree most" are both answerable at a glance.
 *
 * This is the one view that deliberately drops individual answers — it is the
 * complement to the dot plot, not a replacement for it.
 */
export function ScaleMeanSpread({ series, bounds, groupN, className }: ScaleMeanSpreadProps) {
  const ctx = useChartContext();
  const reduceMotion = useReducedMotion();

  const points = scalePoints(bounds);
  const scored = series.filter((s) => totalResponses(s.distribution) > 0);

  if (scored.length === 0) {
    return (
      <p className="text-xs italic" style={{ color: CHART_TOKENS.textMuted }}>
        No responses yet.
      </p>
    );
  }

  const sorted = [...scored].sort((a, b) => (b.mean ?? -Infinity) - (a.mean ?? -Infinity));
  const duration = (reduceMotion ? 0 : ctx.enter.durationMs) / 1000;
  const pad = halfColumnPct(bounds);

  return (
    <div className={"overflow-x-auto " + (className ?? "")}>
      <div className="min-w-[420px]">
        <p className="typo-caption mb-3">
          Dot = mean · bar = ±1 SD · hairline = full range · sorted by mean
        </p>

        <div
          className="grid items-center gap-x-3 gap-y-3"
          style={{ gridTemplateColumns: "minmax(5rem,9rem) minmax(170px,1fr) auto" }}
        >
          {sorted.map((s, rowIndex) => {
            const color = s.color || CHART_TOKENS.primary;
            const range = observedRange(s.distribution, bounds.min);
            const sdFrom =
              s.mean !== null && s.sd !== null ? Math.max(0, scorePct(s.mean - s.sd, bounds)) : null;
            const sdTo =
              s.mean !== null && s.sd !== null ? Math.min(100, scorePct(s.mean + s.sd, bounds)) : null;
            const delay = reduceMotion ? 0 : (rowIndex * ctx.enter.staggerMs) / 1000;

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

                <div className="relative h-6">
                  {points.map((p) => (
                    <span
                      key={p}
                      aria-hidden
                      className="absolute top-0 bottom-0 w-px"
                      style={{ left: `${scorePct(p, bounds)}%`, background: CHART_TOKENS.gridline }}
                    />
                  ))}

                  {range && (
                    <span
                      aria-hidden
                      className="absolute top-1/2 h-px -translate-y-1/2"
                      style={{
                        left: `${scorePct(range[0], bounds)}%`,
                        width: `${scorePct(range[1], bounds) - scorePct(range[0], bounds)}%`,
                        background: softFill(color, 0.3),
                      }}
                    />
                  )}

                  {sdFrom !== null && sdTo !== null && (
                    <motion.span
                      initial={reduceMotion ? false : { opacity: 0, scaleX: 0.4 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      transition={{ duration, delay, ease: ctx.enter.ease }}
                      className="absolute top-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        left: `${sdFrom}%`,
                        width: `max(2px, ${sdTo - sdFrom}%)`,
                        height: 6,
                        background: softFill(color, 0.55),
                      }}
                      title={`${s.label} — ±1 SD: ${fmtScore(s.sd)}`}
                    />
                  )}

                  {s.mean !== null && (
                    <motion.span
                      initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration, delay, ease: ctx.enter.ease }}
                      className="absolute top-1/2 rounded-full"
                      style={{
                        left: `calc(${scorePct(s.mean, bounds)}% - 5px)`,
                        marginTop: -5,
                        width: 10,
                        height: 10,
                        background: color,
                        boxShadow: `0 0 0 2px ${CHART_TOKENS.surface}`,
                      }}
                      title={`${s.label} — mean ${fmtScore(s.mean)} of ${bounds.max}`}
                    />
                  )}
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
