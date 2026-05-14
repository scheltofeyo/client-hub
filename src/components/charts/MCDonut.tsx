"use client";

import { motion, useReducedMotion } from "motion/react";
import { arc as d3Arc, pie as d3Pie } from "d3-shape";
import { useChartContext } from "./ChartContext";
import { CHART_TOKENS, colorForCategory } from "./ChartTheme";
import type { MCChoiceDatum } from "./MCSortedBar";

interface MCDonutProps {
  choices: MCChoiceDatum[];
  /** Diameter in px. Default 240. */
  size?: number;
  className?: string;
}

/**
 * Donut chart with leader callout in the center. Single-select only —
 * caller is responsible for not mounting this on multi-select data
 * (percentages would exceed 100% and the donut would lie).
 */
export function MCDonut({ choices, size = 240, className }: MCDonutProps) {
  const ctx = useChartContext();
  const reduceMotion = useReducedMotion();
  const total = choices.reduce((sum, c) => sum + c.count, 0);
  const sorted = [...choices].sort((a, b) => b.count - a.count);
  const leader = sorted[0];

  if (total === 0 || !leader) {
    return (
      <div className={className}>
        <p className="text-xs italic" style={{ color: CHART_TOKENS.textMuted }}>
          No responses yet.
        </p>
      </div>
    );
  }

  const radius = size / 2;
  const innerRadius = radius - 36;
  const pieGen = d3Pie<MCChoiceDatum>().value((c) => c.count).sort(null);
  const arcGen = d3Arc<{ startAngle: number; endAngle: number }>()
    .innerRadius(innerRadius)
    .outerRadius(radius - 1);
  const slices = pieGen(sorted);
  const duration = (reduceMotion ? 0 : ctx.enter.durationMs) / 1000;

  return (
    <div className={className}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`-${radius} -${radius} ${size} ${size}`}>
            {slices.map((s, i) => {
              const d = arcGen({ startAngle: s.startAngle, endAngle: s.endAngle });
              if (!d) return null;
              return (
                <motion.path
                  key={s.data.id}
                  d={d}
                  fill={colorForCategory(s.data.id)}
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration, delay: reduceMotion ? 0 : i * 0.05, ease: ctx.enter.ease }}
                  style={{ transformOrigin: "center" }}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-4xl font-semibold tabular-nums tracking-tight"
              style={{ color: CHART_TOKENS.textPrimary }}
            >
              {leader.percentage}%
            </span>
            <span
              className="mt-1 text-sm font-medium"
              style={{ color: CHART_TOKENS.textMuted }}
            >
              {leader.label}
            </span>
          </div>
        </div>

        <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs">
          {sorted.map((c) => (
            <li key={c.id} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block size-2.5 rounded-sm"
                style={{ backgroundColor: colorForCategory(c.id) }}
              />
              <span style={{ color: CHART_TOKENS.textPrimary }}>{c.label}</span>
              <span className="tabular-nums" style={{ color: CHART_TOKENS.textMuted }}>
                {c.count} · {c.percentage}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
