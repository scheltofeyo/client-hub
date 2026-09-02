"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Trash2 } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import RichTextEditor from "@/components/ui/RichTextEditor";
import ArchetypePill, { type ArchetypeLite } from "./ArchetypePill";
import EditorOutline, {
  type OutlineRespondentVariable,
  type OutlineSection,
  type OutlineSelection,
} from "./EditorOutline";
import ModeChip, { type EditorMode } from "./ModeChip";
import SaveStateChip, { type SaveState } from "./SaveStateChip";
import QuestionForm, { type QuestionFormQuestion } from "./QuestionForm";
import AddBlockMenu from "./AddBlockMenu";
import { QUESTION_TYPE_META, type ShellQuestionAny } from "./question-types";
import { isValueBackedType, type SurveyQuestionType } from "@/lib/surveys/types";
import {
  RESPONDENT_VARIABLE_COPY_FIELDS,
  defaultRespondentVariableCopy,
  type IRespondentVariableCopy,
  type RespondentVariableCopyField,
} from "@/lib/surveys/respondent-variable-copy";
import {
  CLOSING_SCREEN_FIELDS,
  defaultClosingCopy,
  type ClosingScreenField,
  type ISurveyClosingScreen,
} from "@/lib/surveys/closing-screen";
import {
  GREETING_FIELDS,
  WELCOME_SCREEN_FIELDS,
  defaultWelcomeCopy,
  usesAutoGreeting,
  type ISurveyWelcomeScreen,
  type WelcomeScreenField,
} from "@/lib/surveys/welcome-screen";
import type { Locale } from "@/lib/surveys/translations";

// ── Data types passed by the parent ──────────────────────────────

export type ShellQuestion = ShellQuestionAny;

export interface ShellSection {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  openQuestion?: { enabled: boolean; label: string };
  questions: ShellQuestion[];
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
  /**
   * The session's cultural values. Absent when editing a template — a template has
   * no client, which is exactly why value-backed questions carry no items there.
   */
  culturalValues?: { id: string; title: string }[];
  closingOpenQuestion?: { enabled: boolean; label: string };
  /**
   * Authored overrides for the participant welcome screen. Absent fields fall
   * back to the built-in translations, which is why this is a sparse object
   * rather than a fully-populated one.
   */
  welcomeScreen?: ISurveyWelcomeScreen;
  /**
   * Authored overrides for the closing screen, on the same terms as the welcome
   * screen. `closingThankYouText` is the field it supersedes: surveys authored
   * before this screen existed keep their message there, so it stands in as the
   * body until the first save folds it in.
   */
  closingScreen?: ISurveyClosingScreen;
  closingThankYouText?: string;
  /** The client this survey runs for, used to preview `{company}` in the copy. */
  clientCompany?: string;
  /**
   * Authored copy for the level step, plus the levels a participant will pick
   * from. Absent means this survey does not ask it. The options are read-only —
   * they come from the client's Cultural DNA, and an option typed here would be a
   * level no behaviour is filed under.
   */
  respondentVariable?: { copy: IRespondentVariableCopy; options: string[] };
  sections: ShellSection[];

  // selection
  selected: OutlineSelection;
  onSelect: (item: OutlineSelection) => void;

  // mutations
  onChangeName: (name: string) => void;
  onChangeDescription: (description: string) => void;
  onToggleArchetype?: (archetypeId: string) => void;
  onChangeClosing: (co: { enabled: boolean; label: string }) => void;
  onChangeWelcomeScreen?: (welcomeScreen: ISurveyWelcomeScreen) => void;
  onChangeClosingScreen?: (closingScreen: ISurveyClosingScreen) => void;
  onChangeRespondentVariable?: (copy: IRespondentVariableCopy) => void;

  onAddSection?: () => void;
  onUpdateSection: (sectionId: string, updates: Partial<ShellSection>) => void;
  onDeleteSection: (sectionId: string) => void;
  onReorderSections?: (ids: string[]) => void;

  onAddQuestion?: (sectionId: string, type: SurveyQuestionType) => void;
  onUpdateQuestion: (sectionId: string, questionId: string, updates: Partial<ShellQuestion>) => void;
  onDeleteQuestion: (sectionId: string, questionId: string) => void;
  onReorderQuestionsInSection?: (sectionId: string, ids: string[]) => void;
}

/**
 * Mirrors `buildScreens()` in the runner: the level step is asked right before the
 * first question whose content depends on the answer, and up front when no
 * question does. Derived here rather than taken from the parent, so the outline
 * stays honest about where a participant will actually meet it.
 */
function buildOutlineRespondentVariable(
  respondentVariable: SurveyEditorShellProps["respondentVariable"],
  sections: ShellSection[]
): OutlineRespondentVariable | undefined {
  if (!respondentVariable) return undefined;
  // A short stand-in rather than the built-in question itself: unauthored, the
  // default label is a full sentence that reads badly in a 280px column.
  const label = respondentVariable.copy.label?.trim() || "Level question";
  for (const section of sections) {
    const q = section.questions.find((x) => isValueBackedType(x.type));
    if (q) return { label, anchor: { sectionId: section.id, questionId: q.id } };
  }
  return { label, anchor: null };
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
    selected,
    onSelect,
    archetypeMutable,
    respondentVariable,
  } = props;

  const hasArchetypeRanking = useMemo(
    () =>
      sections.some((s) =>
        s.questions.some((q) => q.type === "archetype-ranking" || q.type === "archetype-top3")
      ),
    [sections]
  );

  const outlineRespondentVariable: OutlineRespondentVariable | undefined =
    buildOutlineRespondentVariable(respondentVariable, sections);

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
            selected={selected}
            onSelect={onSelect}
            onAddSection={props.onAddSection}
            onReorderSections={props.onReorderSections}
            onReorderQuestions={props.onReorderQuestionsInSection}
            archetypeLocked={!archetypeMutable}
            showArchetypes={archetypeMutable && hasArchetypeRanking}
            showClosing={!!props.closingOpenQuestion?.enabled}
            respondentVariable={outlineRespondentVariable}
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
    case "welcome":
      return <WelcomeView {...props} />;
    case "respondent-variable":
      return <RespondentVariableView {...props} />;
    case "archetypes":
      return <ArchetypesView {...props} />;
    case "closing":
      return <ClosingView {...props} />;
    case "closing-screen":
      return <ClosingScreenView {...props} />;
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
    default:
      return <EmptyState text="Pick something from the outline to start editing." />;
  }
}

function isQuestionIncomplete(q: ShellQuestion): boolean {
  switch (q.type) {
    case "archetype-ranking":
      return q.options.some((o) => !o.text.trim());
    case "archetype-top3":
      // Top-3 needs at least 4 distinct options to be meaningful.
      return q.options.length < 4 || q.options.some((o) => !o.text.trim());
    case "general-ranking":
      return q.rankingItems.length < 2 || q.rankingItems.some((i) => !i.text.trim());
    case "general-top3":
      return q.rankingItems.length < 4 || q.rankingItems.some((i) => !i.text.trim());
    case "multiple-choice":
      return q.choices.length < 2 || q.choices.some((c) => !c.text.trim());
    case "open-text":
      return !q.title.trim();
    case "scale":
      return !q.title.trim();
    case "value-assessment":
      // Items are materialised from the client's DNA, so an empty list means the
      // client has no cultural values yet — the question cannot be answered.
      return !q.title.trim() || (q.valueItems?.length ?? 0) === 0;
    case "value-ranking":
      return !q.title.trim() || (q.valueItems?.length ?? 0) < 2;
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
      helper="The title participants see at the top of the survey."
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
          <label className="typo-label">
            Internal note (not visible to participants)
          </label>
          <textarea
            defaultValue={props.description ?? ""}
            onBlur={(e) => {
              if (e.target.value !== (props.description ?? "")) {
                props.onChangeDescription(e.target.value);
              }
            }}
            rows={3}
            className="input resize-none"
            placeholder="For colleagues only — appears in the results export, never in the survey"
          />
        </div>
      </div>
    </SectionCard>
  );
}

// ── Right-pane: Welcome-screen view ──────────────────────────────

interface WelcomeFieldMeta {
  field: WelcomeScreenField;
  label: string;
  helper?: string;
  multiline?: boolean;
  rows?: number;
}

const WELCOME_FIELDS: WelcomeFieldMeta[] = [
  {
    field: "tagline",
    label: "Tagline pill",
    helper: "The small pill above the greeting. {company} is replaced with the client name.",
  },
  { field: "headline", label: "Headline", helper: "The big first line." },
  { field: "subheadline", label: "Sub-headline", helper: "The smaller line right under it." },
  {
    field: "bodyIntro",
    label: "Body",
    helper:
      "Who is asking, what for, and what happens with the answers. Leave a blank line between paragraphs. {company} is supported.",
    multiline: true,
    rows: 6,
  },
  { field: "bodyEmail", label: "Why we ask for an email", multiline: true },
];

/**
 * Every field starts out showing the built-in copy, so authoring is editing
 * rather than writing from scratch. Only text that actually *differs* from the
 * default is stored: that keeps the participant page bilingual for anything left
 * alone, and lets a cleared field fall straight back to the default.
 */
function WelcomeView(props: SurveyEditorShellProps) {
  const { welcomeScreen, onChangeWelcomeScreen, clientCompany } = props;
  const [defaultLocale, setDefaultLocale] = useState<Locale>("nl");

  const defaults = useMemo(
    () => defaultWelcomeCopy(defaultLocale, { company: clientCompany }),
    [defaultLocale, clientCompany]
  );

  function commit(field: WelcomeScreenField, raw: string) {
    if (!onChangeWelcomeScreen) return;
    const value = raw.trim();
    const next: ISurveyWelcomeScreen = { ...welcomeScreen };
    if (!value || value === defaults[field]) delete next[field];
    else next[field] = value;
    // Compare against the stored object so a blur that changed nothing does not
    // fire a save on every field the author tabs through.
    const changed = WELCOME_SCREEN_FIELDS.some((f) => (next[f] ?? "") !== (welcomeScreen?.[f] ?? ""));
    if (changed) onChangeWelcomeScreen(next);
  }

  const autoGreeting = usesAutoGreeting(welcomeScreen);

  /**
   * Switching the greeting back on keeps whatever was authored rather than
   * clearing it, so someone toggling to compare the two does not lose their copy.
   */
  function commitAutoGreeting(enabled: boolean) {
    if (!onChangeWelcomeScreen) return;
    const next: ISurveyWelcomeScreen = { ...welcomeScreen };
    if (enabled) delete next.autoGreeting;
    else next.autoGreeting = false;
    onChangeWelcomeScreen(next);
  }

  /**
   * The image is not an override of a default the way the copy fields are —
   * empty simply means no image — so it gets its own commit rather than going
   * through the default-comparison above.
   */
  function commitImageUrl(raw: string) {
    if (!onChangeWelcomeScreen) return;
    const value = raw.trim();
    if (value === (welcomeScreen?.imageUrl ?? "")) return;
    const next: ISurveyWelcomeScreen = { ...welcomeScreen };
    if (value) next.imageUrl = value;
    else delete next.imageUrl;
    onChangeWelcomeScreen(next);
  }

  const visibleFields = WELCOME_FIELDS.filter(
    (f) => !autoGreeting || !GREETING_FIELDS.includes(f.field)
  );
  const customCount = WELCOME_SCREEN_FIELDS.filter(
    (f) => welcomeScreen?.[f] && !(autoGreeting && GREETING_FIELDS.includes(f))
  ).length;

  const greetingToggle = (
    <div>
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={autoGreeting}
          disabled={!onChangeWelcomeScreen}
          onChange={(e) => commitAutoGreeting(e.target.checked)}
        />
        <span style={{ color: "var(--text-primary)" }}>Automatic greeting</span>
      </label>
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
        {autoGreeting
          ? "The headline and the line under it rotate with the time of day and the weekday. Switch this off to write them yourself."
          : "Switched off — the two lines below are shown exactly as written."}
      </p>
    </div>
  );

  return (
    <SectionCard
      title="Welcome screen"
      helper="The first thing participants see, before any question. Every field starts on the built-in copy — edit what you want to change, or clear a field to go back to the default."
      action={
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Default copy
          </span>
          <select
            value={defaultLocale}
            onChange={(e) => setDefaultLocale(e.target.value as Locale)}
            className="input input-sm"
            style={{ width: 76 }}
            aria-label="Language of the built-in copy"
          >
            <option value="nl">NL</option>
            <option value="en">EN</option>
          </select>
        </div>
      }
    >
      <div className="space-y-4">
        {visibleFields.map(({ field, label, helper, multiline, rows }) => {
          const stored = welcomeScreen?.[field];
          const value = stored ?? defaults[field];
          return (
            <Fragment key={`${field}-${defaultLocale}-${stored ?? ""}`}>
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <label className="typo-label">{label}</label>
                  {stored && onChangeWelcomeScreen && (
                    <button
                      type="button"
                      onClick={() => commit(field, "")}
                      className="btn-link text-xs"
                    >
                      Reset to default
                    </button>
                  )}
                </div>
                {multiline ? (
                  <textarea
                    defaultValue={value}
                    onBlur={(e) => commit(field, e.target.value)}
                    rows={rows ?? 3}
                    className="input resize-none"
                    disabled={!onChangeWelcomeScreen}
                  />
                ) : (
                  <input
                    type="text"
                    defaultValue={value}
                    onBlur={(e) => commit(field, e.target.value)}
                    className="input"
                    disabled={!onChangeWelcomeScreen}
                  />
                )}
                {helper && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {helper}
                  </p>
                )}
              </div>
              {field === "tagline" && greetingToggle}
            </Fragment>
          );
        })}
        <div>
          <label className="typo-label">Image URL (optional)</label>
          <input
            key={`welcome-imageUrl-${welcomeScreen?.imageUrl ?? ""}`}
            type="url"
            defaultValue={welcomeScreen?.imageUrl ?? ""}
            onBlur={(e) => commitImageUrl(e.target.value)}
            placeholder="https://…"
            className="input"
            disabled={!onChangeWelcomeScreen}
          />
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Shown beside the welcome copy, like a section image. Leave empty for
            text only.
          </p>
        </div>
      </div>
      <p className="text-xs mt-4" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
        {customCount === 0
          ? "Nothing customised yet — participants see the built-in copy in their own language."
          : `${customCount} field${customCount === 1 ? "" : "s"} customised. Customised text is shown as written, in both NL and EN.`}
        {" The email field, the time estimate and the start button are not customisable — they stay in the participant\u2019s own language."}
      </p>
    </SectionCard>
  );
}


// ── Right-pane: Level (respondent-variable) view ─────────────────

interface RespondentVariableFieldMeta {
  field: RespondentVariableCopyField;
  label: string;
  helper?: string;
  multiline?: boolean;
  placeholder?: string;
}

const RESPONDENT_VARIABLE_FIELDS: RespondentVariableFieldMeta[] = [
  { field: "label", label: "Question", helper: "The heading of the step." },
  {
    field: "helpText",
    label: "Explanation",
    helper: "Why you are asking and what the answer changes.",
    multiline: true,
  },
  {
    field: "helpUrl",
    label: "Look-it-up link (optional)",
    helper:
      "Where someone can check which level fits them. Leave empty to show no link.",
    placeholder: "https://…",
  },
];

/**
 * The same arrangement as the welcome screen: every field starts on the built-in
 * copy and only text that actually differs is stored, so anything left alone
 * stays bilingual and a cleared field falls straight back to the default.
 *
 * The options are shown but not editable. They are the client's cultural levels
 * and double as the join key onto each value's behaviours — a level typed here
 * would show that participant no behaviours at all. They follow the client's
 * Cultural DNA instead.
 */
function RespondentVariableView(props: SurveyEditorShellProps) {
  const { respondentVariable, onChangeRespondentVariable } = props;
  const [defaultLocale, setDefaultLocale] = useState<Locale>("nl");
  const defaults = useMemo(
    () => defaultRespondentVariableCopy(defaultLocale),
    [defaultLocale]
  );
  if (!respondentVariable) {
    return <EmptyState text="This survey does not ask for a level." />;
  }
  const { copy, options } = respondentVariable;
  const editable = !!onChangeRespondentVariable;

  function commit(field: RespondentVariableCopyField, raw: string) {
    if (!onChangeRespondentVariable) return;
    const value = raw.trim();
    const next: IRespondentVariableCopy = { ...copy };
    if (!value || value === defaults[field]) delete next[field];
    else next[field] = value;
    // Compared against the stored copy so tabbing through without typing does
    // not fire a save per field.
    const changed = RESPONDENT_VARIABLE_COPY_FIELDS.some(
      (f) => (next[f] ?? "") !== (copy[f] ?? "")
    );
    if (changed) onChangeRespondentVariable(next);
  }

  const customCount = RESPONDENT_VARIABLE_COPY_FIELDS.filter((f) => copy[f]).length;

  return (
    <SectionCard
      title="Level question"
      helper="Asked once, right before the first question whose content depends on it. The answer decides which behaviours a participant sees per value, and slices the results afterwards."
      action={
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Default copy
          </span>
          <select
            value={defaultLocale}
            onChange={(e) => setDefaultLocale(e.target.value as Locale)}
            className="input input-sm"
            style={{ width: 76 }}
            aria-label="Language of the built-in copy"
          >
            <option value="nl">NL</option>
            <option value="en">EN</option>
          </select>
        </div>
      }
    >
      <div className="space-y-4">
        {RESPONDENT_VARIABLE_FIELDS.map(({ field, label, helper, multiline, placeholder }) => {
          const stored = copy[field];
          const value = stored ?? defaults[field];
          return (
            <div key={`${field}-${defaultLocale}-${stored ?? ""}`}>
              <div className="flex items-baseline justify-between gap-3">
                <label className="typo-label">{label}</label>
                {stored && editable && (
                  <button
                    type="button"
                    onClick={() => commit(field, "")}
                    className="btn-link text-xs"
                  >
                    Reset to default
                  </button>
                )}
              </div>
              {multiline ? (
                <textarea
                  defaultValue={value}
                  onBlur={(e) => commit(field, e.target.value)}
                  rows={3}
                  className="input resize-none"
                  disabled={!editable}
                />
              ) : (
                <input
                  type="text"
                  defaultValue={value}
                  onBlur={(e) => commit(field, e.target.value)}
                  className="input"
                  placeholder={placeholder}
                  disabled={!editable}
                />
              )}
              {helper && (
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {helper}
                </p>
              )}
            </div>
          );
        })}

        <div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={copy.required !== false}
              disabled={!editable}
              onChange={(e) => {
                if (!onChangeRespondentVariable) return;
                const next: IRespondentVariableCopy = { ...copy };
                if (e.target.checked) delete next.required;
                else next.required = false;
                onChangeRespondentVariable(next);
              }}
            />
            <span style={{ color: "var(--text-primary)" }}>Answer required</span>
          </label>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {copy.required === false
              ? "Optional — someone who skips it sees every level's behaviours and lands outside the segments."
              : "Participants cannot continue past this step without picking a level."}
          </p>
        </div>

        <div>
          <label className="typo-label">Options</label>
          {options.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {editable
                ? "This client has no cultural levels yet — add them to the client's Cultural DNA and the step will offer them here."
                : "Levels come from the client's Cultural DNA once a session is created."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {options.map((option) => (
                <span
                  key={option}
                  className="text-xs px-2 py-1 rounded-badge"
                  style={{ background: "var(--bg-neutral)", color: "var(--text-muted)" }}
                >
                  {option}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
            Not editable here — the levels come from the client&rsquo;s Cultural DNA,
            where each value&rsquo;s behaviours are filed under them.
          </p>
        </div>
      </div>

      <p className="text-xs mt-4" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
        {customCount === 0
          ? "Nothing customised yet — participants see the built-in copy in their own language."
          : `${customCount} field${customCount === 1 ? "" : "s"} customised. Customised text is shown as written, in both NL and EN.`}
      </p>
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

// ── Right-pane: Thank-you screen view ────────────────────────────

interface ClosingFieldMeta {
  field: ClosingScreenField;
  label: string;
  helper?: string;
  multiline?: boolean;
  rows?: number;
}

const CLOSING_FIELDS: ClosingFieldMeta[] = [
  {
    field: "headline",
    label: "Headline",
    helper: "The big line above the message. {company} is replaced with the client name.",
  },
  {
    field: "body",
    label: "Message",
    helper:
      "What happens next, who to thank, where results go. Leave a blank line between paragraphs. {company} is supported.",
    multiline: true,
    rows: 5,
  },
];

/**
 * The closing counterpart of `WelcomeView`, with one wrinkle: a survey authored
 * before this screen existed carries its message in the legacy `thankYouText`.
 * That text is the effective body until something is saved, so it is folded into
 * the object every commit sends — otherwise editing only the headline would
 * hand over to `closingScreen` and drop the sentence participants were reading.
 */
function ClosingScreenView(props: SurveyEditorShellProps) {
  const { closingScreen, closingThankYouText, onChangeClosingScreen, clientCompany } = props;
  const [defaultLocale, setDefaultLocale] = useState<Locale>("nl");
  const defaults = useMemo(() => defaultClosingCopy(defaultLocale), [defaultLocale]);

  const legacy = closingThankYouText?.trim();
  const current: ISurveyClosingScreen = useMemo(
    () => (legacy && !closingScreen?.body ? { ...closingScreen, body: legacy } : { ...closingScreen }),
    [closingScreen, legacy]
  );

  function commit(field: ClosingScreenField, raw: string) {
    if (!onChangeClosingScreen) return;
    const value = raw.trim();
    const next: ISurveyClosingScreen = { ...current };
    if (!value || value === defaults[field]) delete next[field];
    else next[field] = value;
    const changed = CLOSING_SCREEN_FIELDS.some((f) => (next[f] ?? "") !== (current[f] ?? ""));
    if (changed) onChangeClosingScreen(next);
  }

  /** Not an override of a default — empty simply means no image. */
  function commitImageUrl(raw: string) {
    if (!onChangeClosingScreen) return;
    const value = raw.trim();
    if (value === (current.imageUrl ?? "")) return;
    const next: ISurveyClosingScreen = { ...current };
    if (value) next.imageUrl = value;
    else delete next.imageUrl;
    onChangeClosingScreen(next);
  }

  const customCount = CLOSING_SCREEN_FIELDS.filter((f) => current[f]).length;

  return (
    <SectionCard
      title="Thank-you screen"
      helper="The last thing participants see, after their final answer. Every field starts on the built-in copy — edit what you want to change, or clear a field to go back to the default."
      action={
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Default copy
          </span>
          <select
            value={defaultLocale}
            onChange={(e) => setDefaultLocale(e.target.value as Locale)}
            className="input input-sm"
            style={{ width: 76 }}
            aria-label="Language of the built-in copy"
          >
            <option value="nl">NL</option>
            <option value="en">EN</option>
          </select>
        </div>
      }
    >
      <div className="space-y-4">
        {CLOSING_FIELDS.map(({ field, label, helper, multiline, rows }) => {
          const stored = current[field];
          const value = stored ?? defaults[field];
          return (
            <div key={`${field}-${defaultLocale}-${stored ?? ""}`}>
              <div className="flex items-baseline justify-between gap-3">
                <label className="typo-label">{label}</label>
                {stored && onChangeClosingScreen && (
                  <button
                    type="button"
                    onClick={() => commit(field, "")}
                    className="btn-link text-xs"
                  >
                    Reset to default
                  </button>
                )}
              </div>
              {multiline ? (
                <textarea
                  defaultValue={value}
                  onBlur={(e) => commit(field, e.target.value)}
                  rows={rows ?? 3}
                  className="input resize-none"
                  disabled={!onChangeClosingScreen}
                />
              ) : (
                <input
                  type="text"
                  defaultValue={value}
                  onBlur={(e) => commit(field, e.target.value)}
                  className="input"
                  disabled={!onChangeClosingScreen}
                />
              )}
              {helper && (
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {helper}
                </p>
              )}
            </div>
          );
        })}
        <div>
          <label className="typo-label">Image URL (optional)</label>
          <input
            key={`closing-imageUrl-${current.imageUrl ?? ""}`}
            type="url"
            defaultValue={current.imageUrl ?? ""}
            onBlur={(e) => commitImageUrl(e.target.value)}
            placeholder="https://…"
            className="input"
            disabled={!onChangeClosingScreen}
          />
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Shown beside the message, like the welcome screen&rsquo;s. With an image the
            copy moves to the left and is left-aligned; without one it stays centred.
          </p>
        </div>
      </div>
      <p className="text-xs mt-4" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
        {customCount === 0
          ? "Nothing customised yet — participants see the built-in copy in their own language."
          : `${customCount} field${customCount === 1 ? "" : "s"} customised. Customised text is shown as written, in both NL and EN.`}
      </p>
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
          <div>
            <label className="typo-label">Image URL (optional)</label>
            <input
              key={`${section.id}-imageUrl`}
              type="url"
              defaultValue={section.imageUrl ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (section.imageUrl ?? "")) {
                  onUpdateSection(section.id, { imageUrl: v || undefined });
                }
              }}
              placeholder="https://…"
              className="input"
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
  culturalValues,
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
      culturalValues={culturalValues}
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
