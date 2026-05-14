/**
 * Seeds the "Cultural Archetype Survey" template — SUMM's standard archetype survey
 * derived from the Rabobank W&R Products case (January 2026): 14 questions across
 * 4 sections (Mission & DNA, Leadership, Team Development, Rewards), each with
 * 5 options mapped to the archetypes Achievement / Customer-Centric / Innovation /
 * One Team / Greater-Good.
 *
 * Idempotent: if a template with this name already exists, the script exits
 * without modifying it — so manual edits in the admin UI are safe.
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

const SECTIONS = [
  { title: "Mission & DNA" },
  { title: "Leadership" },
  { title: "Team Development" },
  { title: "Rewards" },
] as const;

// Each question's `options` array is in the same order as ARCHETYPE_NAMES:
// [Achievement, Customer-Centric, Innovation, One Team, Greater-Good].
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
    q: 2,
    sectionIndex: 0,
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
    q: 3,
    sectionIndex: 0,
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
    q: 4,
    sectionIndex: 1,
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
    q: 5,
    sectionIndex: 1,
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
    q: 6,
    sectionIndex: 1,
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
    q: 7,
    sectionIndex: 1,
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
    q: 8,
    sectionIndex: 1,
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
    q: 9,
    sectionIndex: 2,
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
    q: 10,
    sectionIndex: 2,
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
    q: 11,
    sectionIndex: 2,
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
    q: 12,
    sectionIndex: 2,
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
    q: 13,
    sectionIndex: 3,
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
    q: 14,
    sectionIndex: 3,
    title: "Which behavior do we currently aim to reduce most?",
    options: [
      "Underperformance or lack of ownership for results",
      "Customer neglect or losing sight of customer needs",
      "Risk aversion and reluctance to try new approaches",
      "Silo thinking and prioritizing individual success over the team",
      "Value misalignment and behavior that undermines trust",
    ],
  },
];

const COMPARISONS: Array<{
  label: string;
  leftLabel: string;
  rightLabel: string;
  leftQs: number[];
  rightQs: number[];
}> = [
  {
    label: "To-be vs As-is Overall",
    leftLabel: "To-be",
    rightLabel: "As-is Overall",
    leftQs: [1, 2, 8],
    rightQs: [3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14],
  },
  {
    label: "To-be vs As-is Leadership",
    leftLabel: "To-be",
    rightLabel: "As-is Leadership",
    leftQs: [1, 2, 8],
    rightQs: [4, 5, 6, 7],
  },
  {
    label: "To-be vs As-is Team Development",
    leftLabel: "To-be",
    rightLabel: "As-is Team Development",
    leftQs: [1, 2, 8],
    rightQs: [9, 10, 11, 12],
  },
  {
    label: "To-be vs As-is Rewards",
    leftLabel: "To-be",
    rightLabel: "As-is Rewards",
    leftQs: [1, 2, 8],
    rightQs: [13, 14],
  },
];

const TEMPLATE_NAME = "Cultural Archetype Survey";
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
    comparisons: [],
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

  const comparisons = COMPARISONS.map((c, idx) => ({
    id: randomUUID(),
    label: c.label,
    leftLabel: c.leftLabel,
    rightLabel: c.rightLabel,
    leftQuestionIds: c.leftQs.map((n) => questionIdByNumber.get(n)!),
    rightQuestionIds: c.rightQs.map((n) => questionIdByNumber.get(n)!),
    order: idx,
  }));

  await SurveyTemplateModel.updateOne({ _id: templateId }, { $set: { comparisons } });
  console.log(`Updated template with ${comparisons.length} comparisons`);

  console.log("Seed complete");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
