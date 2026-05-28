"use client";

import { CHART_TOKENS } from "./ChartTheme";

export interface RankHeatmapItem {
  id: string;
  label: string;
  /** Counts per rank position. Index 0 = rank 1. Length = number of ranks. */
  distribution: number[];
}

interface RankHeatmapProps {
  items: RankHeatmapItem[];
  /** Total number of rank positions (columns). Inferred from longest distribution if omitted. */
  ranks?: number;
  /** Cell size in px. Default 40 (projector). */
  cellSize?: number;
  className?: string;
}

/**
 * items × rank-positions heatmap. Cell intensity = count / max(count)
 * interpolated from `--bg-hover` (0) to `--primary` (max). Count number
 * is rendered inside each cell. Items render in the order they're passed
 * in (caller is responsible for ordering).
 */
export function RankHeatmap({ items, ranks, cellSize = 40, className }: RankHeatmapProps) {
  if (items.length === 0) {
    return (
      <div className={className}>
        <p className="text-xs italic" style={{ color: CHART_TOKENS.textMuted }}>
          No responses yet.
        </p>
      </div>
    );
  }

  const rankCount = ranks ?? Math.max(...items.map((i) => i.distribution.length));
  const maxCount = Math.max(1, ...items.flatMap((i) => i.distribution));

  return (
    <div className={"overflow-x-auto " + (className ?? "")}>
      <table className="border-separate" style={{ borderSpacing: "4px 4px" }}>
        <thead>
          <tr>
            <th
              scope="col"
              className="typo-section-header text-left pr-3"
              style={{ color: CHART_TOKENS.textMuted }}
            >
              Item
            </th>
            {Array.from({ length: rankCount }).map((_, i) => (
              <th
                key={i}
                scope="col"
                className="typo-section-header text-center"
                style={{ color: CHART_TOKENS.textMuted, width: cellSize }}
              >
                #{i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <th
                scope="row"
                className="pr-3 text-left text-xs font-medium"
                style={{ color: CHART_TOKENS.textPrimary, whiteSpace: "nowrap" }}
              >
                {item.label}
              </th>
              {Array.from({ length: rankCount }).map((_, i) => {
                const count = item.distribution[i] ?? 0;
                const intensity = count / maxCount;
                const inkOnFill = intensity > 0.5;
                return (
                  <td
                    key={i}
                    className="text-center text-xs tabular-nums"
                    style={{
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: intensity === 0 ? CHART_TOKENS.gridline : CHART_TOKENS.primary,
                      opacity: intensity === 0 ? 1 : 0.15 + intensity * 0.85,
                      color: inkOnFill ? "#ffffff" : CHART_TOKENS.textPrimary,
                      borderRadius: 4,
                    }}
                    title={`${item.label} rank ${i + 1}: ${count}`}
                  >
                    {count > 0 ? count : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
