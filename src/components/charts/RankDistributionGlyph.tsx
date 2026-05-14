"use client";

import { CHART_TOKENS } from "./ChartTheme";

interface RankDistributionGlyphProps {
  /** Counts per rank position. Index 0 = rank-1 (most preferred). */
  distribution: number[];
  /** Color anchor. Rank-1 uses this; later ranks fade toward background. */
  color?: string;
  /** Width of the glyph in px. Default 80. */
  width?: number;
  /** Height in px. Default 8. */
  height?: number;
  label?: string;
}

/**
 * A small stacked bar showing how votes were distributed across rank
 * positions. Rank-1 (most preferred) is dark/saturated; lower ranks fade.
 * Reveals "this option was everyone's #2 — never anyone's #1" patterns
 * that a single mean percentage hides.
 */
export function RankDistributionGlyph({
  distribution,
  color = CHART_TOKENS.primary,
  width = 80,
  height = 8,
  label,
}: RankDistributionGlyphProps) {
  const total = distribution.reduce((sum, v) => sum + v, 0);
  const labelText =
    label ??
    `Rank distribution: ${distribution
      .map((v, i) => `#${i + 1}=${v}`)
      .join(", ")}`;

  if (total === 0) {
    return (
      <div
        role="img"
        aria-label={`${labelText} (no responses)`}
        style={{ width, height, backgroundColor: CHART_TOKENS.gridline }}
        className="rounded-sm"
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={labelText}
      className="flex overflow-hidden rounded-sm"
      style={{ width, height, backgroundColor: CHART_TOKENS.gridline }}
    >
      {distribution.map((count, i) => {
        if (count === 0) return null;
        const pct = (count / total) * 100;
        // Rank-1 fully saturated; later ranks fade by a linear opacity step.
        const opacity = Math.max(0.2, 1 - i * (0.7 / Math.max(1, distribution.length - 1)));
        return (
          <div
            key={i}
            style={{
              flexBasis: `${pct}%`,
              backgroundColor: color,
              opacity,
            }}
            title={`#${i + 1} · ${count}`}
          />
        );
      })}
    </div>
  );
}
