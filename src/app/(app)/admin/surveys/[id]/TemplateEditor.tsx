"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import SurveyEditorShell, {
  type ShellSection,
  type ShellComparison,
} from "@/components/surveys/SurveyEditorShell";
import type { OutlineSelection } from "@/components/surveys/EditorOutline";
import type { SaveState } from "@/components/surveys/SaveStateChip";
import type { ShellQuestionAny } from "@/components/surveys/question-types";
import type { SurveyQuestionType } from "@/lib/surveys/types";
import type { SerializedQuestion } from "@/lib/surveys/serializers";
import type { Archetype } from "@/types";

type ClosingOpenQuestion = { enabled: boolean; label: string };
type SectionOpenQuestion = { enabled: boolean; label: string };

interface TemplateData {
  name: string;
  description: string;
  status: string;
  archetypeIds: string[];
  defaultRankWeights: number[];
  closingOpenQuestion: ClosingOpenQuestion;
  comparisons: ShellComparison[];
}

interface SectionRow {
  id: string;
  title: string;
  description: string;
  openQuestion: SectionOpenQuestion;
  order: number;
}

type QuestionRow = SerializedQuestion & { order: number };

function toShellQuestion(q: QuestionRow): ShellQuestionAny {
  const base = { id: q.id, title: q.title, description: q.description };
  switch (q.type) {
    case "archetype-ranking":
      return { ...base, type: "archetype-ranking", options: q.options ?? [] };
    case "general-ranking":
      return { ...base, type: "general-ranking", rankingItems: q.rankingItems ?? [] };
    case "multiple-choice":
      return {
        ...base,
        type: "multiple-choice",
        choiceMode: q.choiceMode ?? "single",
        choices: q.choices ?? [],
        maxSelections: q.maxSelections,
      };
    case "open-text":
      return {
        ...base,
        type: "open-text",
        placeholder: q.placeholder,
        multiline: q.multiline,
        required: q.required,
      };
    case "intro":
      return { ...base, type: "intro", bodyHtml: q.bodyHtml };
  }
}

export default function TemplateEditor({
  templateId,
  initialTemplate,
  initialSections,
  initialQuestions,
  archetypes,
}: {
  templateId: string;
  initialTemplate: TemplateData;
  initialSections: SectionRow[];
  initialQuestions: QuestionRow[];
  archetypes: Archetype[];
}) {
  const router = useRouter();
  const [template, setTemplate] = useState(initialTemplate);
  const [sections, setSections] = useState(initialSections);
  const [questions, setQuestions] = useState(initialQuestions);
  const [selected, setSelected] = useState<OutlineSelection>({ kind: "header" });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState<number | null>(null);

  // Fetch downstream-impact info for the mode chip subtitle.
  useEffect(() => {
    let alive = true;
    fetch(`/api/surveys/templates/${templateId}/usage`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data && typeof data.sessionCount === "number") {
          setSessionCount(data.sessionCount);
        }
      });
    return () => {
      alive = false;
    };
  }, [templateId]);

  // ── Save wrapper ────────────────────────────────────────────────
  const withSave = useCallback(
    async (op: () => Promise<Response>): Promise<Response | null> => {
      setSaveState("saving");
      try {
        const res = await op();
        if (!res.ok) {
          const data = await res.json().catch(() => ({} as { error?: string }));
          setError(data.error ?? "Save failed");
          setSaveState("error");
          return null;
        }
        setSaveState("saved");
        setSavedAt(Date.now());
        setError(null);
        return res;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
        setSaveState("error");
        return null;
      }
    },
    []
  );

  // ── Template-level mutations ────────────────────────────────────
  function patchTemplate(updates: Partial<TemplateData>) {
    return withSave(() =>
      fetch(`/api/surveys/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
    );
  }

  function handleChangeName(name: string) {
    setTemplate((prev) => ({ ...prev, name }));
    patchTemplate({ name });
  }
  function handleChangeDescription(description: string) {
    setTemplate((prev) => ({ ...prev, description }));
    patchTemplate({ description });
  }
  function handleChangeClosing(co: ClosingOpenQuestion) {
    setTemplate((prev) => ({ ...prev, closingOpenQuestion: co }));
    patchTemplate({ closingOpenQuestion: co });
  }
  function handleChangeStatus(status: string) {
    setTemplate((prev) => ({ ...prev, status }));
    patchTemplate({ status });
  }
  function handleToggleArchetype(archetypeId: string) {
    const next = template.archetypeIds.includes(archetypeId)
      ? template.archetypeIds.filter((x) => x !== archetypeId)
      : [...template.archetypeIds, archetypeId];
    if (next.length < 2) {
      setError("At least 2 archetypes are required");
      setSaveState("error");
      return;
    }
    const newWeights =
      next.length === template.defaultRankWeights.length
        ? template.defaultRankWeights
        : Array.from({ length: next.length }, (_, i) => next.length - i);
    setTemplate((prev) => ({ ...prev, archetypeIds: next, defaultRankWeights: newWeights }));
    patchTemplate({ archetypeIds: next, defaultRankWeights: newWeights });
  }

  // ── Section mutations ───────────────────────────────────────────
  async function handleAddSection() {
    const res = await withSave(() =>
      fetch(`/api/surveys/templates/${templateId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New section" }),
      })
    );
    if (!res) return;
    const created = await res.json();
    const newSection: SectionRow = {
      id: created.id,
      title: created.title,
      description: created.description ?? "",
      openQuestion: created.openQuestion ?? { enabled: false, label: "" },
      order: created.order ?? sections.length,
    };
    setSections((prev) => [...prev, newSection]);
    setSelected({ kind: "section", id: newSection.id });
  }

  function handleUpdateSection(sectionId: string, updates: Partial<ShellSection>) {
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              title: updates.title ?? s.title,
              description: updates.description ?? s.description,
              openQuestion: updates.openQuestion ?? s.openQuestion,
            }
      )
    );
    const apiUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) apiUpdates.title = updates.title;
    if (updates.description !== undefined) apiUpdates.description = updates.description;
    if (updates.openQuestion !== undefined) apiUpdates.openQuestion = updates.openQuestion;
    withSave(() =>
      fetch(`/api/surveys/templates/${templateId}/sections/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiUpdates),
      })
    );
  }

  function handleDeleteSection(sectionId: string) {
    const sectionQuestionIds = new Set(
      questions.filter((q) => q.sectionId === sectionId).map((q) => q.id)
    );
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    setQuestions((prev) => prev.filter((q) => q.sectionId !== sectionId));

    // Strip orphaned question IDs from comparisons
    const nextComparisons = template.comparisons.map((c) => ({
      ...c,
      leftQuestionIds: c.leftQuestionIds.filter((qid) => !sectionQuestionIds.has(qid)),
      rightQuestionIds: c.rightQuestionIds.filter((qid) => !sectionQuestionIds.has(qid)),
    }));
    if (JSON.stringify(nextComparisons) !== JSON.stringify(template.comparisons)) {
      setTemplate((prev) => ({ ...prev, comparisons: nextComparisons }));
      patchTemplate({ comparisons: nextComparisons });
    }

    // Move selection to a sensible default
    if (
      (selected.kind === "section" && selected.id === sectionId) ||
      (selected.kind === "question" && selected.sectionId === sectionId)
    ) {
      setSelected({ kind: "header" });
    }

    withSave(() =>
      fetch(`/api/surveys/templates/${templateId}/sections/${sectionId}`, {
        method: "DELETE",
      })
    );
  }

  function handleReorderSections(ids: string[]) {
    setSections((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]));
      return ids.map((id, i) => ({ ...(byId.get(id) as SectionRow), order: i }));
    });
    withSave(() =>
      fetch(`/api/surveys/templates/${templateId}/sections`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
    );
  }

  // ── Question mutations ──────────────────────────────────────────
  async function handleAddQuestion(sectionId: string, type: SurveyQuestionType) {
    if (type === "archetype-ranking" && template.archetypeIds.length < 2) {
      setError("Pick at least 2 archetypes first");
      setSaveState("error");
      return;
    }
    const titleByType: Record<SurveyQuestionType, string> = {
      "archetype-ranking": "New question",
      "general-ranking": "New ranking question",
      "multiple-choice": "New choice question",
      "open-text": "New open question",
      intro: "",
    };
    const res = await withSave(() =>
      fetch(`/api/surveys/templates/${templateId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId,
          type,
          title: titleByType[type],
        }),
      })
    );
    if (!res) return;
    const created = (await res.json()) as SerializedQuestion;
    const newQuestion: QuestionRow = { ...created, order: created.order ?? 0 };
    setQuestions((prev) => [...prev, newQuestion]);
    setSelected({ kind: "question", sectionId, id: newQuestion.id });
  }

  function handleUpdateQuestion(
    sectionId: string,
    questionId: string,
    updates: Partial<ShellQuestionAny>
  ) {
    setQuestions((prev) =>
      prev.map((q) => (q.id !== questionId ? q : ({ ...q, ...updates } as QuestionRow)))
    );
    void sectionId;
    // Forward every field the editor produced — backend validates per-type.
    withSave(() =>
      fetch(`/api/surveys/templates/${templateId}/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
    );
  }

  function handleDeleteQuestion(sectionId: string, questionId: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    const nextComparisons = template.comparisons.map((c) => ({
      ...c,
      leftQuestionIds: c.leftQuestionIds.filter((qid) => qid !== questionId),
      rightQuestionIds: c.rightQuestionIds.filter((qid) => qid !== questionId),
    }));
    if (JSON.stringify(nextComparisons) !== JSON.stringify(template.comparisons)) {
      setTemplate((prev) => ({ ...prev, comparisons: nextComparisons }));
      patchTemplate({ comparisons: nextComparisons });
    }
    if (selected.kind === "question" && selected.id === questionId) {
      setSelected({ kind: "section", id: sectionId });
    }
    withSave(() =>
      fetch(`/api/surveys/templates/${templateId}/questions/${questionId}`, {
        method: "DELETE",
      })
    );
  }

  function handleReorderQuestions(sectionId: string, ids: string[]) {
    setQuestions((prev) => {
      const others = prev.filter((q) => q.sectionId !== sectionId);
      const byId = new Map(prev.filter((q) => q.sectionId === sectionId).map((q) => [q.id, q]));
      const reordered = ids.map((id, i) => ({ ...(byId.get(id) as QuestionRow), order: i }));
      return [...others, ...reordered];
    });
    withSave(() =>
      fetch(`/api/surveys/templates/${templateId}/questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
    );
  }

  // ── Comparison mutations ────────────────────────────────────────
  function handleAddComparison() {
    const newComparison: ShellComparison = {
      id: crypto.randomUUID(),
      label: "New comparison",
      leftLabel: "To-be",
      rightLabel: "As-is",
      leftQuestionIds: [],
      rightQuestionIds: [],
      order: template.comparisons.length,
    };
    const next = [...template.comparisons, newComparison];
    setTemplate((prev) => ({ ...prev, comparisons: next }));
    patchTemplate({ comparisons: next });
    setSelected({ kind: "comparison", id: newComparison.id });
  }

  function handleUpdateComparison(comparisonId: string, updates: Partial<ShellComparison>) {
    const next = template.comparisons.map((c) => (c.id === comparisonId ? { ...c, ...updates } : c));
    setTemplate((prev) => ({ ...prev, comparisons: next }));
    patchTemplate({ comparisons: next });
  }

  function handleDeleteComparison(comparisonId: string) {
    const next = template.comparisons.filter((c) => c.id !== comparisonId);
    setTemplate((prev) => ({ ...prev, comparisons: next }));
    patchTemplate({ comparisons: next });
    if (selected.kind === "comparison" && selected.id === comparisonId) {
      setSelected({ kind: "header" });
    }
  }

  async function handleDeleteTemplate() {
    if (
      !confirm(
        `Delete template "${template.name}" entirely? Sessions that already use it keep working via their snapshot.`
      )
    )
      return;
    const res = await fetch(`/api/surveys/templates/${templateId}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/surveys");
  }

  // ── Derived shell shape ─────────────────────────────────────────
  const shellSections: ShellSection[] = useMemo(
    () =>
      sections.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description || undefined,
        openQuestion: s.openQuestion,
        questions: questions
          .filter((q) => q.sectionId === s.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((q) => toShellQuestion(q)),
      })),
    [sections, questions]
  );

  const selectedArchetypes = useMemo(
    () => template.archetypeIds.map((id) => archetypes.find((a) => a.id === id)).filter(Boolean) as Archetype[],
    [template.archetypeIds, archetypes]
  );

  const headerActions = (
    <div className="flex items-center gap-2">
      {sessionCount !== null && sessionCount > 0 && (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Used by {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
        </span>
      )}
      <select
        value={template.status}
        onChange={(e) => handleChangeStatus(e.target.value)}
        className="input input-sm"
        style={{ width: 120 }}
        aria-label="Template status"
      >
        <option value="active">Active</option>
        <option value="archived">Archived</option>
      </select>
      <button
        onClick={handleDeleteTemplate}
        className="btn-danger inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs"
      >
        <Trash2 size={12} />
        Delete template
      </button>
    </div>
  );

  return (
    <>
      {error && (
        <div
          className="sticky top-0 z-40 px-6 py-2 text-xs"
          style={{ background: "var(--danger-light)", color: "var(--danger)" }}
        >
          {error}
        </div>
      )}
      <SurveyEditorShell
        mode="template"
        pageTitle={template.name || "Untitled template"}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Survey templates", href: "/admin/surveys" },
          { label: template.name || "Template" },
        ]}
        headerActions={headerActions}
        saveState={saveState}
        savedAt={savedAt}
        onRetrySave={undefined}
        name={template.name}
        description={template.description}
        archetypes={selectedArchetypes}
        allArchetypes={archetypes}
        archetypeMutable={true}
        closingOpenQuestion={template.closingOpenQuestion}
        sections={shellSections}
        comparisons={template.comparisons}
        selected={selected}
        onSelect={setSelected}
        onChangeName={handleChangeName}
        onChangeDescription={handleChangeDescription}
        onToggleArchetype={handleToggleArchetype}
        onChangeClosing={handleChangeClosing}
        onAddSection={handleAddSection}
        onUpdateSection={handleUpdateSection}
        onDeleteSection={handleDeleteSection}
        onReorderSections={handleReorderSections}
        onAddQuestion={handleAddQuestion}
        onUpdateQuestion={handleUpdateQuestion}
        onDeleteQuestion={handleDeleteQuestion}
        onReorderQuestionsInSection={handleReorderQuestions}
        onAddComparison={handleAddComparison}
        onUpdateComparison={handleUpdateComparison}
        onDeleteComparison={handleDeleteComparison}
      />
    </>
  );
}
