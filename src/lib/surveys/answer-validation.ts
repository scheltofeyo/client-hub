import type {
  ISurveyQuestionSnapshot,
  ISurveySectionSnapshot,
} from "@/lib/models/SurveySession";
import type { SurveyQuestionType } from "@/lib/models/SurveyTemplateQuestion";
import { normalizeQuestionType, TOP3_RANK_LENGTH } from "./types";

export interface IncomingAnswer {
  questionId: string;
  type?: string;
  rankings?: Record<string, unknown>;
  selectedChoiceIds?: unknown;
  scaleValue?: unknown;
  scores?: Record<string, unknown>;
  text?: unknown;
}

export interface ValidatedAnswer {
  questionId: string;
  type: SurveyQuestionType;
  rankings?: Record<string, number>;
  selectedChoiceIds?: string[];
  scaleValue?: number;
  scores?: Record<string, number>;
  text?: string;
}

export type AnswerValidationResult =
  | { ok: true; answers: ValidatedAnswer[] }
  | { ok: false; error: string };

function validateRanking(
  question: ISurveyQuestionSnapshot,
  itemIds: string[],
  rankings: Record<string, unknown> | undefined,
  expectedRanks: number
): { ok: true; rankings: Record<string, number> } | { ok: false; error: string } {
  if (!rankings || typeof rankings !== "object") {
    return { ok: false, error: `Question ${question.id} has no rankings` };
  }
  const validIds = new Set(itemIds);
  const out: Record<string, number> = {};
  const ranksUsed = new Set<number>();
  for (const [id, raw] of Object.entries(rankings)) {
    if (!validIds.has(id)) continue;
    const r = Number(raw);
    if (!Number.isFinite(r) || r < 1 || r > expectedRanks) continue;
    if (ranksUsed.has(r)) {
      return {
        ok: false,
        error: `Each rank may be used only once per question (question ${question.id})`,
      };
    }
    ranksUsed.add(r);
    out[id] = r;
  }
  if (Object.keys(out).length !== validIds.size) {
    return { ok: false, error: `All items must be ranked for question ${question.id}` };
  }
  return { ok: true, rankings: out };
}

/**
 * Top-3 is all-or-nothing: either exactly ranks 1, 2, 3 are filled (each by a
 * distinct valid item), or the rankings map is empty (only allowed when the
 * question is not required — the caller skips that case before reaching here).
 */
function validateTop3(
  question: ISurveyQuestionSnapshot,
  itemIds: string[],
  rankings: Record<string, unknown> | undefined
): { ok: true; rankings: Record<string, number> } | { ok: false; error: string } {
  if (!rankings || typeof rankings !== "object") {
    return { ok: false, error: `Question ${question.id} has no rankings` };
  }
  const validIds = new Set(itemIds);
  const out: Record<string, number> = {};
  const ranksUsed = new Set<number>();
  for (const [id, raw] of Object.entries(rankings)) {
    if (!validIds.has(id)) continue;
    const r = Number(raw);
    if (!Number.isFinite(r) || r < 1 || r > TOP3_RANK_LENGTH) continue;
    if (ranksUsed.has(r)) {
      return {
        ok: false,
        error: `Each rank may be used only once per question (question ${question.id})`,
      };
    }
    ranksUsed.add(r);
    out[id] = r;
  }
  if (Object.keys(out).length !== TOP3_RANK_LENGTH) {
    return {
      ok: false,
      error: `Top 3 must have all three positions filled for question ${question.id}`,
    };
  }
  return { ok: true, rankings: out };
}

function scaleBounds(question: ISurveyQuestionSnapshot): { min: number; max: number } {
  return { min: question.scale?.min ?? 1, max: question.scale?.max ?? 5 };
}

function validateScaleValue(
  question: ISurveyQuestionSnapshot,
  raw: unknown
): { ok: true; value: number } | { ok: false; error: string } {
  const { min, max } = scaleBounds(question);
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    return {
      ok: false,
      error: `Question ${question.id} needs a whole number between ${min} and ${max}`,
    };
  }
  return { ok: true, value: n };
}

/**
 * A value-assessment carries one score per cultural value. All-or-nothing: a
 * partially scored question would silently under-represent the values a
 * respondent skipped in every average computed from it.
 */
function validateScores(
  question: ISurveyQuestionSnapshot,
  raw: Record<string, unknown> | undefined
): { ok: true; scores: Record<string, number> } | { ok: false; error: string } {
  const items = question.valueItems ?? [];
  if (items.length === 0) {
    return { ok: false, error: `Question ${question.id} has no values to score` };
  }
  const { min, max } = scaleBounds(question);
  const out: Record<string, number> = {};
  for (const item of items) {
    const n = Number((raw ?? {})[item.id]);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
      return { ok: false, error: `Score every value in question ${question.id}` };
    }
    out[item.id] = n;
  }
  return { ok: true, scores: out };
}

function validateMultipleChoice(
  question: ISurveyQuestionSnapshot,
  raw: unknown
): { ok: true; ids: string[] } | { ok: false; error: string } {
  const choices = question.choices ?? [];
  const validIds = new Set(choices.map((c) => c.id));
  const arr = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of arr) {
    if (typeof id !== "string" || !validIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  const mode = question.choiceMode ?? "single";
  if (mode === "single") {
    if (out.length !== 1) {
      return { ok: false, error: `Select exactly one option for question ${question.id}` };
    }
  } else {
    if (out.length < 1) {
      return { ok: false, error: `Select at least one option for question ${question.id}` };
    }
    if (question.maxSelections && out.length > question.maxSelections) {
      return {
        ok: false,
        error: `At most ${question.maxSelections} options for question ${question.id}`,
      };
    }
  }
  return { ok: true, ids: out };
}

/**
 * Validate participant answers against a session template snapshot.
 * - "intro" questions: skipped (no answer expected)
 * - all other types: answer required, validated per type
 */
export function validateAnswers(
  incoming: IncomingAnswer[],
  sections: ISurveySectionSnapshot[],
  rankWeights: number[]
): AnswerValidationResult {
  const allQuestions: ISurveyQuestionSnapshot[] = [];
  for (const s of sections) {
    for (const q of s.questions ?? []) allQuestions.push(q);
  }
  const incomingById = new Map(incoming.map((a) => [a.questionId, a]));
  const expectedRanks = rankWeights?.length ?? 5;

  const validated: ValidatedAnswer[] = [];

  for (const q of allQuestions) {
    const type = normalizeQuestionType(q.type);
    if (type === "intro") continue;
    const a = incomingById.get(q.id);
    if (!a) {
      // Non-required questions: skip silently when no answer was supplied
      if (q.required === false) continue;
      return { ok: false, error: `Question ${q.id} has no answer` };
    }
    const isEmptyRanking = !a.rankings || Object.keys(a.rankings).length === 0;
    const isEmptyChoices = !a.selectedChoiceIds || (Array.isArray(a.selectedChoiceIds) && a.selectedChoiceIds.length === 0);
    switch (type) {
      case "archetype-ranking": {
        if (q.required === false && isEmptyRanking) continue;
        const ids = (q.options ?? []).map((o) => o.id);
        const r = validateRanking(q, ids, a.rankings, expectedRanks);
        if (!r.ok) return r;
        validated.push({ questionId: q.id, type, rankings: r.rankings });
        break;
      }
      case "archetype-top3": {
        if (q.required === false && isEmptyRanking) continue;
        const ids = (q.options ?? []).map((o) => o.id);
        const r = validateTop3(q, ids, a.rankings);
        if (!r.ok) return r;
        validated.push({ questionId: q.id, type, rankings: r.rankings });
        break;
      }
      case "general-ranking": {
        if (q.required === false && isEmptyRanking) continue;
        const ids = (q.rankingItems ?? []).map((i) => i.id);
        const r = validateRanking(q, ids, a.rankings, ids.length || expectedRanks);
        if (!r.ok) return r;
        validated.push({ questionId: q.id, type, rankings: r.rankings });
        break;
      }
      case "general-top3": {
        if (q.required === false && isEmptyRanking) continue;
        const ids = (q.rankingItems ?? []).map((i) => i.id);
        const r = validateTop3(q, ids, a.rankings);
        if (!r.ok) return r;
        validated.push({ questionId: q.id, type, rankings: r.rankings });
        break;
      }
      case "value-ranking": {
        if (q.required === false && isEmptyRanking) continue;
        // Bounded by the number of cultural values, never by rankWeights — a
        // 5-long weight array would reject ranks 6-8 for a client with 8 values.
        const ids = (q.valueItems ?? []).map((v) => v.id);
        const r = validateRanking(q, ids, a.rankings, ids.length);
        if (!r.ok) return r;
        validated.push({ questionId: q.id, type, rankings: r.rankings });
        break;
      }
      case "scale": {
        const empty = a.scaleValue === undefined || a.scaleValue === null || a.scaleValue === "";
        if (q.required === false && empty) continue;
        const r = validateScaleValue(q, a.scaleValue);
        if (!r.ok) return r;
        validated.push({ questionId: q.id, type, scaleValue: r.value });
        break;
      }
      case "value-assessment": {
        const emptyScores = !a.scores || Object.keys(a.scores).length === 0;
        if (q.required === false && emptyScores) continue;
        const r = validateScores(q, a.scores);
        if (!r.ok) return r;
        validated.push({ questionId: q.id, type, scores: r.scores });
        break;
      }
      case "multiple-choice": {
        if (q.required === false && isEmptyChoices) continue;
        const r = validateMultipleChoice(q, a.selectedChoiceIds);
        if (!r.ok) return r;
        validated.push({ questionId: q.id, type, selectedChoiceIds: r.ids });
        break;
      }
      case "open-text": {
        const text = typeof a.text === "string" ? a.text.trim() : "";
        if (q.required !== false && !text) {
          return { ok: false, error: `Answer required for question ${q.id}` };
        }
        if (text) validated.push({ questionId: q.id, type, text });
        break;
      }
    }
  }

  return { ok: true, answers: validated };
}

/**
 * Permissive variant for autosave. Drops invalid/partial answers silently
 * instead of erroring — partial in-progress state is the whole point.
 */
export function sanitizeAnswersForSave(
  incoming: IncomingAnswer[],
  sections: ISurveySectionSnapshot[],
  rankWeights: number[]
): ValidatedAnswer[] {
  const allQuestions: ISurveyQuestionSnapshot[] = [];
  for (const s of sections) {
    for (const q of s.questions ?? []) allQuestions.push(q);
  }
  const byId = new Map(allQuestions.map((q) => [q.id, q]));
  const expectedRanks = rankWeights?.length ?? 5;
  const out: ValidatedAnswer[] = [];

  for (const a of incoming) {
    const q = byId.get(a.questionId);
    if (!q) continue;
    const type = normalizeQuestionType(q.type);
    if (type === "intro") continue;

    switch (type) {
      case "archetype-ranking":
      case "general-ranking": {
        const ids =
          type === "archetype-ranking"
            ? (q.options ?? []).map((o) => o.id)
            : (q.rankingItems ?? []).map((i) => i.id);
        const r = validateRanking(q, ids, a.rankings, ids.length || expectedRanks);
        if (r.ok) out.push({ questionId: q.id, type, rankings: r.rankings });
        break;
      }
      case "archetype-top3":
      case "general-top3": {
        const ids =
          type === "archetype-top3"
            ? (q.options ?? []).map((o) => o.id)
            : (q.rankingItems ?? []).map((i) => i.id);
        const r = validateTop3(q, ids, a.rankings);
        if (r.ok) out.push({ questionId: q.id, type, rankings: r.rankings });
        break;
      }
      case "value-ranking": {
        const ids = (q.valueItems ?? []).map((v) => v.id);
        const r = validateRanking(q, ids, a.rankings, ids.length);
        if (r.ok) out.push({ questionId: q.id, type, rankings: r.rankings });
        break;
      }
      case "scale": {
        const r = validateScaleValue(q, a.scaleValue);
        if (r.ok) out.push({ questionId: q.id, type, scaleValue: r.value });
        break;
      }
      case "value-assessment": {
        const r = validateScores(q, a.scores);
        if (r.ok) out.push({ questionId: q.id, type, scores: r.scores });
        break;
      }
      case "multiple-choice": {
        const r = validateMultipleChoice(q, a.selectedChoiceIds);
        if (r.ok) out.push({ questionId: q.id, type, selectedChoiceIds: r.ids });
        break;
      }
      case "open-text": {
        const text = typeof a.text === "string" ? a.text.trim() : "";
        if (text) out.push({ questionId: q.id, type, text });
        break;
      }
    }
  }
  return out;
}
