import type { ISurveySubmission } from "@/lib/models/SurveySubmission";
import type { IRespondentVariable } from "@/lib/models/SurveySession";
import type { ResultsSegment } from "@/components/survey-results/types";

/** Read a cohort value off a submission, tolerating the Mongoose Map/object split. */
export function cohortValue(
  submission: Pick<ISurveySubmission, "cohortTags">,
  key: string
): string | null {
  const tags: unknown = submission.cohortTags;
  if (!tags) return null;
  if (tags instanceof Map) {
    const v = tags.get(key);
    return typeof v === "string" && v ? v : null;
  }
  const v = (tags as Record<string, unknown>)[key];
  return typeof v === "string" && v ? v : null;
}

/**
 * List the segments present in the data, in the order the session declares them.
 *
 * Segments with no responses at all are included so the UI can say "nobody at this
 * level answered yet" rather than silently omitting a level the client expects;
 * `selectable` is false for those because there is nothing to filter to.
 */
export function listSegments(
  submissions: Pick<ISurveySubmission, "cohortTags">[],
  respondentVariable: IRespondentVariable | null | undefined
): ResultsSegment[] {
  if (!respondentVariable?.enabled) return [];
  const key = respondentVariable.key || "culturalLevel";

  const counts = new Map<string, number>();
  for (const sub of submissions) {
    const value = cohortValue(sub, key);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const declared = respondentVariable.options.map((o) => ({
    value: o.id,
    label: o.label || o.id,
    n: counts.get(o.id) ?? 0,
  }));

  // Values that are no longer offered but were answered earlier (the options were
  // edited while the survey was a draft). Dropping them would lose responses.
  const declaredIds = new Set(declared.map((d) => d.value));
  const orphans = [...counts.entries()]
    .filter(([value]) => !declaredIds.has(value))
    .map(([value, n]) => ({ value, label: value, n }));

  return [...declared, ...orphans].map((seg) => ({
    ...seg,
    selectable: seg.n > 0,
  }));
}

/** Filter submissions down to one segment. */
export function filterBySegment<T extends Pick<ISurveySubmission, "cohortTags">>(
  submissions: T[],
  key: string,
  value: string
): T[] {
  return submissions.filter((s) => cohortValue(s, key) === value);
}
