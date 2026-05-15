"use client";

import { useChartContext } from "./ChartContext";
import { CHART_TOKENS } from "./ChartTheme";

interface JaccardTileProps {
  /** Overlap 0..1. */
  similarity: number;
  /** Number of sides being compared. */
  sideCount: number;
  /** K in "top-K overlap". */
  k: number;
  /** Top-K members per side, used to render the overlap chips. */
  topKLabelsBySide: { sideId: string; sideLabel: string; labels: string[] }[];
}

/**
 * Headline scalar tile for top-K rank overlap. Big number + side-by-side
 * top-K chip lists with overlap items highlighted in primary-light.
 */
export function JaccardTile({ similarity, sideCount, k, topKLabelsBySide }: JaccardTileProps) {
  useChartContext();
  const pct = Math.round(similarity * 100);
  const overlapMembers = new Set<string>(topKLabelsBySide[0]?.labels ?? []);
  for (const side of topKLabelsBySide.slice(1)) {
    const sideSet = new Set(side.labels);
    for (const m of [...overlapMembers]) if (!sideSet.has(m)) overlapMembers.delete(m);
  }

  return (
    <div className="rounded-card border p-5 space-y-4" style={{ borderColor: CHART_TOKENS.gridline, background: CHART_TOKENS.surface }}>
      <div>
        <p className="typo-section-header" style={{ color: CHART_TOKENS.textMuted }}>
          Top-{k} overlap
        </p>
        <p className="typo-metric mt-1" style={{ color: CHART_TOKENS.textPrimary }}>
          {pct}%
        </p>
        <p className="text-xs mt-1" style={{ color: CHART_TOKENS.textMuted }}>
          Jaccard similarity of the top-{k} items across {sideCount} sides.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {topKLabelsBySide.map((side) => (
          <div key={side.sideId} className="space-y-1.5">
            <p className="typo-section-header" style={{ color: CHART_TOKENS.textMuted }}>
              {side.sideLabel || side.sideId}
            </p>
            <div className="flex flex-wrap gap-1">
              {side.labels.map((label) => {
                const inOverlap = overlapMembers.has(label);
                return (
                  <span
                    key={label}
                    className="typo-tag rounded-badge px-2 py-0.5"
                    style={{
                      background: inOverlap ? CHART_TOKENS.primaryLight : "var(--bg-elevated)",
                      color: inOverlap ? CHART_TOKENS.primary : CHART_TOKENS.textMuted,
                    }}
                  >
                    {label}
                  </span>
                );
              })}
              {side.labels.length === 0 && (
                <span className="text-xs italic" style={{ color: CHART_TOKENS.textMuted }}>
                  No data yet
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
