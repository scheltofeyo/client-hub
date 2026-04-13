import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { TemplateTaskModel } from "@/lib/models/TemplateTask";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.projectTemplates");
  if (forbidden) return forbidden;

  const { taskId } = await params;
  await connectDB();

  const body = await req.json();
  const { title, description, assignToClientLead } = body;

  if (title !== undefined && !title?.trim()) {
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (title !== undefined) update.title = title.trim();
  if (description !== undefined) update.description = description?.trim() || null;
  if (assignToClientLead !== undefined) update.assignToClientLead = assignToClientLead;

  const doc = await TemplateTaskModel.findByIdAndUpdate(
    taskId,
    { $set: update },
    { new: true }
  ).lean();

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    templateId: doc.templateId,
    parentTaskId: doc.parentTaskId ?? undefined,
    title: doc.title,
    description: doc.description ?? undefined,
    assignToClientLead: doc.assignToClientLead ?? false,
    order: doc.order ?? 0,
    createdAt: doc.createdAt?.toISOString(),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.projectTemplates");
  if (forbidden) return forbidden;

  const { taskId } = await params;
  await connectDB();

  const doc = await TemplateTaskModel.findByIdAndDelete(taskId).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cascade-delete subtasks
  await TemplateTaskModel.deleteMany({ parentTaskId: taskId });

  return NextResponse.json({ success: true });
}
