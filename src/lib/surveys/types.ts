import type { SurveyQuestionType } from "@/lib/models/SurveyTemplateQuestion";

export type { SurveyQuestionType };

export const SURVEY_QUESTION_TYPES: SurveyQuestionType[] = [
  "archetype-ranking",
  "archetype-top3",
  "general-ranking",
  "general-top3",
  "multiple-choice",
  "open-text",
  "intro",
];

export function isSurveyQuestionType(value: unknown): value is SurveyQuestionType {
  return typeof value === "string" && (SURVEY_QUESTION_TYPES as string[]).includes(value);
}

export function normalizeQuestionType(value: unknown): SurveyQuestionType {
  return isSurveyQuestionType(value) ? value : "archetype-ranking";
}

// Types that contribute scores / can appear in a comparison
export const COMPARISON_ELIGIBLE_TYPES: SurveyQuestionType[] = [
  "archetype-ranking",
  "archetype-top3",
  "general-ranking",
  "general-top3",
  "multiple-choice",
];

export function questionTypeLabel(type: SurveyQuestionType): string {
  switch (type) {
    case "archetype-ranking":
      return "Archetype ranking";
    case "archetype-top3":
      return "Archetype top 3";
    case "general-ranking":
      return "General ranking";
    case "general-top3":
      return "General top 3";
    case "multiple-choice":
      return "Multiple choice";
    case "open-text":
      return "Open text";
    case "intro":
      return "Info block";
  }
}

// Fixed number of scored positions for top-3 questions.
export const TOP3_RANK_LENGTH = 3;

export function isArchetypeRankType(type: SurveyQuestionType): boolean {
  return type === "archetype-ranking" || type === "archetype-top3";
}

export function isGeneralRankType(type: SurveyQuestionType): boolean {
  return type === "general-ranking" || type === "general-top3";
}

export function isFullRankingType(type: SurveyQuestionType): boolean {
  return type === "archetype-ranking" || type === "general-ranking";
}

export function isTop3Type(type: SurveyQuestionType): boolean {
  return type === "archetype-top3" || type === "general-top3";
}

export function isRankLikeType(type: SurveyQuestionType): boolean {
  return isFullRankingType(type) || isTop3Type(type);
}

/**
 * Effective scored positions for a question.
 * - Top-3: always 3 (independent of session rankWeights length).
 * - General ranking: bounded by number of authored items.
 * - Archetype ranking: bounded by session rankWeights length.
 */
export function effectiveRankLength(
  type: SurveyQuestionType,
  context: { itemsLength?: number; rankWeightsLength?: number }
): number {
  if (isTop3Type(type)) return TOP3_RANK_LENGTH;
  if (type === "general-ranking") return context.itemsLength ?? context.rankWeightsLength ?? 0;
  if (type === "archetype-ranking") return context.rankWeightsLength ?? 0;
  return 0;
}
