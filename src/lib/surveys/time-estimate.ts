import type { SurveyQuestionType } from "./types";

// Structural shape that both the public client-side PublicQuestion and the
// server-side ISurveyQuestionSnapshot satisfy. Only the fields used for time
// estimation are required.
export interface EstimableQuestion {
  type: SurveyQuestionType;
  choiceMode?: "single" | "multi";
  options?: { id: string }[];
  rankingItems?: { id: string }[];
  valueItems?: { id: string }[];
  multiline?: boolean;
}

export interface EstimableSection {
  questions?: EstimableQuestion[];
}

/** Read the mantra and the level's behaviours, then place a score. */
const VALUE_ASSESSMENT_SECONDS_PER_VALUE = 65;
/** The recap screen that closes a value-assessment — a skim of your own scores. */
const VALUE_ASSESSMENT_RECAP_SECONDS = 35;

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
    case "archetype-top3":
      // Scanning the pool + placing 3 items — roughly half the work of a full rank.
      return 20 + Math.min(3, q.options?.length ?? 0) * 6;
    case "general-ranking":
      return 15 + (q.rankingItems?.length ?? 0) * 6;
    case "general-top3":
      return 20 + Math.min(3, q.rankingItems?.length ?? 0) * 6;
    case "open-text":
      return q.multiline ? 90 : 40;
    case "scale":
      return 15;
    case "value-assessment": {
      // The heaviest block by far: one screen per value, each with a mantra and
      // the level's behaviours to read before scoring, then a recap of your own
      // scores at the end. Counting it as a single question badly undersold it.
      //
      // Calibrated so the usual five-value assessment lands on six minutes.
      const items = q.valueItems?.length ?? 0;
      if (items === 0) return 0;
      return items * VALUE_ASSESSMENT_SECONDS_PER_VALUE + VALUE_ASSESSMENT_RECAP_SECONDS;
    }
    case "value-ranking":
      return 15 + (q.valueItems?.length ?? 0) * 6;
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
