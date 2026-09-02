import { t, type Locale } from "./translations";

/**
 * Author-supplied copy for the respondent-variable step — the one question asked
 * before the value questions ("Which level best fits your role?").
 *
 * The same three states as the welcome and closing screens: **absent** renders the
 * built-in translation in the survey's language, an **empty string** leaves that
 * line out of the step, and **text** is an override shown as written. `label` and
 * `helpText` are therefore optional everywhere they are stored — the `""` that
 * older documents carry for "never authored" is retired by
 * `scripts/backfill-survey-copy.ts`.
 *
 * `helpUrl` is the one that cannot be hidden, and needs no way to be: its built-in
 * value is already empty, so clearing it is the same as never setting it.
 *
 * Only the copy is authorable. The options are the client's cultural levels and
 * are deliberately not editable here — they are the join key onto
 * `culturalValue.behaviors[].level`, so a level typed by hand that the client
 * does not have would show that participant no behaviours at all.
 */
export interface IRespondentVariableCopy {
  /** Absent for the built-in question, `""` to show no heading at all. */
  label?: string;
  /** Absent for the built-in explanation, `""` to show none. */
  helpText?: string;
  /** Link to material where a respondent can look their level up. No default. */
  helpUrl?: string;
  /** Absent means required, matching the model default. */
  required?: boolean;
}

export const RESPONDENT_VARIABLE_COPY_FIELDS = ["label", "helpText", "helpUrl"] as const;

export type RespondentVariableCopyField =
  (typeof RESPONDENT_VARIABLE_COPY_FIELDS)[number];

/**
 * The resolved copy the runner actually renders. Every field is a real string, and
 * an empty one means "render nothing here".
 */
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
 * Merge authored copy over the built-in defaults. A stored empty string is not
 * "nothing authored" but "authored to nothing": it resolves to an empty string so
 * the runner leaves that line out, rather than restoring the default an author
 * just cleared.
 */
export function resolveRespondentVariableCopy(
  locale: Locale,
  custom: IRespondentVariableCopy | null | undefined
): ResolvedRespondentVariableCopy {
  const resolved = defaultRespondentVariableCopy(locale);
  for (const field of RESPONDENT_VARIABLE_COPY_FIELDS) {
    const authored = custom?.[field];
    if (authored === undefined) continue;
    resolved[field] = authored.trim();
  }
  return resolved;
}

/**
 * Accept an arbitrary request body as authored copy. Unknown keys are dropped, but
 * a blank string is *kept*: it is how the editor says "leave this line out", and
 * only a key that was never sent means "use the built-in translation".
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
    // A trimmed-empty value is stored as "" rather than dropped — see above.
    out[field] = value.trim();
  }
  // Only `false` is worth storing — absent already means required.
  if (input.required === false) out.required = false;
  return out;
}
