import type { SurveyQuestionType } from "@/lib/models/SurveyTemplateQuestion";

export type { SurveyQuestionType };

export const SURVEY_QUESTION_TYPES: SurveyQuestionType[] = [
  "archetype-ranking",
  "general-ranking",
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
  "general-ranking",
  "multiple-choice",
];

export function questionTypeLabel(type: SurveyQuestionType): string {
  switch (type) {
    case "archetype-ranking":
      return "Archetype ranking";
    case "general-ranking":
      return "General ranking";
    case "multiple-choice":
      return "Multiple choice";
    case "open-text":
      return "Open text";
    case "intro":
      return "Info block";
  }
}
