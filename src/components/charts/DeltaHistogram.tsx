"use client";

import { useChartContext } from "./ChartContext";
import { CHART_TOKENS } from "./ChartTheme";

export interface DeltaHistogramBin {
  /** Centre of the bin (signed). */
  delta: number;
  count: number;
}

interface DeltaHistogramProps {
  bins: DeltaHistogramBin[];
  unitSuffix?: string;
}

/**
 * Vertical histogram of signed deltas, centred on zero. Positive bins on the
 * right (success-tinted), negative on the left (danger-tinted).
 */
export function DeltaHistogram({ bins, unitSuffix = "%" }: DeltaHistogramProps) {
  useChartContext();
  if (bins.length === 0) {
    return <p className="text-xs italic" style={{ color: CHART_TOKENS.textMuted }}>No deltas to plot.</p>;
  }
  const maxCount = Math.max(1, ...bins.map((b) => b.count));
  const sorted = [...bins].sort((a, b) => a.delta - b.delta);
  return (
    <div>
      <div className="flex items-end gap-1 h-32">
        {sorted.map((b) => {
          const pct = (b.count / maxCount) * 100;
          const positive = b.delta > 0;
          return (
            <div key={b.delta} className="flex-1 flex flex-col items-center justify-end gap-1">
              <div
                className="w-full rounded-t-sm"
                style={{
                  height: `${pct}%`,
                  background: positive ? CHART_TOKENS.success : b.delta < 0 ? CHART_TOKENS.danger : CHART_TOKENS.textMuted,
                  opacity: 0.85,
                }}
                title={`${b.count} respondents · Δ ${formatNumber(b.delta)}${unitSuffix}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1">
        {sorted.map((b) => (
          <span
            key={b.delta}
            className="flex-1 text-center text-[10px] tabular-nums"
            style={{ color: CHART_TOKENS.textMuted }}
          >
            {b.delta > 0 ? "+" : ""}
            {formatNumber(b.delta)}
          </span>
        ))}
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}
