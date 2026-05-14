"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import ShuttlePicker, { type ShuttleQuestion } from "./ShuttlePicker";
import ComparisonHealthPill, { deriveComparisonHealth } from "./ComparisonHealthPill";
import type { ArchetypeLite } from "./ArchetypePill";
import type { ResultsData } from "@/components/survey-results/types";

export interface ComparisonShape {
  id: string;
  label: string;
  leftLabel: string;
  rightLabel: string;
  leftQuestionIds: string[];
  rightQuestionIds: string[];
  order: number;
}

export interface ConfigureSessionMeta {
  templateSnapshot: {
    rankWeights: number[];
    sections: { id: string; title: string; questions: { id: string; title: string }[] }[];
    comparisons: ComparisonShape[];
  };
  sessionComparisons: ComparisonShape[];
}

interface ConfigureSheetProps {
  meta: ConfigureSessionMeta;
  results: ResultsData;
  effectiveComparisons: ComparisonShape[];
  canEdit: boolean;
  onSaveWeights: (next: number[]) => Promise<boolean>;
  onSaveComparisons: (next: ComparisonShape[]) => Promise<boolean>;
}

const WEIGHT_DEBOUNCE_MS = 600;

/**
 * Settings tab content for tuning ranking weights and gap-comparison
 * definitions. Owns its own draft state so the parent's loadSession
 * polling can't reset the user's in-progress edits. Weights are
 * debounce-saved on change; reset button + Reset shortcut still work.
 */
export function ConfigureSheet({
  meta,
  results,
  effectiveComparisons,
  canEdit,
  onSaveWeights,
  onSaveComparisons,
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
  const archetypeLites: ArchetypeLite[] = useMemo(
    () =>
      meta.templateSnapshot.sections.length > 0
        ? results.archetypes.map((a) => ({ id: a.id, name: a.name, color: a.color }))
        : [],
    [meta, results]
  );

  const shuttleQuestions: ShuttleQuestion[] = useMemo(
    () =>
      meta.templateSnapshot.sections.flatMap((s) =>
        s.questions.map((q) => ({
          id: q.id,
          title: q.title || "(untitled question)",
          sectionId: s.id,
          sectionTitle: s.title || "(untitled section)",
        }))
      ),
    [meta]
  );

  const perQuestionPercentages = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const q of results.perQuestion) {
      if (q.type !== "archetype-ranking") continue;
      const inner: Record<string, number> = {};
      for (const a of q.archetypes) inner[a.archetypeId] = a.percentage;
      map[q.questionId] = inner;
    }
    return map;
  }, [results]);

  const knownQuestionIds = useMemo(
    () => new Set(meta.templateSnapshot.sections.flatMap((s) => s.questions.map((q) => q.id))),
    [meta]
  );

  function updateComparison(comparisonId: string, updates: Partial<ComparisonShape>) {
    const next = effectiveComparisons.map((c) =>
      c.id === comparisonId ? { ...c, ...updates } : c
    );
    onSaveComparisons(next);
  }
  function addComparison() {
    const newComparison: ComparisonShape = {
      id: crypto.randomUUID(),
      label: "New comparison",
      leftLabel: "To-be",
      rightLabel: "As-is",
      leftQuestionIds: [],
      rightQuestionIds: [],
      order: effectiveComparisons.length,
    };
    onSaveComparisons([...effectiveComparisons, newComparison]);
  }
  function deleteComparison(comparisonId: string) {
    if (!confirm("Delete this comparison?")) return;
    onSaveComparisons(effectiveComparisons.filter((c) => c.id !== comparisonId));
  }

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

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="typo-section-title" style={{ color: "var(--text-primary)" }}>
            Gap comparisons
          </h2>
          {canEdit && (
            <button
              type="button"
              onClick={addComparison}
              className="btn-secondary border inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-sm"
              style={{ borderColor: "var(--border)" }}
            >
              <Plus size={12} />
              Add comparison
            </button>
          )}
        </div>
        {effectiveComparisons.length === 0 ? (
          <SectionCard>
            <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
              No comparisons yet. Add one to define a To-be vs As-is view.
            </p>
          </SectionCard>
        ) : (
          effectiveComparisons.map((c) => {
            const { health } = deriveComparisonHealth({
              leftQuestionIds: c.leftQuestionIds,
              rightQuestionIds: c.rightQuestionIds,
              knownQuestionIds,
            });
            return (
              <SectionCard
                key={c.id}
                breadcrumb="Gap comparison"
                title={c.label || "Untitled comparison"}
                action={
                  <div className="flex items-center gap-2">
                    <ComparisonHealthPill health={health} />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => deleteComparison(c.id)}
                        className="btn-icon-danger"
                        aria-label="Delete comparison"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                }
              >
                <div className="space-y-4">
                  <div>
                    <label className="typo-label">Comparison label</label>
                    <input
                      type="text"
                      defaultValue={c.label}
                      disabled={!canEdit}
                      onBlur={(e) => {
                        if (e.target.value !== c.label) updateComparison(c.id, { label: e.target.value });
                      }}
                      placeholder="e.g. Leadership: To-be vs As-is"
                      className="input"
                    />
                  </div>
                  <ShuttlePicker
                    key={c.id}
                    questions={shuttleQuestions}
                    leftQuestionIds={c.leftQuestionIds}
                    rightQuestionIds={c.rightQuestionIds}
                    onChange={(next) =>
                      updateComparison(c.id, {
                        leftQuestionIds: next.leftQuestionIds,
                        rightQuestionIds: next.rightQuestionIds,
                      })
                    }
                    leftLabel={c.leftLabel}
                    rightLabel={c.rightLabel}
                    onLeftLabelChange={
                      canEdit
                        ? (v) => v !== c.leftLabel && updateComparison(c.id, { leftLabel: v })
                        : undefined
                    }
                    onRightLabelChange={
                      canEdit
                        ? (v) => v !== c.rightLabel && updateComparison(c.id, { rightLabel: v })
                        : undefined
                    }
                    archetypes={archetypeLites}
                    perQuestionPercentages={perQuestionPercentages}
                  />
                </div>
              </SectionCard>
            );
          })
        )}
      </section>
    </div>
  );
}
