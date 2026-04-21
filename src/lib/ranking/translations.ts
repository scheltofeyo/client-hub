export type Locale = "nl" | "en";

const translations = {
  // Step labels
  "step.details": { nl: "Gegevens", en: "Details" },
  "step.ranking": { nl: "Ranking", en: "Ranking" },
  "step.match": { nl: "Match", en: "Match" },

  // Step 1
  "label.name": { nl: "Naam *", en: "Name *" },
  "label.email": { nl: "E-mailadres *", en: "Email address *" },
  "placeholder.name": { nl: "Je volledige naam", en: "Your full name" },
  "placeholder.email": { nl: "jij@voorbeeld.nl", en: "you@example.com" },
  "btn.next": { nl: "Volgende", en: "Next" },
  "error.nameEmail": { nl: "Vul je naam en e-mailadres in.", en: "Please enter your name and email address." },
  "error.sessionClosed": {
    nl: "Deze sessie is gesloten. Je kunt helaas niet meer deelnemen.",
    en: "This session is closed. You can no longer participate.",
  },
  "error.generic": { nl: "Er ging iets mis.", en: "Something went wrong." },

  // Step 2
  "ranking.instruction": {
    nl: "van het meest naar het minst van toepassing op jou.",
    en: "from most to least applicable to you.",
  },
  "ranking.instructionBold": {
    nl: "Rangschik de waarden",
    en: "Rank the values",
  },
  "ranking.mostApplicable": { nl: "Meest van toepassing", en: "Most applicable" },
  "ranking.leastApplicable": { nl: "Minst van toepassing", en: "Least applicable" },
  "btn.submit": { nl: "Ranking indienen", en: "Submit ranking" },
  "btn.submitting": { nl: "Bezig met opslaan...", en: "Saving..." },
  "aria.viewDetails": { nl: "Details bekijken", en: "View details" },

  // Value detail modal
  "btn.close": { nl: "Sluiten", en: "Close" },

  // Step 3 — waiting
  "match.thanks": { nl: "Bedankt voor je inzending!", en: "Thanks for your submission!" },
  "match.waiting": {
    nl: "We wachten tot de begeleider de sessie sluit.",
    en: "We're waiting for the facilitator to close the session.",
  },
  "match.dontClose": { nl: "Sluit dit scherm niet.", en: "Don't close this screen." },
  "match.autoAppear": {
    nl: "Je match verschijnt hier automatisch.",
    en: "Your match will appear here automatically.",
  },

  // Step 3 — results
  "match.yourMatch": { nl: "Jouw match", en: "Your match" },
  "match.yourGroup": { nl: "Jouw groepje", en: "Your group" },
  "match.trioExplain": {
    nl: "Door een oneven aantal deelnemers is er een groepje van drie gevormd. Bespreek de waarden samen!",
    en: "Due to an odd number of participants, a group of three has been formed. Discuss the values together!",
  },
  "match.noMatch": { nl: "Geen match gevonden", en: "No match found" },
  "match.noMatchExplain": {
    nl: "Door een oneven aantal deelnemers heb je helaas geen match gekregen. De begeleider kan je alsnog koppelen.",
    en: "Due to an odd number of participants, you didn't get a match. The facilitator can still pair you manually.",
  },
  "match.noResult": {
    nl: "Er kon geen match berekend worden.",
    en: "No match could be calculated.",
  },
  "match.compareTitle": { nl: "Jullie rankings vergeleken", en: "Your rankings compared" },
  "match.compareTitleTrio": { nl: "Jullie rankings vergeleken", en: "Your rankings compared" },
  "match.you": { nl: "Jij", en: "You" },
  "match.readAgain": { nl: "Lees opnieuw", en: "Read again" },

  // Error states
  "error.notFound": { nl: "Sessie niet gevonden", en: "Session not found" },
  "error.notFoundExplain": {
    nl: "Controleer of je de juiste link hebt ontvangen.",
    en: "Please check that you received the correct link.",
  },
  "error.notStarted": { nl: "Sessie nog niet gestart", en: "Session not started yet" },
  "error.notStartedExplain": {
    nl: "De begeleider is de sessie nog aan het voorbereiden.",
    en: "The facilitator is still preparing the session.",
  },
  "error.archived": { nl: "Sessie niet meer beschikbaar", en: "Session no longer available" },
  "error.archivedExplain": {
    nl: "Deze sessie is gearchiveerd door de begeleider.",
    en: "This session has been archived by the facilitator.",
  },
} as const satisfies Record<string, Record<Locale, string>>;

export type TranslationKey = keyof typeof translations;

export function t(locale: Locale, key: TranslationKey): string {
  return translations[key][locale];
}

/** Conversation prompts shown to matched participants, per locale. */
export const MATCH_PROMPTS: Record<Locale, string[]> = {
  nl: [
    "Zoek je match op en bespreek: welke waarde vind jij het sterkst terug in je eigen werk?",
    "Ga met je match in gesprek. Vertel: hoe merk je jouw topwaarde in de praktijk?",
    "Zoek elkaar op! Bespreek samen wat jullie belangrijkste waarden concreet betekenen in het werk.",
    "Loop naar je match toe. Vraag: in welke situaties komt jouw sterkste waarde het meest naar voren?",
    "Zoek je match op en deel: waar ben je trots op als het gaat om hoe je waarden toepast?",
    "Ga bij je match zitten. Bespreek: welke waarde zou je graag nog sterker willen maken in je werk?",
    "Zoek elkaar op en vergelijk jullie lijstjes. Bespreek wat de verschillen en overeenkomsten jullie vertellen.",
    "Vind je match in de ruimte. Vraag: wat betekent jouw nummer 1 waarde in de dagelijkse samenwerking?",
    "Zoek je match op! Bespreek samen: hoe helpt jouw sterkste waarde het team?",
    "Ga naar je match toe en wissel uit: welke waarde geeft je de meeste energie in je werk?",
    "Zoek je match op. Bespreek: wanneer voelde je jouw topwaarde het sterkst de afgelopen tijd?",
    "Loop naar je match. Vertel elkaar een concreet voorbeeld van hoe je jouw belangrijkste waarde toepast.",
    "Zoek elkaar op! Vraag je match: welke waarde zou je meer aandacht willen geven?",
    "Ga in gesprek met je match. Bespreek: hoe beïnvloeden jullie waarden de manier waarop jullie samenwerken?",
    "Zoek je match op en ontdek: wat kunnen jullie van elkaars kijk op de bedrijfswaarden leren?",
  ],
  en: [
    "Find your match and discuss: which value do you recognize most in your own work?",
    "Start a conversation with your match. Share: how does your top value show up in practice?",
    "Seek each other out! Discuss what your most important values mean concretely in your work.",
    "Walk over to your match. Ask: in which situations does your strongest value come through the most?",
    "Find your match and share: what are you proud of when it comes to living your values?",
    "Sit down with your match. Discuss: which value would you like to strengthen even more in your work?",
    "Find each other and compare your lists. Discuss what the differences and similarities tell you.",
    "Find your match in the room. Ask: what does your number 1 value mean in day-to-day collaboration?",
    "Find your match! Discuss together: how does your strongest value help the team?",
    "Go to your match and exchange: which value gives you the most energy in your work?",
    "Find your match. Discuss: when did you feel your top value most strongly recently?",
    "Walk to your match. Tell each other a concrete example of how you apply your most important value.",
    "Seek each other out! Ask your match: which value would you like to give more attention to?",
    "Start a conversation with your match. Discuss: how do your values influence the way you collaborate?",
    "Find your match and discover: what can you learn from each other's perspective on the company values?",
  ],
};

/** Conversation prompts for trio groups (odd participant count), per locale. */
export const TRIO_PROMPTS: Record<Locale, string[]> = {
  nl: [
    "Zoek je groepje op en bespreek met z'n drieën: welke waarde vinden jullie het sterkst terug in je eigen werk?",
    "Ga met z'n drieën in gesprek. Vertel: hoe merk je jouw topwaarde in de praktijk?",
    "Zoek elkaar op! Bespreek samen wat jullie belangrijkste waarden concreet betekenen in het werk.",
    "Ga bij je groepje zitten. Bespreek: in welke situaties komt jouw sterkste waarde het meest naar voren?",
    "Zoek je groepje op en deel: waar ben je trots op als het gaat om hoe je waarden toepast?",
    "Ga met z'n drieën zitten. Bespreek: welke waarde zou je graag nog sterker willen maken in je werk?",
    "Zoek elkaar op en vergelijk jullie lijstjes. Bespreek wat de verschillen en overeenkomsten jullie vertellen.",
    "Vind je groepje in de ruimte. Vraag: wat betekent jouw nummer 1 waarde in de dagelijkse samenwerking?",
    "Zoek je groepje op! Bespreek samen: hoe helpt jouw sterkste waarde het team?",
    "Ga met z'n drieën in gesprek: welke waarde geeft jullie de meeste energie in het werk?",
  ],
  en: [
    "Find your group and discuss together: which value do you each recognize most in your own work?",
    "Start a conversation as a trio. Share: how does your top value show up in practice?",
    "Seek each other out! Discuss what your most important values mean concretely in your work.",
    "Sit down with your group. Ask: in which situations does your strongest value come through the most?",
    "Find your group and share: what are you proud of when it comes to living your values?",
    "Sit down as a trio. Discuss: which value would you like to strengthen even more in your work?",
    "Find each other and compare your lists. Discuss what the differences and similarities tell you.",
    "Find your group in the room. Ask: what does your number 1 value mean in day-to-day collaboration?",
    "Find your group! Discuss together: how does your strongest value help the team?",
    "Start a conversation as a trio: which value gives each of you the most energy in your work?",
  ],
};
