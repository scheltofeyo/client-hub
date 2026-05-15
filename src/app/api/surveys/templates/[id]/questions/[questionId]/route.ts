import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/auth-helpers";
import { SurveyTemplateModel } from "@/lib/models/SurveyTemplate";
import { SurveyTemplateQuestionModel } from "@/lib/models/SurveyTemplateQuestion";
import { buildPatchQuestion } from "@/lib/surveys/question-validation";
import { serializeQuestion } from "@/lib/surveys/serializers";
import { normalizeQuestionType } from "@/lib/surveys/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.surveys.manageTemplates");
  if (forbidden) return forbidden;

  const { id, questionId } = await params;
  await connectDB();

  const existing = await SurveyTemplateQuestionModel.findOne({
    _id: questionId,
    templateId: id,
  }).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const template = await SurveyTemplateModel.findById(id).lean();
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const body = await req.json();
  const patched = buildPatchQuestion(
    body,
    normalizeQuestionType(existing.type),
    { archetypeIds: template.archetypeIds ?? [] }
  );
  if (!patched.ok) {
    return NextResponse.json({ error: patched.error }, { status: 400 });
  }

  const doc = await SurveyTemplateQuestionModel.findOneAndUpdate(
    { _id: questionId, templateId: id },
    { $set: patched.value },
    { new: true }
  ).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(serializeQuestion(doc));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.surveys.manageTemplates");
  if (forbidden) return forbidden;

  const { id, questionId } = await params;
  await connectDB();

  const doc = await SurveyTemplateQuestionModel.findOneAndDelete({
    _id: questionId,
    templateId: id,
  }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
