"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AnalysisSideCard } from "./AnalysisSideCard";
import type { PickerQuestion } from "./AnalysisQuestionPicker";
import {
  COMPARISON_OPERATIONS,
  OP_LABEL,
  SUMMARY_OPERATIONS,
  compatibleQuestionsFor,
  type AnalysisOperation,
  type AnalysisSide,
  type AnalysisType,
  type AnalysisResult,
} from "@/lib/surveys/analyses";
import type { QuestionMeta } from "@/lib/surveys/distributions";

const MAX_SIDES = 4;

export interface AnalysisFormInitial {
  id?: string;
  title?: string;
  type?: AnalysisType;
  operation?: AnalysisOperation;
  sides?: AnalysisSide[];
  chartKey?: string;
}

interface AnalysisFormProps {
  sessionId: string;
  questions: QuestionMeta[];
  initial?: AnalysisFormInitial;
  onSaved: (analysis: AnalysisResult) => void;
  onClose: () => void;
}

interface FormSide {
  id: string;
  label: string;
  questionIds: string[];
}

export function AnalysisForm({
  sessionId,
  questions,
  initial,
  onSaved,
  onClose,
}: AnalysisFormProps) {
  const isEdit = !!initial?.id;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<AnalysisType>(initial?.type ?? "summary");
  const [operation, setOperation] = useState<AnalysisOperation>(
    initial?.operation ?? "mc-average"
  );
  const [sides, setSides] = useState<FormSide[]>(
    initial?.sides && initial.sides.length > 0
      ? initial.sides.map((s) => ({
          id: s.id,
          label: s.label,
          // Dedupe — older analyses can carry the same id twice, which would
          // collapse via React's `key` and hide the duplicate pill while still
          // being submitted to the server.
          questionIds: Array.from(new Set(s.questionIds)),
        }))
      : type === "summary"
        ? [{ id: makeId(), label: "", questionIds: [] }]
        : [
            { id: makeId(), label: "Side A", questionIds: [] },
            { id: makeId(), label: "Side B", questionIds: [] },
          ]
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const operationOptions = type === "summary" ? SUMMARY_OPERATIONS : COMPARISON_OPERATIONS;

  // Schema baseline = the first already-selected question across all sides.
  const baselineQuestion = useMemo<QuestionMeta | null>(() => {
    for (const s of sides) {
      for (const qid of s.questionIds) {
        const q = questions.find((x) => x.id === qid);
        if (q) return q;
      }
    }
    return null;
  }, [sides, questions]);

  const compatibility = useMemo(
    () => compatibleQuestionsFor(operation, baselineQuestion, questions),
    [operation, baselineQuestion, questions]
  );

  const pickerQuestions: PickerQuestion[] = useMemo(
    () =>
      questions
        .filter((q) => q.type !== "intro")
        .map((q, idx) => ({ id: q.id, title: q.title, type: q.type, order: idx + 1 })),
    [questions]
  );

  function switchType(next: AnalysisType) {
    if (next === type) return;
    const hasPicks = sides.some((s) => s.questionIds.length > 0);
    if (hasPicks) {
      if (!confirm("Switching type clears your current picks. Continue?")) return;
    }
    setType(next);
    setOperation(next === "summary" ? "mc-average" : "delta-2");
    setSides(
      next === "summary"
        ? [{ id: makeId(), label: "", questionIds: [] }]
        : [
            { id: makeId(), label: "Side A", questionIds: [] },
            { id: makeId(), label: "Side B", questionIds: [] },
          ]
    );
  }

  function changeOperation(next: AnalysisOperation) {
    if (next === operation) return;
    const hasPicks = sides.some((s) => s.questionIds.length > 0);
    if (hasPicks) {
      if (!confirm("Switching operation clears your current picks. Continue?")) return;
    }
    setOperation(next);
    setSides((prev) => prev.map((s) => ({ ...s, questionIds: [] })));
  }

  function toggleQuestion(sideId: string, questionId: string) {
    setSides((prev) =>
      prev.map((s) => {
        if (s.id === sideId) {
          const has = s.questionIds.includes(questionId);
          return {
            ...s,
            questionIds: has
              ? s.questionIds.filter((qid) => qid !== questionId)
              : [...s.questionIds, questionId],
          };
        }
        // Question can only be in one side at a time.
        return {
          ...s,
          questionIds: s.questionIds.filter((qid) => qid !== questionId),
        };
      })
    );
  }

  function changeLabel(sideId: string, label: string) {
    setSides((prev) => prev.map((s) => (s.id === sideId ? { ...s, label } : s)));
  }

  function addSide() {
    if (sides.length >= MAX_SIDES) return;
    const next = String.fromCharCode(65 + sides.length);
    setSides((prev) => [...prev, { id: makeId(), label: `Side ${next}`, questionIds: [] }]);
  }

  function deleteSide(sideId: string) {
    setSides((prev) => prev.filter((s) => s.id !== sideId));
  }

  async function handleSave() {
    if (saving) return;
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (type === "comparison" && sides.length < 2) {
      setError("Comparison needs at least two sides");
      return;
    }
    if (sides.some((s) => s.questionIds.length === 0)) {
      setError("Each side needs at least one question");
      return;
    }

    const payload = {
      title: title.trim(),
      type,
      operation,
      sides: sides.map((s) => ({ id: s.id, label: s.label, questionIds: s.questionIds })),
      chartKey: initial?.chartKey,
    };

    setSaving(true);
    setError(null);
    try {
      const url = isEdit
        ? `/api/surveys/sessions/${sessionId}/analyses/${initial!.id}`
        : `/api/surveys/sessions/${sessionId}/analyses`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(humanizeError(body.error ?? "Could not save analysis", pickerQuestions));
        return;
      }
      const body = await res.json();
      onSaved(body.analysis ?? body);
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="typo-label" style={{ color: "var(--text-muted)" }}>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Drive vs Pilot average"
          className="w-full rounded-button border px-3 py-2 text-sm"
          style={{
            background: "var(--bg-sidebar)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      <div>
        <label className="typo-label" style={{ color: "var(--text-muted)" }}>Type</label>
        <div className="inline-flex gap-1.5">
          <SegmentedPill active={type === "summary"} onClick={() => switchType("summary")}>
            Summary
          </SegmentedPill>
          <SegmentedPill active={type === "comparison"} onClick={() => switchType("comparison")}>
            Comparison
          </SegmentedPill>
        </div>
      </div>

      <div>
        <label className="typo-label" style={{ color: "var(--text-muted)" }}>Operation</label>
        <div className="flex flex-wrap gap-1.5">
          {operationOptions.map((op) => (
            <SegmentedPill key={op} active={operation === op} onClick={() => changeOperation(op)}>
              {OP_LABEL[op]}
            </SegmentedPill>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="typo-label" style={{ color: "var(--text-muted)" }}>
          {type === "summary" ? "Questions" : "Sides"}
        </label>
        {sides.map((s, idx) => (
          <AnalysisSideCard
            key={s.id}
            side={s}
            index={idx}
            totalSides={sides.length}
            allowDelete={type === "comparison" && sides.length > 2}
            questions={pickerQuestions}
            compatibility={compatibility}
            onChangeLabel={(label) => changeLabel(s.id, label)}
            onToggleQuestion={(qid) => toggleQuestion(s.id, qid)}
            onDelete={() => deleteSide(s.id)}
          />
        ))}
        {type === "comparison" && (
          <div>
            {sides.length < MAX_SIDES ? (
              <button
                type="button"
                onClick={addSide}
                className="btn-border border inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-sm"
                style={{ borderColor: "var(--border)" }}
              >
                <Plus size={12} />
                Add side
              </button>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Up to {MAX_SIDES} sides
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <div
        className="flex items-center justify-end gap-2 pt-4 border-t sticky bottom-0 -mx-6 px-6 py-4"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <button type="button" onClick={onClose} className="btn-ghost px-3 py-1.5 rounded-button text-sm">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary px-3 py-1.5 rounded-button text-sm disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save analysis"}
        </button>
      </div>
    </div>
  );
}

function SegmentedPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-button border px-2.5 py-1 text-xs font-medium transition-colors"
      style={{
        background: active ? "var(--primary-light)" : "var(--bg-surface)",
        borderColor: active ? "var(--primary)" : "var(--border)",
        color: active ? "var(--primary)" : "var(--text-muted)",
      }}
    >
      {children}
    </button>
  );
}

function makeId(): string {
  return `s-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Decorate server-side errors with the matching question title when we can
 * resolve the id locally. Helps troubleshoot stale-id mismatches between the
 * client's loaded snapshot and the server-side snapshot.
 */
function humanizeError(message: string, picker: PickerQuestion[]): string {
  const match = /Question ([\w-]+) not found in this survey/i.exec(message);
  if (!match) return message;
  const qid = match[1];
  const q = picker.find((x) => x.id === qid);
  if (!q) {
    return `Question id ${qid} is in this analysis but is no longer in the survey snapshot. Open the form and click × on the red "Missing question" pill to remove it.`;
  }
  return `Server rejected question "Q${q.order ?? "?"} — ${q.title || "(untitled)"}" (id ${qid}). The client and server snapshots disagree on this id. Try a hard refresh; if the error persists the dev server may need to restart.`;
}
