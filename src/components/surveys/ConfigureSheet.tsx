"use client";

import { useEffect, useRef, useState } from "react";
import SectionCard from "@/components/ui/SectionCard";

export interface ConfigureSessionMeta {
  templateSnapshot: {
    rankWeights: number[];
  };
}

interface ConfigureSheetProps {
  meta: ConfigureSessionMeta;
  canEdit: boolean;
  onSaveWeights: (next: number[]) => Promise<boolean>;
}

const WEIGHT_DEBOUNCE_MS = 600;

/**
 * Settings tab content for tuning ranking weights. Owns its own draft state
 * so the parent's loadSession polling can't reset the user's in-progress
 * edits. Weights are debounce-saved on change; reset button still works.
 */
export function ConfigureSheet({
  meta,
  canEdit,
  onSaveWeights,
}: ConfigureSheetProps) {
  // Initialize weightsDraft once on mount (parent re-mounts with key= on session change).
  const [weightsDraft, setWeightsDraft] = useState<string[]>(() =>
    (meta.templateSnapshot.rankWeights ?? []).map(String)
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSave(next: string[]) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const parsed = next.map((s) => Number(s));
      if (parsed.some((n) => !Number.isFinite(n))) return;
      onSaveWeights(parsed);
    }, WEIGHT_DEBOUNCE_MS);
  }

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Scoring weights"
        helper="Points awarded for each rank (rank 1 = first choice). Edits recompute the percentages on the Insights view."
      >
        <div className="flex flex-wrap items-end gap-3">
          {weightsDraft.map((w, i) => (
            <label key={i} className="flex flex-col text-xs" style={{ color: "var(--text-muted)" }}>
              Rank {i + 1}
              <input
                type="number"
                value={w}
                disabled={!canEdit}
                onChange={(e) => {
                  const next = [...weightsDraft];
                  next[i] = e.target.value;
                  setWeightsDraft(next);
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
                const len = weightsDraft.length;
                const reset = Array.from({ length: len }, (_, i) => len - i);
                if (debounceRef.current) clearTimeout(debounceRef.current);
                setWeightsDraft(reset.map(String));
                onSaveWeights(reset);
              }}
              className="btn-ghost rounded-button px-3 py-2 text-xs"
            >
              Reset to {weightsDraft.length},{Math.max(1, weightsDraft.length - 1)},…,1
            </button>
          )}
        </div>
      </SectionCard>

    </div>
  );
}
