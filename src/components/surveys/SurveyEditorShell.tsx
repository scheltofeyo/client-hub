"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Trash2 } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import RichTextEditor from "@/components/ui/RichTextEditor";
import ArchetypePill, { type ArchetypeLite } from "./ArchetypePill";
import EditorOutline, {
  type OutlineSection,
  type OutlineComparison,
  type OutlineSelection,
} from "./EditorOutline";
import ModeChip, { type EditorMode } from "./ModeChip";
import SaveStateChip, { type SaveState } from "./SaveStateChip";
import ShuttlePicker, { type ShuttleQuestion } from "./ShuttlePicker";
import { deriveComparisonHealth, type ComparisonHealth } from "./ComparisonHealthPill";
import QuestionForm, { type QuestionFormQuestion } from "./QuestionForm";
import AddBlockMenu from "./AddBlockMenu";
import { QUESTION_TYPE_META, type ShellQuestionAny } from "./question-types";
import type { SurveyQuestionType } from "@/lib/surveys/types";

// ── Data types passed by the parent ──────────────────────────────

export type ShellQuestion = ShellQuestionAny;

export interface ShellSection {
  id: string;
  title: string;
  description?: string;
  openQuestion?: { enabled: boolean; label: string };
  questions: ShellQuestion[];
}

export interface ShellComparison {
  id: string;
  label: string;
  leftLabel: string;
  rightLabel: string;
  leftQuestionIds: string[];
  rightQuestionIds: string[];
  order: number;
}

export interface SurveyEditorShellProps {
  mode: EditorMode;
  modeContext?: string;
  pageTitle: string;
  breadcrumbs: { label: string; href?: string }[];
  headerActions?: React.ReactNode;
  saveState: SaveState;
  savedAt?: number | null;
  onRetrySave?: () => void;

  // content
  name: string;
  description?: string;
  archetypes: ArchetypeLite[];
  allArchetypes: ArchetypeLite[];
  archetypeMutable: boolean;
  closingOpenQuestion?: { enabled: boolean; label: string };
  sections: ShellSection[];
  comparisons: ShellComparison[];

  // selection
  selected: OutlineSelection;
  onSelect: (item: OutlineSelection) => void;

  // mutations
  onChangeName: (name: string) => void;
  onChangeDescription: (description: string) => void;
  onToggleArchetype?: (archetypeId: string) => void;
  onChangeClosing: (co: { enabled: boolean; label: string }) => void;

  onAddSection?: () => void;
  onUpdateSection: (sectionId: string, updates: Partial<ShellSection>) => void;
  onDeleteSection: (sectionId: string) => void;
  onReorderSections?: (ids: string[]) => void;

  onAddQuestion?: (sectionId: string, type: SurveyQuestionType) => void;
  onUpdateQuestion: (sectionId: string, questionId: string, updates: Partial<ShellQuestion>) => void;
  onDeleteQuestion: (sectionId: string, questionId: string) => void;
  onReorderQuestionsInSection?: (sectionId: string, ids: string[]) => void;

  onAddComparison?: () => void;
  onUpdateComparison: (comparisonId: string, updates: Partial<ShellComparison>) => void;
  onDeleteComparison: (comparisonId: string) => void;

  perQuestionPercentages?: Record<string, Record<string, number>>;
}

// ── Main shell ───────────────────────────────────────────────────

export default function SurveyEditorShell(props: SurveyEditorShellProps) {
  const {
    mode,
    modeContext,
    pageTitle,
    breadcrumbs,
    headerActions,
    saveState,
    savedAt,
    onRetrySave,
    sections,
    comparisons,
    selected,
    onSelect,
    archetypeMutable,
  } = props;

  // Build the outline-data shape
  const knownQuestionIds = useMemo(
    () => new Set(sections.flatMap((s) => s.questions.map((q) => q.id))),
    [sections]
  );

  const hasArchetypeRanking = useMemo(
    () => sections.some((s) => s.questions.some((q) => q.type === "archetype-ranking")),
    [sections]
  );

  const outlineSections: OutlineSection[] = useMemo(
    () =>
      sections.map((s) => ({
        id: s.id,
        title: s.title || "(untitled section)",
        questions: s.questions.map((q) => ({
          id: q.id,
          title: q.title || (q.type === "intro" ? "Info block" : "(untitled question)"),
          type: q.type,
          incomplete: isQuestionIncomplete(q),
        })),
      })),
    [sections]
  );
  const outlineComparisons: OutlineComparison[] = useMemo(
    () =>
      comparisons.map((c) => ({
        id: c.id,
        label: c.label || "Untitled comparison",
        health: deriveComparisonHealth({
          leftQuestionIds: c.leftQuestionIds,
          rightQuestionIds: c.rightQuestionIds,
          knownQuestionIds,
        }).health as ComparisonHealth,
      })),
    [comparisons, knownQuestionIds]
  );

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ background: "var(--bg-app, var(--bg-surface))" }}
    >
      {/* Top bar — breadcrumbs row above title row, matches PageHeader pattern. */}
      <header
        className="shrink-0 px-7 pt-4 pb-3 border-b"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <nav
          className="flex items-center gap-1.5 mb-1.5 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {b.href ? (
                <Link href={b.href} className="hover:underline">{b.label}</Link>
              ) : (
                <span>{b.label}</span>
              )}
              {i < breadcrumbs.length - 1 && <ChevronRight size={10} aria-hidden="true" />}
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <h1 className="typo-page-title truncate min-w-0" style={{ color: "var(--text-primary)" }}>
            {pageTitle}
          </h1>
          <ModeChip mode={mode} context={modeContext} />
          <SaveStateChip state={saveState} savedAt={savedAt} onRetry={onRetrySave} />
          <div className="flex-1" />
          {headerActions}
        </div>
      </header>

      {/* Body — grid with two independently-scrolling regions. min-h-0 lets the grid shrink. */}
      <div
        className="flex-1 grid min-h-0"
        style={{ gridTemplateColumns: "280px 1fr" }}
      >
        <aside
          className="overflow-y-auto border-r"
          style={{ borderColor: "var(--border)" }}
        >
          <EditorOutline
            sections={outlineSections}
            comparisons={outlineComparisons}
            selected={selected}
            onSelect={onSelect}
            onAddSection={props.onAddSection}
            onAddComparison={props.onAddComparison}
            onReorderSections={props.onReorderSections}
            onReorderQuestions={props.onReorderQuestionsInSection}
            archetypeLocked={!archetypeMutable}
            showArchetypes={hasArchetypeRanking}
            showClosing={!!props.closingOpenQuestion?.enabled}
          />
        </aside>

        <main className="overflow-y-auto">
          <div className="px-8 py-6">
            <RightPane {...props} />
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Right-pane router ────────────────────────────────────────────

function RightPane(props: SurveyEditorShellProps) {
  const { selected } = props;

  switch (selected.kind) {
    case "header":
      return <HeaderView {...props} />;
    case "archetypes":
      return <ArchetypesView {...props} />;
    case "closing":
      return <ClosingView {...props} />;
    case "section": {
      const section = props.sections.find((s) => s.id === selected.id);
      if (!section) return <EmptyState text="Section not found. Pick another item from the outline." />;
      return <SectionView key={section.id} {...props} section={section} />;
    }
    case "question": {
      const section = props.sections.find((s) => s.id === selected.sectionId);
      const question = section?.questions.find((q) => q.id === selected.id);
      if (!section || !question)
        return <EmptyState text="Question not found. Pick another item from the outline." />;
      return <QuestionView {...props} section={section} question={question} />;
    }
    case "comparison": {
      const comparison = props.comparisons.find((c) => c.id === selected.id);
      if (!comparison) return <EmptyState text="Comparison not found." />;
      return <ComparisonView key={comparison.id} {...props} comparison={comparison} />;
    }
    default:
      return <EmptyState text="Pick something from the outline to start editing." />;
  }
}

function isQuestionIncomplete(q: ShellQuestion): boolean {
  switch (q.type) {
    case "archetype-ranking":
      return q.options.some((o) => !o.text.trim());
    case "general-ranking":
      return q.rankingItems.length < 2 || q.rankingItems.some((i) => !i.text.trim());
    case "multiple-choice":
      return q.choices.length < 2 || q.choices.some((c) => !c.text.trim());
    case "open-text":
      return !q.title.trim();
    case "intro":
      return false;
  }
}

function EmptyState({ text }: { text: string }) {
  return (
    <SectionCard>
      <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>
        {text}
      </p>
    </SectionCard>
  );
}

// ── Right-pane: Header view ──────────────────────────────────────

function HeaderView(props: SurveyEditorShellProps) {
  return (
    <SectionCard
      title="Survey header"
      helper="Shown to participants at the top of the survey."
    >
      <div className="space-y-4">
        <div>
          <label className="typo-label">Title</label>
          <input
            type="text"
            defaultValue={props.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== props.name) props.onChangeName(v);
            }}
            className="input typo-card-title"
            placeholder="Survey title"
          />
        </div>
        <div>
          <label className="typo-label">Description (optional)</label>
          <textarea
            defaultValue={props.description ?? ""}
            onBlur={(e) => {
              if (e.target.value !== (props.description ?? "")) {
                props.onChangeDescription(e.target.value);
              }
            }}
            rows={3}
            className="input resize-none"
            placeholder="Context shown above the first section"
          />
        </div>
      </div>
    </SectionCard>
  );
}

// ── Right-pane: Archetypes view ──────────────────────────────────

function ArchetypesView(props: SurveyEditorShellProps) {
  const { archetypes, allArchetypes, archetypeMutable, onToggleArchetype } = props;
  if (!archetypeMutable) {
    return (
      <SectionCard
        title="Archetypes"
        helper="Locked once a session is created — make a new session if you need a different set."
        locked
      >
        <div className="flex flex-wrap gap-2">
          {archetypes.map((a) => (
            <ArchetypePill key={a.id} archetype={a} variant="solid" />
          ))}
        </div>
      </SectionCard>
    );
  }
  const selectedIds = new Set(archetypes.map((a) => a.id));
  return (
    <SectionCard
      title="Archetypes"
      helper="Click to toggle. Each question gets one option per selected archetype."
    >
      <div className="flex flex-wrap gap-2">
        {allArchetypes.map((a) => {
          const selected = selectedIds.has(a.id);
          return (
            <ArchetypePill
              key={a.id}
              archetype={a}
              variant="solid"
              selected={selected}
              onClick={() => onToggleArchetype?.(a.id)}
            />
          );
        })}
      </div>
      <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
        At least 2 archetypes are required.
      </p>
    </SectionCard>
  );
}

// ── Right-pane: Closing-question view ────────────────────────────

function ClosingView(props: SurveyEditorShellProps) {
  const co = props.closingOpenQuestion ?? { enabled: false, label: "" };
  return (
    <SectionCard
      title="Closing question"
      helper="Optional free-text prompt shown after the last section."
    >
      <label className="inline-flex items-center gap-2 text-sm mb-3">
        <input
          type="checkbox"
          checked={co.enabled}
          onChange={(e) => props.onChangeClosing({ ...co, enabled: e.target.checked })}
        />
        <span style={{ color: "var(--text-primary)" }}>Enable closing question</span>
      </label>
      {co.enabled && (
        <input
          type="text"
          defaultValue={co.label}
          onBlur={(e) => props.onChangeClosing({ enabled: true, label: e.target.value })}
          placeholder="e.g. Anything else you'd like to share?"
          className="input"
        />
      )}
    </SectionCard>
  );
}

// ── Right-pane: Section view ─────────────────────────────────────

function SectionView({
  section,
  onUpdateSection,
  onDeleteSection,
  onAddQuestion,
  onSelect,
}: SurveyEditorShellProps & { section: ShellSection }) {
  return (
    <div className="space-y-4">
      <SectionCard
        title={section.title || "Untitled section"}
        helper={`${section.questions.length} question${section.questions.length === 1 ? "" : "s"}`}
        action={
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete section "${section.title}" and all its questions?`)) {
                onDeleteSection(section.id);
              }
            }}
            className="btn-icon-danger"
            aria-label="Delete section"
          >
            <Trash2 size={14} />
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="typo-label">Section title</label>
            <input
              type="text"
              defaultValue={section.title}
              onBlur={(e) => {
                if (e.target.value !== section.title) onUpdateSection(section.id, { title: e.target.value });
              }}
              className="input"
            />
          </div>
          <div>
            <label className="typo-label">Description (optional)</label>
            <SectionDescriptionEditor
              key={section.id}
              initial={section.description ?? ""}
              onSave={(html) => onUpdateSection(section.id, { description: html })}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Blocks"
        helper={`${section.questions.length} in this section`}
        action={
          onAddQuestion && (
            <AddBlockMenu onPick={(type) => onAddQuestion(section.id, type)} />
          )
        }
      >
        {section.questions.length === 0 ? (
          <p className="text-sm italic text-center py-6" style={{ color: "var(--text-muted)" }}>
            No blocks yet. Click &ldquo;Add block&rdquo; to start.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {section.questions.map((q, i) => {
              const meta = QUESTION_TYPE_META[q.type];
              const Icon = meta.icon;
              return (
                <li
                  key={q.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-button cursor-pointer hover:bg-hover"
                  style={{ background: "var(--bg-elevated)" }}
                  onClick={() => onSelect({ kind: "question", sectionId: section.id, id: q.id })}
                >
                  <span className="text-xs tabular-nums shrink-0 w-6" style={{ color: "var(--text-muted)" }}>
                    {i + 1}.
                  </span>
                  <Icon size={14} style={{ color: meta.color, flexShrink: 0 }} />
                  <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
                    {q.title || (q.type === "intro" ? "Info block" : "(untitled question)")}
                  </span>
                  <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

// ── Right-pane: Question view ────────────────────────────────────

function QuestionView({
  section,
  question,
  archetypes,
  onUpdateQuestion,
  onDeleteQuestion,
  onSelect,
}: SurveyEditorShellProps & { section: ShellSection; question: ShellQuestion }) {
  const index = section.questions.findIndex((q) => q.id === question.id);
  const prev = index > 0 ? section.questions[index - 1] : undefined;
  const next = index < section.questions.length - 1 ? section.questions[index + 1] : undefined;
  return (
    <QuestionForm
      key={question.id}
      sectionTitle={section.title}
      questionIndex={index}
      totalQuestionsInSection={section.questions.length}
      question={question as QuestionFormQuestion}
      archetypes={archetypes}
      onChange={(updates) => onUpdateQuestion(section.id, question.id, updates as Partial<ShellQuestion>)}
      onPrev={prev ? () => onSelect({ kind: "question", sectionId: section.id, id: prev.id }) : undefined}
      onNext={next ? () => onSelect({ kind: "question", sectionId: section.id, id: next.id }) : undefined}
      onDelete={() => {
        if (confirm(`Delete question "${question.title}"?`)) {
          onDeleteQuestion(section.id, question.id);
        }
      }}
    />
  );
}

// ── Right-pane: Comparison view ──────────────────────────────────

function ComparisonView({
  comparison,
  sections,
  archetypes,
  perQuestionPercentages,
  onUpdateComparison,
  onDeleteComparison,
}: SurveyEditorShellProps & { comparison: ShellComparison }) {
  const shuttleQuestions: ShuttleQuestion[] = useMemo(
    () =>
      sections.flatMap((s) =>
        s.questions.map((q) => ({
          id: q.id,
          title: q.title || "(untitled question)",
          sectionId: s.id,
          sectionTitle: s.title || "(untitled section)",
        }))
      ),
    [sections]
  );

  return (
    <SectionCard
      breadcrumb="Gap comparison"
      title={comparison.label || "Untitled comparison"}
      action={
        <button
          type="button"
          onClick={() => {
            if (confirm("Delete this comparison?")) onDeleteComparison(comparison.id);
          }}
          className="btn-icon-danger"
          aria-label="Delete comparison"
        >
          <Trash2 size={14} />
        </button>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="typo-label">Comparison label</label>
          <input
            type="text"
            defaultValue={comparison.label}
            onBlur={(e) => {
              if (e.target.value !== comparison.label) {
                onUpdateComparison(comparison.id, { label: e.target.value });
              }
            }}
            placeholder="e.g. Leadership: To-be vs As-is"
            className="input"
          />
        </div>

        <ShuttlePicker
          questions={shuttleQuestions}
          leftQuestionIds={comparison.leftQuestionIds}
          rightQuestionIds={comparison.rightQuestionIds}
          onChange={(next) =>
            onUpdateComparison(comparison.id, {
              leftQuestionIds: next.leftQuestionIds,
              rightQuestionIds: next.rightQuestionIds,
            })
          }
          leftLabel={comparison.leftLabel}
          rightLabel={comparison.rightLabel}
          onLeftLabelChange={(v) =>
            v !== comparison.leftLabel && onUpdateComparison(comparison.id, { leftLabel: v })
          }
          onRightLabelChange={(v) =>
            v !== comparison.rightLabel && onUpdateComparison(comparison.id, { rightLabel: v })
          }
          archetypes={archetypes}
          perQuestionPercentages={perQuestionPercentages}
        />
      </div>
    </SectionCard>
  );
}

function SectionDescriptionEditor({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (html: string) => void;
}) {
  // Local content keeps RichTextEditor controlled across parent re-renders
  // while the parent stays in charge of persistence (called on blur only).
  const [content, setContent] = useState(initial);
  return (
    <RichTextEditor
      content={content}
      onChange={(html) => setContent(html)}
      onBlur={(html) => {
        if (html !== initial) onSave(html);
      }}
      placeholder="Add context for this section…"
    />
  );
}
