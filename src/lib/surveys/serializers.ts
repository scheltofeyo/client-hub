import type {
  ISurveyTemplateQuestion,
  SurveyQuestionType,
} from "@/lib/models/SurveyTemplateQuestion";
import type { ISurveyQuestionSnapshot } from "@/lib/models/SurveySession";
import { normalizeQuestionType } from "./types";

export interface SerializedQuestion {
  id: string;
  sectionId: string;
  type: SurveyQuestionType;
  title: string;
  description?: string;
  order: number;

  options?: { id: string; archetypeId: string; text: string }[];
  rankingItems?: { id: string; text: string }[];
  choiceMode?: "single" | "multi";
  choices?: { id: string; text: string }[];
  maxSelections?: number;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  bodyHtml?: string;

  // legacy (pre-migration) — still emitted so the existing editor handles old templates
  openTextEnabled?: boolean;
  openTextLabel?: string;
}

type QuestionLike = Partial<ISurveyTemplateQuestion> & {
  _id?: { toString(): string } | string;
  options?: ISurveyTemplateQuestion["options"];
  rankingItems?: ISurveyTemplateQuestion["rankingItems"];
  choices?: ISurveyTemplateQuestion["choices"];
};

/**
 * Serialize a question document (DB shape) for the wire / editor.
 * Only emits fields relevant to the question's `type`, plus legacy bits for safety.
 */
export function serializeQuestion(doc: QuestionLike): SerializedQuestion {
  const type = normalizeQuestionType(doc.type);
  const idValue = doc._id;
  const id = typeof idValue === "string" ? idValue : idValue?.toString() ?? "";
  const out: SerializedQuestion = {
    id,
    sectionId: doc.sectionId ?? "",
    type,
    title: doc.title ?? "",
    description: doc.description ?? undefined,
    order: doc.order ?? 0,
  };

  switch (type) {
    case "archetype-ranking":
    case "archetype-top3":
      out.options = (doc.options ?? []).map((o) => ({
        id: o.id,
        archetypeId: o.archetypeId,
        text: o.text ?? "",
      }));
      out.required = doc.required !== false;
      break;
    case "general-ranking":
    case "general-top3":
      out.rankingItems = (doc.rankingItems ?? []).map((i) => ({
        id: i.id,
        text: i.text ?? "",
      }));
      out.required = doc.required !== false;
      break;
    case "multiple-choice":
      out.choiceMode = doc.choiceMode ?? "single";
      out.choices = (doc.choices ?? []).map((c) => ({ id: c.id, text: c.text ?? "" }));
      if (typeof doc.maxSelections === "number") out.maxSelections = doc.maxSelections;
      out.required = doc.required !== false;
      break;
    case "open-text":
      if (doc.placeholder) out.placeholder = doc.placeholder;
      if (doc.multiline) out.multiline = true;
      out.required = doc.required !== false;
      break;
    case "intro":
      if (doc.bodyHtml) out.bodyHtml = doc.bodyHtml;
      break;
  }

  // legacy fields surfaced for old archetype-ranking questions that still carry openText config
  if (doc.openTextEnabled) out.openTextEnabled = true;
  if (doc.openTextLabel) out.openTextLabel = doc.openTextLabel;

  return out;
}

/**
 * Serialize a question for inclusion in a session snapshot (no _id, frozen layout).
 */
export function snapshotQuestionFrom(
  doc: QuestionLike & { _id?: { toString(): string } | string }
): ISurveyQuestionSnapshot {
  const serialized = serializeQuestion(doc);
  return {
    id: serialized.id,
    type: serialized.type,
    title: serialized.title,
    description: serialized.description,
    order: serialized.order,
    options: serialized.options,
    rankingItems: serialized.rankingItems,
    choiceMode: serialized.choiceMode,
    choices: serialized.choices,
    maxSelections: serialized.maxSelections,
    placeholder: serialized.placeholder,
    multiline: serialized.multiline,
    required: serialized.required,
    bodyHtml: serialized.bodyHtml,
    openTextEnabled: serialized.openTextEnabled,
    openTextLabel: serialized.openTextLabel,
  };
}

export interface PublicSerializedQuestion {
  id: string;
  type: SurveyQuestionType;
  title: string;
  description?: string;
  order: number;

  // archetype-ranking: archetypeId stripped so participants can't see the mapping
  options?: { id: string; text: string }[];
  rankingItems?: { id: string; text: string }[];
  choiceMode?: "single" | "multi";
  choices?: { id: string; text: string }[];
  maxSelections?: number;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  bodyHtml?: string;
}

/**
 * Public-facing question (participant view). Strips archetypeId from options.
 */
export function serializeQuestionForPublic(
  q: ISurveyQuestionSnapshot
): PublicSerializedQuestion {
  const type = normalizeQuestionType(q.type);
  const out: PublicSerializedQuestion = {
    id: q.id,
    type,
    title: q.title,
    description: q.description ?? undefined,
    order: q.order ?? 0,
  };
  switch (type) {
    case "archetype-ranking":
    case "archetype-top3":
      out.options = (q.options ?? []).map((o) => ({ id: o.id, text: o.text }));
      out.required = q.required !== false;
      break;
    case "general-ranking":
    case "general-top3":
      out.rankingItems = (q.rankingItems ?? []).map((i) => ({ id: i.id, text: i.text }));
      out.required = q.required !== false;
      break;
    case "multiple-choice":
      out.choiceMode = q.choiceMode ?? "single";
      out.choices = (q.choices ?? []).map((c) => ({ id: c.id, text: c.text }));
      if (typeof q.maxSelections === "number") out.maxSelections = q.maxSelections;
      out.required = q.required !== false;
      break;
    case "open-text":
      if (q.placeholder) out.placeholder = q.placeholder;
      if (q.multiline) out.multiline = true;
      out.required = q.required !== false;
      break;
    case "intro":
      if (q.bodyHtml) out.bodyHtml = q.bodyHtml;
      break;
  }
  return out;
}
