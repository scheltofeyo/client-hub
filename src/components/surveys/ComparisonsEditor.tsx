"use client";

import { ArrowLeftRight, Plus, Trash2 } from "lucide-react";

export interface Comparison {
  id: string;
  label: string;
  leftLabel: string;
  rightLabel: string;
  leftQuestionIds: string[];
  rightQuestionIds: string[];
  order: number;
}

export interface ComparisonSection {
  id: string;
  title: string;
  questions: { id: string; title: string }[];
}

const input = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = { background: "var(--bg-sidebar)", borderColor: "var(--border)", color: "var(--text-primary)" };

export default function ComparisonsEditor({
  comparisons,
  sections,
  onChange,
  emptyHint = "No comparisons yet. Add one to define a To-be vs As-is view.",
}: {
  comparisons: Comparison[];
  sections: ComparisonSection[];
  onChange: (next: Comparison[]) => void;
  emptyHint?: string;
}) {
  function addComparison() {
    const next: Comparison = {
      id: crypto.randomUUID(),
      label: "New comparison",
      leftLabel: "To-be",
      rightLabel: "As-is",
      leftQuestionIds: [],
      rightQuestionIds: [],
      order: comparisons.length,
    };
    onChange([...comparisons, next]);
  }

  function updateComparison(comparisonId: string, updates: Partial<Comparison>) {
    onChange(comparisons.map((c) => (c.id === comparisonId ? { ...c, ...updates } : c)));
  }

  function toggleQuestion(comparisonId: string, questionId: string, side: "left" | "right") {
    const c = comparisons.find((x) => x.id === comparisonId);
    if (!c) return;
    const leftSet = new Set(c.leftQuestionIds);
    const rightSet = new Set(c.rightQuestionIds);
    if (side === "left") {
      if (leftSet.has(questionId)) leftSet.delete(questionId);
      else {
        leftSet.add(questionId);
        rightSet.delete(questionId);
      }
    } else {
      if (rightSet.has(questionId)) rightSet.delete(questionId);
      else {
        rightSet.add(questionId);
        leftSet.delete(questionId);
      }
    }
    updateComparison(comparisonId, {
      leftQuestionIds: [...leftSet],
      rightQuestionIds: [...rightSet],
    });
  }

  function deleteComparison(comparisonId: string) {
    if (!confirm("Delete this comparison?")) return;
    onChange(comparisons.filter((c) => c.id !== comparisonId));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="typo-section-title" style={{ color: "var(--text-primary)" }}>Gap comparisons</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Link two sets of questions to render a side-by-side comparison on the results page.
          </p>
        </div>
        <button
          onClick={addComparison}
          className="btn-secondary border inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <Plus size={12} />
          Add comparison
        </button>
      </div>
      {comparisons.length === 0 && (
        <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
          {emptyHint}
        </p>
      )}
      {comparisons.map((c) => (
        <div key={c.id} className="rounded-lg border p-4 mb-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <ArrowLeftRight size={14} style={{ color: "var(--primary)" }} />
            <input
              className={`${input} font-medium`}
              style={inputStyle}
              placeholder="Comparison label (e.g. To-be vs As-is Leadership)"
              value={c.label}
              onChange={(e) => updateComparison(c.id, { label: e.target.value })}
            />
            <button
              onClick={() => deleteComparison(c.id)}
              className="btn-icon p-2 hover:!text-[var(--danger)]"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              Left label
              <input
                className={`${input} mt-1`}
                style={inputStyle}
                value={c.leftLabel}
                onChange={(e) => updateComparison(c.id, { leftLabel: e.target.value })}
              />
            </label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              Right label
              <input
                className={`${input} mt-1`}
                style={inputStyle}
                value={c.rightLabel}
                onChange={(e) => updateComparison(c.id, { rightLabel: e.target.value })}
              />
            </label>
          </div>
          <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            Assign questions to left or right
          </p>
          <div className="space-y-2">
            {sections.map((s) => {
              if (s.questions.length === 0) return null;
              return (
                <div key={s.id}>
                  <p className="typo-section-header mb-1" style={{ color: "var(--text-muted)" }}>{s.title}</p>
                  {s.questions.map((q) => {
                    const leftOn = c.leftQuestionIds.includes(q.id);
                    const rightOn = c.rightQuestionIds.includes(q.id);
                    return (
                      <div key={q.id} className="flex items-center gap-2 py-1 text-xs">
                        <span className="flex-1 truncate" style={{ color: "var(--text-primary)" }}>
                          {q.title}
                        </span>
                        <button
                          onClick={() => toggleQuestion(c.id, q.id, "left")}
                          className="px-2 py-0.5 rounded border"
                          style={{
                            background: leftOn ? "var(--primary-light)" : "transparent",
                            color: leftOn ? "var(--primary)" : "var(--text-muted)",
                            borderColor: leftOn ? "var(--primary)" : "var(--border)",
                          }}
                        >
                          {leftOn ? `← ${c.leftLabel}` : c.leftLabel}
                        </button>
                        <button
                          onClick={() => toggleQuestion(c.id, q.id, "right")}
                          className="px-2 py-0.5 rounded border"
                          style={{
                            background: rightOn ? "var(--primary-light)" : "transparent",
                            color: rightOn ? "var(--primary)" : "var(--text-muted)",
                            borderColor: rightOn ? "var(--primary)" : "var(--border)",
                          }}
                        >
                          {rightOn ? `${c.rightLabel} →` : c.rightLabel}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
