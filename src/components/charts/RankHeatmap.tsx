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
  /**
   * Column headers. Defaults to rank positions ("#1", "#2", …). Ordered-scale
   * questions pass their own scale points instead, so the same grid serves both
   * "which rank did this land in" and "which score did this get".
   */
  columnLabels?: string[];
  /** Header above the row labels. Default "Item". */
  rowHeader?: string;
  /** Noun used in a cell's tooltip, e.g. "rank" (default) or "score". */
  columnNoun?: string;
  className?: string;
}

/**
 * items × rank-positions heatmap. Cell intensity = count / max(count):
 * empty cells use the neutral gridline (`--border`); filled cells use
 * `--primary` ramped via opacity up to the max count. Count number
 * is rendered inside each cell. Items render in the order they're passed
 * in (caller is responsible for ordering).
 */
export function RankHeatmap({
  items,
  ranks,
  cellSize = 40,
  columnLabels,
  rowHeader = "Item",
  columnNoun = "rank",
  className,
}: RankHeatmapProps) {
  if (items.length === 0) {
    return (
      <div className={className}>
        <p className="text-xs italic" style={{ color: CHART_TOKENS.textMuted }}>
          No responses yet.
        </p>
      </div>
    );
  }

  const rankCount =
    ranks ?? columnLabels?.length ?? Math.max(...items.map((i) => i.distribution.length));
  const headerFor = (i: number) => columnLabels?.[i] ?? `#${i + 1}`;
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
              {rowHeader}
            </th>
            {Array.from({ length: rankCount }).map((_, i) => (
              <th
                key={i}
                scope="col"
                className="typo-section-header text-center"
                style={{ color: CHART_TOKENS.textMuted, width: cellSize }}
              >
                {headerFor(i)}
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
                // Only the densest cells get the reversed ink — below that the
                // fill is still close enough to the surface for normal text.
                const inkOnFill = intensity > 0.8;
                return (
                  <td
                    key={i}
                    className="text-center text-xs tabular-nums"
                    style={{
                      width: cellSize,
                      height: cellSize,
                      // Mixed toward the surface rather than faded with `opacity`,
                      // which would take the count label down with it.
                      backgroundColor:
                        intensity === 0
                          ? CHART_TOKENS.gridline
                          : `color-mix(in oklab, ${CHART_TOKENS.primary} ${Math.round(
                              (0.15 + intensity * 0.85) * 100
                            )}%, ${CHART_TOKENS.surface})`,
                      color: inkOnFill ? CHART_TOKENS.onPrimaryStrong : CHART_TOKENS.textPrimary,
                      borderRadius: 4,
                    }}
                    title={`${item.label} ${columnNoun} ${headerFor(i)}: ${count}`}
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
