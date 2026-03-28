import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { TemplateTaskModel } from "@/lib/models/TemplateTask";
import { ProjectTemplateModel } from "@/lib/models/ProjectTemplate";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();

  const docs = await TemplateTaskModel.find({ templateId: id }).sort({ order: 1 }).lean();
  return NextResponse.json(
    docs.map((doc) => ({
      id: doc._id.toString(),
      templateId: doc.templateId,
      parentTaskId: doc.parentTaskId ?? undefined,
      title: doc.title,
      description: doc.description ?? undefined,
      assignToClientLead: doc.assignToClientLead ?? false,
      order: doc.order ?? 0,
      createdAt: doc.createdAt?.toISOString(),
    }))
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: templateId } = await params;
  await connectDB();

  const template = await ProjectTemplateModel.findById(templateId).lean();
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const body = await req.json();
  const { title, description, assignToClientLead, parentTaskId } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Auto-increment order
  const last = await TemplateTaskModel.findOne({ templateId }).sort({ order: -1 }).lean();
  const order = last ? (last.order ?? 0) + 1 : 0;

  const doc = await TemplateTaskModel.create({
    templateId,
    parentTaskId: parentTaskId || undefined,
    title: title.trim(),
    description: description?.trim() || undefined,
    assignToClientLead: assignToClientLead ?? false,
    order,
  });

  return NextResponse.json(
    {
      id: doc._id.toString(),
      templateId: doc.templateId,
      parentTaskId: doc.parentTaskId ?? undefined,
      title: doc.title,
      description: doc.description ?? undefined,
      assignToClientLead: doc.assignToClientLead ?? false,
      order: doc.order ?? 0,
      createdAt: doc.createdAt?.toISOString(),
    },
    { status: 201 }
  );
}
