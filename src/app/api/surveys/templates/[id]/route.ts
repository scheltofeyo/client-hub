import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/auth-helpers";
import { SurveyTemplateModel } from "@/lib/models/SurveyTemplate";
import { SurveyTemplateSectionModel } from "@/lib/models/SurveyTemplateSection";
import { SurveyTemplateQuestionModel } from "@/lib/models/SurveyTemplateQuestion";
import { serializeQuestion } from "@/lib/surveys/serializers";

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
    archetypeIds: template.archetypeIds ?? [],
    defaultRankWeights: template.defaultRankWeights ?? [5, 4, 3, 2, 1],
    defaultTop3Weights: template.defaultTop3Weights ?? [5, 3, 1],
    closingOpenQuestion: template.closingOpenQuestion ?? undefined,
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
  update.version = await (async () => {
    const cur = await SurveyTemplateModel.findById(id).select("version").lean();
    return (cur?.version ?? 1) + 1;
  })();

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
    archetypeIds: doc.archetypeIds ?? [],
    defaultRankWeights: doc.defaultRankWeights ?? [5, 4, 3, 2, 1],
    defaultTop3Weights: doc.defaultTop3Weights ?? [5, 3, 1],
    closingOpenQuestion: doc.closingOpenQuestion ?? undefined,
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
