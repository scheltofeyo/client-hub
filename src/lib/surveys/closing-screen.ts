import { t, type Locale } from "./translations";

/**
 * Author-supplied copy for the closing screen — the last thing a participant
 * sees, after the final answer is in.
 *
 * The same three states as `welcome-screen.ts`: absent renders the built-in
 * translation, an empty string leaves the element out because the author cleared
 * it, and text is an override rendered as written.
 */
export interface ISurveyClosingScreen {
  /** The headline above the body. Supports `{company}`. Empty hides it. */
  headline?: string;
  /**
   * The message itself. Blank lines split it into paragraphs. Supports
   * `{company}`. Empty hides it.
   */
  body?: string;
  /**
   * Optional image beside the closing copy, exactly like the welcome screen's.
   * Not an override of anything — there is no built-in image — so it lives
   * outside `CLOSING_SCREEN_FIELDS` and absent simply means "no image".
   */
  imageUrl?: string;
}

export const CLOSING_SCREEN_FIELDS = ["headline", "body"] as const;

export type ClosingScreenField = (typeof CLOSING_SCREEN_FIELDS)[number];

/**
 * The resolved copy the runner actually renders. Every field is a real string, and
 * an empty one means "render nothing here".
 */
export type ResolvedClosingCopy = Record<ClosingScreenField, string>;

function interpolate(raw: string, company?: string): string {
  return raw.replace(/\{company\}/g, company?.trim() || "");
}

/**
 * The built-in copy for a locale. Used both to render the screen when nothing is
 * authored and to prefill the editor, so the two can never drift.
 */
export function defaultClosingCopy(locale: Locale): ResolvedClosingCopy {
  return {
    headline: t(locale, "done.headline"),
    body: t(locale, "done.subline"),
  };
}

/**
 * Merge authored overrides over the built-in copy.
 *
 * `legacyThankYouText` is the pre-`closingScreen` field: surveys seeded or
 * created before this screen was authorable carry their closing message there,
 * and it must keep rendering. It stands in for the body only — a survey that has
 * since authored a body wins over it, and the headline was never customisable.
 * A body cleared to "" wins over it too: clearing the message has to be able to
 * clear the legacy sentence as well, or it could never be removed.
 */
export function resolveClosingCopy(
  locale: Locale,
  custom: ISurveyClosingScreen | null | undefined,
  opts: { company?: string; legacyThankYouText?: string } = {}
): ResolvedClosingCopy {
  const resolved = defaultClosingCopy(locale);
  const legacy = opts.legacyThankYouText?.trim();
  if (legacy) resolved.body = interpolate(legacy, opts.company);
  for (const field of CLOSING_SCREEN_FIELDS) {
    const authored = custom?.[field];
    if (authored === undefined) continue;
    const trimmed = authored.trim();
    resolved[field] = trimmed ? interpolate(trimmed, opts.company) : "";
  }
  return resolved;
}

/**
 * Accept an arbitrary request body into a storable closing-screen object. Unknown
 * keys are dropped, but a blank string is *kept*: it is how the editor says "leave
 * this line out", and only a key that was never sent means "use the default".
 *
 * Returns `undefined` when nothing is left, which lets the caller unset the field
 * entirely instead of storing an empty object.
 */
export function normalizeClosingScreen(raw: unknown): ISurveyClosingScreen | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const input = raw as Record<string, unknown>;
  const out: ISurveyClosingScreen = {};
  let any = false;
  if (typeof input.imageUrl === "string") {
    const url = input.imageUrl.trim();
    if (url) {
      out.imageUrl = url;
      any = true;
    }
  }
  for (const field of CLOSING_SCREEN_FIELDS) {
    const value = input[field];
    if (typeof value !== "string") continue;
    // A trimmed-empty value is stored as "" rather than dropped — see above.
    out[field] = value.trim();
    any = true;
  }
  return any ? out : undefined;
}
