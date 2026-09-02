export type Locale = "nl" | "en";

const translations = {
  // Identify step
  "identify.headline": {
    nl: "Welkom — bedankt dat je meedoet!",
    en: "Welcome — thanks for joining in!",
  },
  "identify.bodyOrganizer": {
    nl: "Deze survey wordt georganiseerd door SUMM om {company} te helpen meer inzicht te krijgen.",
    en: "This survey is organized by SUMM to help {company} gain insights.",
  },
  "identify.bodyOrganizerNoCompany": {
    nl: "Deze survey wordt georganiseerd door SUMM.",
    en: "This survey is organized by SUMM.",
  },
  "identify.bodyAnonymous": {
    nl: "Je antwoorden blijven volledig anoniem en worden alleen geaggregeerd verwerkt.",
    en: "Your answers stay fully anonymous and are only processed in aggregate.",
  },
  "identify.bodyEmail": {
    nl: "We vragen daarom alleen je e-mailadres — zo voorkomen we dubbele inzendingen, kun je later met hetzelfde adres opnieuw inloggen, en wordt je voortgang na elke vraag automatisch opgeslagen.",
    en: "That's why we only ask for your email — it prevents duplicate responses, lets you log back in with the same address later, and your progress is saved automatically between questions.",
  },
  "identify.tag": { nl: "Hoi {company} teamlid", en: "Hi {company} team member" },

  // Sample greeting shown in the editor. The runner rotates a time-of-day
  // greeting instead (see greetings.ts), which would make a moving target of the
  // prefilled field, so the editor shows this fixed pair as representative copy.
  "identify.sampleHeadline": { nl: "Welkom!", en: "Welcome!" },
  "identify.sampleSubheadline": {
    nl: "Bedankt dat je dit invult.",
    en: "Thanks for filling this in.",
  },

  // Respondent variable (Cultural Level) step
  "respondentVariable.defaultLabel": {
    nl: "Welk niveau past het best bij jouw functie?",
    en: "Which level best fits your role?",
  },
  "respondentVariable.defaultHelp": {
    nl: "Kies het niveau dat het dichtst bij je dagelijkse werk ligt. Het bepaalt welk gedrag je straks per waarde te zien krijgt.",
    en: "Pick the level closest to your day-to-day work. It decides which behaviours you'll see for each value.",
  },
  "respondentVariable.help": {
    nl: "Weet je niet welk niveau bij jou past? Zoek het hier op",
    en: "Not sure which level fits you? Look it up here",
  },
  "recap.headline": { nl: "Dit heb je ingevuld", en: "This is what you filled in" },
  "recap.body": {
    nl: "Een overzicht van je eigen scores. Op de volgende stap vragen we je de waarden ten opzichte van elkaar te rangschikken.",
    en: "An overview of your own scores. Next, we'll ask you to rank the values against each other.",
  },
  "recap.value": { nl: "Waarde", en: "Value" },
  "recap.score": { nl: "Score", en: "Score" },
  "assessment.behaviorsTitle": { nl: "Wat dit betekent voor jouw niveau", en: "What this means at your level" },
  "assessment.noBehaviors": {
    nl: "Voor dit niveau zijn nog geen gedragsvoorbeelden vastgelegd.",
    en: "No behaviour examples have been defined for this level yet.",
  },
  "identify.tagFallback": { nl: "Hoi teamlid", en: "Hi team member" },
  "header.saved": { nl: "Opgeslagen", en: "Saved" },
  "header.unsaved": { nl: "Niet opgeslagen", en: "Unsaved" },
  "identify.statsLine": {
    nl: "{n} vragen · ongeveer {min} minuten van je tijd",
    en: "{n} questions · about {min} minutes of your time",
  },
  "identify.statsLineOne": {
    nl: "1 vraag · slechts een momentje",
    en: "1 question · just a moment",
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

  // Preview mode — a colleague walking a draft. Shown to nobody who is actually
  // answering, but written in the survey's own language like the rest of the chrome.
  "preview.banner": {
    nl: "Preview — je antwoorden worden niet opgeslagen.",
    en: "Preview — your answers are not saved.",
  },

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
  "ranking.helperBold": { nl: "Bouw je eigen volgorde", en: "Build your own order" },
  "ranking.helperRest": {
    nl: "Sleep keuzes vanuit de lijst hieronder naar de juiste positie — bovenaan is het meest van toepassing.",
    en: "Drag choices from the list below into the right position — top is most applicable.",
  },
  "ranking.emptySlotHint": {
    nl: "Sleep hier je #{n}-keuze",
    en: "Drop your #{n} choice here",
  },
  "ranking.poolLabel": { nl: "Beschikbare keuzes", en: "Available choices" },
  "ranking.poolRemaining": {
    nl: "Nog {n} van {total} te plaatsen",
    en: "{n} of {total} still to place",
  },
  "ranking.allPlaced": {
    nl: "Klaar — sleep terug naar de lijst om te wijzigen",
    en: "All set — drag back to the list to change",
  },
  "ranking.poolEmptyHint": {
    nl: "Sleep een keuze hierheen om hem terug te zetten",
    en: "Drop a choice here to put it back",
  },
  "error.requiredRanking": {
    nl: "Plaats eerst alle keuzes in de volgorde.",
    en: "Place all choices in order first.",
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
