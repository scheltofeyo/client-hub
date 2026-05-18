"use client";

import { useEffect, useRef, useState } from "react";
import SectionCard from "@/components/ui/SectionCard";

export interface ConfigureSessionMeta {
  templateSnapshot: {
    rankWeights: number[];
    top3Weights: number[];
  };
}

interface ConfigureSheetProps {
  meta: ConfigureSessionMeta;
  canEdit: boolean;
  onSaveRankWeights: (next: number[]) => Promise<boolean>;
  onSaveTop3Weights: (next: number[]) => Promise<boolean>;
}

const WEIGHT_DEBOUNCE_MS = 600;

/**
 * Settings tab content for tuning the two scoring weight arrays:
 *  - `rankWeights`: applied to archetype-ranking (full-rank archetype scoring).
 *  - `top3Weights`: applied to archetype-top3 (top-3 archetype scoring only).
 *
 * Each editor owns its own debounce timer so saves remain independent.
 * Parent re-mounts with `key=` on session change, so initial state is loaded
 * exactly once per session.
 */
export function ConfigureSheet({
  meta,
  canEdit,
  onSaveRankWeights,
  onSaveTop3Weights,
}: ConfigureSheetProps) {
  return (
    <div className="space-y-6">
      <WeightEditor
        title="Full-ranking weights"
        helper="Points awarded for each rank position in archetype-ranking questions (rank 1 = first choice). Only affects archetype-ranking questions — general-ranking uses mean rank instead."
        initial={meta.templateSnapshot.rankWeights ?? []}
        canEdit={canEdit}
        onSave={onSaveRankWeights}
        resetLabel={(len) => `Reset to ${len},${Math.max(1, len - 1)},…,1`}
        buildReset={(len) => Array.from({ length: len }, (_, i) => len - i)}
      />
      <WeightEditor
        title="Top 3 weights"
        helper="Points awarded for positions 1, 2 and 3 in archetype-top3 questions. Items not placed in the top 3 score 0. General-top3 questions use mean rank, so these weights don't affect them."
        initial={meta.templateSnapshot.top3Weights ?? [5, 3, 1]}
        canEdit={canEdit}
        onSave={onSaveTop3Weights}
        resetLabel={() => "Reset to 5, 3, 1"}
        buildReset={() => [5, 3, 1]}
        fixedLength={3}
      />
    </div>
  );
}

function WeightEditor({
  title,
  helper,
  initial,
  canEdit,
  onSave,
  resetLabel,
  buildReset,
  fixedLength,
}: {
  title: string;
  helper: string;
  initial: number[];
  canEdit: boolean;
  onSave: (next: number[]) => Promise<boolean>;
  resetLabel: (len: number) => string;
  buildReset: (len: number) => number[];
  fixedLength?: number;
}) {
  const [draft, setDraft] = useState<string[]>(() => initial.map(String));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSave(next: string[]) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const parsed = next.map((s) => Number(s));
      if (parsed.some((n) => !Number.isFinite(n))) return;
      onSave(parsed);
    }, WEIGHT_DEBOUNCE_MS);
  }

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const len = fixedLength ?? draft.length;
  return (
    <SectionCard title={title}>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
        {helper}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {draft.map((w, i) => (
          <label key={i} className="flex flex-col text-xs" style={{ color: "var(--text-muted)" }}>
            Rank {i + 1}
            <input
              type="number"
              value={w}
              disabled={!canEdit}
              onChange={(e) => {
                const next = [...draft];
                next[i] = e.target.value;
                setDraft(next);
                scheduleSave(next);
              }}
              className="input input-sm"
              style={{ width: 80 }}
            />
          </label>
        ))}
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              const reset = buildReset(len);
              if (debounceRef.current) clearTimeout(debounceRef.current);
              setDraft(reset.map(String));
              onSave(reset);
            }}
            className="btn-ghost rounded-button px-3 py-2 text-xs"
          >
            {resetLabel(len)}
          </button>
        )}
      </div>
    </SectionCard>
  );
}
