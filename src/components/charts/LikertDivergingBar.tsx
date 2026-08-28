"use client";

import { motion, useReducedMotion } from "motion/react";
import { useChartContext } from "./ChartContext";
import { CHART_TOKENS } from "./ChartTheme";
import { ScaleStatCell } from "./ScaleStatCell";
import {
  bucketCount,
  scalePoints,
  scaleRampColors,
  totalResponses,
  type ScaleBounds,
  type ScaleSeries,
} from "./scale-series";

interface LikertDivergingBarProps {
  series: ScaleSeries[];
  bounds: ScaleBounds;
  /** Question-level respondent count; rows matching it omit their own n. */
  groupN?: number;
  className?: string;
}

interface RowGeometry {
  segments: { point: number; count: number; from: number; to: number; color: string }[];
  leftShare: number;
  rightShare: number;
}

/**
 * Share of respondents per row, stacked and centred on the neutral midpoint.
 *
 * The centring is the whole point: rows line up on "neither high nor low", so
 * how far a value leans — and whether the group is split or merely undecided —
 * is a shape you read across rows without comparing numbers.
 *
 * Colour is a single-hue ramp through SUMM primary, light to dark, never a
 * rainbow. The layout is diverging, the colour job is sequential — the scale
 * runs in one direction, and the position already carries the polarity.
 */
function geometryFor(s: ScaleSeries, bounds: ScaleBounds, colors: string[]): RowGeometry | null {
  const total = totalResponses(s.distribution);
  if (total === 0) return null;

  const points = scalePoints(bounds);
  const n = points.length;
  const pct = points.map((_, i) => ((s.distribution[i] ?? 0) / total) * 100);

  // Odd scales have a true neutral bucket, split across the centre line.
  // Even scales have no neutral point, so the split falls between the halves.
  const midIndex = n % 2 === 1 ? (n - 1) / 2 : -1;
  let leftShare = 0;
  for (let i = 0; i < (midIndex >= 0 ? midIndex : n / 2); i += 1) leftShare += pct[i];
  if (midIndex >= 0) leftShare += pct[midIndex] / 2;
  const rightShare = 100 - leftShare;

  const segments: RowGeometry["segments"] = [];
  let cursor = -leftShare;
  points.forEach((point, i) => {
    const width = pct[i];
    if (width > 0) {
      segments.push({
        point,
        count: s.distribution[i] ?? 0,
        from: cursor,
        to: cursor + width,
        color: colors[i],
      });
    }
    cursor += width;
  });

  return { segments, leftShare, rightShare };
}

export function LikertDivergingBar({ series, bounds, groupN, className }: LikertDivergingBarProps) {
  const ctx = useChartContext();
  const reduceMotion = useReducedMotion();

  const points = scalePoints(bounds);
  const colors = scaleRampColors(bucketCount(bounds));
  const rows = series.map((s) => ({ s, geo: geometryFor(s, bounds, colors) }));

  if (rows.every((r) => r.geo === null)) {
    return (
      <p className="text-xs italic" style={{ color: CHART_TOKENS.textMuted }}>
        No responses yet.
      </p>
    );
  }

  // Symmetric domain, rounded to a clean tick so the axis reads sensibly.
  const widest = Math.max(
    20,
    ...rows.flatMap((r) => (r.geo ? [r.geo.leftShare, r.geo.rightShare] : []))
  );
  const domain = Math.min(100, Math.ceil(widest / 10) * 10);
  const x = (v: number) => Math.max(0, Math.min(100, 50 + (50 * v) / domain));
  const duration = (reduceMotion ? 0 : ctx.enter.durationMs) / 1000;
  const ticks = [-domain, -domain / 2, 0, domain / 2, domain];

  return (
    <div className={"overflow-x-auto " + (className ?? "")}>
      <div className="min-w-[440px]">
        <div
          className="grid items-center gap-x-3 gap-y-2.5"
          style={{ gridTemplateColumns: "minmax(5rem,9rem) minmax(190px,1fr) auto" }}
        >
          {rows.map(({ s, geo }, rowIndex) => (
            <div key={s.id} className="contents">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ background: s.color || CHART_TOKENS.primary }}
                />
                <span
                  className="truncate text-xs font-medium"
                  style={{ color: CHART_TOKENS.textPrimary }}
                  title={s.label}
                >
                  {s.label}
                </span>
              </div>

              <div className="relative h-5">
                <span
                  aria-hidden
                  className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2"
                  style={{ background: CHART_TOKENS.gridline }}
                />
                {geo?.segments.map((seg, i) => {
                  const first = i === 0;
                  const last = i === geo.segments.length - 1;
                  return (
                    <motion.span
                      key={seg.point}
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        duration,
                        delay: reduceMotion ? 0 : (rowIndex * ctx.enter.staggerMs) / 1000,
                        ease: ctx.enter.ease,
                      }}
                      className="absolute top-0 bottom-0"
                      style={{
                        left: `${x(seg.from)}%`,
                        // 2px surface gap between fills, never a border.
                        width: `max(2px, calc(${x(seg.to) - x(seg.from)}% - 2px))`,
                        background: seg.color,
                        borderTopLeftRadius: first ? 4 : 0,
                        borderBottomLeftRadius: first ? 4 : 0,
                        borderTopRightRadius: last ? 4 : 0,
                        borderBottomRightRadius: last ? 4 : 0,
                      }}
                      title={`${s.label} — score ${seg.point}: ${seg.count} of ${totalResponses(s.distribution)}`}
                    />
                  );
                })}
              </div>

              <ScaleStatCell mean={s.mean} sd={s.sd} n={s.n} groupN={groupN} />
            </div>
          ))}

          <div aria-hidden />
          <div className="relative h-4">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute -translate-x-1/2 text-[11px] tabular-nums"
                style={{ left: `${x(t)}%`, color: CHART_TOKENS.textMuted }}
              >
                {t === 0 ? "0" : `${Math.abs(t)}%`}
              </span>
            ))}
          </div>
          <div aria-hidden />
        </div>

        <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          {points.map((p, i) => (
            <li key={p} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block size-2.5 rounded-sm"
                style={{ background: colors[i] }}
              />
              <span style={{ color: CHART_TOKENS.textMuted }}>
                {p}
                {p === bounds.min ? " (low)" : p === bounds.max ? " (high)" : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
