"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useChartContext } from "./ChartContext";
import { CHART_TOKENS } from "./ChartTheme";

export interface TermFrequencyTerm {
  term: string;
  count: number;
}

interface TermFrequencyBarsProps {
  terms: TermFrequencyTerm[];
  /** Raw response texts shown in a collapsible "All responses" section. */
  rawTexts?: { text: string }[];
  /** How many top terms to show before the "Show all" toggle. */
  initialLimit?: number;
}

/**
 * Vertical list of term bars sorted by frequency desc. Below the list,
 * a collapsible block reveals every raw response — useful for sense-checking
 * the term aggregation.
 */
export function TermFrequencyBars({ terms, rawTexts, initialLimit = 12 }: TermFrequencyBarsProps) {
  useChartContext();
  const [showAll, setShowAll] = useState(false);
  const [textsOpen, setTextsOpen] = useState(false);

  const visibleTerms = showAll ? terms : terms.slice(0, initialLimit);
  const remainder = terms.length - visibleTerms.length;
  const max = Math.max(1, ...terms.map((t) => t.count));

  if (terms.length === 0) {
    return <p className="text-xs italic" style={{ color: CHART_TOKENS.textMuted }}>No terms yet.</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {visibleTerms.map((t) => {
          const pct = (t.count / max) * 100;
          return (
            <li key={t.term} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3 text-xs">
              <span className="truncate" style={{ color: CHART_TOKENS.textPrimary }}>{t.term}</span>
              <div className="h-2 rounded-full" style={{ background: "var(--bg-elevated)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CHART_TOKENS.primaryLight }} />
              </div>
              <span className="text-right tabular-nums" style={{ color: CHART_TOKENS.textMuted }}>{t.count}</span>
            </li>
          );
        })}
      </ul>
      {remainder > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs hover:underline"
          style={{ color: CHART_TOKENS.primary }}
        >
          Show all ({terms.length})
        </button>
      )}
      {rawTexts && rawTexts.length > 0 && (
        <div className="border-t pt-3" style={{ borderColor: CHART_TOKENS.gridline }}>
          <button
            type="button"
            onClick={() => setTextsOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium"
            style={{ color: CHART_TOKENS.textMuted }}
          >
            {textsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            All responses ({rawTexts.length})
          </button>
          {textsOpen && (
            <ul className="mt-2 space-y-1">
              {rawTexts.map((r, i) => (
                <li
                  key={i}
                  className="text-xs italic truncate"
                  style={{ color: CHART_TOKENS.textPrimary }}
                  title={r.text}
                >
                  &ldquo;{r.text}&rdquo;
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
