/**
 * Bilingual copy for the public proposal page + PDF render.
 *
 * Conventions:
 * - UI labels (eyebrows, section titles, button labels, form labels) are flat strings.
 * - Strings with runtime substitutions are functions (e.g. `acceptedBy(name)`).
 * - Default body paragraphs (legal intro, rates intro, billing terms) live here too —
 *   per user direction, these are SUMM standards, not per-plan editable.
 */

import type { ProposalLanguage } from "@/lib/models/ProjectPlan";

export const DEFAULT_VALIDITY_DAYS = 30;

type Copy = {
  // Hero / metadata
  proposalEyebrow: string;
  preparedFor: string;
  yourContact: string;

  // Main sections
  whatWePropose: string;
  aanleidingEyebrow: string;
  aanleidingTitle: string;
  challengeLabel: string;
  contextLabel: string;
  approachLabel: string;
  whatWellDo: string;
  projectSingular: string;
  projectPlural: string;
  projectsLead: string;
  noPlanning: string;

  // Project-block inline labels
  whyLabel: string;
  howLabel: string;
  whatLabel: string;
  activitiesLabel: string;
  deliverablesLabel: string;
  sessionsLabel: string;
  teamLabel: string;
  whenLabel: string;
  durationLabel: string;
  investmentLabel: string;
  dayLabel: string;
  daysLabel: string;
  participantSingular: string;
  participantPlural: string;
  tbdLabel: string;

  // Investment
  investmentEyebrow: string;
  whatItCosts: string;
  subtotal: string;
  discount: string;
  net: string;
  vat: string;
  total: string;
  totalInclVat: string;

  // Voorbehoud & Tarieven
  ratesEyebrow: string;
  ratesTitle: string;
  ratesIntro: string;
  perHour: string;
  billingTerms: string;
  validUntil: (formattedDate: string) => string;

  // Juridisch
  legalEyebrow: string;
  legalTitle: string;
  legalIntro: string;
  showTerms: string;
  hideTerms: string;

  // Accept
  nextStepsEyebrow: string;
  readyToStart: string;
  acceptLead: (clientCompany: string) => string;
  yourName: string;
  yourEmail: string;
  signOffAndStart: string;
  submitting: string;
  acceptDisclaimer: string;
  somethingWrong: string;
  thankYou: (name: string) => string;
  thankYouBody: string;

  // Accepted states
  acceptedByPill: (name: string, formattedDate: string) => string;
  proposalAccepted: string;
  proposalAcceptedAnonymous: (formattedDate: string) => string;
  acceptedByOn: (name: string, formattedDate: string) => string;
  acceptedOn: (formattedDate: string) => string;
  officiallyAccepted: string;
  digitallySignedOn: (formattedDate: string) => string;
  downloadPdf: string;
  openPdfPreview: string;

  // In-progress + error
  inProgressTitle: string;
  inProgressBodyWithTitle: (title: string) => string;
  inProgressBodyNoTitle: string;
  proposalUnavailable: string;

  // Sticky bar
  navOverview: string;
  navProjects: (count: number) => string;
  navInvestment: string;
  navAccept: string;
  acceptShort: string;
  acceptedShort: string;

  // Footer
  preparedBySumm: (year: number) => string;
  confidentialNote: (clientCompany: string) => string;

  // Theme toggle (a11y labels)
  switchToLight: string;
  switchToDark: string;

  // Project block expand / collapse hints
  moreInfo: string;
  lessInfo: string;

  // Floating chip prompting client to scroll to the accept section
  scrollToAccept: string;

  // Planning visual — fallback when a project has no scheduled dates yet
  dateTbd: string;
};

const NL: Copy = {
  proposalEyebrow: "Voorstel",
  preparedFor: "Opgesteld voor",
  yourContact: "Je contactpersoon",

  whatWePropose: "Wat we voorstellen",
  aanleidingEyebrow: "Aanleiding & aanpak",
  aanleidingTitle: "De uitdaging en onze aanpak",
  challengeLabel: "De uitdaging",
  contextLabel: "Aanleiding",
  approachLabel: "Onze aanpak",
  whatWellDo: "Wat we gaan doen",
  projectSingular: "project",
  projectPlural: "projecten",
  projectsLead: "Een overzicht van elk project dat we voorstellen.",
  noPlanning: "Nog te plannen",

  whyLabel: "Waarom",
  howLabel: "Hoe",
  whatLabel: "Wat",
  activitiesLabel: "Activiteiten",
  deliverablesLabel: "Resultaten",
  sessionsLabel: "Sessies",
  teamLabel: "Team",
  whenLabel: "Wanneer",
  durationLabel: "Duur",
  investmentLabel: "Investering",
  dayLabel: "dag",
  daysLabel: "dagen",
  participantSingular: "deelnemer",
  participantPlural: "deelnemers",
  tbdLabel: "NTB",

  investmentEyebrow: "Investering",
  whatItCosts: "Wat het kost",
  subtotal: "Subtotaal",
  discount: "Korting",
  net: "Netto",
  vat: "BTW",
  total: "Totaal",
  totalInclVat: "Totaal incl. BTW",

  ratesEyebrow: "Voorbehoud & tarieven",
  ratesTitle: "Overige afspraken",
  ratesIntro:
    "Dit voorstel is gebaseerd op een inschatting van werkuren voor de beschreven activiteiten. Indien aanvullende sessies of extra uren nodig zijn, worden die — altijd in overleg — op nacalculatie gefactureerd tegen onderstaande tarieven.",
  perHour: "/ uur",
  billingTerms: "Facturatie: 50% bij aanvang · 50% bij oplevering",
  validUntil: (d) => `Voorstel geldig tot ${d}`,

  legalEyebrow: "Juridisch",
  legalTitle: "Algemene voorwaarden",
  legalIntro:
    "Op deze samenwerking zijn de NLdigital Voorwaarden 2020 van toepassing. Hieronder de kernpunten — de volledige voorwaarden zijn op te vragen via info@summ.nl of te raadplegen op summ.nl.",
  showTerms: "Bekijk voorwaarden",
  hideTerms: "Verberg voorwaarden",

  nextStepsEyebrow: "Volgende stappen",
  readyToStart: "Klaar om te starten?",
  acceptLead: (company) =>
    `Accepteer het voorstel hieronder en we gaan voor ${company} aan de slag. Je ontvangt een bevestiging per e-mail.`,
  yourName: "Je naam",
  yourEmail: "Je e-mailadres",
  signOffAndStart: "Akkoord en starten",
  submitting: "Versturen…",
  acceptDisclaimer: "Door te accepteren bevestig je de scope en investering hierboven.",
  somethingWrong: "Er ging iets mis",
  thankYou: (name) => `Bedankt, ${name}.`,
  thankYouBody:
    "We hebben je akkoord ontvangen. We nemen snel contact op om de samenwerking op te starten.",

  acceptedByPill: (name, d) => `Geaccepteerd door ${name} op ${d}`,
  proposalAccepted: "Voorstel geaccepteerd",
  proposalAcceptedAnonymous: (d) => `Voorstel geaccepteerd op ${d}`,
  acceptedByOn: (name, d) => `Geaccepteerd door ${name} op ${d}.`,
  acceptedOn: (d) => `Geaccepteerd op ${d}.`,
  officiallyAccepted: "Officieel geaccepteerd",
  digitallySignedOn: (d) => `Digitaal ondertekend op ${d}`,
  downloadPdf: "Download voorstel als PDF",
  openPdfPreview: "Open PDF-voorbeeld",

  inProgressTitle: "We werken nog aan dit voorstel",
  inProgressBodyWithTitle: (title) =>
    `We verfijnen "${title}". Je link blijft werken — kom binnenkort terug.`,
  inProgressBodyNoTitle:
    "We verfijnen je voorstel. Je link blijft werken — kom binnenkort terug.",
  proposalUnavailable: "Voorstel niet beschikbaar",

  navOverview: "Overzicht",
  navProjects: (n) => `Projecten (${n})`,
  navInvestment: "Investering",
  navAccept: "Accepteren",
  acceptShort: "Accepteer",
  acceptedShort: "Geaccepteerd",

  preparedBySumm: (y) => `Opgesteld door SUMM · ${y}`,
  confidentialNote: (company) =>
    `Dit voorstel is vertrouwelijk en bedoeld voor ${company}.`,

  switchToLight: "Schakel naar licht thema",
  switchToDark: "Schakel naar donker thema",

  moreInfo: "Meer info",
  lessInfo: "Verberg",

  scrollToAccept: "Akkoord geven",

  dateTbd: "Datum NTB",
};

const EN: Copy = {
  proposalEyebrow: "Proposal",
  preparedFor: "Prepared for",
  yourContact: "Your contact",

  whatWePropose: "What we propose",
  aanleidingEyebrow: "Background & approach",
  aanleidingTitle: "The challenge and our approach",
  challengeLabel: "The challenge",
  contextLabel: "Background",
  approachLabel: "Our approach",
  whatWellDo: "What we'll do",
  projectSingular: "project",
  projectPlural: "projects",
  projectsLead: "A breakdown of each project we're proposing.",
  noPlanning: "To be scheduled",

  whyLabel: "Why",
  howLabel: "How",
  whatLabel: "What",
  activitiesLabel: "Activities",
  deliverablesLabel: "Deliverables",
  sessionsLabel: "Sessions",
  teamLabel: "Team",
  whenLabel: "When",
  durationLabel: "Duration",
  investmentLabel: "Investment",
  dayLabel: "day",
  daysLabel: "days",
  participantSingular: "participant",
  participantPlural: "participants",
  tbdLabel: "TBD",

  investmentEyebrow: "Investment",
  whatItCosts: "What it costs",
  subtotal: "Subtotal",
  discount: "Discount",
  net: "Net",
  vat: "VAT",
  total: "Total",
  totalInclVat: "Total incl. VAT",

  ratesEyebrow: "Terms & rates",
  ratesTitle: "Other agreements",
  ratesIntro:
    "This proposal is based on an estimate of hours for the described activities. If additional sessions or hours are required, they are — always in consultation — billed on actuals at the rates below.",
  perHour: "/ hour",
  billingTerms: "Billing: 50% on kick-off · 50% on delivery",
  validUntil: (d) => `Proposal valid until ${d}`,

  legalEyebrow: "Legal",
  legalTitle: "General terms",
  legalIntro:
    "The NLdigital Terms 2020 apply to this engagement. The key points are summarised below — the full terms are available via info@summ.nl or summ.nl.",
  showTerms: "View terms",
  hideTerms: "Hide terms",

  nextStepsEyebrow: "Next steps",
  readyToStart: "Ready to start?",
  acceptLead: (company) =>
    `Accept the proposal below and we'll get to work on ${company}'s engagement. You'll receive a confirmation by email.`,
  yourName: "Your name",
  yourEmail: "Your email",
  signOffAndStart: "Sign off and start",
  submitting: "Submitting…",
  acceptDisclaimer: "By accepting, you confirm the scope and investment outlined above.",
  somethingWrong: "Something went wrong",
  thankYou: (name) => `Thank you, ${name}.`,
  thankYouBody:
    "We've received your acceptance. We'll be in touch shortly to kick things off.",

  acceptedByPill: (name, d) => `Accepted by ${name} on ${d}`,
  proposalAccepted: "Proposal accepted",
  proposalAcceptedAnonymous: (d) => `Proposal accepted on ${d}`,
  acceptedByOn: (name, d) => `Accepted by ${name} on ${d}.`,
  acceptedOn: (d) => `Accepted on ${d}.`,
  officiallyAccepted: "Officially accepted",
  digitallySignedOn: (d) => `Digitally signed on ${d}`,
  downloadPdf: "Download proposal as PDF",
  openPdfPreview: "Open PDF preview",

  inProgressTitle: "Working on some changes",
  inProgressBodyWithTitle: (title) =>
    `We're refining "${title}". Your link will keep working — please check back shortly.`,
  inProgressBodyNoTitle:
    "We're refining your proposal. Your link will keep working — please check back shortly.",
  proposalUnavailable: "Proposal unavailable",

  navOverview: "Overview",
  navProjects: (n) => `Projects (${n})`,
  navInvestment: "Investment",
  navAccept: "Accept",
  acceptShort: "Accept",
  acceptedShort: "Accepted",

  preparedBySumm: (y) => `Prepared by SUMM · ${y}`,
  confidentialNote: (company) =>
    `This proposal is confidential and intended for ${company}.`,

  switchToLight: "Switch to light mode",
  switchToDark: "Switch to dark mode",

  moreInfo: "More info",
  lessInfo: "Hide",

  scrollToAccept: "Sign off",

  dateTbd: "Date TBD",
};

export const PROPOSAL_COPY: Record<ProposalLanguage, Copy> = { nl: NL, en: EN };

/** Resolve the copy bundle for a plan, falling back to NL if no language is set. */
export function copyFor(lang?: ProposalLanguage | null): Copy {
  return PROPOSAL_COPY[lang ?? "nl"] ?? PROPOSAL_COPY.nl;
}

export type ProposalCopy = Copy;
