"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ArchetypeLite } from "./ArchetypePill";

export interface LiveDeltaChartProps {
  archetypes: ArchetypeLite[];
  /** Question IDs assigned to the left set. */
  leftQuestionIds: string[];
  /** Question IDs assigned to the right set. */
  rightQuestionIds: string[];
  /** Server-computed per-question percentages: questionId → archetypeId → percentage (0..100). */
  perQuestionPercentages: Record<string, Record<string, number>>;
  /** Editable labels (defaults: "Left"/"Right"). */
  leftLabel?: string;
  rightLabel?: string;
}

interface DeltaRow {
  archetypeId: string;
  name: string;
  color: string;
  leftPct: number;
  rightPct: number;
  delta: number;
}

function deltaFor({
  archetypes,
  leftQuestionIds,
  rightQuestionIds,
  perQuestionPercentages,
}: {
  archetypes: ArchetypeLite[];
  leftQuestionIds: string[];
  rightQuestionIds: string[];
  perQuestionPercentages: Record<string, Record<string, number>>;
}): DeltaRow[] {
  const avg = (qids: string[], archetypeId: string) => {
    const vals = qids
      .map((qid) => perQuestionPercentages[qid]?.[archetypeId] ?? 0)
      .filter((v) => v > 0);
    return vals.length > 0
      ? Math.round(vals.reduce((sum, v) => sum + v, 0) / vals.length)
      : 0;
  };
  return archetypes.map((a) => {
    const leftPct = avg(leftQuestionIds, a.id);
    const rightPct = avg(rightQuestionIds, a.id);
    return {
      archetypeId: a.id,
      name: a.name,
      color: a.color,
      leftPct,
      rightPct,
      delta: leftPct - rightPct,
    };
  });
}

export default function LiveDeltaChart({
  archetypes,
  leftQuestionIds,
  rightQuestionIds,
  perQuestionPercentages,
  leftLabel,
  rightLabel,
}: LiveDeltaChartProps) {
  const rows = useMemo(
    () => deltaFor({ archetypes, leftQuestionIds, rightQuestionIds, perQuestionPercentages }),
    [archetypes, leftQuestionIds, rightQuestionIds, perQuestionPercentages]
  );

  const empty = leftQuestionIds.length === 0 || rightQuestionIds.length === 0;

  if (empty) {
    return (
      <div
        className="px-4 py-3 rounded-card border text-xs"
        style={{ borderColor: "var(--border)", background: "var(--bg-elevated)", color: "var(--text-muted)" }}
      >
        Add questions to both <strong>{leftLabel ?? "left"}</strong> and{" "}
        <strong>{rightLabel ?? "right"}</strong> to compute a delta.
      </div>
    );
  }

  return (
    <div
      className="px-4 py-3 rounded-card border"
      style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
    >
      <div className="flex items-baseline justify-between mb-2">
        <p className="typo-section-header" style={{ color: "var(--text-muted)" }}>Live delta</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {leftLabel ?? "Left"} <span aria-hidden="true">↔</span> {rightLabel ?? "Right"}
        </p>
      </div>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row.archetypeId} className="flex items-center gap-3 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color }} aria-hidden="true" />
            <span className="w-20 shrink-0 truncate" style={{ color: "var(--text-primary)" }}>{row.name}</span>
            <div className="flex-1 grid grid-cols-2 gap-1" aria-hidden="true">
              {/* Left half: bar grows leftward from centre */}
              <div className="flex justify-end">
                <div
                  className="h-2 rounded-l-full"
                  style={{
                    width: `${row.leftPct}%`,
                    background: row.color,
                    opacity: row.delta > 0 ? 1 : 0.4,
                    transition: "width 300ms cubic-bezier(0.2, 0, 0, 1)",
                  }}
                />
              </div>
              {/* Right half: bar grows rightward from centre */}
              <div className="flex justify-start">
                <div
                  className="h-2 rounded-r-full"
                  style={{
                    width: `${row.rightPct}%`,
                    background: row.color,
                    opacity: row.delta < 0 ? 1 : 0.4,
                    transition: "width 300ms cubic-bezier(0.2, 0, 0, 1)",
                  }}
                />
              </div>
            </div>
            <span
              className="w-12 text-right tabular-nums font-semibold flex items-center justify-end gap-0.5"
              style={{
                color:
                  row.delta > 0
                    ? "var(--success)"
                    : row.delta < 0
                      ? "var(--danger)"
                      : "var(--text-muted)",
              }}
            >
              {row.delta > 0 ? <ArrowUp size={10} /> : row.delta < 0 ? <ArrowDown size={10} /> : null}
              {row.delta > 0 ? "+" : ""}
              {row.delta}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
