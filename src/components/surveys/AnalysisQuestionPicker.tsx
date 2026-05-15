"use client";

import { useMemo, useState } from "react";
import { Lock, Plus, Check } from "lucide-react";
import type { CompatibilityResult } from "@/lib/surveys/analyses";

export interface PickerQuestion {
  id: string;
  title: string;
  type: string;
  sectionTitle?: string;
  /** 1-based question number for short labels like "Q3". Optional — when
   * omitted the picker falls back to the full title. */
  order?: number;
}

interface AnalysisQuestionPickerProps {
  questions: PickerQuestion[];
  selectedIds: string[];
  compatibility: CompatibilityResult[];
  onToggle: (questionId: string) => void;
  emptyHint?: string;
}

/**
 * Searchable list of questions with dim/lock states for incompatible items.
 * Inline italic microcopy on the right communicates the reason; no tooltip.
 */
export function AnalysisQuestionPicker({
  questions,
  selectedIds,
  compatibility,
  onToggle,
  emptyHint = "No questions match this operation yet.",
}: AnalysisQuestionPickerProps) {
  const [filter, setFilter] = useState("");
  const compatById = useMemo(
    () => new Map(compatibility.map((c) => [c.id, c])),
    [compatibility]
  );

  const filtered = useMemo(() => {
    const lower = filter.trim().toLowerCase();
    if (!lower) return questions;
    return questions.filter((q) => q.title.toLowerCase().includes(lower));
  }, [questions, filter]);

  const visible = filtered;
  const noCompatible = compatibility.every((c) => !c.compatible);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter questions…"
        className="w-full rounded-button border px-3 py-1.5 text-xs"
        style={{
          background: "var(--bg-sidebar)",
          borderColor: "var(--border)",
          color: "var(--text-primary)",
        }}
      />
      {noCompatible && (
        <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
          {emptyHint}
        </p>
      )}
      <ul className="space-y-0.5 max-h-80 overflow-y-auto">
        {visible.map((q) => {
          const compat = compatById.get(q.id);
          const isSelected = selectedIds.includes(q.id);
          const compatible = compat?.compatible ?? false;
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => compatible && onToggle(q.id)}
                disabled={!compatible}
                className="w-full flex items-center justify-between gap-2 py-1.5 px-2 rounded-button text-left transition-colors hover:bg-hover disabled:cursor-not-allowed"
                style={{ opacity: compatible ? 1 : 0.5 }}
              >
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className="w-4 h-4 rounded-sm border flex items-center justify-center shrink-0"
                    style={{
                      borderColor: isSelected ? "var(--primary)" : "var(--border)",
                      background: isSelected ? "var(--primary)" : "transparent",
                    }}
                    aria-hidden="true"
                  >
                    {isSelected && <Check size={11} style={{ color: "var(--bg-surface)" }} />}
                  </span>
                  <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
                    {typeof q.order === "number" && (
                      <span
                        className="tabular-nums mr-1.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Q{q.order}.
                      </span>
                    )}
                    {q.title || "(untitled)"}
                  </span>
                </span>
                {!compatible && compat?.reason && (
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                      {compat.reason}
                    </span>
                    <Lock size={11} style={{ color: "var(--text-muted)" }} aria-hidden="true" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AddQuestionAffordance({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-tertiary inline-flex items-center gap-1 text-xs px-1.5 py-1"
      style={{ color: "var(--primary)" }}
    >
      <Plus size={12} />
      Add question
    </button>
  );
}
