import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectModel, calculateRolebasedPrice, type IRoleAllocationLine } from "@/lib/models/Project";
import { TaskModel } from "@/lib/models/Task";
import { UserModel } from "@/lib/models/User";
import { recordActivity } from "@/lib/activity";
import type { TaskAssignee } from "@/types";
import { hasPermission, hasPermissionOrIsLead, requirePermission } from "@/lib/auth-helpers";

function sanitizeRoleAllocation(input: unknown): IRoleAllocationLine[] {
  if (!Array.isArray(input)) return [];
  return input.map((raw) => {
    const line = raw as Record<string, unknown>;
    const assignedRaw = line.assignedUser as Record<string, unknown> | undefined;
    const assignedUser =
      assignedRaw && typeof assignedRaw.userId === "string" && typeof assignedRaw.name === "string"
        ? {
            userId: assignedRaw.userId,
            name: assignedRaw.name,
            image: typeof assignedRaw.image === "string" ? assignedRaw.image : undefined,
          }
        : undefined;
    const isExternal = !!line.isExternal;
    const rawCost = line.externalCostRate;
    const externalCostRate =
      isExternal && rawCost != null && rawCost !== "" ? Number(rawCost) : undefined;
    return {
      roleId: String(line.roleId ?? ""),
      roleName: String(line.roleName ?? ""),
      days: Number(line.days ?? 0),
      dayRate: Number(line.dayRate ?? 0),
      marginMultiplier: Number(line.marginMultiplier ?? 1),
      isExternal,
      externalCostRate,
      assignedUser,
    };
  }).filter((l) => l.roleId);
}

function serializeProject(doc: Record<string, unknown> & { _id: { toString(): string } }) {
  return {
    id: doc._id.toString(),
    clientId: doc.clientId,
    planId: doc.planId ?? null,
    title: doc.title,
    description: doc.description,
    why: doc.why ?? null,
    how: doc.how ?? null,
    what: doc.what ?? null,
    activities: doc.activities ?? null,
    deliverables: doc.deliverables ?? null,
    hiddenSections: doc.hiddenSections ?? [],
    status: doc.status,
    completedDate: doc.completedDate ?? null,
    deliveryDate: doc.deliveryDate ?? null,
    soldPrice: doc.soldPrice ?? null,
    pricingMode: doc.pricingMode ?? "manual",
    roleAllocation: doc.roleAllocation ?? [],
    serviceId: doc.serviceId ?? null,
    labelId: doc.labelId ?? null,
    kickedOffAt: doc.kickedOffAt ?? null,
    scheduledStartDate: doc.scheduledStartDate ?? null,
    scheduledEndDate: doc.scheduledEndDate ?? null,
    members: doc.members ?? [],
  };
}

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
  const {
    title,
    description,
    status,
    completedDate,
    soldPrice,
    serviceId,
    labelId,
    deliveryDate,
    kickedOffAt,
    scheduledStartDate,
    scheduledEndDate,
    members,
    why,
    how,
    what,
    activities,
    deliverables,
    hiddenSections,
    pricingMode,
    roleAllocation,
  } = body;

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
      members: doc.members ?? [],
    });
  }

  const update: Record<string, unknown> = {};
  if (title !== undefined) update.title = title.trim();
  if (description !== undefined) update.description = description?.trim() || null;
  if (why !== undefined) update.why = why || null;
  if (how !== undefined) update.how = how || null;
  if (what !== undefined) update.what = what || null;
  if (activities !== undefined) update.activities = activities || null;
  if (deliverables !== undefined) update.deliverables = deliverables || null;
  if (hiddenSections !== undefined) {
    update.hiddenSections = Array.isArray(hiddenSections)
      ? hiddenSections.filter((s) => typeof s === "string")
      : [];
  }
  if (serviceId !== undefined) update.serviceId = serviceId || null;
  if (labelId !== undefined) update.labelId = labelId || null;
  if (deliveryDate !== undefined) update.deliveryDate = deliveryDate?.trim() || null;
  if (scheduledStartDate !== undefined) update.scheduledStartDate = scheduledStartDate?.trim() || null;
  if (scheduledEndDate !== undefined) update.scheduledEndDate = scheduledEndDate?.trim() || null;
  if (kickedOffAt !== undefined && kickedOffAt !== null) update.kickedOffAt = kickedOffAt?.trim() || null;

  // Role allocation + pricing mode. When mode is rolebased, soldPrice is derived from allocation.
  let nextPricingMode: "manual" | "rolebased" | undefined;
  let nextAllocation: IRoleAllocationLine[] | undefined;
  if (pricingMode === "manual" || pricingMode === "rolebased") {
    nextPricingMode = pricingMode;
    update.pricingMode = pricingMode;
  }
  if (roleAllocation !== undefined) {
    nextAllocation = sanitizeRoleAllocation(roleAllocation);
    update.roleAllocation = nextAllocation;
  }
  // Decide soldPrice: explicit input wins only for manual mode. For rolebased we recompute.
  const existingForPricing = nextPricingMode === undefined || nextAllocation === undefined
    ? await ProjectModel.findById(projectId).lean()
    : null;
  const effectiveMode = nextPricingMode ?? existingForPricing?.pricingMode ?? "manual";
  if (effectiveMode === "rolebased") {
    const allocation = nextAllocation ?? existingForPricing?.roleAllocation ?? [];
    update.soldPrice = calculateRolebasedPrice(allocation);
  } else if (soldPrice !== undefined) {
    update.soldPrice = soldPrice === null || soldPrice === "" ? null : Number(soldPrice);
  }

  if (members !== undefined) {
    let resolved: TaskAssignee[] = [];
    if (Array.isArray(members) && members.length > 0) {
      const memberIds = members
        .map((m: { userId?: string }) => m?.userId)
        .filter((u): u is string => typeof u === "string" && u.length > 0);
      if (memberIds.length > 0) {
        const memberUsers = await UserModel.find(
          { _id: { $in: memberIds } },
          { _id: 1, name: 1, image: 1 }
        ).lean();
        resolved = memberUsers.map((u) => ({
          userId: u._id.toString(),
          name: u.name,
          image: u.image ?? undefined,
        }));
      }
    }
    update.members = resolved;
  }

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

  // If this PATCH transitions the project from no-kickoff to kicked-off and the
  // caller did not pass an explicit status, mirror the dedicated /kickoff
  // endpoint's status logic so projects can never end up with kickedOffAt set
  // while status stays at "not_started".
  if (
    status === undefined &&
    typeof update.kickedOffAt === "string" &&
    update.kickedOffAt.length > 0
  ) {
    const existing = await ProjectModel.findById(projectId).lean();
    if (existing && !existing.kickedOffAt) {
      const allTasks = await TaskModel.find({ projectId }).lean();
      const total = allTasks.length;
      const completedCount = allTasks.filter((t) => !!t.completedAt).length;
      const allDone = total > 0 && completedCount === total;
      update.status = allDone ? "completed" : "in_progress";
      if (allDone && !existing.completedDate) {
        update.completedDate = new Date().toISOString().split("T")[0];
      }
    }
  }

  const doc = await ProjectModel.findByIdAndUpdate(projectId, { $set: update }, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Skip activity logging for draft projects (they live under an unaccepted plan)
  const isDraft = doc.status === "draft";

  if (!isDraft && status !== undefined) {
    await recordActivity({
      clientId: id,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "project.status_changed",
      metadata: { projectId, title: doc.title, status: doc.status },
    });
  } else if (!isDraft) {
    // Track meaningful field changes (skip when status change or reset is the primary action)
    const trackFields = ["title", "description", "soldPrice", "serviceId", "labelId", "deliveryDate", "scheduledStartDate", "scheduledEndDate", "members"] as const;
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

  return NextResponse.json(serializeProject(doc as never));
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
