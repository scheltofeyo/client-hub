import { t, type Locale } from "./translations";
import type { Greeting } from "./greetings";

/**
 * Author-supplied copy for the welcome (identify) screen.
 *
 * Every field is optional and every field is an *override*: an absent or empty
 * value means "render the built-in translation". That is what keeps the
 * participant page bilingual for anyone who never touched this — the same
 * arrangement `thankYouText` already uses for the closing screen. Custom copy is
 * a single string, like every other authored string in a template, so it does not
 * follow the runner's NL/EN switch.
 */
export interface ISurveyWelcomeScreen {
  /** Small pill above the greeting. Supports `{company}`. */
  tagline?: string;
  /**
   * Whether to keep the greeting that rotates with the time of day and the
   * weekday. Absent means yes, so a survey that predates this field — or one
   * nobody touched — behaves exactly as it did. Set to `false` to use the two
   * authored lines below instead; the authored text is kept either way, so
   * switching back and forth does not lose it.
   */
  autoGreeting?: boolean;
  /** Big first line. Only used when `autoGreeting` is `false`. */
  headline?: string;
  /** Smaller second line under the headline. Only used when `autoGreeting` is `false`. */
  subheadline?: string;
  /**
   * The main body — who is asking, what for, and what happens with the answers.
   * Blank lines split it into paragraphs (see `welcomeParagraphs()`), so this one
   * field can carry the two paragraphs the built-in copy has. Supports `{company}`.
   */
  bodyIntro?: string;
  /** Closing, smaller body paragraph — why we ask for an email. */
  bodyEmail?: string;
  /**
   * Optional image beside the welcome copy, exactly like a section intro's.
   * Unlike the copy fields this is not an override of anything — there is no
   * built-in image — so it lives outside `WELCOME_SCREEN_FIELDS` and absent
   * simply means "no image".
   */
  imageUrl?: string;
}

/*
 * The email field's label and placeholder and the start button are deliberately
 * *not* customisable. They are mechanics rather than message, and keeping them on
 * the translations means they follow the runner's NL/EN switch even on a survey
 * whose welcome copy is authored in one language.
 */

export const WELCOME_SCREEN_FIELDS = [
  "tagline",
  "headline",
  "subheadline",
  "bodyIntro",
  "bodyEmail",
] as const;

export type WelcomeScreenField = (typeof WELCOME_SCREEN_FIELDS)[number];

/** The two lines the automatic greeting owns when it is switched on. */
export const GREETING_FIELDS: WelcomeScreenField[] = ["headline", "subheadline"];

/** Absent means on, so nothing authored before this field existed changes behaviour. */
export function usesAutoGreeting(custom: ISurveyWelcomeScreen | undefined): boolean {
  return custom?.autoGreeting !== false;
}

/** The resolved copy the runner actually renders — every field a real string. */
export type ResolvedWelcomeCopy = Record<WelcomeScreenField, string>;

function interpolate(raw: string, company?: string): string {
  return raw.replace(/\{company\}/g, company?.trim() || "");
}

/**
 * The built-in copy, for a given locale and client. Used both to render the page
 * when nothing is authored and to prefill the editor, so the two can never drift.
 *
 * `greeting` is optional because the editor has no reason to pick a random one:
 * without it the headline pair falls back to a fixed sample so an author sees
 * representative text rather than a line that changes on every page load.
 */
export function defaultWelcomeCopy(
  locale: Locale,
  opts: { company?: string; greeting?: Greeting } = {}
): ResolvedWelcomeCopy {
  const { company, greeting } = opts;
  return {
    tagline: company
      ? t(locale, "identify.tag", { company })
      : t(locale, "identify.tagFallback"),
    headline: greeting ? greeting.welcome[locale] : t(locale, "identify.sampleHeadline"),
    subheadline: greeting
      ? greeting.thanks[locale]
      : t(locale, "identify.sampleSubheadline"),
    bodyIntro: [
      company
        ? t(locale, "identify.bodyOrganizer", { company })
        : t(locale, "identify.bodyOrganizerNoCompany"),
      t(locale, "identify.bodyAnonymous"),
    ].join("\n\n"),
    bodyEmail: t(locale, "identify.bodyEmail"),
  };
}

/**
 * Merge authored overrides over the built-in copy. A blank override is treated as
 * absent rather than as an empty line — an author who clears a field wants the
 * default back, not a gap in the page.
 */
export function resolveWelcomeCopy(
  locale: Locale,
  custom: ISurveyWelcomeScreen | undefined,
  opts: { company?: string; greeting?: Greeting } = {}
): ResolvedWelcomeCopy {
  const autoGreeting = usesAutoGreeting(custom);
  // Withholding the greeting is what stops the rotation leaking back in when it
  // is switched off and the author then leaves a headline field on its default.
  const defaults = defaultWelcomeCopy(locale, {
    ...opts,
    greeting: autoGreeting ? opts.greeting : undefined,
  });
  const resolved = { ...defaults };
  for (const field of WELCOME_SCREEN_FIELDS) {
    // With the automatic greeting on, the rotating lines win over anything the
    // author left behind from a previous session with it switched off.
    if (autoGreeting && GREETING_FIELDS.includes(field)) continue;
    const authored = custom?.[field]?.trim();
    if (authored) resolved[field] = interpolate(authored, opts.company);
  }
  return resolved;
}

/**
 * Accept an arbitrary request body into a storable welcome-screen object. Unknown
 * keys are dropped and blank strings become `undefined`, so "cleared" and "never
 * set" end up as the same stored state and both mean "use the default".
 *
 * Returns `undefined` when nothing is left, which lets the caller unset the field
 * entirely instead of storing an empty object.
 */
export function normalizeWelcomeScreen(raw: unknown): ISurveyWelcomeScreen | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const input = raw as Record<string, unknown>;
  const out: ISurveyWelcomeScreen = {};
  // Only `false` is worth storing — absent already means the automatic greeting.
  let any = input.autoGreeting === false;
  if (any) out.autoGreeting = false;
  if (typeof input.imageUrl === "string") {
    const url = input.imageUrl.trim();
    if (url) {
      out.imageUrl = url;
      any = true;
    }
  }
  for (const field of WELCOME_SCREEN_FIELDS) {
    const value = input[field];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    out[field] = trimmed;
    any = true;
  }
  return any ? out : undefined;
}

/**
 * Split an authored body field into paragraphs on blank lines. Single newlines
 * are left inside a paragraph, so a soft wrap someone typed does not become a
 * paragraph break on the participant page.
 */
export function welcomeParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}
