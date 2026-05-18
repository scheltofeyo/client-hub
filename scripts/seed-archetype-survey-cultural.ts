/**
 * Seeds the "Cultural Archetype Survey (EN)" template — SUMM's standard archetype
 * survey: 14 archetype-top3 questions across 4 sections (Mission & DNA, Leadership,
 * Team Development, Rewards), plus 1 closing general-top3 question.
 *
 * Re-runnable: if a template with this name already exists, sections and questions
 * are upserted by title (existing question/section IDs are preserved so live
 * sessions don't break). Question `type` is always synced to the seed value.
 *
 * Prerequisites:
 *   - MONGODB_URI must be set in .env.local or the environment
 *   - The 5 archetypes must exist in the database with the exact names listed below
 *
 * Run: npm run seed:archetype-survey
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

// Archetype names must match exactly what's stored in the database.
// Order here = render order on the template (drives index alignment with each question's options array).
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
    title: "About this survey",
    description:
      "<p>For all 14 questions, we provide five answer options and ask you to select your top three. Select the option that best matches your answer as your first choice, then choose your second and third choices.</p><p></p><p><strong>Good to know</strong></p><p>All your input will be treated anonymously, and no individual answer will ever be linked to a specific respondent. Please be as honest and candid as possible, as this will provide the most useful insights.</p>",
    imageUrl: `${SECTION_IMAGE_BASE}/Ranking+tips.png`,
  },
  {
    title: "Mission & DNA",
    description:
      "<p>This first chapter consists of three questions that are all about both your current external and internal strategic focus points and how you would describe the current culture within your organisation.</p>",
    imageUrl: `${SECTION_IMAGE_BASE}/mission+culture.png`,
  },
  {
    title: "Leadership",
    description:
      "<p>This second chapter is all about leadership: how would you describe your company’s leadership style? What leadership behaviors is the leadership team practicing? And what is your style and messaging when communicating with teams?</p>",
    imageUrl: `${SECTION_IMAGE_BASE}/leadership.png`,
  },
  {
    title: "Team Development",
    description:
      "<p>This third chapter focusses on your current team development practices like attracting new talent, onboarding new team members, feedback and performance evaluation and career progression.</p>",
    imageUrl: `${SECTION_IMAGE_BASE}/team+development.png`,
  },
  {
    title: "Rewards",
    description:
      "<p>This fourth &amp; final chapter looks at the behaviors you as an organisation currently reward and which ones you discourage.</p>",
    imageUrl: `${SECTION_IMAGE_BASE}/rewards.png`,
  },
  {
    title: "Rounding up",
    description: "<p>To close things off - please answer this final question</p>",
    imageUrl: `${SECTION_IMAGE_BASE}/Full+pyramid.png`,
  },
];

// Each archetype question's `options` array is in the same order as ARCHETYPE_NAMES:
// [Achievement, Customer-Centric, Innovation, One Team, Greater-Good].
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
    title: "What do you see as our main external strategic objective?",
    options: [
      "To win market share by outperforming our competitors through drive, speed and execution",
      "To win market share and retain clients by creating the best in market customer experience and service",
      "To differentiate ourselves from competitors by offering more innovative products and services",
      "To grow our business through cross-selling, enabled by strong internal collaboration and alignment between our products, teams and silos",
      "To deliver long-term societal and economic value",
    ],
  },
  {
    kind: "archetype-top3",
    q: 2,
    sectionIndex: 1,
    title: "To successfully reach our objective, what should be our main internal focus?",
    options: [
      "Performance discipline and accountability",
      "Deep customer understanding and focus on customer satisfaction",
      "Creativity, experimentation and innovation",
      "Cross-team / department collaboration and alignment",
      "Trust, integrity and the ability to commit to our mission",
    ],
  },
  {
    kind: "archetype-top3",
    q: 3,
    sectionIndex: 1,
    title: "I would describe our current culture as…",
    options: [
      "A high-discipline performance culture focused on results and personal accountability",
      "A customer-centered culture rooted in empathy and customer focus",
      "An innovation culture that encourages experimentation and learning",
      "A collaborative culture focused on collective success",
      "A mission-driven culture focused on societal impact",
    ],
  },
  {
    kind: "archetype-top3",
    q: 4,
    sectionIndex: 2,
    title: "What best describes our current leadership style?",
    options: [
      "Performance-driven and explicit: focused on holding people accountable and celebrating individual performance",
      "Customer-oriented and empowering: focused on enabling teams to do whatever is needed to make the customer happy",
      "Visionary and innovation-driven: focused on pushing people to take risks and chase big leaps forward",
      "Alignment-focused and collaborative: focused on bringing people together to enable collaboration between different teams and expertises",
      "Value-driven and purpose-led: focused on always making sure teams can steer on long-term goals",
    ],
  },
  {
    kind: "archetype-top3",
    q: 5,
    sectionIndex: 2,
    title: "Which leadership behaviors do we successfully practice?",
    options: [
      "We set clear expectations, enabling transparency and addressing underperformance",
      "We prioritize customer needs over internal needs and translate insights into action",
      "We challenge ideas and encourage experimentation",
      "We enable cross-team collaboration and actively exchange insights and know-how",
      "We showcase and encourage acting with integrity and long-term responsibility",
    ],
  },
  {
    kind: "archetype-top3",
    q: 6,
    sectionIndex: 2,
    title: "Which leadership behaviors describe us least?",
    options: [
      "We allow people to avoid accountability for results",
      "We sometimes ignore customer perspectives",
      "We tend to avoid risk and fear failure",
      "We put individual success over collective success",
      "We prioritize short-term results over our long-term mission",
    ],
  },
  {
    kind: "archetype-top3",
    q: 7,
    sectionIndex: 2,
    title: "Which themes currently dominate our leadership messages and communication style?",
    options: [
      "We are direct and results-focused: the communication to our teams is focused on transparency, results and personal accountability",
      "We are customer-driven: the central theme in all our communication to teams is the impact we make for our clients",
      "We are future-oriented: the communication to our teams is always focused on how we see our future and how we want to get there",
      "We are transparent and connective: our communication focuses on emphasising successful collaboration between teams and sharing know-how and insights",
      "We are reflective and purpose-driven: all communication is rooted in our bigger mission",
    ],
  },
  {
    kind: "archetype-top3",
    q: 8,
    sectionIndex: 2,
    title: "Which themes do you feel should be more prominent in our leadership messages and communication style?",
    options: [
      "We should be more direct and results-focused: the communication to our teams should be more focused on transparency, results and personal accountability",
      "We should be more customer-driven: the communication to our teams should be more focused on the impact we make for our clients",
      "We should be more future-oriented: the communication to our teams should be more focused on how we see our future and how we want to get there",
      "We should be more transparent and connective: the communication to our teams should be more focused on emphasising successful collaboration between teams and sharing know-how and insights",
      "We should be more reflective and purpose-driven: the communication to our teams should be more focused on our bigger mission",
    ],
  },
  {
    kind: "archetype-top3",
    q: 9,
    sectionIndex: 3,
    title: "What is our employee value proposition to (current and future) employees?",
    options: [
      "Work in a strong performance culture with transparent goals, clear expectations and the ideal environment to grow professionally",
      "Join a place that champions customer drive and team spirit",
      "Work at a place that shapes tomorrow, celebrates thinking big and welcomes innovation",
      "Be part of a collaborative team environment where shared goals, high trust and cross-functional collaboration are the norm",
      "Be part of a mission-driven organisation with a sincere ambition to make a positive impact on society",
    ],
  },
  {
    kind: "archetype-top3",
    q: 10,
    sectionIndex: 3,
    title: "What best describes our current approach and key messaging when onboarding new employees?",
    options: [
      "We offer new employees a structured onboarding focused on setting clear responsibilities, expectations and performance standards, enabling fast action and accountability from day one.",
      "We immerse new employees in our customers, their needs and impact, helping them understand how their role contributes to delivering value and improving customer experience.",
      "We encourage new employees to question assumptions, emphasizing curiosity and learning.",
      "We focus our onboarding approach on building strong relationships across teams and expertises, enabling understanding of how teams work towards shared goals.",
      "We emphasize our mission, values and societal role, helping new employees connect their work to a broader purpose and long-term impact.",
    ],
  },
  {
    kind: "archetype-top3",
    q: 11,
    sectionIndex: 3,
    title: "What best describes our current feedback culture?",
    options: [
      "We value and practice direct and immediate feedback, strongly focused on individual performance, results and accountability, with clear consequences for follow-up.",
      "We base feedback mainly on customer insights and outcomes, aimed to help team members understand how their actions affect customer value and experience.",
      "Feedback is primarily used as a learning mechanism, encouraging reflection, experimentation and improvement rather than immediate judgment.",
      "We mainly use feedback to focus on collaboration and team dynamics, helping people connect across teams and improve how they work together and contribute to shared goals.",
      "We mainly use feedback to reinforce our values, integrity and purpose, emphasizing alignment with our mission and long-term responsibilities.",
    ],
  },
  {
    kind: "archetype-top3",
    q: 12,
    sectionIndex: 3,
    title: "How would you describe our current approach to performance evaluation and career progression?",
    options: [
      "Our current performance evaluation and career progression approach is based on very clear and explicit expectations and determined by individual performance, ownership and the ability to deliver strong, measurable results.",
      "Our current performance evaluation and career progression approach is primarily based on the impact individuals have on customers and the quality of outcomes they deliver.",
      "Our current performance evaluation and career progression approach is driven by learning, skill development and demonstrated potential for future growth.",
      "Our current performance evaluation and career progression approach is focused on promoting people that contribute to team success, collaboration and reliability within the collective.",
      "Our current performance evaluation and career progression approach is earned through living our values, acting with integrity and contributing to long-term trust and responsibility.",
    ],
  },
  {
    kind: "archetype-top3",
    q: 13,
    sectionIndex: 4,
    title: "Which behavior do we currently reward most?",
    options: [
      "Taking personal accountability and delivering results",
      "Creating meaningful impact for customers",
      "Innovation, experimentation and trying new approaches",
      "Collaboration and contributing to shared team success",
      "Acting in line with purpose and broader impact",
    ],
  },
  {
    kind: "archetype-top3",
    q: 14,
    sectionIndex: 4,
    title: "Which behavior do we currently aim to reduce most?",
    options: [
      "Underperformance or lack of ownership for results",
      "Customer neglect or losing sight of customer needs",
      "Risk aversion and reluctance to try new approaches",
      "Silo thinking and prioritizing individual success over the team",
      "Value misalignment and behavior that undermines trust",
    ],
  },
  {
    kind: "general-top3",
    q: 15,
    sectionIndex: 5,
    title: "Which of the following topics do you feel would have the most impact on our overall success?",
    description: "Please select your top 3",
    items: [
      "Our approach to hiring talent and talent onboarding",
      "Developing our feedback culture",
      "Having clear expectations in place and keeping each other accountable",
      "Developing our leadership practices (meetings, decision making, etc)",
      "Clarifying our organizational structure",
      "How we mentor and educate talent within our team",
      "How we reward our teams",
      "Leadership communication to the team",
    ],
  },
];

const TEMPLATE_NAME = "Cultural Archetype Survey (EN)";
const TEMPLATE_DESCRIPTION =
  "SUMM's cultural archetype survey — measures perceived current culture (as-is) vs desired culture (to-be) across five archetypes.";

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
