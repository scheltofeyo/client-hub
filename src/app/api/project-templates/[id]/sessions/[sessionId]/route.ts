import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { TemplateSessionModel } from "@/lib/models/TemplateSession";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.projectTemplates");
  if (forbidden) return forbidden;

  const { sessionId } = await params;
  await connectDB();

  const body = await req.json();
  const { title, info, order } = body;

  if (title !== undefined && !title?.trim()) {
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (title !== undefined) update.title = title.trim();
  if (info !== undefined) update.info = info?.trim() || null;
  if (order !== undefined) update.order = Number(order);

  const doc = await TemplateSessionModel.findByIdAndUpdate(
    sessionId,
    { $set: update },
    { new: true }
  ).lean();

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    templateId: doc.templateId,
    title: doc.title,
    info: doc.info ?? undefined,
    order: doc.order ?? 0,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.projectTemplates");
  if (forbidden) return forbidden;

  const { sessionId } = await params;
  await connectDB();

  const doc = await TemplateSessionModel.findByIdAndDelete(sessionId).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
