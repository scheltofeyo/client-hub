import { randomUUID } from "node:crypto";
import type { SurveyQuestionType } from "@/lib/models/SurveyTemplateQuestion";
import { isSurveyQuestionType, normalizeQuestionType } from "./types";

export type ValidationResult<T = Record<string, unknown>> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface BuildQuestionInput {
  type?: unknown;
  title?: unknown;
  description?: unknown;
  sectionId?: unknown;
  archetypeIds?: string[]; // template-level, passed by caller

  // archetype-ranking
  options?: unknown;

  // general-ranking
  rankingItems?: unknown;

  // multiple-choice
  choiceMode?: unknown;
  choices?: unknown;
  maxSelections?: unknown;

  // open-text
  placeholder?: unknown;
  multiline?: unknown;
  required?: unknown;

  // intro
  bodyHtml?: unknown;
}

export interface BuildQuestionDefaults {
  archetypeIds?: string[];
}

interface OptionLike {
  id?: string;
  archetypeId?: string;
  text?: string;
}

interface RankingItemLike {
  id?: string;
  text?: string;
}

interface ChoiceLike {
  id?: string;
  text?: string;
}

function trim(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeOptions(input: unknown, archetypeIds: string[]): {
  id: string;
  archetypeId: string;
  text: string;
}[] {
  if (!Array.isArray(input)) {
    return archetypeIds.map((aid) => ({ id: randomUUID(), archetypeId: aid, text: "" }));
  }
  const byArchetype = new Map<string, OptionLike>();
  for (const raw of input) {
    if (raw && typeof raw === "object" && typeof (raw as OptionLike).archetypeId === "string") {
      byArchetype.set((raw as OptionLike).archetypeId!, raw as OptionLike);
    }
  }
  return archetypeIds.map((aid) => {
    const existing = byArchetype.get(aid);
    return {
      id: typeof existing?.id === "string" && existing.id ? existing.id : randomUUID(),
      archetypeId: aid,
      text: trim(existing?.text),
    };
  });
}

function normalizeRankingItems(input: unknown): { id: string; text: string }[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((r): r is RankingItemLike => r !== null && typeof r === "object")
    .map((r) => ({
      id: typeof r.id === "string" && r.id ? r.id : randomUUID(),
      text: trim(r.text),
    }));
}

function normalizeChoices(input: unknown): { id: string; text: string }[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((r): r is ChoiceLike => r !== null && typeof r === "object")
    .map((r) => ({
      id: typeof r.id === "string" && r.id ? r.id : randomUUID(),
      text: trim(r.text),
    }));
}

/**
 * Build the create-payload for a new question.
 * Accepts incomplete data (allows authoring blanks). Title is required for non-intro.
 */
export function buildCreateQuestion(
  body: BuildQuestionInput,
  defaults: BuildQuestionDefaults
): ValidationResult<{
  type: SurveyQuestionType;
  title: string;
  description?: string;
  options?: { id: string; archetypeId: string; text: string }[];
  rankingItems?: { id: string; text: string }[];
  choiceMode?: "single" | "multi";
  choices?: { id: string; text: string }[];
  maxSelections?: number;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  bodyHtml?: string;
}> {
  const type = normalizeQuestionType(body.type);
  const title = trim(body.title);
  if (type !== "intro" && !title) {
    return { ok: false, error: "Title is required" };
  }
  const description = trim(body.description) || undefined;

  const out: Record<string, unknown> = { type, title: title || "", description };

  // Default required: true for every non-intro question type.
  const defaultRequired = body.required !== false;

  switch (type) {
    case "archetype-ranking":
    case "archetype-top3": {
      const archetypeIds = defaults.archetypeIds ?? [];
      out.options = normalizeOptions(body.options, archetypeIds);
      out.required = defaultRequired;
      break;
    }
    case "general-ranking":
    case "general-top3": {
      const items = normalizeRankingItems(body.rankingItems);
      // Top-3 needs at least 4 items to be meaningful; ranking needs at least 3.
      const minItems = type === "general-top3" ? 4 : 3;
      out.rankingItems = items.length > 0
        ? items
        : Array.from({ length: minItems }, () => ({ id: randomUUID(), text: "" }));
      out.required = defaultRequired;
      break;
    }
    case "multiple-choice": {
      const mode = body.choiceMode === "multi" ? "multi" : "single";
      const items = normalizeChoices(body.choices);
      out.choiceMode = mode;
      out.choices = items.length > 0
        ? items
        : [
            { id: randomUUID(), text: "" },
            { id: randomUUID(), text: "" },
          ];
      if (mode === "multi" && typeof body.maxSelections === "number" && body.maxSelections > 0) {
        out.maxSelections = body.maxSelections;
      }
      out.required = defaultRequired;
      break;
    }
    case "open-text": {
      const placeholder = trim(body.placeholder);
      if (placeholder) out.placeholder = placeholder;
      out.multiline = body.multiline === true;
      out.required = defaultRequired;
      break;
    }
    case "intro": {
      const bodyHtml = typeof body.bodyHtml === "string" ? body.bodyHtml : "";
      if (bodyHtml) out.bodyHtml = bodyHtml;
      break;
    }
  }

  return { ok: true, value: out as Parameters<typeof buildCreateQuestion>[0] as never };
}

export type PatchQuestionInput = BuildQuestionInput;

/**
 * Build a $set object for PATCH. Only includes keys that appear in `body`.
 * Validates per-type when type-specific fields are provided.
 */
export function buildPatchQuestion(
  body: PatchQuestionInput,
  existingType: SurveyQuestionType,
  defaults: BuildQuestionDefaults
): ValidationResult<Record<string, unknown>> {
  const update: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = trim(body.title);
    if (existingType !== "intro" && !title) {
      return { ok: false, error: "Title cannot be empty" };
    }
    update.title = title;
  }
  if (body.description !== undefined) {
    const d = trim(body.description);
    update.description = d || undefined;
  }
  if (body.sectionId !== undefined && typeof body.sectionId === "string") {
    update.sectionId = body.sectionId;
  }
  if (body.type !== undefined) {
    if (!isSurveyQuestionType(body.type)) {
      return { ok: false, error: "Invalid question type" };
    }
    // Note: type changes are allowed by the schema but discouraged by UX (no conversion in v1).
    update.type = body.type;
  }

  // type-specific (only when explicitly provided)
  if (body.options !== undefined) {
    const archetypeIds = defaults.archetypeIds ?? [];
    update.options = normalizeOptions(body.options, archetypeIds);
  }
  if (body.rankingItems !== undefined) {
    update.rankingItems = normalizeRankingItems(body.rankingItems);
  }
  if (body.choiceMode !== undefined) {
    update.choiceMode = body.choiceMode === "multi" ? "multi" : "single";
  }
  if (body.choices !== undefined) {
    update.choices = normalizeChoices(body.choices);
  }
  if (body.maxSelections !== undefined) {
    if (body.maxSelections === null) update.maxSelections = undefined;
    else if (typeof body.maxSelections === "number" && body.maxSelections > 0) {
      update.maxSelections = body.maxSelections;
    }
  }
  if (body.placeholder !== undefined) {
    update.placeholder = trim(body.placeholder) || undefined;
  }
  if (body.multiline !== undefined) update.multiline = !!body.multiline;
  if (body.required !== undefined) update.required = !!body.required;
  if (body.bodyHtml !== undefined) {
    update.bodyHtml = typeof body.bodyHtml === "string" ? body.bodyHtml : "";
  }

  return { ok: true, value: update };
}
