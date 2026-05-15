"use client";

import { useChartContext } from "./ChartContext";
import { CHART_TOKENS, colorForCategory } from "./ChartTheme";

export interface BumpSide {
  id: string;
  label: string;
  /** keyId → rank (1-based, lower = better). Use the item's rank within the side. */
  ranks: Record<string, number>;
}

export interface BumpKey {
  id: string;
  label: string;
  /** Optional swatch color (e.g. archetype.color). Falls back to a hashed
   * accent if omitted. */
  color?: string;
}

interface BumpChartProps {
  sides: BumpSide[];
  keys: BumpKey[];
}

/**
 * Bump chart: shows how item ranks shift across N ordered sides. Each item
 * gets a coloured line connecting its rank position in each side; circles
 * mark the endpoints. Y-axis is rank, 1 at the top.
 */
export function BumpChart({ sides, keys }: BumpChartProps) {
  useChartContext();
  if (sides.length < 2 || keys.length === 0) {
    return <p className="text-xs italic" style={{ color: CHART_TOKENS.textMuted }}>Need at least 2 sides and 1 item.</p>;
  }
  const height = 240;
  const width = 480;
  const padding = { top: 16, right: 80, bottom: 28, left: 80 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const rankCount = keys.length;
  const xStep = sides.length > 1 ? innerW / (sides.length - 1) : 0;
  const yStep = rankCount > 1 ? innerH / (rankCount - 1) : 0;

  function xFor(sideIdx: number): number {
    return padding.left + sideIdx * xStep;
  }
  function yFor(rank: number): number {
    return padding.top + (rank - 1) * yStep;
  }

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img">
      {sides.map((s, idx) => (
        <text
          key={s.id}
          x={xFor(idx)}
          y={height - 8}
          textAnchor="middle"
          fontSize="11"
          fill={CHART_TOKENS.textMuted}
        >
          {s.label || s.id}
        </text>
      ))}
      {keys.map((k) => {
        const color = k.color ?? colorForCategory(k.id);
        const points = sides.map((s, idx) => {
          const rank = s.ranks[k.id] ?? rankCount;
          return { x: xFor(idx), y: yFor(rank), rank };
        });
        const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
        const firstRank = points[0].rank;
        const lastRank = points[points.length - 1].rank;
        return (
          <g key={k.id}>
            <path d={path} fill="none" stroke={color} strokeWidth={1.5} opacity={0.85} />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color} />
            ))}
            <text x={padding.left - 6} y={yFor(firstRank)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill={CHART_TOKENS.textMuted}>
              {k.label}
            </text>
            <text x={width - padding.right + 6} y={yFor(lastRank)} dominantBaseline="middle" fontSize="10" fill={CHART_TOKENS.textPrimary}>
              {k.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
