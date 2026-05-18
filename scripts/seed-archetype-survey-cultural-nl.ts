/**
 * Seedt de Nederlandse versie van SUMM's culturele archetype survey
 * ("Culture Archetypes As Is (NL)"): 14 archetype-top3 vragen over 4 secties
 * (Missie & DNA, Leiderschap, Teamontwikkeling, Beloningen), plus 1 afsluitende
 * general-top3 vraag.
 *
 * Herhaalbaar uitvoerbaar: als er al een template met deze naam bestaat worden
 * secties en vragen geüpsert op titel (bestaande question/section IDs blijven
 * intact zodat live sessies blijven werken). Het `type`-veld wordt altijd
 * gesynchroniseerd met de seed-waarde.
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

const SECTION_IMAGE_BASE =
  "https://summ-jm.s3.eu-central-1.amazonaws.com/client+hub/survey+images";

const SECTIONS: ReadonlyArray<{
  title: string;
  description?: string;
  imageUrl?: string;
}> = [
  {
    title: "Over deze survey",
    description:
      "<p>In deze survey vragen we je om een aantal beschikbare antwoorden te sorteren naar jouw persoonlijke top 3. Lees alle antwoorden zorgvuldig en sleep dan de beschikbare antwoorden in de volgorde die voor jou het beste past. </p><p><strong>Goed om te weten</strong></p><p>Al jouw input wordt anoniem verwerkt en geen enkel individueel antwoord wordt ooit gekoppeld aan een specifieke respondent. Wees zo eerlijk en oprecht mogelijk, want dat levert de meest waardevolle inzichten op.</p>",
    imageUrl: `${SECTION_IMAGE_BASE}/Ranking+tips.png`,
  },
  {
    title: "Missie & DNA",
    description:
      "<p>Dit eerste hoofdstuk bestaat uit drie vragen die allemaal gaan over zowel je huidige externe als interne strategische focuspunten en hoe je de huidige cultuur binnen jouw organisatie zou omschrijven.</p>",
    imageUrl: `${SECTION_IMAGE_BASE}/mission+culture.png`,
  },
  {
    title: "Leiderschap",
    description:
      "<p>Dit tweede hoofdstuk gaat volledig over leiderschap: hoe zou je de leiderschapsstijl van jouw organisatie omschrijven? Welk leiderschapsgedrag laat het leiderschapsteam zien? En wat is jouw stijl en boodschap wanneer je communiceert met teams?</p>",
    imageUrl: `${SECTION_IMAGE_BASE}/leadership.png`,
  },
  {
    title: "Team ontwikkeling",
    description:
      "<p>Dit derde hoofdstuk richt zich op jullie huidige teonontwikkelingspraktijken, zoals het aantrekken van nieuw talent, het inwerken van nieuwe teamleden, feedback en prestatiebeoordeling, en loopbaanontwikkeling.</p>",
    imageUrl: `${SECTION_IMAGE_BASE}/team+development.png`,
  },
  {
    title: "Beloningen",
    description:
      "<p>Dit vierde en laatste hoofdstuk kijkt naar het gedrag dat jullie als organisatie momenteel belonen en welk gedrag jullie ontmoedigen.</p>",
    imageUrl: `${SECTION_IMAGE_BASE}/rewards.png`,
  },
  {
    title: "Voor we afronden",
    description: "<p>Om af te sluiten willen we je nog 1 laatste vraag stellen.</p>",
    imageUrl: `${SECTION_IMAGE_BASE}/Full+pyramid.png`,
  },
];

type ArchetypeSeedQuestion = {
  kind: "archetype-top3";
  q: number;
  sectionIndex: number;
  title: string;
  options: [string, string, string, string, string];
};

type GeneralSeedQuestion = {
  kind: "general-top3";
  q: number;
  sectionIndex: number;
  title: string;
  description?: string;
  items: string[];
};

type SeedQuestion = ArchetypeSeedQuestion | GeneralSeedQuestion;

const QUESTIONS: SeedQuestion[] = [
  {
    kind: "archetype-top3",
    q: 1,
    sectionIndex: 1,
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
    kind: "archetype-top3",
    q: 2,
    sectionIndex: 1,
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
    kind: "archetype-top3",
    q: 3,
    sectionIndex: 1,
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
    kind: "archetype-top3",
    q: 4,
    sectionIndex: 2,
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
    kind: "archetype-top3",
    q: 5,
    sectionIndex: 2,
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
    kind: "archetype-top3",
    q: 6,
    sectionIndex: 2,
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
    kind: "archetype-top3",
    q: 7,
    sectionIndex: 2,
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
    kind: "archetype-top3",
    q: 8,
    sectionIndex: 2,
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
    kind: "archetype-top3",
    q: 9,
    sectionIndex: 3,
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
    kind: "archetype-top3",
    q: 10,
    sectionIndex: 3,
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
    kind: "archetype-top3",
    q: 11,
    sectionIndex: 3,
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
    kind: "archetype-top3",
    q: 12,
    sectionIndex: 3,
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
    kind: "archetype-top3",
    q: 13,
    sectionIndex: 4,
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
    kind: "archetype-top3",
    q: 14,
    sectionIndex: 4,
    title: "Welk gedrag proberen we op dit moment het meest terug te dringen?",
    options: [
      "Ondermaats presteren of gebrek aan eigenaarschap voor resultaten",
      "Klanten verwaarlozen of de behoeften van klanten uit het oog verliezen",
      "Risico-aversie en terughoudendheid om nieuwe aanpakken te proberen",
      "Silo-denken en individueel succes boven het team stellen",
      "Waardemisalignement en gedrag dat vertrouwen ondermijnt",
    ],
  },
  {
    kind: "general-top3",
    q: 15,
    sectionIndex: 5,
    title: "Op welke van de volgende onderwerpen zouden we ons volgens jou het meest moeten focussen om onze algehele prestaties te verbeteren?",
    description: "Kies je top 3",
    items: [
      "Onze aanpak van het aantrekken en inwerken van nieuw talent",
      "Het ontwikkelen van onze feedbackcultuur",
      "Heldere verwachtingen stellen en elkaar daarop aanspreken",
      "Het ontwikkelen van onze leiderschapspraktijken (vergaderingen, besluitvorming, etc.)",
      "Het verduidelijken van onze organisatiestructuur",
      "Hoe we talent binnen ons team begeleiden en opleiden",
      "Hoe we onze teams belonen",
      "Communicatie vanuit het leiderschap naar het team",
    ],
  },
];

const TEMPLATE_NAME = "Culture Archetypes As Is (NL)";
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

  const archetypeIds = ARCHETYPE_NAMES.map((n) => archetypeByName.get(n)!);

  let template = await SurveyTemplateModel.findOne({ name: TEMPLATE_NAME });
  if (!template) {
    template = await SurveyTemplateModel.create({
      name: TEMPLATE_NAME,
      description: TEMPLATE_DESCRIPTION,
      status: "active",
      archetypeIds,
      defaultRankWeights: [5, 4, 3, 2, 1],
      version: 1,
      createdBy: "system",
    });
    console.log(`Created template "${TEMPLATE_NAME}" (id=${template._id})`);
  } else {
    console.log(`Found existing template "${TEMPLATE_NAME}" (id=${template._id}) — upserting`);
  }
  const templateId = String(template._id);

  // Upsert sections by title (preserve IDs and order of existing sections;
  // always sync description + imageUrl from seed).
  const sectionIdByIndex = new Map<number, string>();
  for (let i = 0; i < SECTIONS.length; i++) {
    const { title, description, imageUrl } = SECTIONS[i];
    let sec = await SurveyTemplateSectionModel.findOne({ templateId, title });
    if (!sec) {
      sec = await SurveyTemplateSectionModel.create({
        templateId,
        title,
        description,
        imageUrl,
        order: i,
      });
      console.log(`  + section "${title}" (created at order ${i})`);
    } else {
      sec.description = description;
      sec.imageUrl = imageUrl;
      await sec.save();
      console.log(`  ~ section "${title}" (kept at order ${sec.order}, synced description + imageUrl)`);
    }
    sectionIdByIndex.set(i, String(sec._id));
  }

  // Upsert questions by (sectionId + title)
  const orderPerSection = new Map<number, number>();
  for (const q of QUESTIONS) {
    const sectionId = sectionIdByIndex.get(q.sectionIndex)!;
    const orderInSection = orderPerSection.get(q.sectionIndex) ?? 0;
    orderPerSection.set(q.sectionIndex, orderInSection + 1);

    const existing = await SurveyTemplateQuestionModel.findOne({
      templateId,
      sectionId,
      title: q.title,
    });

    if (q.kind === "archetype-top3") {
      const options = q.options.map((text, idx) => ({
        id: existing?.options?.[idx]?.id ?? randomUUID(),
        archetypeId: archetypeIds[idx],
        text,
      }));
      if (!existing) {
        await SurveyTemplateQuestionModel.create({
          templateId,
          sectionId,
          type: "archetype-top3",
          title: q.title,
          options,
          rankingItems: [],
          order: orderInSection,
        });
        console.log(`  + Q${q.q} archetype-top3 "${q.title.slice(0, 60)}…" (created)`);
      } else {
        existing.type = "archetype-top3";
        existing.options = options as typeof existing.options;
        existing.rankingItems = [] as typeof existing.rankingItems;
        existing.order = orderInSection;
        await existing.save();
        console.log(`  ~ Q${q.q} archetype-top3 "${q.title.slice(0, 60)}…" (updated)`);
      }
    } else {
      const rankingItems = q.items.map((text, idx) => ({
        id: existing?.rankingItems?.[idx]?.id ?? randomUUID(),
        text,
      }));
      if (!existing) {
        await SurveyTemplateQuestionModel.create({
          templateId,
          sectionId,
          type: "general-top3",
          title: q.title,
          description: q.description,
          options: [],
          rankingItems,
          order: orderInSection,
        });
        console.log(`  + Q${q.q} general-top3 "${q.title.slice(0, 60)}…" (created)`);
      } else {
        existing.type = "general-top3";
        existing.description = q.description;
        existing.options = [] as typeof existing.options;
        existing.rankingItems = rankingItems as typeof existing.rankingItems;
        existing.order = orderInSection;
        await existing.save();
        console.log(`  ~ Q${q.q} general-top3 "${q.title.slice(0, 60)}…" (updated)`);
      }
    }
  }

  console.log("Seed complete");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
