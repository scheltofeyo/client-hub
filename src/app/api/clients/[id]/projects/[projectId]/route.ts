import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectModel } from "@/lib/models/Project";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, projectId } = await params;
  await connectDB();

  if (!session.user.isAdmin) {
    const client = await ClientModel.findById(id).lean();
    const isLead = (client?.leads ?? []).some((l) => l.userId === session.user.id);
    if (!isLead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, status, completedDate, soldPrice, serviceId } = body;

  if (title !== undefined && !title?.trim()) {
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (title !== undefined) update.title = title.trim();
  if (description !== undefined) update.description = description?.trim() || null;
  if (soldPrice !== undefined) update.soldPrice = soldPrice ? Number(soldPrice) : null;
  if (serviceId !== undefined) update.serviceId = serviceId || null;

  if (status !== undefined) {
    update.status = status;
    if (status === "completed") {
      // Auto-set completedDate to today if not explicitly provided
      update.completedDate = completedDate?.trim() || new Date().toISOString().split("T")[0];
    } else {
      // Clear completedDate when project is no longer completed
      update.completedDate = null;
    }
  } else if (completedDate !== undefined) {
    // Manual override of completedDate — only apply if project is currently completed
    const existing = await ProjectModel.findById(projectId).lean();
    if (existing?.status === "completed") {
      update.completedDate = completedDate?.trim() || null;
    }
  }

  const doc = await ProjectModel.findByIdAndUpdate(projectId, { $set: update }, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    clientId: doc.clientId,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    completedDate: doc.completedDate,
    soldPrice: doc.soldPrice,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { projectId } = await params;
  await connectDB();
  const doc = await ProjectModel.findByIdAndDelete(projectId).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
