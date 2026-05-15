"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { AnalysisQuestionPicker, type PickerQuestion } from "./AnalysisQuestionPicker";
import type { CompatibilityResult } from "@/lib/surveys/analyses";

// Sort by the question's `order` field (Q1, Q2, …). Unknown / stale ids go to
// the end so they remain visible and clickable to remove.
function sortByQuestionOrder(
  ids: string[],
  byId: Map<string, PickerQuestion>
): string[] {
  return [...ids].sort((a, b) => {
    const oa = byId.get(a)?.order ?? Number.MAX_SAFE_INTEGER;
    const ob = byId.get(b)?.order ?? Number.MAX_SAFE_INTEGER;
    return oa - ob;
  });
}

interface AnalysisSideCardProps {
  side: { id: string; label: string; questionIds: string[] };
  index: number;
  totalSides: number;
  allowDelete: boolean;
  questions: PickerQuestion[];
  compatibility: CompatibilityResult[];
  onChangeLabel: (label: string) => void;
  onToggleQuestion: (questionId: string) => void;
  onDelete: () => void;
}

export function AnalysisSideCard({
  side,
  index,
  totalSides,
  allowDelete,
  questions,
  compatibility,
  onChangeLabel,
  onToggleQuestion,
  onDelete,
}: AnalysisSideCardProps) {
  const [pickerOpen, setPickerOpen] = useState(side.questionIds.length === 0);
  const placeholder = `Side ${String.fromCharCode(65 + index)}`;

  const questionsById = new Map(questions.map((q) => [q.id, q]));

  return (
    <div
      className="rounded-card border p-3 space-y-3"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={side.label}
          onChange={(e) => onChangeLabel(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-button border px-2.5 py-1.5 text-sm font-medium"
          style={{
            background: "var(--bg-sidebar)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        />
        {allowDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="btn-icon p-1.5"
            title="Remove side"
            aria-label="Remove side"
          >
            <Trash2 size={13} />
          </button>
        )}
        <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
          {index + 1}/{totalSides}
        </span>
      </div>

      {side.questionIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sortByQuestionOrder(side.questionIds, questionsById).map((qid, pillIdx) => {
            const q = questionsById.get(qid);
            const missing = !q;
            return (
              <span
                key={`${qid}-${pillIdx}`}
                className="inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-xs"
                style={{
                  background: missing ? "var(--danger-light)" : "var(--primary-light)",
                  color: missing ? "var(--danger)" : "var(--primary)",
                }}
                title={
                  missing
                    ? `Question no longer in this survey — remove to save (id: ${qid})`
                    : q?.title
                }
              >
                <span className="tabular-nums">
                  {missing
                    ? "Missing question"
                    : typeof q?.order === "number"
                      ? `Q${q.order}`
                      : (q?.title ?? qid)}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleQuestion(qid)}
                  className="hover:opacity-70"
                  aria-label={`Remove ${q?.title ?? qid}`}
                >
                  <X size={11} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {pickerOpen ? (
        <AnalysisQuestionPicker
          questions={questions}
          selectedIds={side.questionIds}
          compatibility={compatibility}
          onToggle={onToggleQuestion}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="btn-tertiary inline-flex items-center gap-1 text-xs"
          style={{ color: "var(--primary)" }}
        >
          + Add question
        </button>
      )}
    </div>
  );
}
