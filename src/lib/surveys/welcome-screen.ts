import { t, type Locale } from "./translations";
import type { Greeting } from "./greetings";

/**
 * Author-supplied copy for the welcome (identify) screen.
 *
 * Every field is optional and carries three states, not two:
 *
 * - **absent** — render the built-in translation. That is what keeps a survey
 *   nobody touched readable in the language it is set to.
 * - **empty string** — the author deliberately cleared it: leave the element out
 *   of the page entirely. Without this state a cleared line silently filled
 *   itself back in with the default, which is not what clearing a field means.
 * - **text** — an override, rendered exactly as written.
 *
 * Custom copy is a single string, like every other authored string in a template,
 * so it does not follow the survey's language — it is shown as typed.
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
  /** Big first line. Only used when `autoGreeting` is `false`. Empty hides it. */
  headline?: string;
  /**
   * Smaller second line under the headline. Only used when `autoGreeting` is
   * `false`. Empty hides it.
   */
  subheadline?: string;
  /**
   * The main body — who is asking, what for, and what happens with the answers.
   * Blank lines split it into paragraphs (see `welcomeParagraphs()`), so this one
   * field can carry the two paragraphs the built-in copy has. Supports `{company}`.
   */
  bodyIntro?: string;
  /** Closing, smaller body paragraph — why we ask for an email. Empty hides it. */
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
 * the translations means they follow the survey's own language without anyone
 * having to author them.
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

/**
 * The resolved copy the runner actually renders. Every field is a real string, and
 * an empty one means "render nothing here" — either because the author cleared it
 * or, for the greeting pair, because the automatic greeting owns those lines.
 */
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
 * Merge authored copy over the built-in defaults. A stored empty string is not
 * "nothing authored" but "authored to nothing": it resolves to an empty string so
 * the runner leaves that element out, rather than quietly restoring the default an
 * author just cleared.
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
    const authored = custom?.[field];
    if (authored === undefined) continue;
    const trimmed = authored.trim();
    resolved[field] = trimmed ? interpolate(trimmed, opts.company) : "";
  }
  return resolved;
}

/**
 * Accept an arbitrary request body into a storable welcome-screen object. Unknown
 * keys are dropped, but a blank string is *kept*: it is how the editor says "leave
 * this line out". Only a key the editor never sent is absent, and absent is what
 * means "use the built-in copy".
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
    // The trim can empty this, and that is a value in its own right — a cleared
    // field is stored as "" so the page leaves the element out.
    out[field] = value.trim();
    any = true;
  }
  return any ? out : undefined;
}

/**
 * Splitting the body into paragraphs. Kept under this name because the runner and
 * the docs call it that; the implementation is shared with the closing screen.
 */
export { splitParagraphs as welcomeParagraphs } from "./paragraphs";
