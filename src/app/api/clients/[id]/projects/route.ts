import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectModel } from "@/lib/models/Project";
import { TaskModel } from "@/lib/models/Task";
import { ProjectTemplateModel } from "@/lib/models/ProjectTemplate";
import { UserModel } from "@/lib/models/User";
import { recordActivity } from "@/lib/activity";
import type { TaskAssignee } from "@/types";
import { hasPermissionOrIsLead } from "@/lib/auth-helpers";
import {
  buildProjectFieldsFromTemplate,
  instantiateTemplateTasks,
  instantiateTemplateSessions,
  type TemplateProjectFields,
} from "@/lib/template-instantiation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const docs = await ProjectModel.find({ clientId: id, status: { $ne: "draft" } }).sort({ createdAt: -1 }).lean();
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

  // Snapshot plan content + budget from the template (the form only carries
  // title/description/service/members — why/what/how, activities, deliverables
  // and the budget come from the template here, mirroring the plan-draft route).
  let templateFields: TemplateProjectFields | null = null;
  if (templateId) {
    const template = await ProjectTemplateModel.findById(templateId).lean();
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    templateFields = await buildProjectFieldsFromTemplate(template);
  }

  const doc = await ProjectModel.create({
    clientId: id,
    title: title.trim(),
    description: description?.trim() || undefined,
    status: isCompleted ? "completed" : "not_started",
    templateId: templateId || undefined,
    serviceId: serviceId || templateFields?.serviceId || undefined,
    members: memberAssignees,
    ...(templateFields
      ? {
          why: templateFields.why,
          how: templateFields.how,
          what: templateFields.what,
          activities: templateFields.activities,
          deliverables: templateFields.deliverables,
          pricingMode: templateFields.pricingMode,
          roleAllocation: templateFields.roleAllocation,
          discountType: templateFields.discountType,
          discountValue: templateFields.discountValue,
        }
      : {}),
    ...(isCompleted
      ? {
          completedDate: completion,
          kickedOffAt: completion,
          deliveryDate: completion,
          soldPrice: soldPrice ? Number(soldPrice) : templateFields?.soldPrice,
          labelId: labelId || undefined,
        }
      : {
          scheduledStartDate: scheduledStartDate?.trim() || undefined,
          scheduledEndDate: scheduledEndDate?.trim() || undefined,
          soldPrice: templateFields?.soldPrice,
        }),
  });

  // Instantiate template tasks + sessions (shared with the plan-draft route)
  if (templateId) {
    const taskCompletionFields = isCompleted
      ? {
          completedAt: completedAtIso,
          completedById: session.user.id,
          completedByName: session.user.name ?? "Unknown",
        }
      : {};
    const projectId = doc._id.toString();
    const createdById = session.user.id;
    const createdByName = session.user.name ?? "Unknown";

    await instantiateTemplateTasks({
      templateId,
      clientId: id,
      projectId,
      leads: client.leads ?? [],
      extraAssignees: memberAssignees,
      completionFields: taskCompletionFields,
      createdById,
      createdByName,
    });
    await instantiateTemplateSessions({
      templateId,
      clientId: id,
      projectId,
      planTaskAssignees: memberAssignees,
      completionFields: taskCompletionFields,
      createdById,
      createdByName,
    });
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
