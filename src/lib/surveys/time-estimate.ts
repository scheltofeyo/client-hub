import type { SurveyQuestionType } from "./types";

// Structural shape that both the public client-side PublicQuestion and the
// server-side ISurveyQuestionSnapshot satisfy. Only the fields used for time
// estimation are required.
export interface EstimableQuestion {
  type: SurveyQuestionType;
  choiceMode?: "single" | "multi";
  options?: { id: string }[];
  rankingItems?: { id: string }[];
  multiline?: boolean;
}

export interface EstimableSection {
  questions?: EstimableQuestion[];
}

/**
 * Per-question time estimates in seconds. Tuned for typical participants —
 * not exact. Used by both the welcome screen ("ongeveer X minuten van je tijd")
 * and the share-link metadata description.
 */
export function estimateQuestionSeconds(q: EstimableQuestion): number {
  switch (q.type) {
    case "intro":
      return 0;
    case "multiple-choice":
      return q.choiceMode === "multi" ? 30 : 20;
    case "archetype-ranking":
      return 15 + (q.options?.length ?? 0) * 6;
    case "general-ranking":
      return 15 + (q.rankingItems?.length ?? 0) * 6;
    case "open-text":
      return q.multiline ? 90 : 40;
    default:
      return 25;
  }
}

/**
 * Total survey time in whole minutes (≥ 1). Mirrors the formula on the
 * participant welcome screen so previews and the in-app label stay in sync.
 */
export function estimateSurveyMinutes(
  sections: EstimableSection[],
  closingEnabled: boolean
): number {
  let seconds = 0;
  for (const s of sections) {
    for (const q of s.questions ?? []) {
      seconds += estimateQuestionSeconds(q);
    }
  }
  if (closingEnabled) seconds += 90;
  return Math.max(1, Math.round(seconds / 60));
}
