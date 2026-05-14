import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/auth-helpers";
import { SurveyTemplateSectionModel } from "@/lib/models/SurveyTemplateSection";
import { SurveyTemplateQuestionModel } from "@/lib/models/SurveyTemplateQuestion";
import { SurveyTemplateModel } from "@/lib/models/SurveyTemplate";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.surveys.manageTemplates");
  if (forbidden) return forbidden;

  const { id, sectionId } = await params;
  await connectDB();

  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (body.title !== undefined) {
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    update.title = body.title.trim();
  }
  if (body.description !== undefined) update.description = body.description?.trim() || undefined;
  if (body.openQuestion !== undefined) update.openQuestion = body.openQuestion;

  const doc = await SurveyTemplateSectionModel.findOneAndUpdate(
    { _id: sectionId, templateId: id },
    { $set: update },
    { new: true }
  ).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description ?? undefined,
    openQuestion: doc.openQuestion ?? undefined,
    order: doc.order ?? 0,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.surveys.manageTemplates");
  if (forbidden) return forbidden;

  const { id, sectionId } = await params;
  await connectDB();

  const existing = await SurveyTemplateSectionModel.findOne({
    _id: sectionId,
    templateId: id,
  }).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Find the question-ids that will be deleted so we can strip them from comparisons
  const questionsToDelete = await SurveyTemplateQuestionModel.find({
    templateId: id,
    sectionId,
  })
    .select("_id")
    .lean();
  const questionIds = questionsToDelete.map((q) => q._id.toString());

  await Promise.all([
    SurveyTemplateSectionModel.findByIdAndDelete(sectionId),
    SurveyTemplateQuestionModel.deleteMany({ templateId: id, sectionId }),
  ]);

  // Strip orphaned question-ids from any template comparison
  if (questionIds.length > 0) {
    const template = await SurveyTemplateModel.findById(id).lean();
    if (template && Array.isArray(template.comparisons) && template.comparisons.length > 0) {
      const cleaned = template.comparisons.map((c) => ({
        ...c,
        leftQuestionIds: (c.leftQuestionIds ?? []).filter((q: string) => !questionIds.includes(q)),
        rightQuestionIds: (c.rightQuestionIds ?? []).filter((q: string) => !questionIds.includes(q)),
      }));
      await SurveyTemplateModel.findByIdAndUpdate(id, { $set: { comparisons: cleaned } });
    }
  }

  return NextResponse.json({ success: true });
}
