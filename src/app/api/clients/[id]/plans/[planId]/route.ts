import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectPlanModel } from "@/lib/models/ProjectPlan";
import { ProjectModel } from "@/lib/models/Project";
import { TaskModel } from "@/lib/models/Task";
import { SessionModel } from "@/lib/models/Session";
import { ServiceModel } from "@/lib/models/Service";
import { hasPermission, hasPermissionOrIsLead } from "@/lib/auth-helpers";
import { generateShareCode } from "@/lib/ranking/shareCode";
import { recordActivity } from "@/lib/activity";

type AnyDoc = Record<string, unknown> & { _id: { toString(): string } };

function serializeProject(input: unknown, serviceMap?: Map<string, string>) {
  const doc = input as AnyDoc;
  const serviceId = (doc.serviceId as string | undefined) ?? null;
  return {
    id: doc._id.toString(),
    clientId: doc.clientId,
    planId: doc.planId ?? null,
    title: doc.title,
    description: doc.description ?? null,
    why: doc.why ?? null,
    how: doc.how ?? null,
    what: doc.what ?? null,
    activities: doc.activities ?? null,
    deliverables: doc.deliverables ?? null,
    hiddenSections: doc.hiddenSections ?? [],
    status: doc.status,
    soldPrice: doc.soldPrice ?? null,
    pricingMode: doc.pricingMode ?? "manual",
    roleAllocation: doc.roleAllocation ?? [],
    serviceId,
    serviceName: serviceId && serviceMap ? serviceMap.get(serviceId) ?? null : null,
    labelId: doc.labelId ?? null,
    templateId: doc.templateId ?? null,
    deliveryDate: doc.deliveryDate ?? null,
    scheduledStartDate: doc.scheduledStartDate ?? null,
    scheduledEndDate: doc.scheduledEndDate ?? null,
    members: doc.members ?? [],
    createdAt: (doc.createdAt as Date | undefined)?.toISOString?.() ?? null,
  };
}

type AcceptanceEvent = {
  type: "created" | "sent" | "accepted" | "revoked";
  at: string;
  source: "client" | "internal";
  by: { userId?: string; name: string; email?: string; image?: string };
};

function deriveAcceptanceLog(doc: AnyDoc): AcceptanceEvent[] {
  const stored = doc.acceptanceLog as AcceptanceEvent[] | undefined;
  const hasStored = Array.isArray(stored) && stored.length > 0;

  // If the log already has events, ensure a "created" event is at its base.
  if (hasStored) {
    const hasCreated = stored!.some((e) => e.type === "created");
    if (hasCreated) return stored!;
    // Prepend a synthetic created event from createdAt + createdBy
    const createdAt = (doc.createdAt as Date | undefined)?.toISOString?.();
    const createdBy = doc.createdBy as { userId: string; name: string; image?: string } | undefined;
    if (createdAt && createdBy) {
      return [
        { type: "created", at: createdAt, source: "internal", by: createdBy },
        ...stored!,
      ];
    }
    return stored!;
  }

  // No log yet: synthesize created + (optional) sent + (optional) accepted from current state.
  const events: AcceptanceEvent[] = [];
  const createdBy = doc.createdBy as { userId: string; name: string; image?: string } | undefined;
  const createdAt = (doc.createdAt as Date | undefined)?.toISOString?.();
  const presentedAt = doc.presentedAt as string | undefined;
  const acceptedAt = doc.acceptedAt as string | undefined;
  const acceptedByClient = doc.acceptedByClient as { name: string; email: string } | undefined;
  const acceptedBy = doc.acceptedBy as { userId: string; name: string; image?: string } | undefined;

  if (createdAt && createdBy) {
    events.push({ type: "created", at: createdAt, source: "internal", by: createdBy });
  }
  if (presentedAt) {
    events.push({
      type: "sent",
      at: `${presentedAt}T09:00:00.000Z`,
      source: "internal",
      by: createdBy ?? { name: "Unknown" },
    });
  }
  if (acceptedAt) {
    if (acceptedByClient) {
      events.push({
        type: "accepted",
        at: `${acceptedAt}T12:00:00.000Z`,
        source: "client",
        by: { name: acceptedByClient.name, email: acceptedByClient.email },
      });
    } else if (acceptedBy) {
      events.push({
        type: "accepted",
        at: `${acceptedAt}T12:00:00.000Z`,
        source: "internal",
        by: { userId: acceptedBy.userId, name: acceptedBy.name, image: acceptedBy.image },
      });
    }
  }
  return events;
}

function serializePlan(input: unknown) {
  const doc = input as AnyDoc;
  return {
    id: doc._id.toString(),
    clientId: doc.clientId,
    title: doc.title,
    summary: doc.summary ?? null,
    status: doc.status,
    discountType: doc.discountType ?? null,
    discountValue: doc.discountValue ?? null,
    vatRate: doc.vatRate ?? null,
    shareCode: doc.shareCode ?? null,
    proposerStatement: doc.proposerStatement ?? null,
    createdBy: doc.createdBy,
    acceptedBy: doc.acceptedBy ?? null,
    acceptedByClient: doc.acceptedByClient ?? null,
    acceptedAt: doc.acceptedAt ?? null,
    presentedAt: doc.presentedAt ?? null,
    acceptanceLog: deriveAcceptanceLog(doc),
    createdAt: (doc.createdAt as Date | undefined)?.toISOString?.() ?? null,
    updatedAt: (doc.updatedAt as Date | undefined)?.toISOString?.() ?? null,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "projectPlans.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, planId } = await params;
  await connectDB();

  const plan = await ProjectPlanModel.findOne({ _id: planId, clientId: id }).lean();
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Lazy backfill: ensure shareCode exists for older plans created before the field was added.
  if (!(plan as { shareCode?: string }).shareCode) {
    let code = generateShareCode();
    while (await ProjectPlanModel.exists({ shareCode: code })) code = generateShareCode();
    await ProjectPlanModel.findByIdAndUpdate(planId, { $set: { shareCode: code } });
    (plan as { shareCode?: string }).shareCode = code;
  }

  // Drafts come from the Project collection where planId is set.
  // For accepted plans, fetch promoted projects too (still keyed by planId).
  const projects = await ProjectModel.find({ clientId: id, planId }).sort({ order: 1, createdAt: 1 }).lean();

  const projectIds = projects.map((p) => p._id.toString());
  const [tasks, sessions, services] = await Promise.all([
    projectIds.length > 0 ? TaskModel.find({ projectId: { $in: projectIds } }).sort({ order: 1, createdAt: 1 }).lean() : Promise.resolve([]),
    projectIds.length > 0 ? SessionModel.find({ projectId: { $in: projectIds } }).sort({ createdAt: 1 }).lean() : Promise.resolve([]),
    ServiceModel.find({}, { _id: 1, name: 1, rank: 1 }).lean(),
  ]);

  const serviceMap = new Map<string, string>(
    services.map((s) => [s._id.toString(), s.name as string])
  );

  return NextResponse.json({
    plan: serializePlan(plan),
    projects: projects.map((p) => serializeProject(p, serviceMap)),
    tasksByProject: projectIds.reduce<Record<string, unknown[]>>((acc, pid) => {
      acc[pid] = tasks
        .filter((t) => (t.projectId as string | undefined) === pid)
        .map((t) => ({
          id: t._id.toString(),
          clientId: t.clientId ?? null,
          projectId: t.projectId ?? null,
          parentTaskId: t.parentTaskId ?? null,
          sessionId: t.sessionId ?? null,
          title: t.title,
          description: t.description ?? null,
          assignees: t.assignees ?? [],
          completionDate: t.completionDate ?? null,
          completedAt: t.completedAt ?? null,
          order: t.order ?? 0,
          createdById: t.createdById,
          createdByName: t.createdByName,
        }));
      return acc;
    }, {}),
    sessionsByProject: projectIds.reduce<Record<string, unknown[]>>((acc, pid) => {
      acc[pid] = sessions
        .filter((s) => (s.projectId as string | undefined) === pid)
        .map((s) => ({
          id: s._id.toString(),
          projectId: s.projectId,
          title: s.title,
          date: s.date ?? null,
          location: s.location ?? null,
          remoteLink: s.remoteLink ?? null,
          participants: s.participants ?? [],
          info: s.info ?? null,
          templateSessionId: s.templateSessionId ?? null,
          createdById: s.createdById,
          createdByName: s.createdByName,
        }));
      return acc;
    }, {}),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, planId } = await params;
  await connectDB();
  const client = await ClientModel.findById(id).lean();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  if (!hasPermissionOrIsLead(session, "projectPlans.edit", client.leads ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (body.title !== undefined) {
    if (!body.title?.trim()) return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    update.title = body.title.trim();
  }
  if (body.summary !== undefined) update.summary = body.summary || null;
  if (body.proposerStatement !== undefined) {
    update.proposerStatement = typeof body.proposerStatement === "string"
      ? body.proposerStatement.trim() || null
      : null;
  }
  if (body.discountType !== undefined) {
    update.discountType = body.discountType === "percentage" || body.discountType === "amount" ? body.discountType : null;
  }
  if (body.discountValue !== undefined) update.discountValue = body.discountValue == null || body.discountValue === "" ? null : Number(body.discountValue);
  if (body.vatRate !== undefined) update.vatRate = body.vatRate == null || body.vatRate === "" ? null : Number(body.vatRate);

  if (body.status !== undefined) {
    if (!["draft", "ready", "accepted", "archived"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    // Accept transitions: go via the /accept endpoint so promotion logic runs.
    if (body.status === "accepted") {
      return NextResponse.json({ error: "Use the /accept endpoint to accept a plan" }, { status: 400 });
    }
    update.status = body.status;
    if (body.status === "ready") update.presentedAt = new Date().toISOString().split("T")[0];
  }

  // Detect status transitions that warrant an activity / acceptance-log entry
  const prior = await ProjectPlanModel.findOne({ _id: planId, clientId: id }, { status: 1 }).lean();
  const isMarkAsReady = prior && prior.status !== "ready" && update.status === "ready";
  const isArchive = prior && prior.status !== "archived" && update.status === "archived";

  const mongoUpdate: Record<string, unknown> = { $set: update };
  if (isMarkAsReady) {
    mongoUpdate.$push = {
      acceptanceLog: {
        type: "sent",
        at: new Date().toISOString(),
        source: "internal",
        by: {
          userId: session.user.id,
          name: session.user.name ?? "Unknown",
          image: session.user.image ?? undefined,
        },
      },
    };
  }

  const doc = await ProjectPlanModel.findOneAndUpdate(
    { _id: planId, clientId: id },
    mongoUpdate,
    { new: true }
  ).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (isMarkAsReady) {
    await recordActivity({
      clientId: id,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "plan.sent",
      metadata: { planId: doc._id.toString(), title: doc.title },
    });
  } else if (isArchive) {
    await recordActivity({
      clientId: id,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "plan.archived",
      metadata: { planId: doc._id.toString(), title: doc.title },
    });
  }

  return NextResponse.json(serializePlan(doc));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, planId } = await params;
  await connectDB();
  const client = await ClientModel.findById(id).lean();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  if (!hasPermissionOrIsLead(session, "projectPlans.delete", client.leads ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Refuse hard-delete if any accepted (promoted) projects still reference this plan.
  // Plans containing only drafts are deleted with their drafts (and their tasks/sessions).
  const acceptedCount = await ProjectModel.countDocuments({
    clientId: id,
    planId,
    status: { $ne: "draft" },
  });
  if (acceptedCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a plan with accepted projects. Archive it instead." },
      { status: 400 }
    );
  }

  const draftProjects = await ProjectModel.find({ clientId: id, planId, status: "draft" }, { _id: 1 }).lean();
  const draftIds = draftProjects.map((p) => p._id.toString());

  if (draftIds.length > 0) {
    await Promise.all([
      TaskModel.deleteMany({ projectId: { $in: draftIds } }),
      SessionModel.deleteMany({ projectId: { $in: draftIds } }),
      ProjectModel.deleteMany({ _id: { $in: draftIds } }),
    ]);
  }

  const doc = await ProjectPlanModel.findOneAndDelete({ _id: planId, clientId: id }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
