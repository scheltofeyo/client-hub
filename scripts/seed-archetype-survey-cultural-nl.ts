/**
 * Seeds the Dutch version of SUMM's Cultural Archetype Survey template
 * ("Culturele Archetype Survey"): 14 vragen over 4 secties (Missie & DNA,
 * Leiderschap, Teamontwikkeling, Beloningen), elk met 5 opties gekoppeld
 * aan de archetypes Achievement / Customer-Centric / Innovation / One Team /
 * Greater-Good. Idempotent — bij re-run wordt een bestaande template niet
 * overschreven.
 *
 * Run: npm run seed:archetype-survey-nl
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

if (!process.env.MONGODB_URI) {
  try {
    const envPath = resolve(__dirname, "..", ".env.local");
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local may not exist in CI — env vars should be set there
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

// Archetype-namen blijven Engels — zo zijn ze in de database opgeslagen en
// blijven sessies/resultaten consistent met de Engelse template.
const ARCHETYPE_NAMES = [
  "Achievement",
  "Customer-Centric",
  "Innovation",
  "One Team",
  "Greater-Good",
] as const;

const SECTIONS = [
  { title: "Missie & DNA" },
  { title: "Leiderschap" },
  { title: "Teamontwikkeling" },
  { title: "Beloningen" },
] as const;

type SeedQuestion = {
  q: number;
  sectionIndex: number;
  title: string;
  options: [string, string, string, string, string];
};

const QUESTIONS: SeedQuestion[] = [
  {
    q: 1,
    sectionIndex: 0,
    title: "Wat zie jij als onze belangrijkste externe strategische doelstelling?",
    options: [
      "Marktaandeel winnen door onze concurrenten te overtreffen op drive, snelheid en uitvoering",
      "Marktaandeel winnen en klanten behouden door de beste klantbeleving en service in de markt te leveren",
      "Ons onderscheiden van concurrenten door innovatievere producten en diensten aan te bieden",
      "Onze business laten groeien via cross-selling, ondersteund door sterke interne samenwerking en afstemming tussen onze producten, teams en silo's",
      "Lange-termijn maatschappelijke en economische waarde leveren",
    ],
  },
  {
    q: 2,
    sectionIndex: 0,
    title: "Om onze doelstelling te bereiken, waar zou onze interne focus op moeten liggen?",
    options: [
      "Prestatie-discipline en verantwoordelijkheid",
      "Diepgaand klantbegrip en focus op klanttevredenheid",
      "Creativiteit, experimenteren en innovatie",
      "Samenwerking en afstemming tussen teams en afdelingen",
      "Vertrouwen, integriteit en het vermogen om ons aan onze missie te committeren",
    ],
  },
  {
    q: 3,
    sectionIndex: 0,
    title: "Onze huidige cultuur zou ik omschrijven als…",
    options: [
      "Een sterk gedisciplineerde prestatiecultuur, gericht op resultaten en persoonlijke verantwoordelijkheid",
      "Een klantgerichte cultuur, geworteld in empathie en klantfocus",
      "Een innovatiecultuur die experimenteren en leren aanmoedigt",
      "Een samenwerkingscultuur gericht op collectief succes",
      "Een missie-gedreven cultuur gericht op maatschappelijke impact",
    ],
  },
  {
    q: 4,
    sectionIndex: 1,
    title: "Wat omschrijft onze huidige leiderschapsstijl het best?",
    options: [
      "Prestatie-gedreven en expliciet: gericht op mensen verantwoordelijk houden en individuele prestaties vieren",
      "Klantgericht en empowerend: gericht op het in staat stellen van teams om alles te doen wat nodig is om de klant tevreden te maken",
      "Visionair en innovatie-gedreven: gericht op mensen aansporen om risico's te nemen en grote sprongen voorwaarts te maken",
      "Afstemmings-gericht en samenwerkend: gericht op mensen samenbrengen om samenwerking tussen verschillende teams en expertises mogelijk te maken",
      "Waarden-gedreven en doelgericht: gericht op altijd zorgen dat teams kunnen sturen op lange-termijn doelen",
    ],
  },
  {
    q: 5,
    sectionIndex: 1,
    title: "Welk leiderschapsgedrag tonen we succesvol?",
    options: [
      "We stellen heldere verwachtingen, zorgen voor transparantie en pakken ondermaats presteren aan",
      "We stellen klantbehoeften boven interne belangen en vertalen inzichten naar actie",
      "We dagen ideeën uit en moedigen experimenteren aan",
      "We maken cross-team samenwerking mogelijk en wisselen actief inzichten en kennis uit",
      "We laten zien en moedigen aan dat we handelen met integriteit en lange-termijn verantwoordelijkheid",
    ],
  },
  {
    q: 6,
    sectionIndex: 1,
    title: "Welk leiderschapsgedrag past het minst bij ons?",
    options: [
      "We laten mensen verantwoordelijkheid voor resultaten ontlopen",
      "We negeren soms klantperspectieven",
      "We zijn risicomijdend en bang om te falen",
      "We zetten individueel succes boven collectief succes",
      "We geven prioriteit aan korte-termijn resultaten boven onze lange-termijn missie",
    ],
  },
  {
    q: 7,
    sectionIndex: 1,
    title: "Welke thema's domineren op dit moment onze leiderschapsboodschappen en communicatiestijl?",
    options: [
      "We zijn direct en resultaatgericht: de communicatie naar onze teams is gericht op transparantie, resultaten en persoonlijke verantwoordelijkheid",
      "We zijn klantgedreven: het centrale thema in al onze communicatie naar teams is de impact die we maken voor onze klanten",
      "We zijn toekomstgericht: de communicatie naar onze teams is altijd gericht op hoe we onze toekomst zien en hoe we daar willen komen",
      "We zijn transparant en verbindend: onze communicatie richt zich op het benadrukken van succesvolle samenwerking tussen teams en het delen van kennis en inzichten",
      "We zijn reflectief en doelgericht: alle communicatie is geworteld in onze grotere missie",
    ],
  },
  {
    q: 8,
    sectionIndex: 1,
    title: "Welke thema's zouden volgens jou prominenter aanwezig moeten zijn in onze leiderschapsboodschappen en communicatiestijl?",
    options: [
      "We zouden directer en meer resultaatgericht moeten zijn: de communicatie naar onze teams zou meer gericht moeten zijn op transparantie, resultaten en persoonlijke verantwoordelijkheid",
      "We zouden meer klantgedreven moeten zijn: de communicatie naar onze teams zou meer gericht moeten zijn op de impact die we maken voor onze klanten",
      "We zouden meer toekomstgericht moeten zijn: de communicatie naar onze teams zou meer gericht moeten zijn op hoe we onze toekomst zien en hoe we daar willen komen",
      "We zouden meer transparant en verbindend moeten zijn: de communicatie naar onze teams zou meer gericht moeten zijn op het benadrukken van succesvolle samenwerking tussen teams en het delen van kennis en inzichten",
      "We zouden meer reflectief en doelgericht moeten zijn: de communicatie naar onze teams zou meer gericht moeten zijn op onze grotere missie",
    ],
  },
  {
    q: 9,
    sectionIndex: 2,
    title: "Wat is onze employee value proposition naar (huidige en toekomstige) medewerkers?",
    options: [
      "Werk in een sterke prestatiecultuur met transparante doelen, heldere verwachtingen en de ideale omgeving om je professioneel te ontwikkelen",
      "Werk op een plek waar klantgedrevenheid en teamgeest gevierd worden",
      "Werk op een plek die de toekomst vormgeeft, groot denken viert en innovatie verwelkomt",
      "Wees onderdeel van een samenwerkingsgerichte teamomgeving waar gedeelde doelen, hoog vertrouwen en cross-functionele samenwerking de norm zijn",
      "Wees onderdeel van een missie-gedreven organisatie met een oprechte ambitie om een positieve impact te maken op de maatschappij",
    ],
  },
  {
    q: 10,
    sectionIndex: 2,
    title: "Wat omschrijft onze huidige aanpak en kernboodschap bij het onboarden van nieuwe medewerkers het best?",
    options: [
      "We bieden nieuwe medewerkers een gestructureerde onboarding gericht op het vastleggen van heldere verantwoordelijkheden, verwachtingen en prestatienormen, zodat ze vanaf dag één actie- en resultaatgericht kunnen werken.",
      "We dompelen nieuwe medewerkers onder in onze klanten, hun behoeften en impact, zodat ze begrijpen hoe hun rol bijdraagt aan het leveren van waarde en het verbeteren van de klantbeleving.",
      "We moedigen nieuwe medewerkers aan om aannames te bevragen, met de nadruk op nieuwsgierigheid en leren.",
      "We richten onze onboarding op het bouwen van sterke relaties tussen teams en expertises, zodat duidelijk wordt hoe teams samenwerken aan gedeelde doelen.",
      "We benadrukken onze missie, waarden en maatschappelijke rol, zodat nieuwe medewerkers hun werk kunnen verbinden met een breder doel en lange-termijn impact.",
    ],
  },
  {
    q: 11,
    sectionIndex: 2,
    title: "Wat omschrijft onze huidige feedbackcultuur het best?",
    options: [
      "We waarderen en praktiseren directe en onmiddellijke feedback, sterk gericht op individuele prestaties, resultaten en verantwoordelijkheid, met heldere consequenties voor opvolging.",
      "We baseren feedback voornamelijk op klantinzichten en -uitkomsten, om teamleden te helpen begrijpen hoe hun acties de klantwaarde en -beleving beïnvloeden.",
      "Feedback wordt vooral gebruikt als leermechanisme, dat reflectie, experimenteren en verbetering aanmoedigt in plaats van directe oordelen.",
      "We gebruiken feedback vooral om de focus op samenwerking en teamdynamiek te leggen, en helpen mensen om over teams heen te verbinden en beter samen te werken aan gedeelde doelen.",
      "We gebruiken feedback vooral om onze waarden, integriteit en missie te versterken, met de nadruk op afstemming met onze missie en lange-termijn verantwoordelijkheden.",
    ],
  },
  {
    q: 12,
    sectionIndex: 2,
    title: "Hoe zou je onze huidige aanpak van prestatie-evaluatie en loopbaanontwikkeling omschrijven?",
    options: [
      "Onze huidige aanpak van prestatie-evaluatie en loopbaanontwikkeling is gebaseerd op zeer heldere en expliciete verwachtingen en wordt bepaald door individuele prestaties, eigenaarschap en het vermogen om sterke, meetbare resultaten te leveren.",
      "Onze huidige aanpak van prestatie-evaluatie en loopbaanontwikkeling is voornamelijk gebaseerd op de impact die individuen hebben op klanten en de kwaliteit van de uitkomsten die ze leveren.",
      "Onze huidige aanpak van prestatie-evaluatie en loopbaanontwikkeling wordt gedreven door leren, vaardigheidsontwikkeling en aangetoond potentieel voor toekomstige groei.",
      "Onze huidige aanpak van prestatie-evaluatie en loopbaanontwikkeling is gericht op het promoten van mensen die bijdragen aan teamsucces, samenwerking en betrouwbaarheid binnen het collectief.",
      "Onze huidige aanpak van prestatie-evaluatie en loopbaanontwikkeling wordt verdiend door te leven volgens onze waarden, te handelen met integriteit en bij te dragen aan lange-termijn vertrouwen en verantwoordelijkheid.",
    ],
  },
  {
    q: 13,
    sectionIndex: 3,
    title: "Welk gedrag belonen we op dit moment het meest?",
    options: [
      "Persoonlijke verantwoordelijkheid nemen en resultaten leveren",
      "Betekenisvolle impact creëren voor klanten",
      "Innovatie, experimenteren en nieuwe aanpakken proberen",
      "Samenwerking en bijdragen aan gedeeld teamsucces",
      "Handelen in lijn met onze missie en bredere impact",
    ],
  },
  {
    q: 14,
    sectionIndex: 3,
    title: "Welk gedrag proberen we op dit moment het meest terug te dringen?",
    options: [
      "Ondermaats presteren of gebrek aan eigenaarschap voor resultaten",
      "Klanten verwaarlozen of de behoeften van klanten uit het oog verliezen",
      "Risico-aversie en terughoudendheid om nieuwe aanpakken te proberen",
      "Silo-denken en individueel succes boven het team stellen",
      "Waardemisalignement en gedrag dat vertrouwen ondermijnt",
    ],
  },
];

const TEMPLATE_NAME = "Culturele Archetype Survey";
const TEMPLATE_DESCRIPTION =
  "SUMM's culturele archetype-onderzoek — meet hoe de huidige cultuur (as-is) wordt ervaren versus de gewenste cultuur (to-be) over vijf archetypes.";

async function main() {
  await mongoose.connect(MONGODB_URI!, { bufferCommands: false });

  const { ArchetypeModel } = await import("../src/lib/models/Archetype");
  const { SurveyTemplateModel } = await import("../src/lib/models/SurveyTemplate");
  const { SurveyTemplateSectionModel } = await import(
    "../src/lib/models/SurveyTemplateSection"
  );
  const { SurveyTemplateQuestionModel } = await import(
    "../src/lib/models/SurveyTemplateQuestion"
  );

  const archetypes = await ArchetypeModel.find({ name: { $in: [...ARCHETYPE_NAMES] } }).lean();
  const archetypeByName = new Map(archetypes.map((a) => [a.name, String(a._id)]));
  const missing = ARCHETYPE_NAMES.filter((n) => !archetypeByName.has(n));
  if (missing.length > 0) {
    console.error(
      `Missing archetypes in database: ${missing.join(", ")}.\n` +
        `Create them via /admin (archetypes section) with these exact names, then re-run.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Found ${archetypes.length} archetypes`);

  const existing = await SurveyTemplateModel.findOne({ name: TEMPLATE_NAME }).lean();
  if (existing) {
    console.log(`Template "${TEMPLATE_NAME}" already exists (id=${existing._id}), skipping.`);
    await mongoose.disconnect();
    return;
  }

  const archetypeIds = ARCHETYPE_NAMES.map((n) => archetypeByName.get(n)!);

  const template = await SurveyTemplateModel.create({
    name: TEMPLATE_NAME,
    description: TEMPLATE_DESCRIPTION,
    status: "active",
    archetypeIds,
    defaultRankWeights: [5, 4, 3, 2, 1],
    version: 1,
    createdBy: "system",
  });
  const templateId = String(template._id);
  console.log(`Created template "${TEMPLATE_NAME}" (id=${templateId})`);

  const sectionIds: string[] = [];
  for (let i = 0; i < SECTIONS.length; i++) {
    const sec = await SurveyTemplateSectionModel.create({
      templateId,
      title: SECTIONS[i].title,
      order: i,
    });
    sectionIds.push(String(sec._id));
  }
  console.log(`Created ${sectionIds.length} sections`);

  const questionIdByNumber = new Map<number, string>();
  const orderPerSection = new Map<number, number>();
  for (const q of QUESTIONS) {
    const orderInSection = orderPerSection.get(q.sectionIndex) ?? 0;
    orderPerSection.set(q.sectionIndex, orderInSection + 1);

    const options = q.options.map((text, idx) => ({
      id: randomUUID(),
      archetypeId: archetypeIds[idx],
      text,
    }));

    const doc = await SurveyTemplateQuestionModel.create({
      templateId,
      sectionId: sectionIds[q.sectionIndex],
      title: q.title,
      options,
      openTextEnabled: false,
      order: orderInSection,
    });
    questionIdByNumber.set(q.q, String(doc._id));
  }
  console.log(`Created ${questionIdByNumber.size} questions`);

  console.log("Seed complete");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
