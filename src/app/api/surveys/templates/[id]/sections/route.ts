import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/auth-helpers";
import { SurveyTemplateModel } from "@/lib/models/SurveyTemplate";
import { SurveyTemplateSectionModel } from "@/lib/models/SurveyTemplateSection";

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
  const { title, description, imageUrl, openQuestion } = body;
  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const last = await SurveyTemplateSectionModel.findOne({ templateId: id })
    .sort({ order: -1 })
    .lean();
  const order = last ? (last.order ?? 0) + 1 : 0;

  const doc = await SurveyTemplateSectionModel.create({
    templateId: id,
    title: title.trim(),
    description: description?.trim() || undefined,
    imageUrl: imageUrl?.trim() || undefined,
    openQuestion: openQuestion ?? undefined,
    order,
  });

  return NextResponse.json(
    {
      id: doc._id.toString(),
      title: doc.title,
      description: doc.description ?? undefined,
      imageUrl: doc.imageUrl ?? undefined,
      openQuestion: doc.openQuestion ?? undefined,
      order: doc.order ?? 0,
    },
    { status: 201 }
  );
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
    ids.map((sectionId: string, index: number) =>
      SurveyTemplateSectionModel.findOneAndUpdate(
        { _id: sectionId, templateId: id },
        { $set: { order: index } }
      )
    )
  );

  return NextResponse.json({ success: true });
}
