import type {
  ISurveyQuestionSnapshot,
  ISurveySectionSnapshot,
} from "@/lib/models/SurveySession";
import type { SurveyQuestionType } from "@/lib/models/SurveyTemplateQuestion";
import { normalizeQuestionType } from "./types";

export interface IncomingAnswer {
  questionId: string;
  type?: string;
  rankings?: Record<string, unknown>;
  selectedChoiceIds?: unknown;
  text?: unknown;
}

export interface ValidatedAnswer {
  questionId: string;
  type: SurveyQuestionType;
  rankings?: Record<string, number>;
  selectedChoiceIds?: string[];
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
      case "general-ranking": {
        if (q.required === false && isEmptyRanking) continue;
        const ids = (q.rankingItems ?? []).map((i) => i.id);
        const r = validateRanking(q, ids, a.rankings, ids.length || expectedRanks);
        if (!r.ok) return r;
        validated.push({ questionId: q.id, type, rankings: r.rankings });
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
