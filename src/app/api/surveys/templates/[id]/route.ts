import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/auth-helpers";
import { SurveyTemplateModel } from "@/lib/models/SurveyTemplate";
import { SurveyTemplateSectionModel } from "@/lib/models/SurveyTemplateSection";
import { SurveyTemplateQuestionModel } from "@/lib/models/SurveyTemplateQuestion";
import { serializeQuestion } from "@/lib/surveys/serializers";
import { normalizeWelcomeScreen } from "@/lib/surveys/welcome-screen";
import { normalizeClosingScreen } from "@/lib/surveys/closing-screen";
import { normalizeRespondentVariableCopy } from "@/lib/surveys/respondent-variable-copy";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.surveys.manageTemplates");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const [template, sections, questions] = await Promise.all([
    SurveyTemplateModel.findById(id).lean(),
    SurveyTemplateSectionModel.find({ templateId: id }).sort({ order: 1, createdAt: 1 }).lean(),
    SurveyTemplateQuestionModel.find({ templateId: id }).sort({ order: 1, createdAt: 1 }).lean(),
  ]);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: template._id.toString(),
    name: template.name,
    description: template.description ?? undefined,
    status: template.status,
    defaultLocale: template.defaultLocale ?? "nl",
    archetypeIds: template.archetypeIds ?? [],
    defaultRankWeights: template.defaultRankWeights ?? [5, 4, 3, 2, 1],
    defaultTop3Weights: template.defaultTop3Weights ?? [5, 3, 1],
    closingOpenQuestion: template.closingOpenQuestion ?? undefined,
    defaultWelcomeScreen: template.defaultWelcomeScreen ?? undefined,
    defaultClosingScreen: template.defaultClosingScreen ?? undefined,
    defaultThankYouText: template.defaultThankYouText ?? undefined,
    defaultRespondentVariable: template.defaultRespondentVariable ?? undefined,
    version: template.version ?? 1,
    sections: sections.map((s) => ({
      id: s._id.toString(),
      title: s.title,
      description: s.description ?? undefined,
      imageUrl: s.imageUrl ?? undefined,
      openQuestion: s.openQuestion ?? undefined,
      order: s.order ?? 0,
    })),
    questions: questions.map((q) => serializeQuestion(q)),
    createdAt: template.createdAt?.toISOString(),
    updatedAt: template.updatedAt?.toISOString(),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.surveys.manageTemplates");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    update.name = body.name.trim();
  }
  if (body.description !== undefined) update.description = body.description?.trim() || undefined;
  if (body.status !== undefined) update.status = body.status;
  // The language the survey runs in. Sessions copy it into their snapshot at
  // creation, so changing it here only affects sessions made from now on.
  if (body.defaultLocale !== undefined) {
    if (body.defaultLocale !== "nl" && body.defaultLocale !== "en") {
      return NextResponse.json({ error: "defaultLocale must be nl or en" }, { status: 400 });
    }
    update.defaultLocale = body.defaultLocale;
  }
  if (body.archetypeIds !== undefined) {
    if (!Array.isArray(body.archetypeIds) || body.archetypeIds.length < 2) {
      return NextResponse.json({ error: "Pick at least 2 archetypes" }, { status: 400 });
    }
    update.archetypeIds = body.archetypeIds;
  }
  if (body.defaultRankWeights !== undefined) {
    if (!Array.isArray(body.defaultRankWeights)) {
      return NextResponse.json({ error: "Weights must be an array" }, { status: 400 });
    }
    update.defaultRankWeights = body.defaultRankWeights.map((w: unknown) => Number(w));
  }
  if (body.defaultTop3Weights !== undefined) {
    if (
      !Array.isArray(body.defaultTop3Weights) ||
      body.defaultTop3Weights.length !== 3 ||
      body.defaultTop3Weights.some((w: unknown) => !Number.isFinite(Number(w)))
    ) {
      return NextResponse.json(
        { error: "defaultTop3Weights must be 3 numbers" },
        { status: 400 }
      );
    }
    update.defaultTop3Weights = body.defaultTop3Weights.map((w: unknown) => Number(w));
  }
  if (body.closingOpenQuestion !== undefined) update.closingOpenQuestion = body.closingOpenQuestion;
  // Normalizing here rather than storing the body verbatim is what makes a
  // cleared field mean "fall back to the built-in copy" instead of an empty line.
  if (body.defaultWelcomeScreen !== undefined) {
    update.defaultWelcomeScreen = normalizeWelcomeScreen(body.defaultWelcomeScreen) ?? null;
  }
  if (body.defaultClosingScreen !== undefined) {
    update.defaultClosingScreen = normalizeClosingScreen(body.defaultClosingScreen) ?? null;
  }
  // Retired by `defaultClosingScreen`, which the editor sends alongside with the
  // old text already folded into its body. Kept writable so that hand-off can
  // happen in one PATCH rather than leaving two sources of the same sentence.
  if (body.defaultThankYouText !== undefined) {
    update.defaultThankYouText = String(body.defaultThankYouText).trim() || null;
  }
  const current = await SurveyTemplateModel.findById(id)
    .select("version defaultRespondentVariable")
    .lean();
  // Copy only — the options come from the client's Cultural DNA at session
  // creation, and a template has no client. `enabled` is set here rather than
  // toggled: authoring this copy is what asks for the step, and leaving it false
  // would drop the copy on the floor when a session materialises the template.
  // The key is carried over, never rewritten: it is where the answer lands in
  // `SurveySubmission.cohortTags`, so changing it would orphan the results filter.
  if (body.defaultRespondentVariable !== undefined) {
    const copy = normalizeRespondentVariableCopy(body.defaultRespondentVariable);
    update.defaultRespondentVariable = {
      enabled: true,
      key: current?.defaultRespondentVariable?.key || "culturalLevel",
      // Absent and "" are different answers — see the session PATCH.
      label: copy.label,
      helpText: copy.helpText,
      helpUrl: copy.helpUrl,
      required: copy.required !== false,
    };
  }
  update.version = (current?.version ?? 1) + 1;

  const doc = await SurveyTemplateModel.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true }
  ).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description ?? undefined,
    status: doc.status,
    defaultLocale: doc.defaultLocale ?? "nl",
    archetypeIds: doc.archetypeIds ?? [],
    defaultRankWeights: doc.defaultRankWeights ?? [5, 4, 3, 2, 1],
    defaultTop3Weights: doc.defaultTop3Weights ?? [5, 3, 1],
    closingOpenQuestion: doc.closingOpenQuestion ?? undefined,
    defaultWelcomeScreen: doc.defaultWelcomeScreen ?? undefined,
    defaultClosingScreen: doc.defaultClosingScreen ?? undefined,
    defaultThankYouText: doc.defaultThankYouText ?? undefined,
    defaultRespondentVariable: doc.defaultRespondentVariable ?? undefined,
    version: doc.version ?? 1,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.surveys.manageTemplates");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const doc = await SurveyTemplateModel.findByIdAndDelete(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cascade: delete sections and questions belonging to this template
  await Promise.all([
    SurveyTemplateSectionModel.deleteMany({ templateId: id }),
    SurveyTemplateQuestionModel.deleteMany({ templateId: id }),
  ]);

  return NextResponse.json({ success: true });
}
