import { t, type Locale } from "./translations";

/**
 * Author-supplied copy for the respondent-variable step — the one question asked
 * before the value questions ("Which level best fits your role?").
 *
 * Same arrangement as `welcome-screen.ts`: every text field is an *override*, and
 * an absent or blank one renders the built-in translation, which is what keeps an
 * untouched survey bilingual under the runner's NL/EN switch.
 *
 * Only the copy is authorable. The options are the client's cultural levels and
 * are deliberately not editable here — they are the join key onto
 * `culturalValue.behaviors[].level`, so a level typed by hand that the client
 * does not have would show that participant no behaviours at all.
 */
export interface IRespondentVariableCopy {
  label?: string;
  helpText?: string;
  /** Link to material where a respondent can look their level up. No default. */
  helpUrl?: string;
  /** Absent means required, matching the model default. */
  required?: boolean;
}

export const RESPONDENT_VARIABLE_COPY_FIELDS = ["label", "helpText", "helpUrl"] as const;

export type RespondentVariableCopyField =
  (typeof RESPONDENT_VARIABLE_COPY_FIELDS)[number];

/** The resolved copy the runner actually renders — every field a real string. */
export type ResolvedRespondentVariableCopy = Record<RespondentVariableCopyField, string>;

/**
 * The built-in copy for a locale. Used both to render the step when nothing is
 * authored and to prefill the editor, so the two can never drift.
 */
export function defaultRespondentVariableCopy(
  locale: Locale
): ResolvedRespondentVariableCopy {
  return {
    label: t(locale, "respondentVariable.defaultLabel"),
    helpText: t(locale, "respondentVariable.defaultHelp"),
    // No built-in link: where a client documents its levels differs per client,
    // so empty means "show no link" rather than "show the default one".
    helpUrl: "",
  };
}

/**
 * Merge authored overrides over the built-in copy. A blank override is treated as
 * absent rather than as an empty line — an author who clears a field wants the
 * default back, not a heading with nothing under it.
 */
export function resolveRespondentVariableCopy(
  locale: Locale,
  custom: IRespondentVariableCopy | null | undefined
): ResolvedRespondentVariableCopy {
  const resolved = defaultRespondentVariableCopy(locale);
  for (const field of RESPONDENT_VARIABLE_COPY_FIELDS) {
    const authored = custom?.[field]?.trim();
    if (authored) resolved[field] = authored;
  }
  return resolved;
}

/**
 * Accept an arbitrary request body as authored copy. Unknown keys are dropped and
 * blank strings become absent, so "cleared" and "never set" end up as the same
 * stored state and both mean "use the built-in translation".
 *
 * `options`, `key` and `enabled` are deliberately not read here — they are
 * derived from the client's Cultural DNA and the survey's own content, never
 * posted by the editor.
 */
export function normalizeRespondentVariableCopy(raw: unknown): IRespondentVariableCopy {
  if (!raw || typeof raw !== "object") return {};
  const input = raw as Record<string, unknown>;
  const out: IRespondentVariableCopy = {};
  for (const field of RESPONDENT_VARIABLE_COPY_FIELDS) {
    const value = input[field];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) out[field] = trimmed;
  }
  // Only `false` is worth storing — absent already means required.
  if (input.required === false) out.required = false;
  return out;
}
