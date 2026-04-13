import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectModel } from "@/lib/models/Project";
import { TaskModel } from "@/lib/models/Task";
import { recordActivity } from "@/lib/activity";
import { hasPermissionOrIsLead } from "@/lib/auth-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, projectId } = await params;
  await connectDB();

  {
    const client = await ClientModel.findById(id).lean();
    if (!hasPermissionOrIsLead(session, "projects.kickoff", client?.leads ?? [])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const existing = await ProjectModel.findById(projectId).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.kickedOffAt) {
    return NextResponse.json({ error: "Project is already kicked off" }, { status: 409 });
  }

  const body = await req.json();
  const { deliveryDate, soldPrice, labelId, title, serviceId, description, kickedOffAt } = body;

  if (!deliveryDate?.trim()) {
    return NextResponse.json({ error: "Delivery date is required" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];
  const update: Record<string, unknown> = {
    kickedOffAt: kickedOffAt?.trim() || today,
    deliveryDate: deliveryDate.trim(),
  };
  if (title !== undefined) update.title = title.trim() || existing.title;
  if (description !== undefined) update.description = description?.trim() || null;
  if (soldPrice !== undefined) update.soldPrice = soldPrice ? Number(soldPrice) : null;
  if (serviceId !== undefined) update.serviceId = serviceId || null;
  if (labelId !== undefined) update.labelId = labelId || null;

  // Recalculate project status from current task state
  const allTasks = await TaskModel.find({ projectId }).lean();
  const completedCount = allTasks.filter((t) => !!t.completedAt).length;
  const total = allTasks.length;
  update.status =
    total === 0 || completedCount === 0
      ? "not_started"
      : completedCount === total
      ? "completed"
      : "in_progress";
  if (update.status === "completed" && !existing.completedDate) {
    update.completedDate = today;
  } else if (update.status !== "completed") {
    update.completedDate = null;
  }

  const doc = await ProjectModel.findByIdAndUpdate(projectId, { $set: update }, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await recordActivity({
    clientId: id,
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "project.kicked_off",
    metadata: { projectId, title: doc.title, deliveryDate: doc.deliveryDate },
  });

  return NextResponse.json({
    id: doc._id.toString(),
    clientId: doc.clientId,
    title: doc.title,
    description: doc.description ?? null,
    status: doc.status,
    completedDate: doc.completedDate ?? null,
    deliveryDate: doc.deliveryDate ?? null,
    soldPrice: doc.soldPrice ?? null,
    serviceId: doc.serviceId ?? null,
    labelId: doc.labelId ?? null,
    kickedOffAt: doc.kickedOffAt ?? null,
  });
}
