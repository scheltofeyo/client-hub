import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectModel } from "@/lib/models/Project";
import { recordActivity } from "@/lib/activity";
import { hasPermission, hasPermissionOrIsLead, requirePermission } from "@/lib/auth-helpers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, projectId } = await params;
  await connectDB();

  {
    const client = await ClientModel.findById(id).lean();
    if (!hasPermissionOrIsLead(session, "projects.edit", client?.leads ?? [])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await req.json();
  const { title, description, status, completedDate, soldPrice, serviceId, labelId, deliveryDate, kickedOffAt, scheduledStartDate, scheduledEndDate } = body;

  if (title !== undefined && !title?.trim()) {
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
  }

  // Reset project back to upcoming (un-kick-off) — requires specific permission
  if (kickedOffAt === null) {
    if (!hasPermission(session, "projects.resetToUpcoming")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const doc = await ProjectModel.findByIdAndUpdate(
      projectId,
      { $set: { status: "not_started", completedDate: null, deliveryDate: null, soldPrice: null, labelId: null }, $unset: { kickedOffAt: 1 } },
      { new: true }
    ).lean();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await recordActivity({
      clientId: id,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "project.reset_to_upcoming",
      metadata: { projectId, title: doc.title },
    });
    return NextResponse.json({
      id: doc._id.toString(),
      clientId: doc.clientId,
      title: doc.title,
      description: doc.description,
      status: doc.status,
      completedDate: doc.completedDate ?? null,
      deliveryDate: doc.deliveryDate ?? null,
      soldPrice: doc.soldPrice ?? null,
      serviceId: doc.serviceId ?? null,
      labelId: doc.labelId ?? null,
      kickedOffAt: null,
    });
  }

  const update: Record<string, unknown> = {};
  if (title !== undefined) update.title = title.trim();
  if (description !== undefined) update.description = description?.trim() || null;
  if (soldPrice !== undefined) update.soldPrice = soldPrice ? Number(soldPrice) : null;
  if (serviceId !== undefined) update.serviceId = serviceId || null;
  if (labelId !== undefined) update.labelId = labelId || null;
  if (deliveryDate !== undefined) update.deliveryDate = deliveryDate?.trim() || null;
  if (scheduledStartDate !== undefined) update.scheduledStartDate = scheduledStartDate?.trim() || null;
  if (scheduledEndDate !== undefined) update.scheduledEndDate = scheduledEndDate?.trim() || null;
  if (kickedOffAt !== undefined && kickedOffAt !== null) update.kickedOffAt = kickedOffAt?.trim() || null;

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

  if (status !== undefined) {
    await recordActivity({
      clientId: id,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "project.status_changed",
      metadata: { projectId, title: doc.title, status: doc.status },
    });
  } else {
    // Track meaningful field changes (skip when status change or reset is the primary action)
    const trackFields = ["title", "description", "soldPrice", "serviceId", "labelId", "deliveryDate", "scheduledStartDate", "scheduledEndDate"] as const;
    const updatedFields = trackFields.filter((f) => body[f] !== undefined);
    if (updatedFields.length > 0) {
      await recordActivity({
        clientId: id,
        actorId: session.user.id,
        actorName: session.user.name ?? "Unknown",
        type: "project.updated",
        metadata: { projectId, title: doc.title, fields: updatedFields },
      });
    }
  }

  return NextResponse.json({
    id: doc._id.toString(),
    clientId: doc.clientId,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    completedDate: doc.completedDate,
    deliveryDate: doc.deliveryDate,
    soldPrice: doc.soldPrice,
    serviceId: doc.serviceId,
    labelId: doc.labelId,
    kickedOffAt: doc.kickedOffAt ?? null,
    scheduledStartDate: doc.scheduledStartDate ?? null,
    scheduledEndDate: doc.scheduledEndDate ?? null,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requirePermission(session, "projects.delete");
  if (forbidden) return forbidden;

  const { id, projectId } = await params;
  await connectDB();
  const doc = await ProjectModel.findByIdAndDelete(projectId).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await recordActivity({
    clientId: id,
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "project.deleted",
    metadata: { projectId, title: doc.title },
  });

  return NextResponse.json({ success: true });
}
