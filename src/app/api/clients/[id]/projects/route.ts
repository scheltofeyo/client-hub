import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectModel } from "@/lib/models/Project";
import { TaskModel } from "@/lib/models/Task";
import { TemplateTaskModel } from "@/lib/models/TemplateTask";
import { SessionModel } from "@/lib/models/Session";
import { TemplateSessionModel } from "@/lib/models/TemplateSession";
import { UserModel } from "@/lib/models/User";
import { recordActivity } from "@/lib/activity";
import type { TaskAssignee } from "@/types";
import { hasPermissionOrIsLead } from "@/lib/auth-helpers";

function mergeAssignees(a: TaskAssignee[], b: TaskAssignee[]): TaskAssignee[] {
  const seen = new Set<string>();
  const out: TaskAssignee[] = [];
  for (const x of [...a, ...b]) {
    if (seen.has(x.userId)) continue;
    seen.add(x.userId);
    out.push(x);
  }
  return out;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const docs = await ProjectModel.find({ clientId: id }).sort({ createdAt: -1 }).lean();
  return NextResponse.json(
    docs.map((doc) => ({
      id: doc._id.toString(),
      clientId: doc.clientId,
      title: doc.title,
      description: doc.description,
      status: doc.status,
      completedDate: doc.completedDate,
      deliveryDate: doc.deliveryDate,
      soldPrice: doc.soldPrice,
      templateId: doc.templateId,
      serviceId: doc.serviceId,
      labelId: doc.labelId,
      kickedOffAt: doc.kickedOffAt ?? null,
      scheduledStartDate: doc.scheduledStartDate ?? null,
      scheduledEndDate: doc.scheduledEndDate ?? null,
      members: doc.members ?? [],
      createdAt: doc.createdAt?.toISOString().split("T")[0],
    }))
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();

  const client = await ClientModel.findById(id).lean();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  if (!hasPermissionOrIsLead(session, "projects.create", client.leads ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    title,
    description,
    templateId,
    serviceId,
    scheduledStartDate,
    scheduledEndDate,
    members,
    addAsCompleted,
    completedDate,
    soldPrice,
    labelId,
  } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const isCompleted = addAsCompleted === true;
  const completion = typeof completedDate === "string" ? completedDate.trim() : "";
  if (isCompleted && !completion) {
    return NextResponse.json({ error: "Completed date is required" }, { status: 400 });
  }

  // Resolve member snapshots (server-trusted name + image) from User collection
  let memberAssignees: TaskAssignee[] = [];
  if (Array.isArray(members) && members.length > 0) {
    const memberIds = members
      .map((m: { userId?: string }) => m?.userId)
      .filter((u): u is string => typeof u === "string" && u.length > 0);
    if (memberIds.length > 0) {
      const memberUsers = await UserModel.find(
        { _id: { $in: memberIds } },
        { _id: 1, name: 1, image: 1 }
      ).lean();
      memberAssignees = memberUsers.map((u) => ({
        userId: u._id.toString(),
        name: u.name,
        image: u.image ?? undefined,
      }));
    }
  }

  const completedAtIso = isCompleted
    ? new Date(`${completion}T12:00:00Z`).toISOString()
    : undefined;

  const doc = await ProjectModel.create({
    clientId: id,
    title: title.trim(),
    description: description?.trim() || undefined,
    status: isCompleted ? "completed" : "not_started",
    templateId: templateId || undefined,
    serviceId: serviceId || undefined,
    members: memberAssignees,
    ...(isCompleted
      ? {
          completedDate: completion,
          kickedOffAt: completion,
          deliveryDate: completion,
          soldPrice: soldPrice ? Number(soldPrice) : undefined,
          labelId: labelId || undefined,
        }
      : {
          scheduledStartDate: scheduledStartDate?.trim() || undefined,
          scheduledEndDate: scheduledEndDate?.trim() || undefined,
        }),
  });

  // Bulk-create tasks from template if one was used
  if (templateId) {
    const templateTasks = await TemplateTaskModel.find({ templateId })
      .sort({ order: 1 })
      .lean();

    if (templateTasks.length > 0) {
      // Resolve client lead assignees if any task needs them
      const needsLeads = templateTasks.some((t) => t.assignToClientLead);
      let leadAssignees: TaskAssignee[] = [];
      if (needsLeads && (client.leads ?? []).length > 0) {
        const leadIds = (client.leads ?? []).map((l) => l.userId);
        const leadUsers = await UserModel.find(
          { _id: { $in: leadIds } },
          { _id: 1, image: 1 }
        ).lean();
        const imgMap = Object.fromEntries(
          leadUsers.map((u) => [u._id.toString(), u.image ?? undefined])
        );
        leadAssignees = (client.leads ?? []).map((l) => ({
          userId: l.userId,
          name: l.name,
          image: imgMap[l.userId],
        }));
      }

      const projectId = doc._id.toString();
      const idMap: Record<string, string> = {};

      const completionFields = isCompleted
        ? {
            completedAt: completedAtIso,
            completedById: session.user.id,
            completedByName: session.user.name ?? "Unknown",
          }
        : {};

      // Pass 1: top-level tasks (no parentTaskId)
      const topLevel = templateTasks.filter((t) => !t.parentTaskId);
      for (const tt of topLevel) {
        const created = await TaskModel.create({
          clientId: id,
          projectId,
          title: tt.title,
          description: tt.description || undefined,
          assignees: mergeAssignees(
            tt.assignToClientLead ? leadAssignees : [],
            memberAssignees,
          ),
          createdById: session.user.id,
          createdByName: session.user.name ?? "Unknown",
          ...completionFields,
        });
        idMap[tt._id.toString()] = created._id.toString();
      }

      // Pass 2: subtasks
      const subtasks = templateTasks.filter((t) => !!t.parentTaskId);
      for (const tt of subtasks) {
        const resolvedParentId = idMap[tt.parentTaskId!];
        if (!resolvedParentId) continue; // orphan — skip gracefully
        const created = await TaskModel.create({
          clientId: id,
          projectId,
          parentTaskId: resolvedParentId,
          title: tt.title,
          description: tt.description || undefined,
          assignees: mergeAssignees(
            tt.assignToClientLead ? leadAssignees : [],
            memberAssignees,
          ),
          createdById: session.user.id,
          createdByName: session.user.name ?? "Unknown",
          ...completionFields,
        });
        idMap[tt._id.toString()] = created._id.toString();
      }
    }

    // Instantiate draft sessions + Plan-tasks from template sessions
    const templateSessions = await TemplateSessionModel.find({ templateId })
      .sort({ order: 1 })
      .lean();
    const projectId = doc._id.toString();
    const sessionTaskCompletion = isCompleted
      ? {
          completedAt: completedAtIso,
          completedById: session.user.id,
          completedByName: session.user.name ?? "Unknown",
        }
      : {};
    for (const ts of templateSessions) {
      const draft = await SessionModel.create({
        clientId: id,
        projectId,
        title: ts.title,
        info: ts.info || undefined,
        templateSessionId: ts._id.toString(),
        participants: [],
        createdById: session.user.id,
        createdByName: session.user.name ?? "Unknown",
      });
      await TaskModel.create({
        clientId: id,
        projectId,
        sessionId: draft._id.toString(),
        title: `Plan ${ts.title}`,
        assignees: memberAssignees,
        createdById: session.user.id,
        createdByName: session.user.name ?? "Unknown",
        ...sessionTaskCompletion,
      });
    }
  }

  // For "add as completed", create the Deliver task already marked done
  if (isCompleted) {
    await TaskModel.create({
      clientId: id,
      projectId: doc._id.toString(),
      title: `Deliver ${doc.title}`,
      assignees: memberAssignees,
      completedAt: completedAtIso,
      completedById: session.user.id,
      completedByName: session.user.name ?? "Unknown",
      createdById: session.user.id,
      createdByName: session.user.name ?? "Unknown",
    });
  }

  await recordActivity({
    clientId: id,
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "project.created",
    metadata: { projectId: doc._id.toString(), title: doc.title },
  });

  if (isCompleted) {
    await recordActivity({
      clientId: id,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "project.kicked_off",
      metadata: { projectId: doc._id.toString(), title: doc.title, deliveryDate: completion },
    });
    await recordActivity({
      clientId: id,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "project.status_changed",
      metadata: { projectId: doc._id.toString(), title: doc.title, status: "completed" },
    });
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
    templateId: doc.templateId,
    serviceId: doc.serviceId,
    labelId: doc.labelId,
    kickedOffAt: doc.kickedOffAt ?? null,
    scheduledStartDate: doc.scheduledStartDate ?? null,
    scheduledEndDate: doc.scheduledEndDate ?? null,
    members: doc.members ?? [],
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  }, { status: 201 });
}
