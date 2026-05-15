"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useChartContext } from "./ChartContext";
import { CHART_TOKENS, colorForCategory } from "./ChartTheme";

export interface GroupedVerticalBarsSide {
  id: string;
  label: string;
  values: Record<string, number>;
  /** Optional respondent count, appended to the legend as "(n=X)". */
  n?: number;
}

export interface GroupedVerticalBarsKey {
  id: string;
  label: string;
  /** Optional swatch color (e.g. archetype.color). Falls back to a hashed
   * accent if omitted. */
  color?: string;
}

interface GroupedVerticalBarsProps {
  sides: GroupedVerticalBarsSide[];
  keys: GroupedVerticalBarsKey[];
  unitSuffix?: string;
  /** Domain max shared across groups. Defaults to the max value in the data. */
  domainMax?: number;
  /** Bar area height in px. */
  height?: number;
  className?: string;
}

/**
 * Vertical bar chart grouped by key. Each group shows N bars side-by-side —
 * one per `side` — so the per-key spread is visible at a glance. Bar colour
 * is keyed by side index (consistent across groups). Groups are ordered by
 * the sum of their values across sides (descending) so the most active
 * items lead the read.
 */
export function GroupedVerticalBars({
  sides,
  keys,
  unitSuffix = "%",
  domainMax,
  height = 220,
  className,
}: GroupedVerticalBarsProps) {
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
  const duration = (reduceMotion ? 0 : ctx.enter.durationMs) / 1000;
  const stagger = (reduceMotion ? 0 : ctx.enter.staggerMs) / 1000;

  if (keys.length === 0 || sides.length === 0) {
    return (
      <div className={className}>
        <p className="text-xs italic text-text-muted">No data.</p>
      </div>
    );
  }

  // Preserve input order — the API hands keys back in admin-defined order
  // (archetype rank for archetype-ranking, choice order for MC, etc.).
  const orderedKeys = keys;
  const max =
    domainMax ??
    Math.max(1, ...sides.flatMap((s) => orderedKeys.map((k) => s.values[k.id] ?? 0)));

  return (
    <div ref={ref} className={className}>
      {/* Legend — each side shown as a neutral swatch at the side's opacity to
          communicate "darker = first side, lighter = later sides". The bar
          itself uses each archetype's own colour, faded per side. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {sides.map((s, idx) => (
          <div key={s.id} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: CHART_TOKENS.textPrimary, opacity: sideOpacity(idx) }}
              aria-hidden="true"
            />
            <span style={{ color: CHART_TOKENS.textPrimary }}>
              {s.label || s.id}
              {typeof s.n === "number" && (
                <span style={{ color: CHART_TOKENS.textMuted }}> (n={s.n})</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Bar groups */}
      <div
        className="grid items-end gap-3"
        style={{
          gridTemplateColumns: `repeat(${orderedKeys.length}, minmax(0, 1fr))`,
          height,
        }}
      >
        {orderedKeys.map((key, keyIdx) => (
          <div key={key.id} className="flex h-full items-end justify-center gap-1">
            {sides.map((side, sideIdx) => {
              const v = side.values[key.id] ?? 0;
              const pct = max > 0 ? (v / max) * 100 : 0;
              const color = key.color ?? colorForCategory(key.id);
              const delay = shown
                ? keyIdx * stagger + sideIdx * (stagger * 0.5)
                : 0;
              return (
                <div
                  key={side.id}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                  style={{ maxWidth: 48 }}
                >
                  <span
                    className="mb-1 text-[11px] font-semibold tabular-nums leading-none"
                    style={{ color: CHART_TOKENS.textPrimary }}
                  >
                    {formatValue(v, unitSuffix)}
                  </span>
                  <div className="relative w-full" style={{ height: "100%" }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: shown ? `${pct}%` : 0 }}
                      transition={{
                        duration,
                        delay,
                        ease: ctx.enter.ease,
                      }}
                      style={{ backgroundColor: color, opacity: sideOpacity(sideIdx) }}
                      className="absolute inset-x-0 bottom-0 rounded-sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Baseline */}
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

      {/* Group labels */}
      <div
        className="mt-2 grid gap-3"
        style={{ gridTemplateColumns: `repeat(${orderedKeys.length}, minmax(0, 1fr))` }}
      >
        {orderedKeys.map((key) => (
          <div key={key.id} className="text-center">
            <p
              className="line-clamp-2 text-[11px] leading-tight"
              style={{ color: CHART_TOKENS.textPrimary }}
              title={key.label}
            >
              {key.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Per-side opacity ramp: first side is full-strength, subsequent sides fade.
// Tuned so 2-side comparisons read as "vivid vs muted" rather than "two
// equally-bright competing colours."
const SIDE_OPACITIES = [1, 0.5, 0.3, 0.18, 0.1] as const;

function sideOpacity(idx: number): number {
  return SIDE_OPACITIES[idx] ?? 0.08;
}

function formatValue(v: number, unit: string): string {
  if (unit === "%") return `${Math.round(v)}%`;
  return `${formatNumber(v)}${unit}`;
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}
