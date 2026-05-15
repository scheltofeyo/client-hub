"use client";

import { useChartContext } from "./ChartContext";
import { CHART_TOKENS } from "./ChartTheme";

export interface SlopeRow {
  id: string;
  label: string;
  leftValue: number;
  rightValue: number;
}

interface SlopeChartProps {
  rows: SlopeRow[];
  leftLabel?: string;
  rightLabel?: string;
  unitSuffix?: string;
  domainMin?: number;
  domainMax?: number;
}

/**
 * Two-column slope chart: each row gets a line drawn between its left and
 * right value, with circle endpoints and a value tag per side. Lines for
 * items that decreased are dashed danger-tinted; increased lines are solid
 * success-tinted; flat lines are muted.
 */
export function SlopeChart({
  rows,
  leftLabel,
  rightLabel,
  unitSuffix = "%",
  domainMin,
  domainMax,
}: SlopeChartProps) {
  useChartContext();
  const allValues = rows.flatMap((r) => [r.leftValue, r.rightValue]);
  const min = domainMin ?? Math.min(0, ...allValues);
  const max = domainMax ?? Math.max(100, ...allValues);
  const range = max - min || 1;
  const height = 240;
  const padding = 24;
  const innerHeight = height - padding * 2;

  function yFor(v: number): number {
    return padding + (1 - (v - min) / range) * innerHeight;
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between text-xs mb-2" style={{ color: CHART_TOKENS.textMuted }}>
        <span>{leftLabel ?? "Left"}</span>
        <span>{rightLabel ?? "Right"}</span>
      </div>
      <svg width="100%" height={height} viewBox={`0 0 400 ${height}`} preserveAspectRatio="none" role="img">
        <line x1="60" y1={padding} x2="60" y2={height - padding} stroke={CHART_TOKENS.gridline} />
        <line x1="340" y1={padding} x2="340" y2={height - padding} stroke={CHART_TOKENS.gridline} />
        {rows.map((row) => {
          const y1 = yFor(row.leftValue);
          const y2 = yFor(row.rightValue);
          const delta = row.rightValue - row.leftValue;
          const color = delta > 0 ? CHART_TOKENS.success : delta < 0 ? CHART_TOKENS.danger : CHART_TOKENS.textMuted;
          return (
            <g key={row.id}>
              <line
                x1="60"
                y1={y1}
                x2="340"
                y2={y2}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray={delta < 0 ? "4 3" : undefined}
                opacity={0.85}
              />
              <circle cx="60" cy={y1} r="4" fill={CHART_TOKENS.surface} stroke={color} strokeWidth={1.5} />
              <circle cx="340" cy={y2} r="4" fill={color} />
              <text x="50" y={y1} textAnchor="end" dominantBaseline="middle" fontSize="10" fill={CHART_TOKENS.textMuted}>
                {row.label}
              </text>
              <text x="350" y={y2} dominantBaseline="middle" fontSize="10" fill={CHART_TOKENS.textPrimary}>
                {formatNumber(row.rightValue)}{unitSuffix}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}
