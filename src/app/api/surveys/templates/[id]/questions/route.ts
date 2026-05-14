import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/auth-helpers";
import { SurveyTemplateModel } from "@/lib/models/SurveyTemplate";
import { SurveyTemplateQuestionModel } from "@/lib/models/SurveyTemplateQuestion";
import { buildCreateQuestion } from "@/lib/surveys/question-validation";
import { serializeQuestion } from "@/lib/surveys/serializers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.surveys.manageTemplates");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const template = await SurveyTemplateModel.findById(id).lean();
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const body = await req.json();
  if (!body || typeof body !== "object" || typeof body.sectionId !== "string") {
    return NextResponse.json({ error: "sectionId is required" }, { status: 400 });
  }

  const built = buildCreateQuestion(body, { archetypeIds: template.archetypeIds ?? [] });
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }

  const last = await SurveyTemplateQuestionModel.findOne({
    templateId: id,
    sectionId: body.sectionId,
  })
    .sort({ order: -1 })
    .lean();
  const order = last ? (last.order ?? 0) + 1 : 0;

  try {
    const doc = await SurveyTemplateQuestionModel.create({
      templateId: id,
      sectionId: body.sectionId,
      ...built.value,
      order,
    });

    return NextResponse.json(serializeQuestion(doc.toObject()), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create question";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.surveys.manageTemplates");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const { ids } = await req.json();
  if (!Array.isArray(ids)) {
    return NextResponse.json({ error: "ids must be an array" }, { status: 400 });
  }

  await Promise.all(
    ids.map((qid: string, index: number) =>
      SurveyTemplateQuestionModel.findOneAndUpdate(
        { _id: qid, templateId: id },
        { $set: { order: index } }
      )
    )
  );

  return NextResponse.json({ success: true });
}
