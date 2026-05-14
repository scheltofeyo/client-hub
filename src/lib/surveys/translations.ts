export type Locale = "nl" | "en";

const translations = {
  // Identify step
  "identify.headline": {
    nl: "Welkom — bedankt dat je meedoet!",
    en: "Welcome — thanks for joining in!",
  },
  "identify.subline": {
    nl: "Fijn dat je hier even de tijd voor neemt. We vragen alleen je e-mailadres om dubbele inzendingen te voorkomen — je antwoorden blijven volledig anoniem en worden alleen geaggregeerd verwerkt.",
    en: "Thanks for taking the time. We only ask for your email to prevent duplicate responses — your answers stay fully anonymous and are only processed in aggregate.",
  },
  "identify.tag": { nl: "Jouw stem telt", en: "Your voice counts" },
  "identify.statsLine": {
    nl: "{n} vragen · ongeveer {min} minuten van je tijd",
    en: "{n} questions · about {min} minutes of your time",
  },
  "identify.statsLineOne": {
    nl: "1 vraag · slechts een momentje",
    en: "1 question · just a moment",
  },
  "identify.reassure": {
    nl: "Niemand ziet jouw individuele antwoorden — alleen de totalen tellen mee.",
    en: "Nobody sees your individual responses — only the totals count.",
  },
  "identify.nameLabel": { nl: "Je naam", en: "Your name" },
  "identify.namePlaceholder": { nl: "Bijv. Sam de Vries", en: "e.g. Sam Brown" },
  "identify.emailLabel": { nl: "Je e-mailadres", en: "Your email" },
  "identify.emailPlaceholder": { nl: "jij@bedrijf.nl", en: "you@company.com" },
  "identify.cta": { nl: "Start de survey", en: "Start the survey" },

  // Navigation / step labels
  "nav.section": { nl: "Sectie {n} van {total}", en: "Section {n} of {total}" },
  "nav.question": { nl: "Vraag {n} van {total}", en: "Question {n} of {total}" },
  "nav.previous": { nl: "Vorige", en: "Previous" },
  "nav.next": { nl: "Volgende", en: "Next" },
  "nav.continue": { nl: "Doorgaan", en: "Continue" },
  "nav.submit": { nl: "Antwoorden insturen", en: "Submit responses" },
  "nav.submitting": { nl: "Bezig met versturen…", en: "Submitting…" },
  "nav.start": { nl: "Start", en: "Start" },
  "nav.finalQuestion": { nl: "Laatste vraag", en: "Final question" },

  // Submit confirmation modal
  "confirm.title": {
    nl: "Antwoorden definitief versturen?",
    en: "Submit your answers for good?",
  },
  "confirm.description": {
    nl: "Na het versturen kun je je antwoorden niet meer aanpassen.",
    en: "Once submitted you can no longer change your answers.",
  },
  "confirm.cancel": { nl: "Nog even nakijken", en: "Review once more" },
  "confirm.confirm": { nl: "Ja, versturen", en: "Yes, submit" },

  // Question helpers
  "ranking.helperBold": { nl: "Sleep om te rangschikken", en: "Drag to rank" },
  "ranking.helperRest": {
    nl: "van meest (boven) naar minst (onder) van toepassing.",
    en: "from most (top) to least (bottom) applicable.",
  },
  "choice.maxHelper": { nl: "Selecteer maximaal {n}.", en: "Select up to {n}." },

  // Closing legacy
  "closing.placeholder": { nl: "Optioneel", en: "Optional" },
  "closing.fallbackLabel": {
    nl: "Wil je nog iets delen?",
    en: "Anything else you'd like to share?",
  },

  // Section legacy open-question
  "section.openFallback": {
    nl: "Wil je nog iets toevoegen over deze sectie?",
    en: "Anything to add about this section?",
  },
  "section.openPlaceholder": { nl: "Optionele reflecties", en: "Optional reflections" },

  // Done state
  "done.headlinePersonal": { nl: "Bedankt, {name}!", en: "Thanks, {name}!" },
  "done.headline": { nl: "Bedankt voor je input!", en: "Thanks for your input!" },
  "done.subline": {
    nl: "Je antwoorden zijn opgeslagen — je kunt dit tabblad sluiten.",
    en: "Your responses have been recorded — you can close this tab now.",
  },

  // Errors
  "error.nameRequired": { nl: "Vul je naam in.", en: "Please enter your name." },
  "error.emailInvalid": {
    nl: "Vul een geldig e-mailadres in.",
    en: "Please enter a valid email address.",
  },
  "error.startFailed": {
    nl: "Kon de survey niet starten.",
    en: "Could not start the survey.",
  },
  "error.submitFailed": {
    nl: "Kon je antwoorden niet versturen.",
    en: "Could not submit your responses.",
  },
  "error.missingSubmission": {
    nl: "Inzending niet gevonden.",
    en: "Missing submission id.",
  },
  "error.requiredAny": {
    nl: "Beantwoord eerst alle verplichte vragen op deze pagina.",
    en: "Please answer all required questions on this page.",
  },
  "error.notFound": { nl: "Survey niet beschikbaar", en: "Survey not available" },
  "error.invalidLink": {
    nl: "Deze surveylink is ongeldig of verlopen.",
    en: "This survey link is invalid or has expired.",
  },
  "error.draft": {
    nl: "Deze survey is nog niet geopend. Probeer het later nog eens.",
    en: "This survey is not open yet. Please check back later.",
  },
  "error.closed": { nl: "Deze survey is gesloten.", en: "This survey is closed." },
  "error.archived": {
    nl: "Deze survey is niet meer beschikbaar.",
    en: "This survey is no longer available.",
  },
} as const satisfies Record<string, Record<Locale, string>>;

export type TranslationKey = keyof typeof translations;

/**
 * Translate a key with optional interpolation. Supports `{name}` style placeholders.
 */
export function t(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  const raw = translations[key][locale];
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name) =>
    name in vars ? String(vars[name]) : `{${name}}`
  );
}
