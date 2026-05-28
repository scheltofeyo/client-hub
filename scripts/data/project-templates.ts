/**
 * Source-of-truth seed data for ProjectTemplate documents.
 *
 * Used by `npm run seed:templates`. Mirrors the column structure of
 * `scripts/data/services-database.reference.csv` (the original spreadsheet
 * the SUMM team curated). Edit this file as the canonical source — the CSV
 * is kept alongside purely for historical reference.
 *
 * Conventions:
 *   - `name` carries the size suffix where the row is one of multiple S/M/L
 *     variants of the same Service (e.g. "Culturele Diagnose – M").
 *     One-off named variants keep their full name and skip the suffix.
 *   - `summary` is **consultant-facing pick-guidance** — never shown to
 *     clients. It answers "when should I pick this size variant?" in 1–2
 *     sentences. Source: the "Omvang bepalende factoren" CSV column.
 *   - `serviceName` is the lookup key against the Service collection.
 *     Names match the Title rows from the CSV.
 *   - `defaultDescription` is HTML — short marketing pitch for the variant.
 *   - `defaultWhy / defaultWhat / defaultHow / defaultActivities /
 *     defaultDeliverables` are HTML and feed the project plan's five
 *     sections. Field order on the live UI: Why → What → How →
 *     Activities → Deliverables. Field copy is written via the
 *     `/summ-template-copy` skill (see .claude/skills/summ-template-copy).
 *   - `defaultDeliveryDays` is the calendar duration, parsed from the
 *     CSV's `Doorloop` column. Single values are exact; week ranges use
 *     the upper bound; month ranges use the lower bound.
 *   - Pricing (defaultSoldPrice / roleAllocation) is intentionally
 *     omitted — roles get added per template in the admin UI, and the
 *     role-based pricing engine derives the budget from there.
 */

export type SeedSession = {
  title: string;
  info?: string;
};

export type SeedTask = {
  title: string;
  description?: string;
  assignToClientLead?: boolean;
  subtasks?: readonly SeedTask[];
};

export type SeedRoleAllocation = {
  roleName: string;
  days: number;
};

export type SeedTemplate = {
  name: string;
  summary: string;
  serviceName: string;
  defaultDescription: string;
  defaultWhy?: string;
  defaultWhat?: string;
  defaultHow?: string;
  defaultActivities?: string;
  defaultDeliverables?: string;
  defaultDeliveryDays?: number;
  /**
   * Client-facing sessions only. Internal SUMM work (expert scans, uitwerking,
   * concept design, recap-writing) does NOT get a session — those happen
   * silently between scheduled klant-momenten. Each session becomes a draft
   * Session + a "Plan {title}" task when a project is created from the template.
   */
  sessions?: readonly SeedSession[];
  /**
   * Role-based budget allocation. Each entry maps a ProjectRole name to a
   * day count. The seed runner resolves names to IDs + rates from the DB.
   * Templates without an allocation (e.g. Platform licentie) skip this field.
   */
  defaultRoleAllocation?: readonly SeedRoleAllocation[];
  /**
   * Internal SUMM work tasks — structured as hoofdtaken (parent) with
   * subtaken (children). E.g. "Voorbereiding" → ["Intake voorbereiden",
   * "Documentatie analyseren"]. Created as TemplateTasks (not Sessions).
   */
  tasks?: readonly SeedTask[];
};

// ── HTML helpers ─────────────────────────────────────────────────────────────
// Stick to the node set the RichTextEditor (TipTap StarterKit minus heading/
// codeBlock/code/blockquote/horizontalRule) actually round-trips: <p>, <ul>,
// <li>, <strong>, <em>, <br>. Anything else gets stripped on save or render.

const p = (text: string) => `<p>${text}</p>`;
const b = (text: string) => `<strong>${text}</strong>`;

/** Flat noun-phrase bullet list — used for Deliverables. */
const ul = (items: readonly string[]) =>
  `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;

/** Title + one-sentence purpose bullets — used for Activities. */
const ulTitled = (items: readonly (readonly [string, string])[]) =>
  `<ul>${items
    .map(([title, sub]) => `<li>${b(title)}<br>${sub}</li>`)
    .join("")}</ul>`;

/** Bold intro line + list. Used for Activities ("Aanpak:") and Deliverables
 *  ("Branded presentatie met:"). */
const introList = (intro: string, list: string) => `${p(b(intro))}${list}`;

export const SEED_PROJECT_TEMPLATES: readonly SeedTemplate[] = [
  // 1.1 — Inspiratiesessie
  {
    name: "Inspiratiesessie: Cultural Archetypes",
    summary:
      "Eenmalige 2-uurs sessie voor het leiderschapsteam. Kies als kennismakingsmoment of om de SUMM-aanpak te verkennen voordat je een groter traject inzet.",
    serviceName: "Inspiration session",
    defaultDescription: p(
      "In een inspirerende sessie verdiepen we het inzicht van jouw leiderschapsteam in wat cultuur werkelijk betekent en hoe je als organisatie doelgericht en consistent kunt bouwen aan het gewenste culturele DNA. We introduceren de culturele archetypes en illustreren deze met concrete best practices die laten zien hoe toonaangevende bedrijven hun strategie en cultuur elkaar laten versterken."
    ),
    defaultWhy: p(
      "Je weet dat cultuur ertoe doet, maar binnen je leiderschapsteam loopt het gesprek erover vast in abstracte woorden. Iedereen voelt iets anders bij 'onze cultuur', niemand weet waar je concreet zou beginnen en strategie en gedrag drijven langzaam uit elkaar."
    ),
    defaultWhat: p(
      "Een gedeeld vertrekpunt waarin jullie leiderschapsteam de strategische rol van cultuur scherp ziet. Daarmee wordt helder waar jullie eigen culturele uitdagingen en kansen liggen en welk gedrag, welk leiderschap en welke beslissingen ertoe doen om die te benutten."
    ),
    defaultHow: p(
      "In een interactieve sessie van twee uur met het leiderschapsteam introduceren we de Cultural Archetypes, brengen we de businesswaarde van cultuur in beeld en vertalen we best practices van toonaangevende bedrijven naar jullie eigen context."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Intake met contactpersoon", "Business-context, huidige cultuur en dynamiek binnen het leiderschapsteam begrijpen."],
      ["Interactieve sessie met leiderschapsteam", "Basisprincipes van cultuurvorming en Cultural Archetypes vertalen naar relevante aandachtspunten."],
      ["Wrap-up door SUMM", "Observaties en eerste culturele aandachtspunten vastleggen en terugkoppelen."],
    ])),
    defaultDeliverables: introList("Geschreven wrap-up met:", ul([
      "Algemene observaties uit de sessie",
      "Voor jullie relevante culturele aandachtspunten",
      "Uitkomsten van de interactieve survey tijdens de sessie",
      "Eerste handelingsperspectief voor leiderschap",
    ])),
    defaultDeliveryDays: 7,
    sessions: [
      { title: "Intake met contactpersoon", info: "30 minuten — business-context, huidige cultuur en dynamiek binnen het leiderschapsteam ophalen." },
      { title: "Inspiratiesessie met leiderschapsteam", info: "2 uur — interactieve sessie over Cultural Archetypes en de businesswaarde van cultuur, met live survey." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 1 },
      { roleName: "Senior Consultant", days: 1 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Intake voorbereiden" },
          { title: "Business-context en cultuurinfo analyseren" },
          { title: "Sessie-materiaal opmaken" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Survey opzetten voor interactieve sessie" },
          { title: "Presentatie finaliseren" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Wrap-up schrijven" },
          { title: "Observaties en aandachtspunten formuleren" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },

  // 1.2 — Culturele Diagnose
  {
    name: "Culturele Diagnose – S",
    summary:
      "Op basis van bestaande middelen, procesbeschrijvingen en context; desk research + korte meeting LT bevindingen.",
    serviceName: "Surveys",
    defaultDescription: p(
      "Op basis van een expert scan van al jullie bestaande documentatie en processen formuleren we concrete actiepunten en een solide basis voor jullie culturele roadmap."
    ),
    defaultWhy: p(
      "Jullie voelen dat de cultuur is verschoven of dat hij niet doet wat hij zou moeten doen, maar er liggen vooral meningen en geen feiten. Daardoor blijven keuzes over leiderschap, teams en beloning hangen in onderbuik en eindigen cultuurgesprekken in losse aannames."
    ),
    defaultWhat: p(
      "Een fact-based diagnose die laat zien waar jullie cultuur vandaag staat, wat werkt en waar frictie of groeikansen liggen. Daarmee wordt helder welk gedrag, welk leiderschap en welke structuren als eerste aandacht vragen om jullie missie waar te maken."
    ),
    defaultHow: p(
      "We doen een expert scan op jullie missie, beoogd Cultureel DNA en bestaande inrichting van leiderschap, teamontwikkeling en beloning, en vertalen die analyse naar concrete aandachtspunten voor jullie culturele roadmap."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Intake met contactpersoon", "Bestaande input over missie, DNA en culturele practices in kaart brengen."],
      ["Expert scan door SUMM", "Documentatie en processen analyseren op missie, DNA en inrichting van leiderschap, teams en beloning."],
      ["Rapportage en aanbevelingen", "Inzichten en aandachtspunten formuleren als basis voor jullie culturele roadmap."],
    ])),
    defaultDeliverables: introList("Rapport met:", ul([
      "Belangrijkste inzichten uit de expert scan",
      "Aandachtspunten op missie en beoogd Cultureel DNA",
      "Aandachtspunten op leiderschap, teamontwikkeling en beloning",
      "Concrete aanbevelingen voor jullie culturele roadmap",
    ])),
    defaultDeliveryDays: 14,
    sessions: [
      { title: "Intake met contactpersoon", info: "Bestaande input over missie, DNA en culturele practices ophalen — basis voor de expert scan." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 2 },
      { roleName: "Content lead", days: 1 },
      { roleName: "Senior Consultant", days: 0.5 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Intake voorbereiden" },
          { title: "Planning afstemmen met contactpersoon", assignToClientLead: true },
          { title: "Bestaande documentatie verzamelen" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Expert scan uitvoeren" },
          { title: "Analyse missie, DNA en practices opstellen" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Rapport opstellen" },
          { title: "Aanbevelingen formuleren" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },
  {
    name: "Culturele Diagnose – M",
    summary:
      "Desk research, interviews (6 tot 8) en presentatie van bevindingen aan LT.",
    serviceName: "Surveys",
    defaultDescription: p(
      "Op basis van een expert scan van al jullie bestaande documentatie en processen en een aantal interviews van specifieke sleutelspelers binnen jullie team formuleren we concrete actiepunten en een solide basis voor jullie culturele roadmap."
    ),
    defaultWhy: p(
      "Jullie voelen dat de cultuur is verschoven of dat hij niet doet wat hij zou moeten doen, maar er liggen vooral meningen en geen feiten. Daardoor blijven keuzes over leiderschap, teams en beloning hangen in onderbuik en eindigen cultuurgesprekken in losse aannames."
    ),
    defaultWhat: p(
      "Een fact-based diagnose die laat zien waar jullie cultuur vandaag staat, wat werkt en waar frictie of groeikansen liggen. Daarmee wordt helder welk gedrag, welk leiderschap en welke structuren als eerste aandacht vragen om jullie missie waar te maken."
    ),
    defaultHow: p(
      "We combineren een expert scan op jullie documentatie en processen met zes tot acht kwalitatieve interviews met sleutelspelers, en vertalen die analyse naar concrete aandachtspunten en aanbevelingen voor jullie culturele roadmap."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Intake met contactpersoon", "Bestaande input over missie, DNA en culturele practices in kaart brengen."],
      ["Expert scan door SUMM", "Documentatie en processen analyseren op missie, DNA en inrichting van leiderschap, teams en beloning."],
      ["Interviews met sleutelspelers (6–8)", "Kwalitatieve verdieping ophalen over gedrag, ritme en leiderschap in de praktijk."],
      ["Rapportage en presentatie", "Inzichten en aanbevelingen bundelen en terugkoppelen aan opdrachtgever."],
    ])),
    defaultDeliverables: introList("Rapport en presentatie met:", ul([
      "Belangrijkste inzichten uit expert scan en interviews",
      "Aandachtspunten op missie en beoogd Cultureel DNA",
      "Aandachtspunten op leiderschap, teamontwikkeling en beloning",
      "Concrete aanbevelingen voor jullie culturele roadmap",
    ])),
    defaultDeliveryDays: 21,
    sessions: [
      { title: "Intake met contactpersoon", info: "Bestaande input over missie, DNA en culturele practices ophalen — basis voor scan en interviews." },
      { title: "Interviews met sleutelspelers", info: "6–8 individuele interviews (45–60 min) ter verdieping op gedrag, ritme en leiderschap in de praktijk." },
      { title: "Presentatie rapportage", info: "Inzichten en aanbevelingen terugkoppelen aan opdrachtgever." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 2 },
      { roleName: "Content lead", days: 1 },
      { roleName: "Senior Consultant", days: 1.5 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Intake voorbereiden" },
          { title: "Bestaande documentatie verzamelen" },
          { title: "Interview-guide opstellen" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Expert scan uitvoeren" },
          { title: "Interviews plannen en afnemen" },
          { title: "Analyse missie, DNA en practices opstellen" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Rapport en presentatie opstellen" },
          { title: "Aanbevelingen formuleren" },
          { title: "Feedback verwerken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },
  {
    name: "Culturele Diagnose – L",
    summary:
      "Desk research, interviews, opzetten survey, uitsturen survey en verwerken data + presentatie LT.",
    serviceName: "Surveys",
    defaultDescription: p(
      "Op basis van een expert scan van al jullie bestaande documentatie en processen, een aantal interviews van specifieke sleutelspelers binnen jullie team en de inzichten uit een bedrijfsbrede survey formuleren we concrete actiepunten en een solide basis voor jullie culturele roadmap."
    ),
    defaultWhy: p(
      "Jullie voelen dat de cultuur is verschoven of dat hij niet doet wat hij zou moeten doen, maar er liggen vooral meningen en geen feiten. Daardoor blijven keuzes over leiderschap, teams en beloning hangen in onderbuik en eindigen cultuurgesprekken in losse aannames."
    ),
    defaultWhat: p(
      "Een fact-based diagnose die laat zien waar jullie cultuur vandaag staat, wat werkt en waar frictie of groeikansen liggen. Daarmee wordt helder welk gedrag, welk leiderschap en welke structuren als eerste aandacht vragen om jullie missie waar te maken."
    ),
    defaultHow: p(
      "We combineren een expert scan, kwalitatieve interviews met sleutelspelers en een bedrijfsbrede survey, en bundelen de uitkomsten tot één samenhangend beeld van de huidige cultuur met concrete aanbevelingen voor jullie culturele roadmap."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Intake met contactpersoon", "Bestaande input over missie, DNA en culturele practices in kaart brengen."],
      ["Expert scan door SUMM", "Documentatie en processen analyseren op missie, DNA en inrichting van leiderschap, teams en beloning."],
      ["Interviews met sleutelspelers (6–8)", "Kwalitatieve verdieping ophalen over gedrag, ritme en leiderschap in de praktijk."],
      ["Bedrijfsbrede survey", "Beleving en gedrag binnen het hele team kwantitatief in beeld brengen."],
      ["Rapportage en presentatie", "Inzichten uit alle sporen bundelen en terugkoppelen aan opdrachtgever."],
    ])),
    defaultDeliverables: introList("Rapport en presentatie met:", ul([
      "Belangrijkste inzichten uit expert scan, interviews en survey",
      "Kwantitatieve bevindingen uit de bedrijfsbrede survey",
      "Aandachtspunten op missie en beoogd Cultureel DNA",
      "Aandachtspunten op leiderschap, teamontwikkeling en beloning",
      "Concrete aanbevelingen voor jullie culturele roadmap",
    ])),
    defaultDeliveryDays: 35,
    sessions: [
      { title: "Intake met contactpersoon", info: "Bestaande input over missie, DNA en culturele practices ophalen — basis voor scan, interviews en survey." },
      { title: "Interviews met sleutelspelers", info: "6–8 individuele interviews (45–60 min) ter verdieping op gedrag, ritme en leiderschap in de praktijk." },
      { title: "Presentatie rapportage", info: "Inzichten uit alle sporen (scan, interviews, survey) terugkoppelen aan opdrachtgever." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 4 },
      { roleName: "Content lead", days: 3 },
      { roleName: "Senior Consultant", days: 2 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Intake voorbereiden" },
          { title: "Bestaande documentatie verzamelen" },
          { title: "Interview-guide opstellen" },
          { title: "Survey opzetten en configureren" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Expert scan uitvoeren" },
          { title: "Interviews plannen en afnemen" },
          { title: "Survey uitzetten en data monitoren" },
          { title: "Survey-data verwerken en analyseren" },
          { title: "Analyse missie, DNA en practices opstellen" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Rapport en presentatie opstellen" },
          { title: "Kwantitatieve bevindingen visualiseren" },
          { title: "Aanbevelingen formuleren" },
          { title: "Feedback verwerken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },

  // 1.3 — Mission statement  (worked example for the skill)
  {
    name: "Mission statement – M",
    summary:
      "Op basis van 1 sessie, 1 iteratieronde + uitwerking.",
    serviceName: "Mission Statement",
    defaultDescription: p(
      "We helpen je leiderschapsteam om de drijfveren, ambitie en het beoogd onderscheidend vermogen van je bedrijf helder en precies te formuleren, zodat dit kunnen dienen als een richtinggevende doelstelling bij het formuleren van je winnende culturele DNA."
    ),
    defaultWhy: p(
      "Zonder een expliciet en gedeeld doel ontstaan binnen je organisatie versnipperde keuzes, interne ruis en cultuurverschillen tussen teams. Zo wordt strategie iets wat alleen op papier staat, terwijl gedrag alle kanten op beweegt."
    ),
    defaultWhat: p(
      "Een scherpe Mission Statement maakt expliciet waar jullie voor bestaan en waarin jullie fundamenteel onderscheidend willen zijn. Daarmee wordt helder welk gedrag, welk leiderschap en welke beslissingen nodig zijn om die ambitie waar te maken."
    ),
    defaultHow: p(
      "Door gerichte strategische sessies met het leiderschapsteam brengen we drijfveren, ambitie en onderscheidend vermogen scherp in beeld en vertalen we deze naar een heldere en gedragen Mission Statement."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Founder interview", "Doel en strategische context scherpstellen."],
      ["Strategische sessie met leiderschap", "Drijfveren, ambitie en onderscheidend vermogen aanscherpen."],
      ["Uitwerking door SUMM", "Analyse, formulering en scherpstelling van de definitieve Mission Statement."],
      ["Oplevering en presentatie", "Presentatie van de Mission Statement en strategische implicaties."],
    ])),
    defaultDeliverables: introList("Branded presentatie met:", ul([
      "Geformuleerde Mission Statement (why/how/what)",
      "Analyse van marktdynamieken: uitdagingen, kansen en onderscheidende troeven",
      "Strategische positionering: wie jullie als organisatie zijn",
      "Geformuleerde Employer Value Proposition (EVP)",
    ])),
    defaultDeliveryDays: 28,
    sessions: [
      { title: "Founder interview", info: "Doel en strategische context scherpstellen ter voorbereiding van de strategische sessie." },
      { title: "Strategische sessie met leiderschap", info: "Drijfveren, ambitie en onderscheidend vermogen samen aanscherpen." },
      { title: "Oplevering en presentatie", info: "Presentatie van de Mission Statement en strategische implicaties." },
    ],
    defaultRoleAllocation: [
      { roleName: "Content lead", days: 2 },
      { roleName: "Senior Consultant", days: 2 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Founder interview voorbereiden" },
          { title: "Strategische context analyseren" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Marktdynamieken en positionering analyseren" },
          { title: "Concept Mission Statement uitwerken" },
          { title: "Presentatie opmaken" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Mission Statement finaliseren" },
          { title: "Feedback verwerken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },
  {
    name: "Mission statement – L",
    summary:
      "Op basis van 2 tot 3 sessies, 2 iteratierondes + uitwerktijd.",
    serviceName: "Mission Statement",
    defaultDescription: p(
      "We helpen je leiderschapsteam om de drijfveren, ambitie en het beoogd onderscheidend vermogen van je bedrijf helder en precies te formuleren, zodat dit kunnen dienen als een richtinggevende doelstelling bij het formuleren van je winnende culturele DNA."
    ),
    defaultWhy: p(
      "Zonder een expliciet en gedeeld doel ontstaan binnen je organisatie versnipperde keuzes, interne ruis en cultuurverschillen tussen teams. Zo wordt strategie iets wat alleen op papier staat, terwijl gedrag alle kanten op beweegt."
    ),
    defaultWhat: p(
      "Een scherpe Mission Statement maakt expliciet waar jullie voor bestaan en waarin jullie fundamenteel onderscheidend willen zijn. Daarmee wordt helder welk gedrag, welk leiderschap en welke beslissingen nodig zijn om die ambitie waar te maken."
    ),
    defaultHow: p(
      "In strategische sessies met het leiderschapsteam vertalen we drijfveren en ambitie naar een scherpe Mission Statement en gebruiken we Cultural Archetypes om jullie onderscheidend vermogen en positionering te versterken."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Intake met opdrachtgever / founder / CEO", "Doel en strategische context scherpstellen."],
      ["Interviews met sleutelpersonen (founders / leiderschap)", "Drijfveren, ambitie, strategische uitdagingen en kansen expliciteren."],
      ["Strategische sessie #1 met leiderschap", "Richting bepalen op ambitie, onderscheidend vermogen en archetypische positionering."],
      ["Strategische sessie #2 met leiderschap", "Presentatie en aanscherping van de uitgewerkte Mission Statement (why/how/what) en strategische implicaties."],
      ["Uitwerking door SUMM", "Analyse, formulering en scherpstelling van de definitieve Mission Statement."],
    ])),
    defaultDeliverables: introList("Branded presentatie met:", ul([
      "Geformuleerde Mission Statement (why/how/what)",
      "Analyse van marktdynamieken: uitdagingen, kansen en onderscheidende troeven",
      "Strategische positionering: wie jullie als organisatie zijn",
      "Geformuleerde Employer Value Proposition (EVP)",
    ])),
    defaultDeliveryDays: 28,
    sessions: [
      { title: "Intake met opdrachtgever / founder / CEO", info: "Doel en strategische context scherpstellen — startpunt van het traject." },
      { title: "Interviews met sleutelpersonen", info: "Meerdere individuele interviews (founders / leiderschap) — drijfveren, ambitie, uitdagingen en kansen expliciteren." },
      { title: "Strategische sessie #1 met leiderschap", info: "Richting bepalen op ambitie, onderscheidend vermogen en archetypische positionering." },
      { title: "Strategische sessie #2 met leiderschap", info: "Presentatie en aanscherping van de uitgewerkte Mission Statement (why/how/what) en strategische implicaties." },
    ],
    defaultRoleAllocation: [
      { roleName: "Content lead", days: 3.5 },
      { roleName: "Senior Consultant", days: 3.5 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Intake voorbereiden" },
          { title: "Interview-guide opstellen" },
          { title: "Strategische context analyseren" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Interviews verwerken en analyseren" },
          { title: "Marktdynamieken en positionering analyseren" },
          { title: "Concept Mission Statement uitwerken" },
          { title: "Sessie #1 voorbereiden" },
          { title: "Sessie #2 voorbereiden" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Presentatie opmaken" },
          { title: "Mission Statement finaliseren" },
          { title: "Feedback verwerken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },

  // 1.4 — Cultureel DNA
  {
    name: "Cultureel DNA – S",
    summary:
      "1 sessie & 1 iteratieronde.",
    serviceName: "Cultural DNA",
    defaultDescription: p(
      "We begeleiden jou en je team bij het aanscherpen van jullie unieke winnende culturele DNA en bijbehorende voorbeeld gedragingen."
    ),
    defaultWhy: p(
      "Jullie waarden staan ergens beschreven, maar niemand weet precies wat ze in de praktijk betekenen. Teams interpreteren ze elk anders, nieuwe mensen pikken de cultuur impliciet op en bij groei of drukte vervaagt de gedeelde norm in dagelijks gedrag."
    ),
    defaultWhat: p(
      "Een scherp Cultureel DNA dat jullie waarden vertaalt naar observeerbaar gedrag per rol en context. Daarmee wordt helder welk gedrag, welk leiderschap en welke beslissingen passen bij wie jullie willen zijn — en kunnen teams elkaar er ook op aanspreken."
    ),
    defaultHow: p(
      "Samen met het leiderschapsteam scherpen we jullie bestaande waarden aan in een co-writing sessie en een feedbackronde, en vertalen ze naar concrete voorbeeld gedragingen die direct bruikbaar zijn in werving, onboarding en evaluatie."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Kick-off met leiderschapsteam", "Bestaande waarden en strategische context scherpstellen."],
      ["Co-writing sessie met leiderschap", "Waarden aanscherpen en vertalen naar voorbeeld gedragingen."],
      ["Feedbackronde en uitwerking", "Aangescherpt DNA terugkoppelen en finaliseren door SUMM."],
    ])),
    defaultDeliverables: introList("Branded presentatie met:", ul([
      "Aangescherpt Cultureel DNA: waarden en kernovertuigingen",
      "Voorbeeld gedragingen per waarde",
      "Gedeelde taal voor samenwerking en besluitvorming",
      "Vertrekpunt voor doorvertaling naar leiderschap en HR-rituelen",
    ])),
    defaultDeliveryDays: 14,
    sessions: [
      { title: "Kick-off met leiderschapsteam", info: "Bestaande waarden en strategische context scherpstellen." },
      { title: "Co-writing sessie met leiderschap", info: "Waarden aanscherpen en vertalen naar voorbeeld gedragingen." },
      { title: "Feedbackronde met leiderschap", info: "Aangescherpt DNA terugkoppelen, valideren en finaliseren." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 1 },
      { roleName: "Content lead", days: 2 },
      { roleName: "Senior Consultant", days: 1 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Kick-off voorbereiden" },
          { title: "Bestaande waarden inventariseren" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Sessie-materiaal opmaken" },
          { title: "Concept DNA uitwerken" },
          { title: "Voorbeeld gedragingen formuleren" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Presentatie opmaken" },
          { title: "Feedback verwerken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },
  {
    name: "Cultureel DNA – M",
    summary:
      "3 sessies met dezelfde groep + terugpresentatie aan LT/MT (+prep slides) & uitwerktijd.",
    serviceName: "Cultural DNA",
    defaultDescription: p(
      "We begeleiden jou en je team bij het formuleren van jullie unieke winnende culturele DNA en bijbehorende voorbeeld gedragingen."
    ),
    defaultWhy: p(
      "Jullie waarden staan ergens beschreven, maar niemand weet precies wat ze in de praktijk betekenen. Teams interpreteren ze elk anders, nieuwe mensen pikken de cultuur impliciet op en bij groei of drukte vervaagt de gedeelde norm in dagelijks gedrag."
    ),
    defaultWhat: p(
      "Een scherp Cultureel DNA dat jullie waarden vertaalt naar observeerbaar gedrag per rol en context. Daarmee wordt helder welk gedrag, welk leiderschap en welke beslissingen passen bij wie jullie willen zijn — en kunnen teams elkaar er ook op aanspreken."
    ),
    defaultHow: p(
      "Met een co-writing team van culturele ambassadeurs uit jullie organisatie formuleren we in drie sessies jullie Cultureel DNA en vertalen waarden naar voorbeeld gedragingen, met een afsluitende terugkoppeling aan het leiderschapsteam."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Co-writing team samenstellen en briefen", "Culturele ambassadeurs selecteren en uitlijnen op doel en proces."],
      ["Co-writing sessie #1 (op locatie)", "Identiteit, drijfveren en kernovertuigingen ophalen."],
      ["Co-writing sessie #2 (op locatie)", "Waarden formuleren en aanscherpen op herkenbaarheid."],
      ["Co-writing sessie #3 (remote)", "Waarden vertalen naar voorbeeld gedragingen per rol en context."],
      ["Terugkoppeling aan leiderschapsteam", "Cultureel DNA presenteren, valideren en finaliseren."],
    ])),
    defaultDeliverables: introList("Branded presentatie met:", ul([
      "Geformuleerd Cultureel DNA: waarden en kernovertuigingen",
      "Voorbeeld gedragingen per waarde",
      "Gedeelde taal voor samenwerking en besluitvorming",
      "Vertrekpunt voor doorvertaling naar leiderschap en HR-rituelen",
    ])),
    defaultDeliveryDays: 28,
    sessions: [
      { title: "Briefing co-writing team", info: "Geselecteerde culturele ambassadeurs uitlijnen op doel en proces." },
      { title: "Co-writing sessie #1 (op locatie)", info: "Identiteit, drijfveren en kernovertuigingen ophalen." },
      { title: "Co-writing sessie #2 (op locatie)", info: "Waarden formuleren en aanscherpen op herkenbaarheid." },
      { title: "Co-writing sessie #3 (remote)", info: "Waarden vertalen naar voorbeeld gedragingen per rol en context." },
      { title: "Terugkoppeling aan leiderschapsteam", info: "Cultureel DNA presenteren, valideren en finaliseren." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 4 },
      { roleName: "Content lead", days: 3 },
      { roleName: "Senior Consultant", days: 1 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Co-writing team samenstellen" },
          { title: "Briefing voorbereiden" },
          { title: "Strategische context analyseren" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Sessie-materiaal opmaken per sessie" },
          { title: "Tussentijdse uitwerking na sessie #1" },
          { title: "Tussentijdse uitwerking na sessie #2" },
          { title: "Concept DNA uitwerken" },
          { title: "Voorbeeld gedragingen formuleren" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Terugkoppeling-presentatie opmaken" },
          { title: "Feedback verwerken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },
  {
    name: "Cultureel DNA – L",
    summary:
      "5 tot 6 sessies met andere groepen en verschillende gedragingen + terugpresentatie aan leiderschap.",
    serviceName: "Cultural DNA",
    defaultDescription: p(
      "We begeleiden jou en je team bij het formuleren en valideren van jullie unieke winnende culturele DNA en bijbehorende voorbeeld gedragingen."
    ),
    defaultWhy: p(
      "Jullie waarden staan ergens beschreven, maar niemand weet precies wat ze in de praktijk betekenen. Teams interpreteren ze elk anders, nieuwe mensen pikken de cultuur impliciet op en bij groei of drukte vervaagt de gedeelde norm in dagelijks gedrag."
    ),
    defaultWhat: p(
      "Een scherp Cultureel DNA dat jullie waarden vertaalt naar observeerbaar gedrag per rol en context. Daarmee wordt helder welk gedrag, welk leiderschap en welke beslissingen passen bij wie jullie willen zijn — en kunnen teams elkaar er ook op aanspreken."
    ),
    defaultHow: p(
      "Met een co-writing team van culturele ambassadeurs formuleren we jullie Cultureel DNA in drie sessies, valideren we de uitkomst met een bredere klankbordgroep en koppelen we terug aan het leiderschapsteam voor finalisatie."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Co-writing team samenstellen en briefen", "Culturele ambassadeurs selecteren en uitlijnen op doel en proces."],
      ["Co-writing sessie #1", "Identiteit, drijfveren en kernovertuigingen ophalen."],
      ["Co-writing sessie #2", "Waarden formuleren en aanscherpen op herkenbaarheid."],
      ["Co-writing sessie #3", "Waarden vertalen naar voorbeeld gedragingen per rol en context."],
      ["Iteratie-sessie met klankbordgroep", "Concept-DNA breder valideren en aanscherpen op draagvlak en herkenbaarheid."],
      ["Terugkoppeling aan leiderschapsteam", "Cultureel DNA presenteren, valideren en finaliseren."],
    ])),
    defaultDeliverables: introList("Branded presentatie met:", ul([
      "Geformuleerd en gevalideerd Cultureel DNA: waarden en kernovertuigingen",
      "Voorbeeld gedragingen per waarde",
      "Gedeelde taal voor samenwerking en besluitvorming",
      "Vertrekpunt voor doorvertaling naar leiderschap en HR-rituelen",
    ])),
    defaultDeliveryDays: 35,
    sessions: [
      { title: "Briefing co-writing team", info: "Geselecteerde culturele ambassadeurs uitlijnen op doel en proces." },
      { title: "Co-writing sessie #1", info: "Identiteit, drijfveren en kernovertuigingen ophalen." },
      { title: "Co-writing sessie #2", info: "Waarden formuleren en aanscherpen op herkenbaarheid." },
      { title: "Co-writing sessie #3", info: "Waarden vertalen naar voorbeeld gedragingen per rol en context." },
      { title: "Iteratie-sessie met klankbordgroep", info: "Concept-DNA breder valideren en aanscherpen op draagvlak en herkenbaarheid." },
      { title: "Terugkoppeling aan leiderschapsteam", info: "Cultureel DNA presenteren, valideren en finaliseren." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 6 },
      { roleName: "Content lead", days: 5 },
      { roleName: "Senior Consultant", days: 2 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Co-writing team samenstellen" },
          { title: "Briefing voorbereiden" },
          { title: "Strategische context analyseren" },
          { title: "Klankbordgroep selecteren" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Sessie-materiaal opmaken per sessie" },
          { title: "Tussentijdse uitwerking na sessie #1" },
          { title: "Tussentijdse uitwerking na sessie #2" },
          { title: "Concept DNA uitwerken" },
          { title: "Voorbeeld gedragingen formuleren" },
          { title: "Iteratie-sessie met klankbordgroep voorbereiden" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Validatie-feedback klankbordgroep verwerken" },
          { title: "Terugkoppeling-presentatie opmaken" },
          { title: "Feedback verwerken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },

  // 1.5 — Career Framework
  {
    name: "Career Framework – S",
    summary:
      "1 uitleg & plotsessie, 1 iteratieronde in de sheets → max 15 functieprofielen (incl. bruikbare opzet van ‘oude’ functieprofielen).",
    serviceName: "Career Framework",
    defaultDescription: p(
      "Wij helpen jou en je expert leads om jullie culturele DNA te verankeren in een duidelijk, bedrijfsbreed carrière framework. We creëren een duidelijke structuur van job families, stellen heldere groeipaden op en we verzorgen de definitie van scherpe, bruikbare en vooral cultuur-gedreven functieprofielen."
    ),
    defaultWhy: p(
      "Zonder helder kader weet niemand wat groei concreet betekent: promoties gaan op gevoel, beoordelingen voelen politiek en mensen vragen zich af wanneer ze nu eigenlijk 'senior' zijn. Talent vertrekt omdat ze hun pad niet zien, en leiders missen taal om gedrag en skills te bespreken."
    ),
    defaultWhat: p(
      "Een Carrière Framework maakt expliciet welke skills, welk gedrag en welke verantwoordelijkheid bij elk niveau horen. Zo wordt groei een gesprek over vakmanschap en culturele bijdrage in plaats van over titels of dienstjaren."
    ),
    defaultHow: p(
      "Samen met de expert lead brengen we het bestaande groeipad in kaart, vertalen we jullie Cultureel DNA naar gedragsvoorbeelden per niveau en scherpen we de functieprofielen aan in één iteratieronde."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Structuur Carrière Framework opstellen", "Job family en groeiniveaus vastleggen op basis van jullie DNA."],
      ["Briefing expert lead", "Inhoudelijke verwachtingen per niveau scherpstellen met de vakinhoudelijke lead."],
      ["Concept-functieprofielen en aanscherping", "Profielen opstellen en finetunen op skills, gedrag en culturele bijdrage."],
    ])),
    defaultDeliverables: introList("Branded presentatie met:", ul([
      "Structuur van het Carrière Framework",
      "Groeipad met skills en gedrag per niveau (junior, medior, senior, lead)",
      "Cultuurgedreven functieprofielen per rol",
      "Handvatten voor toepassing in feedback en beoordeling",
    ])),
    defaultDeliveryDays: 28,
    sessions: [
      { title: "Structuur-sessie met expert lead", info: "Job family en groeiniveaus vastleggen op basis van jullie DNA." },
      { title: "Briefing expert lead", info: "Inhoudelijke verwachtingen per niveau scherpstellen met de vakinhoudelijke lead." },
      { title: "Aanscherping concept-functieprofielen", info: "Profielen samen finetunen op skills, gedrag en culturele bijdrage." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 3 },
      { roleName: "Content lead", days: 2 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Structuur carrière framework opzetten" },
          { title: "Bestaande functiebeschrijvingen analyseren" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Briefing expert lead voorbereiden" },
          { title: "Concept-functieprofielen opstellen" },
          { title: "Gedragsvoorbeelden per niveau uitwerken" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Feedback verwerken" },
          { title: "Definitieve profielen opmaken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },
  {
    name: "Career Framework – M (alleen kern team)",
    summary:
      "1 uitleg & plotsessie met kern team, 2 iteratierondes in sheet & pdf → tot 40 functieprofielen.",
    serviceName: "Career Framework",
    defaultDescription: p(
      "Wij helpen jou en je expert leads om jullie culturele DNA te verankeren in een duidelijk, bedrijfsbreed carrière framework. We creëren een duidelijke structuur van job families, stellen heldere groeipaden op en we verzorgen de definitie van scherpe, bruikbare en vooral cultuur-gedreven functieprofielen."
    ),
    defaultWhy: p(
      "Zonder helder kader weet niemand wat groei concreet betekent: promoties gaan op gevoel, beoordelingen voelen politiek en mensen vragen zich af wanneer ze nu eigenlijk 'senior' zijn. Talent vertrekt omdat ze hun pad niet zien, en leiders missen taal om gedrag en skills te bespreken."
    ),
    defaultWhat: p(
      "Een Carrière Framework maakt expliciet welke skills, welk gedrag en welke verantwoordelijkheid bij elk niveau horen. Zo wordt groei een gesprek over vakmanschap en culturele bijdrage in plaats van over titels of dienstjaren."
    ),
    defaultHow: p(
      "Met de expert leads van elk vakgebied vertalen we jullie Cultureel DNA naar gedragsvoorbeelden per niveau, ontwerpen we meerdere parallelle groeipaden en stemmen we deze onderling af tot één samenhangend Carrière Framework."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Structuur Carrière Framework opstellen", "Job families en groeiniveaus over alle vakgebieden vastleggen."],
      ["Briefing expert leads", "Per vakgebied de inhoudelijke verwachtingen per niveau scherpstellen."],
      ["Concept-functieprofielen per groeipad", "Profielen opstellen op skills, gedrag en culturele bijdrage."],
      ["Cross-family afstemming en aanscherping", "Niveaus en taal gelijk trekken over alle groeipaden heen."],
    ])),
    defaultDeliverables: introList("Branded presentatie met:", ul([
      "Structuur van het Carrière Framework",
      "Groeipaden met skills en gedrag per niveau (junior, medior, senior, lead)",
      "Cultuurgedreven functieprofielen per rol",
      "Handvatten voor toepassing in feedback en beoordeling",
    ])),
    defaultDeliveryDays: 35,
    sessions: [
      { title: "Structuur-sessie met expert leads", info: "Job families en groeiniveaus over alle vakgebieden vastleggen." },
      { title: "Briefing expert leads", info: "Per vakgebied de inhoudelijke verwachtingen per niveau scherpstellen." },
      { title: "Aanscherping concept-functieprofielen", info: "Profielen samen finetunen op skills, gedrag en culturele bijdrage." },
      { title: "Cross-family afstemming", info: "Niveaus en taal gelijk trekken over alle groeipaden heen." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 4 },
      { roleName: "Content lead", days: 3.5 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Structuur carrière framework opzetten" },
          { title: "Bestaande functiebeschrijvingen analyseren" },
          { title: "Briefing expert leads voorbereiden" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Concept-functieprofielen per groeipad opstellen" },
          { title: "Gedragsvoorbeelden per niveau uitwerken" },
          { title: "Cross-family afstemming voorbereiden" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Niveaus en taal gelijktrekken" },
          { title: "Feedback verwerken" },
          { title: "Definitieve profielen opmaken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },
  {
    name: "Career Framework – M (betrekken leads)",
    summary:
      "1 uitleg & plotsessie met kern team, 1 sessie met teamleads (uitleg fp’s + werkwijze), 2 iteratierondes → tot 60 functieprofielen.",
    serviceName: "Career Framework",
    defaultDescription: p(
      "Wij helpen jou en je expert leads om jullie culturele DNA te verankeren in een duidelijk, bedrijfsbreed carrière framework. We creëren een duidelijke structuur van job families, stellen heldere groeipaden op en we verzorgen de definitie van scherpe, bruikbare en vooral cultuur-gedreven functieprofielen."
    ),
    defaultWhy: p(
      "Zonder helder kader weet niemand wat groei concreet betekent: promoties gaan op gevoel, beoordelingen voelen politiek en mensen vragen zich af wanneer ze nu eigenlijk ‘senior’ zijn. Talent vertrekt omdat ze hun pad niet zien, en leiders missen taal om gedrag en skills te bespreken."
    ),
    defaultWhat: p(
      "Een Carrière Framework maakt expliciet welke skills, welk gedrag en welke verantwoordelijkheid bij elk niveau horen. Zo wordt groei een gesprek over vakmanschap en culturele bijdrage in plaats van over titels of dienstjaren."
    ),
    defaultHow: p(
      "Met het kern team en de betrokken teamleads vertalen we jullie Cultureel DNA naar gedragsvoorbeelden per niveau, ontwerpen we parallelle groeipaden en scherpen we de functieprofielen samen aan tot ze aansluiten bij jullie specifieke context."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Structuur Carrière Framework opstellen", "Job families en groeiniveaus over alle vakgebieden vastleggen."],
      ["Uitleg & plotsessie met kern team", "Structuur, niveaus en verwachtingen samen doorlopen."],
      ["Sessie met teamleads", "Uitleg functieprofielen en werkwijze — teamleads betrekken bij de invulling."],
      ["Concept-functieprofielen per groeipad", "Profielen opstellen op skills, gedrag en culturele bijdrage."],
      ["Cross-family afstemming en aanscherping", "Niveaus en taal gelijk trekken over alle groeipaden heen."],
    ])),
    defaultDeliverables: introList("Branded presentatie met:", ul([
      "Structuur van het Carrière Framework",
      "Groeipaden met skills en gedrag per niveau (junior, medior, senior, lead)",
      "Cultuurgedreven functieprofielen per rol",
      "Handvatten voor toepassing in feedback en beoordeling",
    ])),
    defaultDeliveryDays: 35,
    sessions: [
      { title: "Uitleg & plotsessie met kern team", info: "Structuur, niveaus en verwachtingen samen doorlopen." },
      { title: "Sessie met teamleads", info: "Uitleg functieprofielen en werkwijze — teamleads betrekken bij de invulling." },
      { title: "Aanscherping concept-functieprofielen", info: "Profielen samen finetunen op skills, gedrag en culturele bijdrage." },
      { title: "Cross-family afstemming", info: "Niveaus en taal gelijk trekken over alle groeipaden heen." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 6 },
      { roleName: "Content lead", days: 4.5 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Structuur carrière framework opzetten" },
          { title: "Bestaande functiebeschrijvingen analyseren" },
          { title: "Plotsessie met kern team voorbereiden" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Sessie met teamleads voorbereiden" },
          { title: "Concept-functieprofielen per groeipad opstellen" },
          { title: "Gedragsvoorbeelden per niveau uitwerken" },
          { title: "Cross-family afstemming voorbereiden" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Niveaus en taal gelijktrekken" },
          { title: "Feedback verwerken" },
          { title: "Definitieve profielen opmaken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },
  {
    name: "Career Framework – L",
    summary:
      "1 uitleg & plotsessie met kern team, kern team zelf aan slag met plotting, 1 sessie met teamleads (uitleg fp’s & werkwijze), 1 iteratieronde → vanaf ±50 profielen.",
    serviceName: "Career Framework",
    defaultDescription: p(
      "Wij helpen jou en je expert leads om jullie culturele DNA te verankeren in een duidelijk, bedrijfsbreed carrière framework. We creëren een duidelijke structuur van job families, stellen heldere groeipaden op en we verzorgen de definitie van scherpe, bruikbare en vooral cultuur-gedreven functieprofielen."
    ),
    defaultWhy: p(
      "Zonder helder kader weet niemand wat groei concreet betekent: promoties gaan op gevoel, beoordelingen voelen politiek en mensen vragen zich af wanneer ze nu eigenlijk 'senior' zijn. Talent vertrekt omdat ze hun pad niet zien, en leiders missen taal om gedrag en skills te bespreken."
    ),
    defaultWhat: p(
      "Een Carrière Framework maakt expliciet welke skills, welk gedrag en welke verantwoordelijkheid bij elk niveau horen. Zo wordt groei een gesprek over vakmanschap en culturele bijdrage in plaats van over titels of dienstjaren."
    ),
    defaultHow: p(
      "Met meerdere expert leads ontwerpen we groeipaden voor elk vakgebied en losse rollen, vertalen we jullie Cultureel DNA naar gedragsvoorbeelden per niveau en verankeren we het framework in jullie performance management ritme."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Structuur Carrière Framework opstellen", "Job families, groeipaden en losse rollen over de hele organisatie in kaart brengen."],
      ["Briefing expert leads", "Per vakgebied de inhoudelijke verwachtingen per niveau scherpstellen."],
      ["Concept-functieprofielen per groeipad en rol", "Profielen opstellen op skills, gedrag en culturele bijdrage."],
      ["Cross-family afstemming", "Niveaus en taal gelijk trekken over alle groeipaden en losse rollen heen."],
      ["Validatie en verankering", "Toets met leiderschap en koppeling aan feedback- en beoordelingsritme."],
    ])),
    defaultDeliverables: introList("Branded presentatie met:", ul([
      "Structuur van het Carrière Framework",
      "Groeipaden met skills en gedrag per niveau (junior, medior, senior, lead)",
      "Cultuurgedreven functieprofielen per rol",
      "Handvatten voor toepassing in feedback en beoordeling",
    ])),
    defaultDeliveryDays: 42,
    sessions: [
      { title: "Structuur-sessie met expert leads", info: "Job families, groeipaden en losse rollen over de hele organisatie in kaart brengen." },
      { title: "Briefing expert leads", info: "Per vakgebied de inhoudelijke verwachtingen per niveau scherpstellen." },
      { title: "Aanscherping concept-functieprofielen", info: "Profielen samen finetunen op skills, gedrag en culturele bijdrage." },
      { title: "Cross-family afstemming", info: "Niveaus en taal gelijk trekken over alle groeipaden en losse rollen." },
      { title: "Validatie en verankering met leiderschap", info: "Toets met leiderschap en koppeling aan feedback- en beoordelingsritme." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 8 },
      { roleName: "Content lead", days: 6 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Structuur carrière framework opzetten" },
          { title: "Bestaande functiebeschrijvingen analyseren" },
          { title: "Briefing expert leads voorbereiden" },
          { title: "Overzicht losse rollen inventariseren" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Concept-functieprofielen per groeipad opstellen" },
          { title: "Concept-functieprofielen losse rollen opstellen" },
          { title: "Gedragsvoorbeelden per niveau uitwerken" },
          { title: "Cross-family afstemming voorbereiden" },
          { title: "Niveaus en taal gelijktrekken" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Validatie met leiderschap voorbereiden" },
          { title: "Koppeling aan feedback- en beoordelingsritme uitwerken" },
          { title: "Feedback verwerken" },
          { title: "Definitieve profielen opmaken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },

  // 1.6 — Rollen & Rituelen
  {
    name: "Rollen en Rituelen – M",
    summary:
      "1 ophaalsessie, uitwerken, 1 terugpresenteersessie, aanscherpen & iteratieronde.",
    serviceName: "Roles & Rituals",
    defaultDescription: p(
      "We helpen je om jullie culturele DNA centraal te plaatsen in strak ontworpen teamvormende processen en rollen: van employer branding en werving tot onboarding, talent ontwikkeling en performance management."
    ),
    defaultWhy: p(
      "Jullie HR-processen draaien, maar ze versterken jullie cultuur niet: werving, onboarding en beoordeling zijn losse momenten zonder gedeeld ritme. Nieuwe mensen leren de cultuur niet actief, rollen zijn onduidelijk en eigenaarschap over de employee journey blijft diffuus."
    ),
    defaultWhat: p(
      "Een cultuurgedreven employee journey maakt van elk HR-moment een ritueel waarin jullie Cultureel DNA wordt geoefend. Daarmee wordt helder welke rollen, welk leiderschap en welk ritme nodig zijn om cultuur in de praktijk te dragen."
    ),
    defaultHow: p(
      "Met het kernteam scannen we jullie huidige employee journey, scherpen we in werksessies de bestaande rollen en rituelen aan en leveren we een concrete aanbeveling op die direct aansluit bij jullie ritme."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Scan huidige inrichting", "Werving, onboarding, ontwikkeling en performance management tegen het licht houden."],
      ["Werksessie #1 met kernteam", "Knelpunten en kansen per moment in de employee journey expliciteren."],
      ["Werksessie #2 met kernteam", "Rollen en rituelen aanscherpen op basis van Cultureel DNA."],
      ["Aanbeveling door SUMM", "Uitwerking van een cultuurgedreven employee journey met heldere rolverdeling."],
    ])),
    defaultDeliverables: introList("Branded presentatie met:", ul([
      "Analyse van de huidige employee journey",
      "Cultuurgedreven inrichting van werving, onboarding, ontwikkeling en performance management",
      "Heldere rolbeschrijvingen en verantwoordelijkheden",
      "Ritmische rituelen per fase van de journey",
    ])),
    defaultDeliveryDays: 28,
    sessions: [
      { title: "Werksessie #1 met kernteam", info: "Knelpunten en kansen per moment in de employee journey expliciteren." },
      { title: "Werksessie #2 met kernteam", info: "Rollen en rituelen aanscherpen op basis van Cultureel DNA." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 4 },
      { roleName: "Content lead", days: 2 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Scan huidige employee journey uitvoeren" },
          { title: "Werksessie #1 voorbereiden" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Knelpunten en kansen inventariseren" },
          { title: "Werksessie #2 voorbereiden" },
          { title: "Rollen en rituelen uitwerken" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Aanbeveling opstellen" },
          { title: "Feedback verwerken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },
  {
    name: "Rollen en Rituelen – L",
    summary:
      "1 ophaalsessie, uitwerken, 1 terugpresenteersessie, aanscherpen & iteratieronde + inbedding in organisatie.",
    serviceName: "Roles & Rituals",
    defaultDescription: p(
      "We helpen je om jullie culturele DNA centraal te plaatsen in strak ontworpen teamvormende processen en rollen: van employer branding en werving tot onboarding, talent ontwikkeling en performance management."
    ),
    defaultWhy: p(
      "Jullie HR-processen draaien, maar ze versterken jullie cultuur niet: werving, onboarding en beoordeling zijn losse momenten zonder gedeeld ritme. Nieuwe mensen leren de cultuur niet actief, rollen zijn onduidelijk en eigenaarschap over de employee journey blijft diffuus."
    ),
    defaultWhat: p(
      "Een cultuurgedreven employee journey maakt van elk HR-moment een ritueel waarin jullie Cultureel DNA wordt geoefend. Daarmee wordt helder welke rollen, welk leiderschap en welk ritme nodig zijn om cultuur in de praktijk te dragen."
    ),
    defaultHow: p(
      "Met het kernteam herontwerpen we in meerdere werksessies de volledige employee journey, vertalen we jullie Cultureel DNA naar rollen en rituelen en bouwen we het change management mee in zodat de nieuwe werkwijze ook landt."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Scan huidige inrichting", "Werving, onboarding, ontwikkeling en performance management tegen het licht houden."],
      ["Werksessie #1 met kernteam", "Knelpunten en kansen per moment in de employee journey expliciteren."],
      ["Werksessie #2 met kernteam", "Rollen en rituelen herontwerpen op basis van Cultureel DNA."],
      ["Werksessie #3 met kernteam", "Toetsing en aanscherping van het herontwerp."],
      ["Aanbeveling door SUMM", "Uitwerking van een cultuurgedreven employee journey met heldere rolverdeling."],
      ["Change management plan", "Implementatieaanpak en eigenaarschap per fase scherpstellen."],
    ])),
    defaultDeliverables: introList("Branded presentatie met:", ul([
      "Analyse van de huidige employee journey",
      "Cultuurgedreven inrichting van werving, onboarding, ontwikkeling en performance management",
      "Heldere rolbeschrijvingen en verantwoordelijkheden",
      "Ritmische rituelen per fase van de journey",
      "Implementatieplan met change management aanpak",
    ])),
    defaultDeliveryDays: 42,
    sessions: [
      { title: "Werksessie #1 met kernteam", info: "Knelpunten en kansen per moment in de employee journey expliciteren." },
      { title: "Werksessie #2 met kernteam", info: "Rollen en rituelen herontwerpen op basis van Cultureel DNA." },
      { title: "Werksessie #3 met kernteam", info: "Toetsing en aanscherping van het herontwerp." },
      { title: "Change management afstemming", info: "Implementatieaanpak en eigenaarschap per fase samen scherpstellen." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 5 },
      { roleName: "Content lead", days: 3 },
      { roleName: "Senior Consultant", days: 2 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Scan huidige employee journey uitvoeren" },
          { title: "Werksessie #1 voorbereiden" },
          { title: "Bestaande rollen en processen analyseren" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Knelpunten en kansen inventariseren" },
          { title: "Werksessie #2 voorbereiden" },
          { title: "Herontwerp rollen en rituelen uitwerken" },
          { title: "Werksessie #3 voorbereiden" },
          { title: "Toetsing en aanscherping verwerken" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Aanbeveling opstellen" },
          { title: "Change management plan uitwerken" },
          { title: "Feedback verwerken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },

  // 1.8 — Manifesto booklet
  {
    name: "Cultural Manifesto booklet – M",
    summary:
      "1,5 dag design (1 opzet + 0,5 final/print ready), SUMM = copy & projectmanagement, 2 iteratierondes.",
    serviceName: "Cultural Manifesto",
    defaultDescription: p(
      "We maken jullie custom branded Cultureel Manifest: een inspirerend handboek waarin alle belangrijkste informatie over jullie Missie, jullie Culturele DNA en jullie werkwijze worden samengebracht in een logisch, strak en onderscheidend verhaal gericht aan huidige en toekomstige teamleden."
    ),
    defaultWhy: p(
      "Jullie hebben een Mission Statement en Cultureel DNA, maar het verhaal leeft niet in het dagelijks ritme: nieuwe teamleden missen de context, onboarding voelt versnipperd en bestaande mensen hebben niets tastbaars om op terug te vallen. Cultuur blijft daardoor hangen in losse documenten."
    ),
    defaultWhat: p(
      "Een Cultural Manifesto booklet bundelt jullie Mission Statement, Cultureel DNA en werkwijze in één onderscheidend handboek. Daarmee wordt cultuur een tastbaar verhaal dat nieuwe teamleden meeneemt en bestaande mensen scherp houdt op gedrag, leiderschap en richting."
    ),
    defaultHow: p(
      "Met het kernteam vertalen we jullie bestaande content in één co-creatie sessie naar een logische verhaalstructuur en leveren we een drukklaar, custom branded booklet op."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Concept design en indeling", "Verhaalstructuur en visuele richting opzetten vanuit Mission Statement en DNA."],
      ["Co-creatie sessie met kernteam", "Inhoud aanscherpen, toon vaststellen en accenten leggen."],
      ["Definitief ontwerp", "Layout, beeld en copy uitwerken tot drukklaar booklet."],
      ["Oplevering", "Drukklare bestanden en begeleidende handvatten voor gebruik."],
    ])),
    defaultDeliverables: introList("Drukklaar Cultural Manifesto booklet met:", ul([
      "Mission Statement en strategische richting",
      "Cultureel DNA met waarden en voorbeeld-gedragingen",
      "Werkwijze: rollen, rituelen en groei",
      "Custom branded design, klaar om te drukken",
    ])),
    defaultDeliveryDays: 14,
    sessions: [
      { title: "Co-creatie sessie met kernteam", info: "Inhoud aanscherpen, toon vaststellen en accenten leggen." },
      { title: "Oplevering", info: "Drukklare bestanden overhandigen en gebruik toelichten." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 2 },
      { roleName: "Content lead", days: 1 },
      { roleName: "Senior Consultant", days: 0.5 },
      { roleName: "Design external", days: 1.5 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Bestaande content inventariseren" },
          { title: "Concept design en indeling opzetten" },
          { title: "Co-creatie sessie voorbereiden" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Copy schrijven en aanscherpen" },
          { title: "Design uitwerken" },
          { title: "Feedback verwerken" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Definitief ontwerp finaliseren" },
          { title: "Drukklare bestanden aanleveren" },
        ],
      },
    ],
  },
  {
    name: "Cultural Manifesto booklet – L",
    summary:
      "2,5 dag design (1 opzet + 1 uitwerking + 0,5 final), SUMM = copy & projectmanagement, 3 iteratierondes.",
    serviceName: "Cultural Manifesto",
    defaultDescription: p(
      "We maken jullie custom branded Cultureel Manifest: een inspirerend handboek waarin alle belangrijkste informatie over jullie Missie, jullie Culturele DNA en jullie werkwijze worden samengebracht in een logisch, strak en onderscheidend verhaal gericht aan huidige en toekomstige teamleden."
    ),
    defaultWhy: p(
      "Jullie hebben een Mission Statement en Cultureel DNA, maar het verhaal leeft niet in het dagelijks ritme: nieuwe teamleden missen de context, onboarding voelt versnipperd en bestaande mensen hebben niets tastbaars om op terug te vallen. Cultuur blijft daardoor hangen in losse documenten."
    ),
    defaultWhat: p(
      "Een Cultural Manifesto booklet bundelt jullie Mission Statement, Cultureel DNA en werkwijze in één onderscheidend handboek. Daarmee wordt cultuur een tastbaar verhaal dat nieuwe teamleden meeneemt en bestaande mensen scherp houdt op gedrag, leiderschap en richting."
    ),
    defaultHow: p(
      "Met het kernteam halen we via gerichte gesprekken de ontbrekende verhalen en voorbeelden op, vertalen we deze in meerdere co-creatie sessies naar een logische verhaalstructuur en leveren we een drukklaar, custom branded booklet op."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Concept design en indeling", "Verhaalstructuur en visuele richting opzetten vanuit Mission Statement en DNA."],
      ["Content-ophaal traject", "Interviews en story mining om ontbrekende verhalen en voorbeelden op te halen."],
      ["Co-creatie sessies met kernteam", "Inhoud aanscherpen, toon vaststellen en accenten leggen."],
      ["Definitief ontwerp", "Layout, beeld en copy uitwerken tot drukklaar booklet."],
      ["Oplevering", "Drukklare bestanden en begeleidende handvatten voor gebruik."],
    ])),
    defaultDeliverables: introList("Drukklaar Cultural Manifesto booklet met:", ul([
      "Mission Statement en strategische richting",
      "Cultureel DNA met waarden en voorbeeld-gedragingen",
      "Werkwijze: rollen, rituelen en groei",
      "Custom branded design, klaar om te drukken",
    ])),
    defaultDeliveryDays: 21,
    sessions: [
      { title: "Story mining interviews", info: "Korte gesprekken met team-leden om ontbrekende verhalen en voorbeelden op te halen." },
      { title: "Co-creatie sessie met kernteam", info: "Inhoud aanscherpen, toon vaststellen en accenten leggen." },
      { title: "Oplevering", info: "Drukklare bestanden overhandigen en gebruik toelichten." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 3 },
      { roleName: "Content lead", days: 2 },
      { roleName: "Senior Consultant", days: 1 },
      { roleName: "Design external", days: 2.5 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Bestaande content inventariseren" },
          { title: "Concept design en indeling opzetten" },
          { title: "Story mining interviews voorbereiden" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Interviews verwerken en verhalen selecteren" },
          { title: "Co-creatie sessie voorbereiden" },
          { title: "Copy schrijven en aanscherpen" },
          { title: "Design uitwerken" },
          { title: "Feedback verwerken per iteratieronde" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Definitief ontwerp finaliseren" },
          { title: "Drukklare bestanden aanleveren" },
        ],
      },
    ],
  },

  // 2.1 — Launch support
  {
    name: "Launch support – M",
    summary:
      "1 kick-off sessie, uitwerken preso & lancering, feedbackronde klant + aanwezigheid op dag zelf.",
    serviceName: "Culture Launch",
    defaultDescription: p(
      "Je Culturele DNA lanceren doe je maar 1 keer. Wij helpen je er een leuke en informatieve dag van te maken door je lancering te begeleiden zowel qua inhoud, design en als interactie met je team."
    ),
    defaultWhy: p(
      "Een Cultureel DNA is pas geland als je team het hoort, ziet en zelf oefent. Zonder een doordachte lancering blijft het bij een sessie ergens in de agenda en mist het ritme om gedrag, taal en eigenaarschap echt op gang te brengen."
    ),
    defaultWhat: p(
      "Een gefaciliteerde Culture Launch maakt jullie Cultureel DNA expliciet en deelbaar voor het hele team. Daarmee wordt richting, taal en gedrag op één moment zichtbaar — als startpunt voor consistent leiderschap en samenwerking."
    ),
    defaultHow: p(
      "Samen met jullie kernteam ontwerpen we de inhoud, vorm en interactie van de launch en faciliteren we de dag op locatie. SUMM begeleidt zowel de presentatie als de Culture Quiz, zodat content en beleving op elkaar aansluiten."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Begeleiding en design van de launch presentatie", "Inhoud, structuur en vormgeving aanscherpen tot één heldere verhaallijn."],
      ["Korte inspiratiesessie", "Context, businesswaarde en betekenis van het Cultureel DNA duiden."],
      ["Voorbereiding Culture Quiz", "Interactief format ontwerpen waarmee het team het DNA actief verkent."],
      ["Hosting op locatie", "De volledige dag faciliteren, ritme bewaken en interactie aanjagen."],
    ])),
    defaultDeliverables: introList("Volledig gefaciliteerde Culture Launch met:", ul([
      "Branded launch presentatie",
      "Korte inspiratiesessie over jullie Cultureel DNA",
      "Culture Quiz: interactief format voor het hele team",
      "Hosting van de launch dag op locatie naar keuze",
    ])),
    defaultDeliveryDays: 14,
    sessions: [
      { title: "Werksessie launch design met kernteam", info: "Inhoud, structuur en interactie van de launch samen aanscherpen." },
      { title: "Launch dag op locatie", info: "Volledig gefaciliteerde Culture Launch — presentatie, inspiratiesessie en Culture Quiz." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 3 },
      { roleName: "Senior Consultant", days: 1.25 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Launch presentatie opzetten" },
          { title: "Culture Quiz ontwerpen" },
          { title: "Planning afstemmen met contactpersoon", assignToClientLead: true },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Presentatie finaliseren" },
          { title: "Culture Quiz materiaal opmaken" },
          { title: "Inspiratiesessie voorbereiden" },
        ],
      },
      {
        title: "Afronding",
        subtasks: [
          { title: "Materialen aanleveren aan locatie" },
          { title: "Wrap-up en foto's verwerken" },
        ],
      },
    ],
  },
  {
    name: "Launch support – L",
    summary:
      "Afstemming SUMM + design minimaal 1,5 dag, afhankelijk van vraag.",
    serviceName: "Culture Launch",
    defaultDescription: p(
      "Je Culturele DNA lanceren doe je maar 1 keer. Wij helpen je er een leuke en informatieve dag van te maken door je lancering te begeleiden zowel qua inhoud, design en als interactie met je team."
    ),
    defaultWhy: p(
      "Een Cultureel DNA is pas geland als je team het hoort, ziet en zelf oefent. Zonder een doordachte lancering blijft het bij een sessie ergens in de agenda en mist het ritme om gedrag, taal en eigenaarschap echt op gang te brengen."
    ),
    defaultWhat: p(
      "Een gefaciliteerde Culture Launch maakt jullie Cultureel DNA expliciet en deelbaar voor het hele team. Daarmee wordt richting, taal en gedrag op één moment zichtbaar — als startpunt voor consistent leiderschap en samenwerking."
    ),
    defaultHow: p(
      "Samen met jullie kernteam ontwerpen we de inhoud, vorm en interactie van de launch, produceren we branded uitingen zoals banners en merch en faciliteren we de dag op locatie. SUMM verbindt presentatie, omgeving en activatie tot één samenhangende ervaring."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Begeleiding en design van de launch presentatie", "Inhoud, structuur en vormgeving aanscherpen tot één heldere verhaallijn."],
      ["Ontwerp en productie van branded uitingen", "Banners, merch en omgevingselementen die het DNA zichtbaar maken."],
      ["Korte inspiratiesessie", "Context, businesswaarde en betekenis van het Cultureel DNA duiden."],
      ["Voorbereiding Culture Quiz", "Interactief format ontwerpen waarmee het team het DNA actief verkent."],
      ["Productie en logistieke voorbereiding", "Materialen, locatie en programma op elkaar afstemmen."],
      ["Hosting op locatie", "De volledige dag faciliteren, ritme bewaken en interactie aanjagen."],
    ])),
    defaultDeliverables: introList("Volledig gefaciliteerde Culture Launch met:", ul([
      "Branded launch presentatie",
      "Branded uitingen: banners, merch en omgevingselementen",
      "Korte inspiratiesessie over jullie Cultureel DNA",
      "Culture Quiz: interactief format voor het hele team",
      "Hosting van de launch dag op locatie naar keuze",
    ])),
    defaultDeliveryDays: 14,
    sessions: [
      { title: "Werksessie launch design met kernteam", info: "Inhoud, structuur, interactie en branded uitingen samen aanscherpen." },
      { title: "Launch dag op locatie", info: "Volledig gefaciliteerde Culture Launch met branded materialen, inspiratiesessie en Culture Quiz." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 0.5 },
      { roleName: "Design external", days: 1.5 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Launch presentatie opzetten" },
          { title: "Culture Quiz ontwerpen" },
          { title: "Branded uitingen ontwerpen" },
          { title: "Planning afstemmen met contactpersoon", assignToClientLead: true },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Presentatie finaliseren" },
          { title: "Culture Quiz materiaal opmaken" },
          { title: "Banners en merch laten produceren" },
          { title: "Inspiratiesessie voorbereiden" },
          { title: "Logistiek en locatie afstemmen" },
        ],
      },
      {
        title: "Afronding",
        subtasks: [
          { title: "Materialen aanleveren aan locatie" },
          { title: "Wrap-up en foto's verwerken" },
        ],
      },
    ],
  },

  // 2.2 — Leadership training (three named variants, all linked to "Training: Leadership")
  {
    name: "Mentor training",
    summary:
      "Zonder externe trainers, €3.000 per sessie + hulp in communicatie + branded lead booklets.",
    serviceName: "Training: Leadership",
    defaultDescription: p(
      "Goede leiders zijn de belangrijkste dragers van jullie cultuur en vormen de cruciale schakel tussen strategie en de dagelijkse uitvoering. Onze Mentor-training maakt onderdeel uit van onze leiderschapstrainingen en is bedoeld voor zowel startende als meer ervaren mentoren die talentontwikkeling begeleiden en input leveren voor de performance evaluaties binnen jouw organisatie."
    ),
    defaultWhy: p(
      "Mentoren krijgen vaak de rol erbij, zonder kader of taal. Daardoor verloopt talentontwikkeling ad hoc, voelt feedback persoonlijk in plaats van gedragen, en blijft de bijdrage aan performance evaluaties subjectief en inconsistent tussen mensen en teams."
    ),
    defaultWhat: p(
      "Een scherp mentorprofiel en een gedeelde aanpak maken expliciet wat goed mentorschap binnen jullie context betekent. Daarmee wordt talentontwikkeling consistent, eigenaarschap zichtbaar en input voor evaluaties uitlegbaar."
    ),
    defaultHow: p(
      "In twee trainingssessies van vier uur vertalen we jullie Cultureel DNA naar een werkbaar mentorprofiel en oefenen we de bijbehorende gespreks- en feedbackvaardigheden. We starten met een self-assessment en sluiten af met een cheatsheet die mentoren in hun dagelijkse ritme gebruiken."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Mentor-profiel opstellen of aanscherpen", "Rolverwachtingen en gedrag concreet maken vanuit jullie DNA."],
      ["Self-assessment deelnemers", "Persoonlijke startpositie en ontwikkelpunten in beeld brengen."],
      ["Trainingssessie #1 met mentoren", "Mentorprofiel, gespreksstructuur en feedback op gedrag oefenen."],
      ["Trainingssessie #2 met mentoren", "Talentontwikkeling, evaluatie-input en casuïstiek verdiepen."],
      ["Recap en post read", "Geleerde principes vastleggen in een werkbare cheatsheet."],
    ])),
    defaultDeliverables: introList("Trainingspakket met:", ul([
      "Branded Mentor profiel met gedragsvoorbeelden",
      "Self-assessment per deelnemer",
      "Twee trainingssessies van 4 uur (max ~10 deelnemers)",
      "Recap en cheatsheet voor dagelijks gebruik",
    ])),
    defaultDeliveryDays: 42,
    sessions: [
      { title: "Werksessie Mentor-profiel met contactpersoon", info: "Rolverwachtingen en gedrag concreet maken vanuit jullie DNA." },
      { title: "Trainingssessie #1 met mentoren", info: "4 uur, max ~10 deelnemers — mentorprofiel, gespreksstructuur en feedback op gedrag oefenen." },
      { title: "Trainingssessie #2 met mentoren", info: "4 uur, max ~10 deelnemers — talentontwikkeling, evaluatie-input en casuïstiek verdiepen." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 3 },
      { roleName: "Senior Consultant", days: 2.5 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Mentor-profiel opstellen of aanscherpen" },
          { title: "Self-assessment klaarzetten" },
          { title: "Cases uit praktijk verzamelen" },
        ],
      },
      {
        title: "Trainingen",
        subtasks: [
          { title: "Sessie #1 voorbereiden" },
          { title: "Sessie #2 voorbereiden" },
        ],
      },
      {
        title: "Afronding",
        subtasks: [
          { title: "Recap schrijven" },
          { title: "Cheatsheet opmaken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },
  {
    name: "Team Lead training",
    summary:
      "Zonder externe trainers, €3.000 per sessie + hulp in communicatie + branded lead booklets.",
    serviceName: "Training: Leadership",
    defaultDescription: p(
      "Goede leiders zijn de belangrijkste dragers van jullie cultuur en vormen de cruciale schakel tussen strategie en de dagelijkse uitvoering. Onze Team Lead-training maakt onderdeel uit van onze leiderschapstrainingen en is bedoeld voor zowel startende als meer ervaren Team Leads, in de rol van meewerkend voorman/-vrouw, verantwoordelijk voor de ontwikkeling van het vakgebied en hun team."
    ),
    defaultWhy: p(
      "Team leads zijn meewerkend voorman én cultuurdrager tegelijk. Zonder een gedeeld profiel en ritme glijdt de rol terug naar operationeel trekken: vakinhoud wint van teamontwikkeling, feedback wordt ad hoc en eigenaarschap blijft bij één persoon liggen."
    ),
    defaultWhat: p(
      "Een scherp Team Lead-profiel en een gedeelde aanpak maken expliciet hoe je vakgebied én team tegelijk ontwikkelt. Daarmee wordt leiderschap systemisch, feedback ritmisch en eigenaarschap zichtbaar in het dagelijkse werk."
    ),
    defaultHow: p(
      "In drie trainingssessies van vier uur vertalen we jullie Cultureel DNA naar een werkbaar Team Lead-profiel en oefenen we de bijbehorende leiderschaps-, feedback- en coachingsvaardigheden. We starten met een self-assessment en sluiten af met een cheatsheet die team leads in hun dagelijkse ritme gebruiken."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Team Lead-profiel opstellen of aanscherpen", "Rolverwachtingen, vakinhoud en cultuurgedrag verbinden vanuit jullie DNA."],
      ["Self-assessment deelnemers", "Persoonlijke startpositie en ontwikkelpunten in beeld brengen."],
      ["Trainingssessie #1 met team leads", "Team Lead-profiel, ritme en eigenaarschap concreet maken."],
      ["Trainingssessie #2 met team leads", "Coaching, feedback op gedrag en teamontwikkeling oefenen."],
      ["Trainingssessie #3 met team leads", "Casuïstiek, performance management en borging in de praktijk."],
      ["Recap en post read", "Geleerde principes vastleggen in een werkbare cheatsheet."],
    ])),
    defaultDeliverables: introList("Trainingspakket met:", ul([
      "Branded Team Lead profiel met gedragsvoorbeelden",
      "Self-assessment per deelnemer",
      "Drie trainingssessies van 4 uur (max ~10 deelnemers)",
      "Recap en cheatsheet voor dagelijks gebruik",
    ])),
    defaultDeliveryDays: 84,
    sessions: [
      { title: "Werksessie Team Lead-profiel met contactpersoon", info: "Rolverwachtingen, vakinhoud en cultuurgedrag verbinden vanuit jullie DNA." },
      { title: "Trainingssessie #1 met team leads", info: "4 uur, max ~10 deelnemers — Team Lead-profiel, ritme en eigenaarschap concreet maken." },
      { title: "Trainingssessie #2 met team leads", info: "4 uur, max ~10 deelnemers — coaching, feedback op gedrag en teamontwikkeling oefenen." },
      { title: "Trainingssessie #3 met team leads", info: "4 uur, max ~10 deelnemers — casuïstiek, performance management en borging in de praktijk." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 4 },
      { roleName: "Senior Consultant", days: 3.5 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Team Lead-profiel opstellen of aanscherpen" },
          { title: "Self-assessment klaarzetten" },
          { title: "Cases uit praktijk verzamelen" },
        ],
      },
      {
        title: "Trainingen",
        subtasks: [
          { title: "Sessie #1 voorbereiden" },
          { title: "Sessie #2 voorbereiden" },
          { title: "Sessie #3 voorbereiden" },
        ],
      },
      {
        title: "Afronding",
        subtasks: [
          { title: "Recap schrijven" },
          { title: "Cheatsheet opmaken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },
  {
    name: "MT training",
    summary:
      "Voor MT-leden met hiërarchische eindverantwoordelijkheid (teamprestaties, samenstelling, beoordeling). 5 sessies van 4 uur, ~8 deelnemers per sessie.",
    serviceName: "Training: Leadership",
    defaultDescription: p(
      "Goede leiders zijn de belangrijkste dragers van jullie cultuur en vormen de cruciale schakel tussen strategie en de dagelijkse uitvoering. Onze MT-training maakt onderdeel uit van onze leiderschapstrainingen en is bedoeld voor zowel startende als meer ervaren Management Team-leden, met hiërarchische eindverantwoordelijkheid voor teamprestaties, teamsamenstelling en beoordeling."
    ),
    defaultWhy: p(
      "MT-leden dragen eindverantwoordelijkheid voor prestaties, samenstelling en beoordeling van hun teams. Zonder gedeelde taal en ritme worden beslissingen persoonlijk in plaats van systemisch: elk MT-lid stuurt anders, cultuur fragmenteert tussen afdelingen en performance management voelt politiek."
    ),
    defaultWhat: p(
      "Een scherp MT-profiel en een gedeelde aanpak maken expliciet hoe MT-leden cultuur, strategie en teamprestaties met elkaar verbinden. Daarmee worden beslissingen over gedrag, samenstelling en beoordeling consistent, uitlegbaar en gedragen door het hele MT."
    ),
    defaultHow: p(
      "In vijf trainingssessies van vier uur vertalen we jullie Cultureel DNA naar een werkbaar MT-profiel en oefenen we de bijbehorende leiderschaps-, beoordelings- en besluitvormingsvaardigheden. We starten met een self-assessment en sluiten af met een cheatsheet die MT-leden in hun dagelijkse ritme gebruiken."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["MT-profiel opstellen of aanscherpen", "Rolverwachtingen en gedrag van MT-leden concreet maken vanuit jullie DNA."],
      ["Self-assessment deelnemers", "Persoonlijke startpositie en ontwikkelpunten in beeld brengen."],
      ["Trainingssessie #1 met MT", "MT-profiel, ritme en cultuurdragerschap concreet maken."],
      ["Trainingssessie #2 met MT", "Strategie, richting geven en eigenaarschap activeren."],
      ["Trainingssessie #3 met MT", "Coaching, feedback op gedrag en teamontwikkeling."],
      ["Trainingssessie #4 met MT", "Performance management, beoordeling en teamsamenstelling."],
      ["Trainingssessie #5 met MT", "Casuïstiek, besluitvorming en borging in het MT-ritme."],
      ["Recap en post read", "Geleerde principes vastleggen in een werkbare cheatsheet."],
    ])),
    defaultDeliverables: introList("Trainingspakket met:", ul([
      "Branded MT profiel met gedragsvoorbeelden",
      "Self-assessment per deelnemer",
      "Vijf trainingssessies van 4 uur (max ~8 deelnemers)",
      "Recap en cheatsheet voor dagelijks gebruik",
    ])),
    defaultDeliveryDays: 180,
    sessions: [
      { title: "Werksessie MT-profiel met contactpersoon", info: "Rolverwachtingen en gedrag van MT-leden concreet maken vanuit jullie DNA." },
      { title: "Trainingssessie #1 met MT", info: "4 uur, max ~8 deelnemers — MT-profiel, ritme en cultuurdragerschap concreet maken." },
      { title: "Trainingssessie #2 met MT", info: "4 uur, max ~8 deelnemers — strategie, richting geven en eigenaarschap activeren." },
      { title: "Trainingssessie #3 met MT", info: "4 uur, max ~8 deelnemers — coaching, feedback op gedrag en teamontwikkeling." },
      { title: "Trainingssessie #4 met MT", info: "4 uur, max ~8 deelnemers — performance management, beoordeling en teamsamenstelling." },
      { title: "Trainingssessie #5 met MT", info: "4 uur, max ~8 deelnemers — casuïstiek, besluitvorming en borging in het MT-ritme." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 6.5 },
      { roleName: "Senior Consultant", days: 6 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "MT-profiel opstellen of aanscherpen" },
          { title: "Self-assessment klaarzetten" },
          { title: "Cases uit praktijk verzamelen" },
          { title: "Communicatie naar deelnemers voorbereiden" },
        ],
      },
      {
        title: "Trainingen",
        subtasks: [
          { title: "Sessie #1 voorbereiden" },
          { title: "Sessie #2 voorbereiden" },
          { title: "Sessie #3 voorbereiden" },
          { title: "Sessie #4 voorbereiden" },
          { title: "Sessie #5 voorbereiden" },
        ],
      },
      {
        title: "Afronding",
        subtasks: [
          { title: "Recap schrijven" },
          { title: "Cheatsheet opmaken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },

  // 2.3 — Platform implementatie
  {
    name: "Platform implementatie – S",
    summary:
      "Kies wanneer alle content al verzameld is in een voortraject. Wij richten de omgeving in en doen key-user training.",
    serviceName: "Platform",
    defaultDescription: p(
      "Het SUMM platform helpt jullie als team gemakkelijker bij te dragen aan al je culturele practices. Zo werken je mensen gezamenlijk aan je culturele doelen en practices."
    ),
    defaultWhy: p(
      "Cultuur blijft bij jullie te vaak een los project: mooie sessies, een mooi document, maar weinig dagelijks ritme. Zonder een gedeelde plek waar gedrag, rituelen en feedback samenkomen, vervliegt de energie zodra het project klaar is."
    ),
    defaultWhat: p(
      "Een ingerichte, branded SUMM omgeving die jullie Cultureel DNA, teams en practices op één plek samenbrengt. Daarmee wordt cultuur onderdeel van het dagelijks ritme in plaats van een eenmalige oefening."
    ),
    defaultHow: p(
      "We nemen de in het voortraject opgeleverde content over, richten de branded SUMM omgeving in op jullie teams en profielen, en trainen jullie key-users zodat zij het platform vanaf dag één eigenaar kunnen maken."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Intake met contactpersoon", "Content, teams en gewenste inrichting scherpstellen."],
      ["Implementatie opgeleverde content", "Cultureel DNA, teams en profielen in de branded omgeving zetten."],
      ["Key-user training", "Contactpersoon en key-users bekwaam maken in beheer en activatie."],
    ])),
    defaultDeliverables: introList("Branded SUMM omgeving met:", ul([
      "Ingerichte teams en gebruikersprofielen",
      "Geladen Cultureel DNA en bijbehorende gedragingen",
      "Key-user training en beknopte handleiding",
      "Branded look-and-feel afgestemd op jullie identiteit",
    ])),
    defaultDeliveryDays: 7,
    sessions: [
      { title: "Intake met contactpersoon", info: "Content, teams en gewenste inrichting scherpstellen." },
      { title: "Key-user training", info: "Contactpersoon en key-users bekwaam maken in beheer en activatie van het platform." },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Intake voorbereiden" },
          { title: "Content uit voortraject overnemen" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Branded omgeving inrichten" },
          { title: "Teams en profielen aanmaken" },
          { title: "Key-user training voorbereiden" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Kwaliteitscontrole op inrichting" },
          { title: "Handleiding aanleveren" },
        ],
      },
    ],
  },
  {
    name: "Platform implementatie – L",
    summary:
      "Kies wanneer content nog opgehaald en ingevoerd moet worden. Wij ondersteunen het hele proces.",
    serviceName: "Platform",
    defaultDescription: p(
      "Het SUMM platform helpt jullie als team gemakkelijker bij te dragen aan al je culturele practices. Zo werken je mensen gezamenlijk aan je culturele doelen en practices."
    ),
    defaultWhy: p(
      "Cultuur blijft bij jullie te vaak een los project: mooie sessies, een mooi document, maar weinig dagelijks ritme. Zonder een gedeelde plek waar gedrag, rituelen en feedback samenkomen, vervliegt de energie zodra het project klaar is."
    ),
    defaultWhat: p(
      "Een ingerichte, branded SUMM omgeving die jullie Cultureel DNA, teams en practices op één plek samenbrengt. Daarmee wordt cultuur onderdeel van het dagelijks ritme in plaats van een eenmalige oefening."
    ),
    defaultHow: p(
      "We halen samen met jullie de benodigde content op, voeren die in een branded SUMM omgeving in, structureren teams en profielen en trainen key-users zodat het platform vanaf de livegang een werkend ritme draagt."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Intake met contactpersoon", "Scope, teams en benodigde content scherpstellen."],
      ["Content opvragen en verzamelen", "Cultureel DNA, gedragingen en teaminformatie verzamelen uit jullie organisatie."],
      ["Inrichting branded omgeving", "Content invoeren, teams structureren en profielen aanmaken."],
      ["Key-user training", "Contactpersoon en key-users bekwaam maken in beheer en activatie."],
      ["Livegang en overdracht", "Platform openstellen voor het team en eigenaarschap overdragen."],
    ])),
    defaultDeliverables: introList("Branded SUMM omgeving met:", ul([
      "Ingerichte teams en gebruikersprofielen",
      "Geladen Cultureel DNA en bijbehorende gedragingen",
      "Verzamelde en gestructureerde culturele content",
      "Key-user training en beknopte handleiding",
      "Branded look-and-feel afgestemd op jullie identiteit",
    ])),
    defaultDeliveryDays: 14,
    sessions: [
      { title: "Intake met contactpersoon", info: "Scope, teams en benodigde content scherpstellen." },
      { title: "Content-ophaal gesprekken", info: "Gesprekken om Cultureel DNA, gedragingen en teaminformatie op te halen uit jullie organisatie." },
      { title: "Key-user training", info: "Contactpersoon en key-users bekwaam maken in beheer en activatie van het platform." },
      { title: "Livegang en overdracht", info: "Platform openstellen voor het team en eigenaarschap overdragen." },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Intake voorbereiden" },
          { title: "Content-ophaal plan opstellen" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Content opvragen bij organisatie" },
          { title: "Content structureren en invoeren" },
          { title: "Branded omgeving inrichten" },
          { title: "Teams en profielen aanmaken" },
          { title: "Key-user training voorbereiden" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Kwaliteitscontrole op inrichting" },
          { title: "Handleiding aanleveren" },
          { title: "Livegang begeleiden" },
        ],
      },
    ],
  },

  // 2.4 — Platform licentie (subscription tiers; no delivery duration)
  {
    name: "Platform licentie – S",
    summary:
      "Voor teams tot 30 users. Onbeperkte toegang tot alle modules en toekomstige updates.",
    serviceName: "Platform",
    defaultDescription: p(
      "Onbeperkte toegang tot het SUMM platform voor je hele team. Inclusief alle modules en alle toekomstige updates. Tier S: tot 30 users."
    ),
    defaultWhy: p(
      "Cultuur leeft alleen als ze elke week voelbaar is. Zonder doorlopende toegang tot één gedeelde plek vervalt het ritme: feedback, rituelen en gedrag verdwijnen uit het dagelijks werk en cultuur wordt opnieuw een project in plaats van een gewoonte."
    ),
    defaultWhat: p(
      "Doorlopende toegang tot het SUMM platform voor het hele team, inclusief alle modules en toekomstige updates. Daarmee blijft jullie Cultureel DNA dagelijks zichtbaar en bruikbaar in gedrag, feedback en samenwerking."
    ),
    defaultHow: p(
      "Jullie krijgen een licentie op de branded SUMM omgeving voor maximaal 30 users, met directe toegang tot alle modules. Nieuwe functionaliteit wordt automatisch beschikbaar gemaakt zonder extra implementatie."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Licentie-activatie", "Toegang openstellen voor het hele team binnen de S-tier (tot 30 users)."],
      ["Continue updates en support", "Nieuwe modules en verbeteringen automatisch beschikbaar maken."],
    ])),
    defaultDeliverables: introList("Doorlopende toegang met:", ul([
      "Onbeperkte toegang voor maximaal 30 users",
      "Alle modules en toekomstige updates inbegrepen",
      "Branded SUMM omgeving als gedeelde cultuurplek",
    ])),
    tasks: [
      {
        title: "Activatie",
        subtasks: [
          { title: "Licentie activeren" },
          { title: "Key-user onboarding plannen" },
        ],
      },
    ],
  },
  {
    name: "Platform licentie – M",
    summary:
      "Voor teams van 30 tot 50 users. Onbeperkte toegang tot alle modules en toekomstige updates.",
    serviceName: "Platform",
    defaultDescription: p(
      "Onbeperkte toegang tot het SUMM platform voor je hele team. Inclusief alle modules en alle toekomstige updates. Tier M: 30 tot 50 users."
    ),
    defaultWhy: p(
      "Cultuur leeft alleen als ze elke week voelbaar is. Zonder doorlopende toegang tot één gedeelde plek vervalt het ritme: feedback, rituelen en gedrag verdwijnen uit het dagelijks werk en cultuur wordt opnieuw een project in plaats van een gewoonte."
    ),
    defaultWhat: p(
      "Doorlopende toegang tot het SUMM platform voor het hele team, inclusief alle modules en toekomstige updates. Daarmee blijft jullie Cultureel DNA dagelijks zichtbaar en bruikbaar in gedrag, feedback en samenwerking."
    ),
    defaultHow: p(
      "Jullie krijgen een licentie op de branded SUMM omgeving voor 30 tot 50 users, met directe toegang tot alle modules. Nieuwe functionaliteit wordt automatisch beschikbaar gemaakt zonder extra implementatie."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Licentie-activatie", "Toegang openstellen voor het hele team binnen de M-tier (30 tot 50 users)."],
      ["Continue updates en support", "Nieuwe modules en verbeteringen automatisch beschikbaar maken."],
    ])),
    defaultDeliverables: introList("Doorlopende toegang met:", ul([
      "Onbeperkte toegang voor 30 tot 50 users",
      "Alle modules en toekomstige updates inbegrepen",
      "Branded SUMM omgeving als gedeelde cultuurplek",
    ])),
    tasks: [
      {
        title: "Activatie",
        subtasks: [
          { title: "Licentie activeren" },
          { title: "Key-user onboarding plannen" },
        ],
      },
    ],
  },
  {
    name: "Platform licentie – L",
    summary:
      "Voor teams van 50+ users. Onbeperkte toegang tot alle modules en toekomstige updates.",
    serviceName: "Platform",
    defaultDescription: p(
      "Onbeperkte toegang tot het SUMM platform voor je hele team. Inclusief alle modules en alle toekomstige updates. Tier L: 50+ users."
    ),
    defaultWhy: p(
      "Cultuur leeft alleen als ze elke week voelbaar is. Zonder doorlopende toegang tot één gedeelde plek vervalt het ritme: feedback, rituelen en gedrag verdwijnen uit het dagelijks werk en cultuur wordt opnieuw een project in plaats van een gewoonte."
    ),
    defaultWhat: p(
      "Doorlopende toegang tot het SUMM platform voor het hele team, inclusief alle modules en toekomstige updates. Daarmee blijft jullie Cultureel DNA dagelijks zichtbaar en bruikbaar in gedrag, feedback en samenwerking."
    ),
    defaultHow: p(
      "Jullie krijgen een licentie op de branded SUMM omgeving voor 50 of meer users, met directe toegang tot alle modules. Nieuwe functionaliteit wordt automatisch beschikbaar gemaakt zonder extra implementatie."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Licentie-activatie", "Toegang openstellen voor het hele team binnen de L-tier (50+ users)."],
      ["Continue updates en support", "Nieuwe modules en verbeteringen automatisch beschikbaar maken."],
    ])),
    defaultDeliverables: introList("Doorlopende toegang met:", ul([
      "Onbeperkte toegang voor 50 of meer users",
      "Alle modules en toekomstige updates inbegrepen",
      "Branded SUMM omgeving als gedeelde cultuurplek",
    ])),
    tasks: [
      {
        title: "Activatie",
        subtasks: [
          { title: "Licentie activeren" },
          { title: "Key-user onboarding plannen" },
        ],
      },
    ],
  },

  // 2.5 — Feedback training
  {
    name: "Feedback training – S",
    summary:
      "Kick-off: kennismaken & leerdoelen, cases uitwerken en controle hierop, sessie + recap.",
    serviceName: "Training: Feedback",
    defaultDescription: p(
      "Feedback is de brandstof voor elke sterke cultuur. In onze feedback training leren de deelnemers alle skills om bij te dragen aan een gezonde feedbackcultuur. Door te leren hoe effectief en gericht feedback te geven én te ontvangen, zowel op skills als op culturele bijdrage en gedrag."
    ),
    defaultWhy: p(
      "In jullie teams blijft feedback te vaak ongezegd: mensen durven elkaar niet aan te spreken, of het gebeurt pas bij beoordelingen. Daardoor stagneert groei, blijven irritaties hangen en wordt cultuur iets wat alleen op papier bestaat."
    ),
    defaultWhat: p(
      "Een feedbacktraining die deelnemers de skills geeft om feedback te geven en te ontvangen op zowel vakmanschap als gedrag. Daarmee wordt feedback onderdeel van het dagelijks ritme in plaats van een ongemakkelijk moment."
    ),
    defaultHow: p(
      "Met een intake stemmen we de training af op jullie context, sturen we een pre-read uit ter voorbereiding en faciliteren we 4-uurs trainingssessies met twee trainers waarin deelnemers oefenen op maatwerkcases uit jullie eigen praktijk."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Intake met contactpersoon", "Context, cases en leerdoelen scherpstellen."],
      ["Pre-read voor deelnemers", "Theorie en voorbereiding op de sessie aanreiken."],
      ["Trainingssessie (4 uur, 2 trainers)", "Eén groep van max 10 deelnemers oefent met feedback geven en ontvangen."],
      ["Recap voor deelnemers", "Inzichten bundelen en vertalen naar dagelijks gebruik."],
    ])),
    defaultDeliverables: introList("Trainingspakket met:", ul([
      "Branded pre-read voor deelnemers",
      "Gefaciliteerde trainingssessie van 4 uur",
      "Recap met kernpunten en oefenhandvatten",
      "Maatwerkcases uit jullie eigen praktijk",
    ])),
    defaultDeliveryDays: 21,
    sessions: [
      { title: "Intake met contactpersoon", info: "Context, cases en leerdoelen scherpstellen." },
      { title: "Trainingssessie met deelnemers", info: "4 uur, 1 groep van max 10 deelnemers, 2 trainers — oefenen met feedback geven en ontvangen." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 2.5 },
      { roleName: "Content lead", days: 1.5 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Intake voorbereiden" },
          { title: "Maatwerkcases uitwerken" },
          { title: "Pre-read opmaken" },
        ],
      },
      {
        title: "Trainingen",
        subtasks: [
          { title: "Sessie-materiaal finaliseren" },
        ],
      },
      {
        title: "Afronding",
        subtasks: [
          { title: "Recap schrijven" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },
  {
    name: "Feedback training – M",
    summary:
      "Kick-off: kennismaken & leerdoelen, cases uitwerken en controle hierop, 2–3 sessies + recap.",
    serviceName: "Training: Feedback",
    defaultDescription: p(
      "Feedback is de brandstof voor elke sterke cultuur. In onze feedback training leren de deelnemers alle skills om bij te dragen aan een gezonde feedbackcultuur. Door te leren hoe effectief en gericht feedback te geven én te ontvangen, zowel op skills als op culturele bijdrage en gedrag."
    ),
    defaultWhy: p(
      "In jullie teams blijft feedback te vaak ongezegd: mensen durven elkaar niet aan te spreken, of het gebeurt pas bij beoordelingen. Daardoor stagneert groei, blijven irritaties hangen en wordt cultuur iets wat alleen op papier bestaat."
    ),
    defaultWhat: p(
      "Een feedbacktraining die deelnemers de skills geeft om feedback te geven en te ontvangen op zowel vakmanschap als gedrag. Daarmee wordt feedback onderdeel van het dagelijks ritme in plaats van een ongemakkelijk moment."
    ),
    defaultHow: p(
      "Met een intake stemmen we de training af op jullie context, sturen we een pre-read uit ter voorbereiding en faciliteren we 4-uurs trainingssessies met twee trainers waarin deelnemers oefenen op maatwerkcases uit jullie eigen praktijk."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Intake met contactpersoon", "Context, cases en leerdoelen scherpstellen."],
      ["Pre-read voor deelnemers", "Theorie en voorbereiding op de sessies aanreiken."],
      ["Trainingssessies (2–3 groepen, 4 uur, 2 trainers)", "Per groep van max 10 deelnemers oefenen met feedback geven en ontvangen."],
      ["Recap voor deelnemers", "Inzichten bundelen en vertalen naar dagelijks gebruik."],
    ])),
    defaultDeliverables: introList("Trainingspakket met:", ul([
      "Branded pre-read voor deelnemers",
      "Gefaciliteerde trainingssessies van 4 uur",
      "Recap met kernpunten en oefenhandvatten",
      "Maatwerkcases uit jullie eigen praktijk",
    ])),
    defaultDeliveryDays: 21,
    sessions: [
      { title: "Intake met contactpersoon", info: "Context, cases en leerdoelen scherpstellen." },
      { title: "Trainingssessie met deelnemers", info: "4 uur per groep, 2 trainers — plan 2 tot 3 groepen van max 10 deelnemers." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 4 },
      { roleName: "Content lead", days: 2.5 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Intake voorbereiden" },
          { title: "Maatwerkcases uitwerken" },
          { title: "Pre-read opmaken" },
        ],
      },
      {
        title: "Trainingen",
        subtasks: [
          { title: "Sessie-materiaal finaliseren" },
          { title: "Planning meerdere groepen afstemmen" },
        ],
      },
      {
        title: "Afronding",
        subtasks: [
          { title: "Recap schrijven" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },
  {
    name: "Feedback training – L",
    summary:
      "Kick-off: kennismaken & leerdoelen, cases uitwerken en controle hierop, 3–5 sessies + recap.",
    serviceName: "Training: Feedback",
    defaultDescription: p(
      "Feedback is de brandstof voor elke sterke cultuur. In onze feedback training leren de deelnemers alle skills om bij te dragen aan een gezonde feedbackcultuur, waarin teamleden elkaar open en vol vertrouwen feedback geven, ongeacht hun positie in het team."
    ),
    defaultWhy: p(
      "In jullie teams blijft feedback te vaak ongezegd: mensen durven elkaar niet aan te spreken, of het gebeurt pas bij beoordelingen. Daardoor stagneert groei, blijven irritaties hangen en wordt cultuur iets wat alleen op papier bestaat."
    ),
    defaultWhat: p(
      "Een feedbacktraining die deelnemers de skills geeft om feedback te geven en te ontvangen op zowel vakmanschap als gedrag. Daarmee wordt feedback onderdeel van het dagelijks ritme in plaats van een ongemakkelijk moment."
    ),
    defaultHow: p(
      "Met een intake stemmen we de training af op jullie context, sturen we een pre-read uit ter voorbereiding en faciliteren we 4-uurs trainingssessies met twee trainers waarin deelnemers oefenen op maatwerkcases uit jullie eigen praktijk."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Intake met contactpersoon", "Context, cases en leerdoelen scherpstellen."],
      ["Pre-read voor deelnemers", "Theorie en voorbereiding op de sessies aanreiken."],
      ["Trainingssessies (~5 groepen, 3–5 sessies van 4 uur, 2 trainers)", "Per groep van max 10 deelnemers oefenen met feedback geven en ontvangen."],
      ["Recap voor deelnemers", "Inzichten bundelen en vertalen naar dagelijks gebruik."],
      ["Afsluitende terugkoppeling aan contactpersoon", "Rode draad en aandachtspunten voor borging delen met opdrachtgever."],
    ])),
    defaultDeliverables: introList("Trainingspakket met:", ul([
      "Branded pre-read voor deelnemers",
      "Gefaciliteerde trainingssessies van 4 uur",
      "Recap met kernpunten en oefenhandvatten",
      "Maatwerkcases uit jullie eigen praktijk",
      "Terugkoppeling aan contactpersoon op rode draad en borging",
    ])),
    defaultDeliveryDays: 35,
    sessions: [
      { title: "Intake met contactpersoon", info: "Context, cases en leerdoelen scherpstellen." },
      { title: "Trainingssessie met deelnemers", info: "4 uur per groep, 2 trainers — plan ~5 groepen van max 10 deelnemers." },
      { title: "Afsluitende terugkoppeling aan contactpersoon", info: "Rode draad en aandachtspunten voor borging delen met opdrachtgever." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 5 },
      { roleName: "Content lead", days: 3.5 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Intake voorbereiden" },
          { title: "Maatwerkcases uitwerken" },
          { title: "Pre-read opmaken" },
          { title: "Planning ~5 groepen afstemmen" },
        ],
      },
      {
        title: "Trainingen",
        subtasks: [
          { title: "Sessie-materiaal finaliseren" },
          { title: "Cases per groep aanpassen" },
        ],
      },
      {
        title: "Afronding",
        subtasks: [
          { title: "Recap schrijven" },
          { title: "Rode draad en borgingsadvies formuleren" },
          { title: "Terugkoppeling aan contactpersoon voorbereiden" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },

  // 2.6 — Rewards
  {
    name: "Reward strategie – M",
    summary:
      "Ophaalsessie, uitwerking, iteratieronde + presentatie aan LT.",
    serviceName: "Rewards",
    defaultDescription: p(
      "Op basis van jullie beoogde culturele DNA (en daarbij passende best practices), een uitvoerige scan van jullie huidige aanpak rondom beloning en jullie employer value proposition formuleren we onze aanbeveling voor jullie optimaal passende beloningsstrategie."
    ),
    defaultWhy: p(
      "Jullie beloning stuurt onbedoeld het verkeerde gedrag aan, voelt voor mensen niet uitlegbaar en staat los van wat jullie als Cultureel DNA willen versterken. Daardoor wordt beloning een bron van ruis en verloop in plaats van een hefboom voor de gewenste cultuur."
    ),
    defaultWhat: p(
      "Een cultuurgedreven rewardstrategie die expliciet maakt welk gedrag jullie willen belonen en hoe vaste, variabele en niet-financiële prikkels samenwerken. Daarmee wordt beloning uitlegbaar, motiverend en in lijn met jullie missie en DNA."
    ),
    defaultHow: p(
      "In een combinatie van outside-in marktanalyse en inside-out scan brengen we jullie huidige beloning, EVP en rollen in beeld en vertalen we deze in werksessies met het LT naar een passende rewardstrategie en implementatieplan."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Intake en scan", "Huidige beloningsaanpak, EVP en rollen in beeld brengen."],
      ["Werksessie #1 met LT", "Strategische uitgangspunten en gewenst gedrag scherpstellen."],
      ["Werksessie #2 met LT", "Mix van vaste, variabele en niet-financiële beloning ontwerpen."],
      ["Uitwerking en implementatieplan door SUMM", "Definitieve rewardstrategie en stappen voor invoering opleveren."],
    ])),
    defaultDeliverables: introList("Branded presentatie met:", ul([
      "Aanbeveling voor cultuurgedreven rewardstrategie",
      "Heldere koppeling tussen rollen, performance en beloning",
      "Mix van vaste, variabele en niet-financiële rewards",
      "Implementatieplan met stappen en aandachtspunten",
    ])),
    defaultDeliveryDays: 28,
    sessions: [
      { title: "Intake en scan met opdrachtgever", info: "Huidige beloningsaanpak, EVP en rollen samen in beeld brengen." },
      { title: "Werksessie #1 met LT", info: "Strategische uitgangspunten en gewenst gedrag scherpstellen." },
      { title: "Werksessie #2 met LT", info: "Mix van vaste, variabele en niet-financiële beloning samen ontwerpen." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 2 },
      { roleName: "Content lead", days: 1 },
      { roleName: "Senior Consultant", days: 1 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Intake voorbereiden" },
          { title: "Huidige beloningsaanpak scannen" },
          { title: "Marktanalyse uitvoeren" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Werksessie #1 voorbereiden" },
          { title: "Werksessie #2 voorbereiden" },
          { title: "Concept rewardstrategie uitwerken" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Implementatieplan opstellen" },
          { title: "Feedback verwerken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },
  {
    name: "Reward strategie – L",
    summary:
      "Ophaalsessie, uitwerking, terugpresenteersessie, verwerken + iteratieronde + presentatie aan LT / organisatie.",
    serviceName: "Rewards",
    defaultDescription: p(
      "Op basis van jullie beoogde culturele DNA (en daarbij passende best practices), een uitvoerige scan van jullie huidige aanpak rondom beloning en jullie employer value proposition formuleren we onze aanbeveling voor jullie optimaal passende beloningsstrategie."
    ),
    defaultWhy: p(
      "Jullie beloning stuurt onbedoeld het verkeerde gedrag aan, voelt voor mensen niet uitlegbaar en staat los van wat jullie als Cultureel DNA willen versterken. Daardoor wordt beloning een bron van ruis en verloop in plaats van een hefboom voor de gewenste cultuur."
    ),
    defaultWhat: p(
      "Een cultuurgedreven rewardstrategie die expliciet maakt welk gedrag jullie willen belonen en hoe vaste, variabele en niet-financiële prikkels samenwerken. Daarmee wordt beloning uitlegbaar, motiverend en in lijn met jullie missie en DNA."
    ),
    defaultHow: p(
      "In een combinatie van outside-in marktanalyse en uitvoerige inside-out scan vertalen we jullie huidige beloning, EVP, rollen en CAO-context in werksessies met LT en kernteam naar een passende rewardstrategie en gedetailleerd implementatieplan."
    ),
    defaultActivities: introList("Aanpak:", ulTitled([
      ["Intake en uitvoerige scan", "Huidige beloning, EVP, rollen en CAO-context in beeld brengen."],
      ["Werksessie #1 met LT en kernteam", "Strategische uitgangspunten en gewenst gedrag scherpstellen."],
      ["Werksessie #2 met LT en kernteam", "Mix van vaste, variabele en niet-financiële beloning ontwerpen."],
      ["Uitwerking door SUMM", "Definitieve rewardstrategie formuleren en doorrekenen op impact."],
      ["Implementatieplan en change-aanpak", "Stappen, communicatie en risico's voor invoering uitwerken."],
    ])),
    defaultDeliverables: introList("Branded presentatie met:", ul([
      "Aanbeveling voor cultuurgedreven rewardstrategie",
      "Heldere koppeling tussen rollen, performance en beloning",
      "Mix van vaste, variabele en niet-financiële rewards",
      "Implementatieplan met stappen, communicatie en aandachtspunten",
      "Change-aanpak afgestemd op CAO en bredere stakeholders",
    ])),
    defaultDeliveryDays: 42,
    sessions: [
      { title: "Intake en uitvoerige scan met opdrachtgever", info: "Huidige beloning, EVP, rollen en CAO-context samen in beeld brengen." },
      { title: "Werksessie #1 met LT en kernteam", info: "Strategische uitgangspunten en gewenst gedrag scherpstellen." },
      { title: "Werksessie #2 met LT en kernteam", info: "Mix van vaste, variabele en niet-financiële beloning samen ontwerpen." },
      { title: "Implementatieplan en change-aanpak afstemming", info: "Stappen, communicatie, CAO-context en stakeholder-aanpak samen scherpstellen." },
    ],
    defaultRoleAllocation: [
      { roleName: "Client lead", days: 3 },
      { roleName: "Content lead", days: 2 },
      { roleName: "Senior Consultant", days: 2.5 },
    ],
    tasks: [
      {
        title: "Voorbereiding",
        subtasks: [
          { title: "Intake voorbereiden" },
          { title: "Uitvoerige scan huidige beloning uitvoeren" },
          { title: "Marktanalyse uitvoeren" },
          { title: "EVP en CAO-context analyseren" },
        ],
      },
      {
        title: "Uitvoering",
        subtasks: [
          { title: "Werksessie #1 voorbereiden" },
          { title: "Werksessie #2 voorbereiden" },
          { title: "Concept rewardstrategie uitwerken" },
          { title: "Impact doorrekenen" },
        ],
      },
      {
        title: "Oplevering",
        subtasks: [
          { title: "Implementatieplan opstellen" },
          { title: "Change-aanpak uitwerken" },
          { title: "Feedback verwerken" },
          { title: "Definitieve versie opleveren" },
        ],
      },
    ],
  },
];
