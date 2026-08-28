/**
 * Seedt de "Cultural Self-Assessment"-template — in twee taalvarianten.
 *
 * Deze template bevat bewust géén klantspecifieke inhoud: de `value-assessment`-
 * en `value-ranking`-vragen dragen geen items. Die worden pas gematerialiseerd op
 * het moment dat er een sessie voor een klant wordt aangemaakt, uit het Cultural
 * DNA van díe klant. Daardoor werkt één template voor een klant met drie waarden
 * én voor een klant met acht.
 *
 * De deelnemerspagina vertaalt alleen haar eigen chrome (zie
 * `src/lib/surveys/translations.ts`); de inhoud van een template — introtekst,
 * vraagtitels, promptteksten — staat per template opgeslagen. Een Engelstalige
 * survey vraagt dus om een eigen template, net als bij de archetype-survey.
 * Beide varianten staan hieronder in `VARIANTS`, zodat de upsert-logica maar
 * één keer bestaat en de twee talen niet uit elkaar kunnen groeien.
 *
 * Herhaalbaar uitvoerbaar: bestaande secties en vragen worden geüpsert op titel,
 * zodat question/section-IDs intact blijven en lopende sessies blijven werken.
 *
 * Run: npm run seed:cultural-assessment      (Nederlands)
 *      npm run seed:cultural-assessment-en   (Engels)
 */

import { readFileSync } from "fs";
import { resolve } from "path";
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
    // .env.local hoeft niet te bestaan in CI
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

type SeedQuestion = {
  sectionIndex: number;
  type: "intro" | "value-assessment" | "value-ranking";
  title: string;
  description?: string;
  bodyHtml?: string;
  assessmentPrompt?: string;
  scale?: { min: number; max: number; minLabel?: string; maxLabel?: string };
};

type SeedVariant = {
  name: string;
  /** Eerdere namen van dezelfde template — voorkomt een duplicaat na hernoemen. */
  legacyNames?: string[];
  description: string;
  thankYouText: string;
  respondentVariable: {
    enabled: boolean;
    key: string;
    label: string;
    helpText: string;
    required: boolean;
  };
  sections: ReadonlyArray<{ title: string; description: string }>;
  questions: SeedQuestion[];
};

const VARIANTS: Record<"nl" | "en", SeedVariant> = {
  nl: {
    name: "Cultural Self-Assessment (NL)",
    legacyNames: ["Cultural Self-Assessment"],
    description:
      "Deelnemers reflecteren voorafgaand aan een Cultural DNA-training op hun eigen gedrag " +
      "ten opzichte van de waarden van hun organisatie. Resultaten zijn uitsluitend op groepsniveau bedoeld.",
    thankYouText:
      "Bedankt! Je antwoorden zijn opgeslagen. Tijdens de training gaan we met de " +
      "belangrijkste inzichten uit de groep aan de slag.",
    respondentVariable: {
      enabled: true,
      key: "culturalLevel",
      label: "Welk niveau past het best bij jouw functie?",
      helpText:
        "Kies het niveau dat het dichtst bij je dagelijkse werk ligt. Het bepaalt welke " +
        "gedragsvoorbeelden je straks per waarde te zien krijgt.",
      required: true,
    },
    sections: [
      {
        title: "Introductie",
        description: "Welkom en uitleg over deze vragenlijst.",
      },
      {
        title: "Self-assessment",
        description:
          "Per waarde zie je het gedrag dat hoort bij het niveau dat je hebt gekozen.",
      },
      {
        title: "Ranking",
        description: "Tot slot: hoe verhouden de waarden zich voor jou tot elkaar?",
      },
    ],
    questions: [
      {
        sectionIndex: 0,
        type: "intro",
        title: "",
        bodyHtml:
          "<p>Ter voorbereiding op de aankomende Cultural DNA-training vragen we je om kort te " +
          "reflecteren op je eigen gedrag.</p>" +
          "<p>Het invullen kost ongeveer tien minuten. Er zijn geen goede of foute antwoorden — " +
          "we gebruiken de uitkomsten alleen op groepsniveau, als startpunt voor het gesprek " +
          "tijdens de training.</p>",
      },
      {
        sectionIndex: 1,
        type: "value-assessment",
        title: "Cultural self-assessment",
        assessmentPrompt: "Hoe goed vind je dat jij dit gedrag vandaag de dag laat zien?",
        scale: { min: 1, max: 5, minLabel: "Nauwelijks", maxLabel: "Heel goed" },
      },
      {
        sectionIndex: 2,
        type: "value-ranking",
        title: "Rangschik de waarden",
        description:
          "Sleep de waarden in volgorde: bovenaan de waarde waarop je jezelf het sterkst " +
          "vindt, onderaan de waarde waarop je jezelf het minst sterk vindt.",
      },
    ],
  },

  en: {
    name: "Cultural Self-Assessment (EN)",
    description:
      "Participants reflect on their own behaviour against their organisation's values ahead of " +
      "a Cultural DNA training. Results are only ever meant to be read at group level.",
    thankYouText:
      "Thank you! Your answers have been saved. During the training we'll work with the most " +
      "important insights from the group.",
    respondentVariable: {
      enabled: true,
      key: "culturalLevel",
      label: "Which level best fits your role?",
      helpText:
        "Pick the level closest to your day-to-day work. It decides which behaviour examples " +
        "you'll see for each value.",
      required: true,
    },
    sections: [
      {
        title: "Introduction",
        description: "Welcome, and a short explanation of this questionnaire.",
      },
      {
        title: "Self-assessment",
        description:
          "For every value you'll see the behaviour that belongs to the level you picked.",
      },
      {
        title: "Ranking",
        description: "Finally: how do the values compare to one another for you?",
      },
    ],
    questions: [
      {
        sectionIndex: 0,
        type: "intro",
        title: "",
        bodyHtml:
          "<p>To prepare for the upcoming Cultural DNA training, we'd like you to reflect " +
          "briefly on your own behaviour.</p>" +
          "<p>It takes about ten minutes. There are no right or wrong answers — we only use " +
          "the outcomes at group level, as a starting point for the conversation during the " +
          "training.</p>",
      },
      {
        sectionIndex: 1,
        type: "value-assessment",
        title: "Cultural self-assessment",
        assessmentPrompt: "How well do you feel you show this behaviour today?",
        scale: { min: 1, max: 5, minLabel: "Hardly", maxLabel: "Very well" },
      },
      {
        sectionIndex: 2,
        type: "value-ranking",
        title: "Rank the values",
        description:
          "Drag the values into order: at the top the value you feel strongest on, at the " +
          "bottom the value you feel least strong on.",
      },
    ],
  },
};

function parseLocale(): "nl" | "en" {
  const arg = process.argv[2];
  if (!arg) return "nl";
  if (arg === "nl" || arg === "en") return arg;
  console.error(`Unknown locale "${arg}" — use "nl" or "en".`);
  process.exit(1);
}

async function main() {
  const locale = parseLocale();
  const variant = VARIANTS[locale];

  await mongoose.connect(MONGODB_URI!, { bufferCommands: false });

  const { SurveyTemplateModel } = await import("../src/lib/models/SurveyTemplate");
  const { SurveyTemplateSectionModel } = await import(
    "../src/lib/models/SurveyTemplateSection"
  );
  const { SurveyTemplateQuestionModel } = await import(
    "../src/lib/models/SurveyTemplateQuestion"
  );

  const knownNames = [variant.name, ...(variant.legacyNames ?? [])];
  let template = await SurveyTemplateModel.findOne({ name: { $in: knownNames } });
  if (!template) {
    template = await SurveyTemplateModel.create({
      name: variant.name,
      description: variant.description,
      status: "active",
      // Bewust leeg: deze template gebruikt geen archetypes.
      archetypeIds: [],
      defaultThankYouText: variant.thankYouText,
      defaultRespondentVariable: variant.respondentVariable,
      version: 1,
      createdBy: "system",
    });
    console.log(`Created template "${variant.name}" (id=${template._id})`);
  } else {
    const previousName = template.name;
    template.name = variant.name;
    template.description = variant.description;
    template.defaultThankYouText = variant.thankYouText;
    template.defaultRespondentVariable = variant.respondentVariable;
    await template.save();
    const renamed = previousName !== variant.name ? ` — renamed from "${previousName}"` : "";
    console.log(
      `Found existing template "${variant.name}" (id=${template._id}) — upserting${renamed}`
    );
  }
  const templateId = String(template._id);

  const sectionIdByIndex = new Map<number, string>();
  for (let i = 0; i < variant.sections.length; i++) {
    const { title, description } = variant.sections[i];
    let sec = await SurveyTemplateSectionModel.findOne({ templateId, title });
    if (!sec) {
      sec = await SurveyTemplateSectionModel.create({
        templateId,
        title,
        description,
        order: i,
      });
      console.log(`  + section "${title}" (created at order ${i})`);
    } else {
      sec.description = description;
      await sec.save();
      console.log(`  ~ section "${title}" (kept at order ${sec.order})`);
    }
    sectionIdByIndex.set(i, String(sec._id));
  }

  const orderPerSection = new Map<number, number>();
  for (const q of variant.questions) {
    const sectionId = sectionIdByIndex.get(q.sectionIndex)!;
    const order = orderPerSection.get(q.sectionIndex) ?? 0;
    orderPerSection.set(q.sectionIndex, order + 1);

    const existing = await SurveyTemplateQuestionModel.findOne({
      templateId,
      sectionId,
      title: q.title,
    });

    const payload = {
      templateId,
      sectionId,
      type: q.type,
      title: q.title,
      description: q.description,
      bodyHtml: q.bodyHtml,
      assessmentPrompt: q.assessmentPrompt,
      scale: q.scale,
      // Nooit hier ingevuld — zie de bestandskop.
      valueItems: [],
      required: q.type !== "intro",
      order,
    };

    if (!existing) {
      await SurveyTemplateQuestionModel.create(payload);
      console.log(`  + question "${q.title || "(intro)"}" (${q.type})`);
    } else {
      existing.set(payload);
      await existing.save();
      console.log(`  ~ question "${q.title || "(intro)"}" (${q.type}, synced)`);
    }
  }

  console.log("\nDone. Create a session from this template for any client that has Cultural DNA.");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
