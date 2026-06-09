"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useChartContext } from "./ChartContext";
import { CHART_TOKENS } from "./ChartTheme";

export interface TornadoRow {
  id: string;
  label: string;
  /** Left-side absolute value (e.g. avg % share in the left set). Optional —
   * if both leftValue and rightValue are provided the chart renders the
   * dual-bar diverging-from-centre layout. */
  leftValue?: number;
  rightValue?: number;
  delta: number;
  /** Optional per-row accent (e.g. archetype.color). Replaces the
   * success/danger fill on the diverging bars. */
  color?: string;
}

interface TornadoProps {
  rows: TornadoRow[];
  /** Suffix shown after each value, e.g. "%" or " pts". */
  unitSuffix?: string;
  /** Editable labels (default "Left" / "Right"). Shown top-right. */
  leftLabel?: string;
  rightLabel?: string;
  /** Respondent counts per side. When provided, shown as "(n=X)" in the header. */
  leftN?: number;
  rightN?: number;
  /** Domain max per side. Bars within each half scale against this. Default:
   * 100 when unitSuffix === "%", else max(leftValue, rightValue) across rows. */
  domainMax?: number;
}

/**
 * Per-row diverging bars pinned to a central axis. The left half grows
 * leftward, the right half grows rightward — the side with the larger
 * value is shown at full opacity, the other faded. Delta is displayed on
 * the far right with an up/down arrow.
 *
 * Centre-pivoted, per-row diverging bars — see the chart usage in the
 * Tornado picker on Comparison analyses.
 */
export function Tornado({
  rows,
  unitSuffix = "%",
  leftLabel,
  rightLabel,
  leftN,
  rightN,
  domainMax,
}: TornadoProps) {
  useChartContext();
  const isPercent = unitSuffix === "%";
  const allValues = rows.flatMap((r) => [r.leftValue ?? 0, r.rightValue ?? 0]);
  const max = isPercent ? 100 : (domainMax ?? Math.max(1, ...allValues));

  return (
    <div>
      {(leftLabel || rightLabel) && (
        <div
          className="grid grid-cols-[8rem_1fr_5rem] items-baseline gap-3 mb-2 text-xs"
          style={{ color: CHART_TOKENS.textMuted }}
        >
          <span />
          <div className="grid grid-cols-2 gap-1">
            <span className="text-center truncate">{withN(leftLabel ?? "Left", leftN)}</span>
            <span className="text-center truncate">{withN(rightLabel ?? "Right", rightN)}</span>
          </div>
          <span />
        </div>
      )}
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const rowColor = row.color ?? CHART_TOKENS.primary;
          const leftVal = row.leftValue ?? 0;
          const rightVal = row.rightValue ?? 0;
          const leftPct = max > 0 ? Math.min(100, (leftVal / max) * 100) : 0;
          const rightPct = max > 0 ? Math.min(100, (rightVal / max) * 100) : 0;
          return (
            <li
              key={row.id}
              className="grid grid-cols-[8rem_1fr_5rem] items-center gap-3 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: rowColor }}
                  aria-hidden="true"
                />
                <span
                  className="truncate"
                  style={{ color: CHART_TOKENS.textPrimary }}
                  title={row.label}
                >
                  {row.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1" aria-hidden="true">
                {/* Left half: bar grows leftward from centre. Opaque when the
                    left side is the larger one (delta = right - left < 0). */}
                <div className="flex justify-end">
                  <div
                    className="h-2 rounded-l-full"
                    style={{
                      width: `${leftPct}%`,
                      background: rowColor,
                      opacity: row.delta < 0 ? 1 : 0.4,
                      transition: "width 300ms cubic-bezier(0.2, 0, 0, 1)",
                    }}
                  />
                </div>
                {/* Right half: bar grows rightward from centre. Opaque when the
                    right side is the larger one (delta > 0). */}
                <div className="flex justify-start">
                  <div
                    className="h-2 rounded-r-full"
                    style={{
                      width: `${rightPct}%`,
                      background: rowColor,
                      opacity: row.delta > 0 ? 1 : 0.4,
                      transition: "width 300ms cubic-bezier(0.2, 0, 0, 1)",
                    }}
                  />
                </div>
              </div>
              <span
                className="text-right tabular-nums font-semibold flex items-center justify-end gap-0.5"
                style={{
                  color:
                    row.delta > 0
                      ? CHART_TOKENS.success
                      : row.delta < 0
                        ? CHART_TOKENS.danger
                        : CHART_TOKENS.textMuted,
                }}
              >
                {row.delta > 0 ? <ArrowUp size={10} /> : row.delta < 0 ? <ArrowDown size={10} /> : null}
                {row.delta > 0 ? "+" : ""}
                {formatNumber(row.delta)}
                {unitSuffix}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

function withN(label: string, n?: number): string {
  return typeof n === "number" ? `${label} (n=${n})` : label;
}
