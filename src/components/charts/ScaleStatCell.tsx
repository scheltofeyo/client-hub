"use client";

import { CHART_TOKENS } from "./ChartTheme";
import { fmtScore } from "./scale-series";

interface ScaleStatCellProps {
  mean: number | null;
  sd: number | null;
  n: number;
  /**
   * Respondent count for the question as a whole. When a row matches it, `n` is
   * left off — the card header already says it, and repeating it on every row
   * buries the score it sits next to. It reappears the moment a row differs,
   * which is exactly when it means something: someone skipped that value.
   */
  groupN?: number;
}

/** The numeric readout beside an ordered-scale row: mean leading, spread under it. */
export function ScaleStatCell({ mean, sd, n, groupN }: ScaleStatCellProps) {
  const showN = groupN === undefined || n !== groupN;
  return (
    <div className="text-right whitespace-nowrap">
      <div
        className="text-[15px] font-semibold leading-tight tabular-nums"
        style={{ color: CHART_TOKENS.textPrimary }}
      >
        {fmtScore(mean)}
      </div>
      <div className="text-[11px] leading-tight tabular-nums" style={{ color: CHART_TOKENS.textMuted }}>
        SD {fmtScore(sd)}
        {showN ? ` · n ${n}` : ""}
      </div>
    </div>
  );
}
