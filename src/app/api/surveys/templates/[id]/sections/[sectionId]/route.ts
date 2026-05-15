import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/auth-helpers";
import { SurveyTemplateSectionModel } from "@/lib/models/SurveyTemplateSection";
import { SurveyTemplateQuestionModel } from "@/lib/models/SurveyTemplateQuestion";

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
  if (body.imageUrl !== undefined) update.imageUrl = body.imageUrl?.trim() || undefined;
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
    imageUrl: doc.imageUrl ?? undefined,
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

  await Promise.all([
    SurveyTemplateSectionModel.findByIdAndDelete(sectionId),
    SurveyTemplateQuestionModel.deleteMany({ templateId: id, sectionId }),
  ]);

  return NextResponse.json({ success: true });
}
