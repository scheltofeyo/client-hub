"use client";

import { useChartContext } from "./ChartContext";
import { CHART_TOKENS } from "./ChartTheme";

export interface DumbbellRow {
  id: string;
  label: string;
  leftValue: number;
  rightValue: number;
  /** Optional per-row accent (e.g. archetype.color). Replaces the default
   * primary on both endpoints. Direction is still encoded by open/filled. */
  color?: string;
}

interface DumbbellProps {
  rows: DumbbellRow[];
  leftLabel?: string;
  rightLabel?: string;
  /** Respondent counts per side. When provided, shown as "(n=X)" in the legend. */
  leftN?: number;
  rightN?: number;
  /** Suffix shown after each value, e.g. "%" or " pts". */
  unitSuffix?: string;
  domainMin?: number;
  domainMax?: number;
}

/**
 * Per-row dumbbell with axis ticks (0 / midpoint / max), absolute values per
 * endpoint, and the delta on the far right. Sorted by absolute delta desc so
 * the biggest movers float up.
 */
export function Dumbbell({
  rows,
  leftLabel,
  rightLabel,
  leftN,
  rightN,
  unitSuffix = "%",
  domainMin,
  domainMax,
}: DumbbellProps) {
  useChartContext();
  const sorted = [...rows].sort(
    (a, b) => Math.abs(b.rightValue - b.leftValue) - Math.abs(a.rightValue - a.leftValue)
  );

  const isPercent = unitSuffix === "%";
  const allValues = rows.flatMap((r) => [r.leftValue, r.rightValue]);
  // Percent data always plots on a fixed 0-100 domain so cards stay comparable.
  const min = isPercent ? 0 : (domainMin ?? Math.min(0, ...allValues));
  const max = isPercent ? 100 : (domainMax ?? Math.max(1, ...allValues));
  const range = max - min || 1;
  const ticks = computeTicks(min, max, isPercent);

  function pctOf(v: number): number {
    return ((v - min) / range) * 100;
  }

  const gridCols = "grid-cols-[8rem_1fr_5rem_4rem]";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs" style={{ color: CHART_TOKENS.textMuted }}>
        <LegendMarker open label={withN(leftLabel ?? "Left", leftN)} />
        <LegendMarker open={false} label={withN(rightLabel ?? "Right", rightN)} />
      </div>

      <ul className="space-y-2">
        {sorted.map((row) => {
          const left = pctOf(row.leftValue);
          const right = pctOf(row.rightValue);
          const delta = row.rightValue - row.leftValue;
          const lineStart = Math.min(left, right);
          const lineWidth = Math.abs(right - left);
          const rowColor = row.color ?? CHART_TOKENS.primary;
          return (
            <li
              key={row.id}
              className={`grid ${gridCols} items-center gap-3 text-xs`}
            >
              <span className="truncate" style={{ color: CHART_TOKENS.textPrimary }}>{row.label}</span>
              <div className="relative h-4">
                {ticks.map((t) => (
                  <span
                    key={t.position}
                    className="absolute top-1/2 -translate-y-1/2 h-2 w-px"
                    style={{
                      left: `${t.position}%`,
                      background: CHART_TOKENS.gridline,
                      opacity: 0.4,
                    }}
                    aria-hidden="true"
                  />
                ))}
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-[1px]"
                  style={{
                    left: `${lineStart}%`,
                    width: `${lineWidth}%`,
                    background: CHART_TOKENS.gridline,
                  }}
                  aria-hidden="true"
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full"
                  style={{
                    left: `${left}%`,
                    background: CHART_TOKENS.surface,
                    border: `1.5px solid ${rowColor}`,
                  }}
                  aria-hidden="true"
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full"
                  style={{ left: `${right}%`, background: rowColor }}
                  aria-hidden="true"
                />
              </div>
              <span
                className="text-right text-[10px] tabular-nums leading-tight flex flex-col items-end"
              >
                <span className="flex items-center gap-1" style={{ color: CHART_TOKENS.textMuted }}>
                  {formatNumber(row.leftValue)}
                  {unitSuffix}
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: CHART_TOKENS.surface,
                      border: `1px solid ${rowColor}`,
                    }}
                    aria-hidden="true"
                  />
                </span>
                <span className="flex items-center gap-1" style={{ color: rowColor }}>
                  {formatNumber(row.rightValue)}
                  {unitSuffix}
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: rowColor }}
                    aria-hidden="true"
                  />
                </span>
              </span>
              <span
                className="text-right tabular-nums font-semibold"
                style={{
                  color:
                    delta > 0
                      ? CHART_TOKENS.success
                      : delta < 0
                        ? CHART_TOKENS.danger
                        : CHART_TOKENS.textMuted,
                }}
              >
                {delta > 0 ? "+" : ""}
                {formatNumber(delta)}
                {unitSuffix}
              </span>
            </li>
          );
        })}
      </ul>

      <div
        className={`grid ${gridCols} gap-3 text-[10px] tabular-nums`}
        style={{ color: CHART_TOKENS.textMuted }}
      >
        <span />
        <div className="relative h-3">
          {ticks.map((t, i) => (
            <span
              key={t.position}
              className={
                i === 0
                  ? "absolute left-0"
                  : i === ticks.length - 1
                    ? "absolute right-0"
                    : "absolute -translate-x-1/2"
              }
              style={i === 0 || i === ticks.length - 1 ? undefined : { left: `${t.position}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
        <span />
        <span />
      </div>
    </div>
  );
}

function computeTicks(min: number, max: number, isPercent: boolean): { position: number; label: string }[] {
  if (isPercent) {
    return [0, 25, 50, 75, 100].map((v) => ({ position: v, label: `${v}%` }));
  }
  const range = max - min || 1;
  return [0, 0.25, 0.5, 0.75, 1].map((frac) => {
    const value = min + range * frac;
    return { position: frac * 100, label: formatNumber(value) };
  });
}

function LegendMarker({ open, label }: { open: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={
          open
            ? {
                background: CHART_TOKENS.surface,
                border: `1.5px solid ${CHART_TOKENS.primary}`,
              }
            : { background: CHART_TOKENS.primary }
        }
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

function withN(label: string, n?: number): string {
  return typeof n === "number" ? `${label} (n=${n})` : label;
}
