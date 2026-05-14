"use client";

import { CHART_TOKENS } from "./ChartTheme";

interface RankMiniHistogramProps {
  /** Counts per rank position. Index 0 = rank 1 (most preferred). */
  distribution: number[];
  /** Color anchor for filled bars. */
  color?: string;
  /** Total width in px. Default 96. */
  width?: number;
  /** Bar area height in px (excluding rank labels below). Default 36. */
  height?: number;
  /** Show "1 2 3 …" rank labels below the bars. Default true. */
  showLabels?: boolean;
}

/**
 * Vertical mini bar chart showing the count at each rank position.
 *
 * Every rank position renders a faint background "track" at the full bar
 * height, so empty positions are visible (you can see how many ranks the
 * question has, not just where votes landed). On top of the track, a
 * filled bar grows proportionally to the count.
 *
 * A baseline rule below the bars gives the chart visual weight; rank
 * labels sit beneath that.
 */
export function RankMiniHistogram({
  distribution,
  color = CHART_TOKENS.primary,
  width = 96,
  height = 36,
  showLabels = true,
}: RankMiniHistogramProps) {
  const bars = Math.max(distribution.length, 1);
  const max = Math.max(...distribution, 1);
  const gap = 3;
  const barWidth = Math.max(4, (width - (bars - 1) * gap) / bars);
  const labelHeight = showLabels ? 14 : 0;
  const baselineGap = 1;
  const baselineThickness = 2;
  const totalH = height + baselineGap + baselineThickness + labelHeight;
  const total = distribution.reduce((sum, v) => sum + v, 0);
  const labelText = `Rank distribution — ${distribution.map((c, i) => `#${i + 1}: ${c}`).join(", ")}`;

  return (
    <svg
      width={width}
      height={totalH}
      role="img"
      aria-label={labelText}
      style={{ display: "block" }}
    >
      {distribution.map((count, i) => {
        const filledH = total > 0 ? (count / max) * (height - 1) : 0;
        const x = i * (barWidth + gap);
        return (
          <g key={i}>
            {/* Track (always visible, very faint) */}
            <rect
              x={x}
              y={0}
              width={barWidth}
              height={height}
              fill={color}
              opacity={0.12}
              rx={2}
            />
            {/* Filled bar (only when count > 0) */}
            {count > 0 && (
              <rect
                x={x}
                y={height - filledH}
                width={barWidth}
                height={filledH}
                fill={color}
                rx={2}
              />
            )}
            {showLabels && (
              <text
                x={x + barWidth / 2}
                y={height + baselineGap + baselineThickness + labelHeight - 3}
                fontSize={9}
                fill={CHART_TOKENS.textMuted}
                textAnchor="middle"
              >
                {i + 1}
              </text>
            )}
          </g>
        );
      })}
      {/* Baseline — sits `baselineGap` px below the bar area */}
      <line
        x1={0}
        x2={width}
        y1={height + baselineGap + baselineThickness / 2}
        y2={height + baselineGap + baselineThickness / 2}
        stroke={CHART_TOKENS.textMuted}
        strokeWidth={baselineThickness}
        strokeLinecap="round"
        opacity={0.35}
      />
    </svg>
  );
}
