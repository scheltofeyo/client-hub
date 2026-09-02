import type { ICulturalDnaValue } from "@/lib/models/Client";
import type {
  ICulturalValueSnapshot,
  IRespondentVariable,
} from "@/lib/models/SurveySession";
import type { ISurveyRespondentVariableDefaults } from "@/lib/models/SurveyTemplate";

/** The subset of a client document these helpers read. */
export interface ClientCulturalSource {
  culturalDna?: ICulturalDnaValue[];
  culturalLevels?: string[];
}

/** Mongoose `.select()` string for the fields these helpers need. */
export const CULTURAL_SELECT = "culturalDna culturalLevels";

/**
 * Cultural levels are free text, typed once on the client and again on every
 * behaviour, often by different people. Real data has them drifting apart by a
 * trailing space — which makes an exact match show a participant no behaviours
 * at all. Normalising both sides on the way into the snapshot is what keeps the
 * `behaviors[].level` -> chosen-level join working.
 */
export function normalizeLevel(level: string): string {
  return level.trim();
}

/** Whether two level strings refer to the same level. */
export function levelsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export interface CulturalSnapshot {
  culturalValues: ICulturalValueSnapshot[];
  culturalLevels: string[];
}

/**
 * Copy a client's Cultural DNA into the shape a session snapshot stores.
 *
 * A copy, not a reference: `Client.culturalDna` is free text the client rewrites
 * between engagements, and a session that has already been answered must keep
 * showing the values and behaviours its respondents actually saw.
 */
export function culturalSnapshotFromClient(
  client: ClientCulturalSource | null | undefined
): CulturalSnapshot {
  const values = client?.culturalDna ?? [];
  const levels = client?.culturalLevels ?? [];
  return {
    culturalValues: values.map((v) => ({
      id: v.id,
      title: v.title,
      color: v.color ?? "",
      mantra: v.mantra ?? "",
      description: v.description ?? "",
      behaviors: (v.behaviors ?? []).map((b) => ({
        level: normalizeLevel(b.level),
        content: b.content ?? "",
      })),
    })),
    // De-duplicated after trimming: "Tactisch" and "Tactisch " are one level, and
    // offering both would split a segment in two.
    culturalLevels: [...new Set(levels.map(normalizeLevel).filter(Boolean))],
  };
}

/**
 * Build the respondent-variable config for a session: copy from the template
 * (label, help text, required) and take the options from the client's levels.
 *
 * Returns undefined when the template doesn't ask for one, or when the client has
 * no levels configured — a level picker with nothing to pick is worse than none.
 */
export function respondentVariableFromLevels(
  levels: string[],
  defaults?: ISurveyRespondentVariableDefaults | null
): IRespondentVariable | undefined {
  if (!defaults?.enabled) return undefined;
  if (levels.length === 0) return undefined;
  const normalized = [...new Set(levels.map((l) => l.trim()).filter(Boolean))];
  if (normalized.length === 0) return undefined;
  return {
    enabled: true,
    key: defaults.key || "culturalLevel",
    // Copied verbatim, `""` included: an empty string is the author's decision to
    // show no heading, and `|| undefined` would quietly turn it back into the
    // built-in question.
    label: defaults.label,
    helpText: defaults.helpText,
    helpUrl: defaults.helpUrl || undefined,
    required: defaults.required !== false,
    // The level string is its own id — see IRespondentVariableOption.
    options: normalized.map((level) => ({ id: level, label: level })),
  };
}

/**
 * The respondent variable a session should actually run with.
 *
 * Derived rather than purely stored, because a `value-assessment` or
 * `value-ranking` cannot do its job without a level: the whole point is that the
 * behaviours shown differ per level. Leaving it to a flag someone has to
 * remember means adding one of those blocks to an ad-hoc survey silently falls
 * back to showing every level's behaviours at once — wrong, but not obviously
 * broken enough to notice before a training.
 *
 * A stored, enabled config always wins, so the copy stays configurable. The
 * derived one carries no copy at all, so the runner renders the translated
 * default — which is the whole point of leaving those fields absent.
 */
export function effectiveRespondentVariable(session: {
  respondentVariable?: IRespondentVariable | null;
  templateSnapshot?: {
    culturalLevels?: string[];
    sections?: { questions?: { type?: string }[] }[];
  };
}): IRespondentVariable | undefined {
  const stored = session.respondentVariable;
  if (stored?.enabled && stored.options.length > 0) return stored;

  const levels = session.templateSnapshot?.culturalLevels ?? [];
  if (levels.length === 0) return undefined;

  const needsLevel = (session.templateSnapshot?.sections ?? []).some((sec) =>
    (sec.questions ?? []).some(
      (q) => q.type === "value-assessment" || q.type === "value-ranking"
    )
  );
  if (!needsLevel) return undefined;

  return respondentVariableFromLevels(levels, {
    enabled: true,
    key: stored?.key || "culturalLevel",
    label: stored?.label,
    helpText: stored?.helpText,
    helpUrl: stored?.helpUrl,
    required: stored?.required !== false,
  });
}

export type CohortTagResult =
  | { ok: true; tags?: Record<string, string> }
  | { ok: false; error: string };

/**
 * Validate the respondent's answer to the respondent-variable step against the
 * options stored on the session.
 *
 * Checked server-side rather than trusted from the client because the value both
 * selects which behaviours were shown and becomes a results filter — an arbitrary
 * string would create a phantom segment that no one can be shown or suppressed.
 */
export function sanitizeCohortTags(
  raw: unknown,
  respondentVariable: IRespondentVariable | null | undefined
): CohortTagResult {
  if (!respondentVariable?.enabled) return { ok: true };

  const key = respondentVariable.key || "culturalLevel";
  const supplied =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)[key]
      : undefined;
  const value = typeof supplied === "string" ? supplied.trim() : "";

  if (!value) {
    if (respondentVariable.required) {
      return { ok: false, error: `${respondentVariable.label || key} is required` };
    }
    return { ok: true };
  }
  const known = respondentVariable.options.some((o) => o.id === value);
  if (!known) {
    return { ok: false, error: `Unknown value for ${respondentVariable.label || key}` };
  }
  return { ok: true, tags: { [key]: value } };
}
