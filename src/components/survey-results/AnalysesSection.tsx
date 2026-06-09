"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AnalysisCard } from "./AnalysisCard";
import { describeAnalysisFromConfig } from "./AnalysisAutoDescription";
import type { AnalysisResult } from "@/lib/surveys/analyses";
import type { QuestionResult } from "./types";

interface AnalysesSectionProps {
  analyses: AnalysisResult[];
  questions: QuestionResult[];
  canEdit: boolean;
  onCreate?: () => void;
  onEdit?: (analysis: AnalysisResult) => void;
  onDuplicate?: (analysis: AnalysisResult) => void;
  onDelete?: (analysis: AnalysisResult) => void;
  onMoveUp?: (analysis: AnalysisResult) => void;
  onMoveDown?: (analysis: AnalysisResult) => void;
}

export function AnalysesSection({
  analyses,
  questions,
  canEdit,
  onCreate,
  onEdit,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: AnalysesSectionProps) {
  const showCreate = canEdit && !!onCreate;
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

  if (analyses.length === 0 && !showCreate) return null;

  const questionsById = new Map<string, { title: string; type: QuestionResult["type"] }>(
    questions.map((q) => [q.questionId, { title: q.title, type: q.type }])
  );

  function toggle(id: string) {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAll(state: boolean) {
    setVisibleIds(state ? new Set(analyses.map((a) => a.id)) : new Set());
  }

  const visibleAnalyses = analyses.filter((a) => visibleIds.has(a.id));
  const allOn = visibleIds.size === analyses.length && analyses.length > 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2
          className="typo-section-header"
          style={{ color: "var(--text-muted)" }}
        >
          Custom analyses
        </h2>
        {showCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="btn-border border inline-flex items-center gap-1.5 rounded-button px-3 py-1.5 text-xs font-medium"
          >
            <Plus size={13} />
            New analysis
          </button>
        )}
      </div>

      {analyses.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {analyses.map((a) => {
            const active = visibleIds.has(a.id);
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(a.id)}
                className="rounded-button border px-4 py-2 text-xs font-medium transition-colors max-w-[18rem] truncate"
                style={{
                  background: active ? "var(--primary-light)" : "var(--bg-surface)",
                  borderColor: active ? "var(--primary)" : "var(--border)",
                  color: active ? "var(--primary)" : "var(--text-muted)",
                }}
                title={a.title || "(untitled)"}
              >
                {a.title || "(untitled)"}
              </button>
            );
          })}
          {analyses.length > 1 && (
            <button
              type="button"
              onClick={() => setAll(!allOn)}
              className="btn-link text-xs ml-1"
            >
              {allOn ? "Hide all" : "Show all"}
            </button>
          )}
        </div>
      )}

      {analyses.length > 0 && visibleAnalyses.length === 0 && (
        <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
          Selecteer een analyse hierboven om te tonen.
        </p>
      )}

      {visibleAnalyses.map((a) => {
        const idx = analyses.indexOf(a);
        const description = describeAnalysisFromConfig(
          {
            type: a.type,
            operation: a.operation,
            sides: a.sides.map((s) => ({ label: s.label, questionIds: s.questionIds })),
          },
          questionsById
        );
        return (
          <AnalysisCard
            key={a.id}
            analysis={a}
            description={description}
            canEdit={canEdit}
            isFirst={idx === 0}
            isLast={idx === analyses.length - 1}
            onEdit={onEdit ? () => onEdit(a) : undefined}
            onDuplicate={onDuplicate ? () => onDuplicate(a) : undefined}
            onDelete={onDelete ? () => onDelete(a) : undefined}
            onMoveUp={onMoveUp ? () => onMoveUp(a) : undefined}
            onMoveDown={onMoveDown ? () => onMoveDown(a) : undefined}
          />
        );
      })}

    </section>
  );
}
