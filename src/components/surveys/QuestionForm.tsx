"use client";

import { ArrowLeft, ArrowRight, GripVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import SectionCard from "@/components/ui/SectionCard";
import RichTextEditor from "@/components/ui/RichTextEditor";
import ArchetypePill, { type ArchetypeLite } from "./ArchetypePill";
import { QUESTION_TYPE_META, type ShellQuestionAny } from "./question-types";
import { TOP3_RANK_LENGTH } from "@/lib/surveys/types";

export type QuestionFormQuestion = ShellQuestionAny;

export interface QuestionFormProps {
  sectionTitle: string;
  questionIndex: number;
  totalQuestionsInSection: number;
  question: ShellQuestionAny;
  archetypes: ArchetypeLite[];
  onChange: (updates: Partial<ShellQuestionAny>) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onDelete?: () => void;
}

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export default function QuestionForm({
  sectionTitle,
  questionIndex,
  totalQuestionsInSection,
  question,
  archetypes,
  onChange,
  onPrev,
  onNext,
  onDelete,
}: QuestionFormProps) {
  const meta = QUESTION_TYPE_META[question.type];
  const TypeIcon = meta.icon;
  const supportsRequired = question.type !== "intro";
  const isRequired = supportsRequired ? (question as { required?: boolean }).required !== false : false;

  return (
    <SectionCard
      breadcrumb={`Section · ${sectionTitle} / ${meta.label} ${questionIndex + 1} of ${totalQuestionsInSection}`}
      title=""
      action={
        <div className="flex items-center gap-3">
          {supportsRequired && (
            <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => onChange({ required: e.target.checked } as Partial<ShellQuestionAny>)}
              />
              <span style={{ color: "var(--text-muted)" }}>Required</span>
            </label>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="btn-icon-danger"
              aria-label="Delete block"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      }
      footer={
        (onPrev || onNext) && (
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={onPrev}
              disabled={!onPrev}
              className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-sm disabled:opacity-40"
            >
              <ArrowLeft size={14} />
              Previous
            </button>
            <span className="text-xs inline-flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <TypeIcon size={12} style={{ color: meta.color }} />
              {meta.label}
            </span>
            <button
              type="button"
              onClick={onNext}
              disabled={!onNext}
              className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-sm disabled:opacity-40"
            >
              Next
              <ArrowRight size={14} />
            </button>
          </div>
        )
      }
    >
      <QuestionTypeRouter
        question={question}
        archetypes={archetypes}
        onChange={onChange}
      />
    </SectionCard>
  );
}

function QuestionTypeRouter({
  question,
  archetypes,
  onChange,
}: {
  question: ShellQuestionAny;
  archetypes: ArchetypeLite[];
  onChange: (updates: Partial<ShellQuestionAny>) => void;
}) {
  switch (question.type) {
    case "archetype-ranking":
    case "archetype-top3":
      return (
        <ArchetypeRankingEditor question={question} archetypes={archetypes} onChange={onChange} />
      );
    case "general-ranking":
    case "general-top3":
      return <GeneralRankingEditor question={question} onChange={onChange} />;
    case "multiple-choice":
      return <MultipleChoiceEditor question={question} onChange={onChange} />;
    case "open-text":
      return <OpenTextEditor question={question} onChange={onChange} />;
    case "intro":
      return <IntroEditor question={question} onChange={onChange} />;
  }
}

// ── Shared title/description fields ─────────────────────────────────

function TitleField({
  title,
  placeholder,
  onCommit,
}: {
  title: string;
  placeholder: string;
  onCommit: (v: string) => void;
}) {
  return (
    <div>
      <label className="typo-label">Title</label>
      <input
        type="text"
        defaultValue={title}
        onBlur={(e) => {
          const v = e.target.value;
          if (v !== title) onCommit(v);
        }}
        placeholder={placeholder}
        className="input typo-card-title"
        style={{ background: "var(--bg-elevated)" }}
      />
    </div>
  );
}

function DescriptionField({
  description,
  onCommit,
}: {
  description?: string;
  onCommit: (v: string) => void;
}) {
  return (
    <div>
      <label className="typo-label">Description (optional)</label>
      <textarea
        defaultValue={description ?? ""}
        onBlur={(e) => {
          if (e.target.value !== (description ?? "")) onCommit(e.target.value);
        }}
        rows={2}
        placeholder="Extra context shown to participants"
        className="input resize-none"
      />
    </div>
  );
}

// ── Archetype ranking editor ───────────────────────────────────────

function ArchetypeRankingEditor({
  question,
  archetypes,
  onChange,
}: {
  question: Extract<ShellQuestionAny, { type: "archetype-ranking" | "archetype-top3" }>;
  archetypes: ArchetypeLite[];
  onChange: (updates: Partial<ShellQuestionAny>) => void;
}) {
  const archetypeMap = new Map(archetypes.map((a) => [a.id, a]));
  const isTop3 = question.type === "archetype-top3";
  // Top-3 needs 3 filled slots; full ranking needs at least 2 items to be a ranking.
  const minOptions = isTop3 ? TOP3_RANK_LENGTH : 2;
  const includedIds = new Set(question.options.map((o) => o.archetypeId));
  const availableToAdd = archetypes.filter((a) => !includedIds.has(a.id));
  const canRemove = question.options.length > minOptions;

  function removeOption(optId: string) {
    if (!canRemove) return;
    onChange({ options: question.options.filter((o) => o.id !== optId) });
  }
  function addArchetype(archetypeId: string) {
    if (includedIds.has(archetypeId)) return;
    onChange({
      options: [
        ...question.options,
        { id: uuid(), archetypeId, text: "" },
      ],
    });
  }

  return (
    <div className="space-y-5">
      <TitleField
        title={question.title}
        placeholder="What's the question?"
        onCommit={(v) => onChange({ title: v })}
      />
      <DescriptionField
        description={question.description}
        onCommit={(v) => onChange({ description: v })}
      />
      <div>
        <label className="typo-label">Options · one per archetype</label>
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          {isTop3
            ? `Participants pick 3 options from this list. Only ranks 1–3 are scored. Minimum ${minOptions} options.`
            : `Participants rank every option. Minimum ${minOptions} options.`}
        </p>
        <div className="space-y-1.5">
          {question.options.map((opt) => {
            const a = archetypeMap.get(opt.archetypeId);
            if (!a) return null;
            return (
              <ArchetypeOptionRow
                key={opt.id}
                archetype={a}
                text={opt.text}
                canRemove={canRemove}
                removeLabel={
                  canRemove
                    ? "Remove archetype from this question"
                    : `At least ${minOptions} archetypes are required`
                }
                onRemove={() => removeOption(opt.id)}
                onCommit={(text) => {
                  if (text === opt.text) return;
                  onChange({
                    options: question.options.map((o) =>
                      o.id === opt.id ? { ...o, text } : o
                    ),
                  });
                }}
              />
            );
          })}
        </div>
        {availableToAdd.length > 0 && (
          <div className="mt-3">
            <p className="typo-label">Add archetype</p>
            <div className="flex flex-wrap gap-1.5">
              {availableToAdd.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => addArchetype(a.id)}
                  className="inline-flex items-center gap-1 rounded-button border px-2 py-1 text-xs hover:bg-hover"
                  style={{ borderColor: "var(--border)" }}
                  aria-label={`Add ${a.name} to this question`}
                >
                  <Plus size={12} />
                  <ArchetypePill archetype={a} size="sm" variant="solid" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ArchetypeOptionRow({
  archetype,
  text,
  canRemove,
  removeLabel,
  onRemove,
  onCommit,
}: {
  archetype: ArchetypeLite;
  text: string;
  canRemove: boolean;
  removeLabel: string;
  onRemove: () => void;
  onCommit: (text: string) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="pt-1.5 shrink-0" style={{ minWidth: 140 }}>
        <ArchetypePill archetype={archetype} size="sm" variant="solid" />
      </div>
      <input
        type="text"
        defaultValue={text}
        onBlur={(e) => onCommit(e.target.value)}
        placeholder="Option text"
        className="input"
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={removeLabel}
        title={removeLabel}
        className="btn-icon mt-1 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ── General ranking editor ─────────────────────────────────────────

function GeneralRankingEditor({
  question,
  onChange,
}: {
  question: Extract<ShellQuestionAny, { type: "general-ranking" | "general-top3" }>;
  onChange: (updates: Partial<ShellQuestionAny>) => void;
}) {
  function setItems(items: typeof question.rankingItems) {
    onChange({ rankingItems: items });
  }
  const isTop3 = question.type === "general-top3";
  return (
    <div className="space-y-5">
      <TitleField
        title={question.title}
        placeholder={isTop3 ? "What top 3 should participants pick?" : "What should participants rank?"}
        onCommit={(v) => onChange({ title: v })}
      />
      <DescriptionField
        description={question.description}
        onCommit={(v) => onChange({ description: v })}
      />
      <div>
        <label className="typo-label">{isTop3 ? "Items to pick from" : "Items to rank"}</label>
        {isTop3 && (
          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
            Participants pick 3 items from this list. Add at least 4 items.
          </p>
        )}
        <div className="space-y-1.5">
          {question.rankingItems.map((item) => (
            <RankItemRow
              key={item.id}
              text={item.text}
              onCommit={(text) =>
                text === item.text
                  ? undefined
                  : setItems(
                      question.rankingItems.map((i) =>
                        i.id === item.id ? { ...i, text } : i
                      )
                    )
              }
              onDelete={() =>
                setItems(question.rankingItems.filter((i) => i.id !== item.id))
              }
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setItems([...question.rankingItems, { id: uuid(), text: "" }])}
          className="btn-tertiary inline-flex items-center gap-1.5 mt-2 text-xs"
        >
          <Plus size={12} />
          Add item
        </button>
      </div>
    </div>
  );
}

function RankItemRow({
  text,
  onCommit,
  onDelete,
}: {
  text: string;
  onCommit: (text: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <GripVertical
        size={14}
        style={{ color: "var(--text-muted)", opacity: 0.5, flexShrink: 0 }}
      />
      <input
        type="text"
        defaultValue={text}
        onBlur={(e) => onCommit(e.target.value)}
        placeholder="Item text"
        className="input"
      />
      <button
        type="button"
        onClick={onDelete}
        className="btn-icon-danger shrink-0"
        aria-label="Remove item"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ── Multiple choice editor ────────────────────────────────────────

function MultipleChoiceEditor({
  question,
  onChange,
}: {
  question: Extract<ShellQuestionAny, { type: "multiple-choice" }>;
  onChange: (updates: Partial<ShellQuestionAny>) => void;
}) {
  function setChoices(choices: typeof question.choices) {
    onChange({ choices });
  }
  return (
    <div className="space-y-5">
      <TitleField
        title={question.title}
        placeholder="What's the question?"
        onCommit={(v) => onChange({ title: v })}
      />
      <DescriptionField
        description={question.description}
        onCommit={(v) => onChange({ description: v })}
      />
      <div>
        <label className="typo-label">Mode</label>
        <div className="flex items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-1.5">
            <input
              type="radio"
              checked={question.choiceMode === "single"}
              onChange={() => onChange({ choiceMode: "single" })}
            />
            <span style={{ color: "var(--text-primary)" }}>One answer</span>
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="radio"
              checked={question.choiceMode === "multi"}
              onChange={() => onChange({ choiceMode: "multi" })}
            />
            <span style={{ color: "var(--text-primary)" }}>Multiple answers</span>
          </label>
        </div>
      </div>
      <div>
        <label className="typo-label">Choices</label>
        <div className="space-y-1.5">
          {question.choices.map((c) => (
            <ChoiceRow
              key={c.id}
              text={c.text}
              onCommit={(text) =>
                text === c.text
                  ? undefined
                  : setChoices(
                      question.choices.map((x) => (x.id === c.id ? { ...x, text } : x))
                    )
              }
              onDelete={() => setChoices(question.choices.filter((x) => x.id !== c.id))}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setChoices([...question.choices, { id: uuid(), text: "" }])}
          className="btn-tertiary inline-flex items-center gap-1.5 mt-2 text-xs"
        >
          <Plus size={12} />
          Add choice
        </button>
      </div>
      {question.choiceMode === "multi" && (
        <div>
          <label className="typo-label">Max selections (optional)</label>
          <input
            type="number"
            min={1}
            defaultValue={question.maxSelections ?? ""}
            onBlur={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                if (question.maxSelections !== undefined) onChange({ maxSelections: undefined });
                return;
              }
              const n = Number(raw);
              if (Number.isFinite(n) && n > 0 && n !== question.maxSelections) {
                onChange({ maxSelections: n });
              }
            }}
            placeholder="No limit"
            className="input"
            style={{ maxWidth: 160 }}
          />
        </div>
      )}
    </div>
  );
}

function ChoiceRow({
  text,
  onCommit,
  onDelete,
}: {
  text: string;
  onCommit: (text: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <GripVertical
        size={14}
        style={{ color: "var(--text-muted)", opacity: 0.5, flexShrink: 0 }}
      />
      <input
        type="text"
        defaultValue={text}
        onBlur={(e) => onCommit(e.target.value)}
        placeholder="Choice text"
        className="input"
      />
      <button
        type="button"
        onClick={onDelete}
        className="btn-icon-danger shrink-0"
        aria-label="Remove choice"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ── Open text editor ─────────────────────────────────────────────

function OpenTextEditor({
  question,
  onChange,
}: {
  question: Extract<ShellQuestionAny, { type: "open-text" }>;
  onChange: (updates: Partial<ShellQuestionAny>) => void;
}) {
  return (
    <div className="space-y-5">
      <TitleField
        title={question.title}
        placeholder="What's the question?"
        onCommit={(v) => onChange({ title: v })}
      />
      <DescriptionField
        description={question.description}
        onCommit={(v) => onChange({ description: v })}
      />
      <div>
        <label className="typo-label">Answer format</label>
        <div className="flex items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-1.5">
            <input
              type="radio"
              checked={!question.multiline}
              onChange={() => onChange({ multiline: false })}
            />
            <span style={{ color: "var(--text-primary)" }}>Single line</span>
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="radio"
              checked={!!question.multiline}
              onChange={() => onChange({ multiline: true })}
            />
            <span style={{ color: "var(--text-primary)" }}>Paragraph</span>
          </label>
        </div>
      </div>
      <div>
        <label className="typo-label">Placeholder (optional)</label>
        <input
          type="text"
          defaultValue={question.placeholder ?? ""}
          onBlur={(e) => {
            if (e.target.value !== (question.placeholder ?? "")) {
              onChange({ placeholder: e.target.value });
            }
          }}
          placeholder="Type your answer…"
          className="input"
        />
      </div>
    </div>
  );
}

// ── Intro editor ─────────────────────────────────────────────────

function IntroEditor({
  question,
  onChange,
}: {
  question: Extract<ShellQuestionAny, { type: "intro" }>;
  onChange: (updates: Partial<ShellQuestionAny>) => void;
}) {
  // Track local content so RichTextEditor stays controlled across renders
  const [content, setContent] = useState(question.bodyHtml ?? "");
  return (
    <div className="space-y-5">
      <div>
        <label className="typo-label">Title (optional)</label>
        <input
          type="text"
          defaultValue={question.title}
          onBlur={(e) => {
            if (e.target.value !== question.title) onChange({ title: e.target.value });
          }}
          placeholder="Section heading"
          className="input typo-card-title"
          style={{ background: "var(--bg-elevated)" }}
        />
      </div>
      <div>
        <label className="typo-label">Content</label>
        <RichTextEditor
          content={content}
          onChange={(html) => setContent(html)}
          onBlur={(html) => {
            if (html !== (question.bodyHtml ?? "")) onChange({ bodyHtml: html });
          }}
          placeholder="Welcome the participants, explain the purpose…"
        />
      </div>
    </div>
  );
}
