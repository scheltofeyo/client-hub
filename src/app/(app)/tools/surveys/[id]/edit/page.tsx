"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import SurveyEditorShell, {
  type ShellSection,
  type ShellQuestion,
} from "@/components/surveys/SurveyEditorShell";
import type { OutlineSelection } from "@/components/surveys/EditorOutline";
import type { SaveState } from "@/components/surveys/SaveStateChip";
import type { ArchetypeLite } from "@/components/surveys/ArchetypePill";
import type { ShellQuestionAny } from "@/components/surveys/question-types";
import type { SurveyQuestionType } from "@/lib/surveys/types";

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function buildBlankQuestion(
  type: SurveyQuestionType,
  archetypes: { id: string }[]
): ShellQuestionAny {
  const id = uid();
  switch (type) {
    case "archetype-ranking":
      return {
        id,
        type: "archetype-ranking",
        title: "New question",
        options: archetypes.map((a) => ({ id: uid(), archetypeId: a.id, text: "" })),
      };
    case "general-ranking":
      return {
        id,
        type: "general-ranking",
        title: "New ranking question",
        rankingItems: [
          { id: uid(), text: "" },
          { id: uid(), text: "" },
          { id: uid(), text: "" },
        ],
      };
    case "multiple-choice":
      return {
        id,
        type: "multiple-choice",
        title: "New choice question",
        choiceMode: "single",
        choices: [
          { id: uid(), text: "" },
          { id: uid(), text: "" },
        ],
      };
    case "open-text":
      return { id, type: "open-text", title: "New open question", required: true };
    case "intro":
      return { id, type: "intro", title: "" };
  }
}

interface ArchetypeSnapshot {
  id: string;
  name: string;
  color: string;
}

interface Snapshot {
  name: string;
  description?: string;
  archetypes: ArchetypeSnapshot[];
  rankWeights: number[];
  closingOpenQuestion?: { enabled: boolean; label: string };
  sections: ShellSection[];
}

interface SessionDetail {
  id: string;
  clientId: string;
  clientName: string | null;
  title: string;
  status: string;
  createdBy: string;
  templateSnapshot: Snapshot;
}

export default function EditSnapshotPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: authSession } = useSession();
  const currentUserId = authSession?.user?.id;
  const perms = authSession?.user?.permissions ?? [];
  const canEditAny = perms.includes("tools.surveys.editAny");

  const [data, setData] = useState<SessionDetail | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState<OutlineSelection>({ kind: "header" });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load session ────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/surveys/sessions/${id}`);
      if (!alive) return;
      if (!res.ok) {
        setLoadFailed(true);
        return;
      }
      const d = (await res.json()) as SessionDetail;
      if (!alive) return;
      setData(d);
      setSnapshot(d.templateSnapshot);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  // ── Save wrapper ────────────────────────────────────────────────
  const persist = useCallback(
    async (payload: Record<string, unknown>): Promise<boolean> => {
      setSaveState("saving");
      const res = await fetch(`/api/surveys/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({} as { error?: string }));
        setError(d.error ?? "Save failed");
        setSaveState("error");
        return false;
      }
      setSaveState("saved");
      setSavedAt(Date.now());
      setError(null);
      return true;
    },
    [id]
  );

  // ── Mutations ───────────────────────────────────────────────────
  function patchSnapshot(patch: Partial<Snapshot>) {
    if (!snapshot) return;
    setSnapshot({ ...snapshot, ...patch });
  }

  function handleChangeName(name: string) {
    patchSnapshot({ name });
    persist({ snapshotName: name });
  }
  function handleChangeDescription(description: string) {
    patchSnapshot({ description });
    persist({ snapshotDescription: description });
  }
  function handleChangeClosing(co: { enabled: boolean; label: string }) {
    patchSnapshot({ closingOpenQuestion: co });
    persist({ snapshotClosingOpenQuestion: co });
  }

  function patchSections(sections: ShellSection[]) {
    if (!snapshot) return;
    setSnapshot({ ...snapshot, sections });
    persist({ snapshotSections: sections });
  }

  // Sections
  function handleAddSection() {
    if (!snapshot) return;
    const next: ShellSection = {
      id: crypto.randomUUID(),
      title: "New section",
      description: "",
      openQuestion: { enabled: false, label: "" },
      questions: [],
    };
    const sections = [...snapshot.sections, next];
    patchSections(sections);
    setSelected({ kind: "section", id: next.id });
  }
  function handleUpdateSection(sectionId: string, updates: Partial<ShellSection>) {
    if (!snapshot) return;
    patchSections(snapshot.sections.map((s) => (s.id === sectionId ? { ...s, ...updates } : s)));
  }
  function handleDeleteSection(sectionId: string) {
    if (!snapshot) return;
    const sections = snapshot.sections.filter((s) => s.id !== sectionId);
    patchSections(sections);
    if (
      (selected.kind === "section" && selected.id === sectionId) ||
      (selected.kind === "question" && selected.sectionId === sectionId)
    ) {
      setSelected({ kind: "header" });
    }
  }
  function handleReorderSections(ids: string[]) {
    if (!snapshot) return;
    const byId = new Map(snapshot.sections.map((s) => [s.id, s]));
    patchSections(ids.map((id) => byId.get(id) as ShellSection));
  }

  // Questions
  function handleAddQuestion(sectionId: string, type: SurveyQuestionType) {
    if (!snapshot) return;
    if (type === "archetype-ranking" && snapshot.archetypes.length < 2) {
      setError("This session has fewer than 2 archetypes. Recreate the session from a valid template.");
      setSaveState("error");
      return;
    }
    const newQuestion = buildBlankQuestion(type, snapshot.archetypes);
    const sections = snapshot.sections.map((s) =>
      s.id === sectionId ? { ...s, questions: [...s.questions, newQuestion] } : s
    );
    patchSections(sections);
    setSelected({ kind: "question", sectionId, id: newQuestion.id });
  }
  function handleUpdateQuestion(
    sectionId: string,
    questionId: string,
    updates: Partial<ShellQuestionAny>
  ) {
    if (!snapshot) return;
    const sections = snapshot.sections.map((s) =>
      s.id !== sectionId
        ? s
        : {
            ...s,
            questions: s.questions.map((q) =>
              q.id === questionId ? ({ ...q, ...updates } as ShellQuestionAny) : q
            ),
          }
    );
    patchSections(sections);
  }
  function handleDeleteQuestion(sectionId: string, questionId: string) {
    if (!snapshot) return;
    const sections = snapshot.sections.map((s) =>
      s.id !== sectionId ? s : { ...s, questions: s.questions.filter((q) => q.id !== questionId) }
    );
    patchSections(sections);
    if (selected.kind === "question" && selected.id === questionId) {
      setSelected({ kind: "section", id: sectionId });
    }
  }
  function handleReorderQuestions(sectionId: string, ids: string[]) {
    if (!snapshot) return;
    const sections = snapshot.sections.map((s) => {
      if (s.id !== sectionId) return s;
      const byId = new Map(s.questions.map((q) => [q.id, q]));
      return { ...s, questions: ids.map((qid) => byId.get(qid) as ShellQuestion) };
    });
    patchSections(sections);
  }

  // ── Derived ─────────────────────────────────────────────────────
  const archetypeLites: ArchetypeLite[] = useMemo(
    () => (snapshot?.archetypes ?? []).map((a) => ({ id: a.id, name: a.name, color: a.color })),
    [snapshot]
  );

  if (loadFailed) {
    return <div className="p-7 text-sm" style={{ color: "var(--danger)" }}>Could not load session.</div>;
  }
  if (!data || !snapshot) return null;

  const isOwner = data.createdBy === currentUserId;
  const canEdit = isOwner || canEditAny;
  const isDraft = data.status === "draft";

  if (!canEdit) {
    return (
      <div className="p-7 text-sm" style={{ color: "var(--danger)" }}>
        You do not have permission to edit this session.
      </div>
    );
  }
  if (!isDraft) {
    return (
      <div className="p-7 text-sm space-y-2">
        <p style={{ color: "var(--danger)" }}>
          This session is no longer in draft. Snapshot content is locked once published.
        </p>
        <button onClick={() => router.push(`/tools/surveys/${id}`)} className="btn-primary px-4 py-2 rounded-button text-sm">
          Back to session
        </button>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="sticky top-0 z-40 px-6 py-2 text-xs" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
          {error}
        </div>
      )}
      <SurveyEditorShell
        mode="snapshot"
        modeContext={data.clientName ?? undefined}
        pageTitle={snapshot.name || "Untitled session"}
        breadcrumbs={[
          { label: "Tools", href: "/tools" },
          { label: "Surveys", href: "/tools/surveys" },
          { label: data.title || "Session", href: `/tools/surveys/${id}` },
          { label: "Edit content" },
        ]}
        headerActions={
          <button
            onClick={() => router.push(`/tools/surveys/${id}`)}
            className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-semibold"
          >
            Back to session
          </button>
        }
        saveState={saveState}
        savedAt={savedAt}
        onRetrySave={undefined}
        name={snapshot.name}
        description={snapshot.description}
        archetypes={archetypeLites}
        allArchetypes={archetypeLites}
        archetypeMutable={false}
        closingOpenQuestion={snapshot.closingOpenQuestion}
        sections={snapshot.sections}
        selected={selected}
        onSelect={setSelected}
        onChangeName={handleChangeName}
        onChangeDescription={handleChangeDescription}
        onChangeClosing={handleChangeClosing}
        onAddSection={handleAddSection}
        onUpdateSection={handleUpdateSection}
        onDeleteSection={handleDeleteSection}
        onReorderSections={handleReorderSections}
        onAddQuestion={handleAddQuestion}
        onUpdateQuestion={handleUpdateQuestion}
        onDeleteQuestion={handleDeleteQuestion}
        onReorderQuestionsInSection={handleReorderQuestions}
      />
    </>
  );
}
