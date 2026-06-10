import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectPlanModel } from "@/lib/models/ProjectPlan";
import { ProjectModel } from "@/lib/models/Project";
import { ProjectTemplateModel } from "@/lib/models/ProjectTemplate";
import { TaskModel } from "@/lib/models/Task";
import { SessionModel } from "@/lib/models/Session";
import { hasPermissionOrIsLead } from "@/lib/auth-helpers";
import {
  buildProjectFieldsFromTemplate,
  instantiateTemplateTasks,
  instantiateTemplateSessions,
  type TemplateProjectFields,
} from "@/lib/template-instantiation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, planId } = await params;
  await connectDB();

  const [client, plan] = await Promise.all([
    ClientModel.findById(id).lean(),
    ProjectPlanModel.findOne({ _id: planId, clientId: id }).lean(),
  ]);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  if (!hasPermissionOrIsLead(session, "projectPlans.edit", client.leads ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (plan.status === "accepted" || plan.status === "finalized") {
    return NextResponse.json({ error: "Cannot modify an accepted or finalized plan" }, { status: 400 });
  }

  const body = await req.json();
  const { templateId, title, scheduledStartDate, scheduledEndDate } = body;

  let draftTitle: string = (title ?? "").trim();
  // Default for a blank draft: rolebased with an empty allocation (price 0).
  let fields: TemplateProjectFields = { pricingMode: "rolebased", soldPrice: 0 };

  // Snapshot content + budget from template, if provided
  if (templateId) {
    const template = await ProjectTemplateModel.findById(templateId).lean();
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    if (!draftTitle) draftTitle = template.name;
    fields = await buildProjectFieldsFromTemplate(template);
  }

  if (!draftTitle) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Append new draft to the bottom of the plan's list.
  const last = await ProjectModel.findOne({ clientId: id, planId })
    .sort({ order: -1 })
    .select({ order: 1 })
    .lean();
  const nextOrder = (last?.order ?? -1) + 1;

  const project = await ProjectModel.create({
    clientId: id,
    planId,
    title: draftTitle,
    description: fields.description || undefined,
    why: fields.why,
    how: fields.how,
    what: fields.what,
    activities: fields.activities,
    deliverables: fields.deliverables,
    status: "draft",
    pricingMode: fields.pricingMode,
    roleAllocation: fields.roleAllocation,
    serviceId: fields.serviceId || undefined,
    soldPrice: fields.soldPrice,
    discountType: fields.discountType,
    discountValue: fields.discountValue,
    scheduledStartDate: scheduledStartDate?.trim() || undefined,
    scheduledEndDate: scheduledEndDate?.trim() || undefined,
    templateId: templateId || undefined,
    order: nextOrder,
  });
  const projectId = project._id.toString();

  // Instantiate template tasks + sessions (no member assignees, no completion,
  // no activity logging — the project is a draft). Shared with the normal route.
  if (templateId) {
    await instantiateTemplateTasks({
      templateId,
      clientId: id,
      projectId,
      leads: client.leads ?? [],
      extraAssignees: [],
      completionFields: {},
      createdById: session.user.id,
      createdByName: session.user.name ?? "Unknown",
    });
    await instantiateTemplateSessions({
      templateId,
      clientId: id,
      projectId,
      planTaskAssignees: [],
      completionFields: {},
      createdById: session.user.id,
      createdByName: session.user.name ?? "Unknown",
    });
  }

  const [fresh, freshTasks, freshSessions] = await Promise.all([
    ProjectModel.findById(projectId).lean(),
    TaskModel.find({ projectId }).sort({ order: 1, createdAt: 1 }).lean(),
    SessionModel.find({ projectId }).sort({ createdAt: 1 }).lean(),
  ]);

  return NextResponse.json(
    {
      id: projectId,
      clientId: id,
      planId,
      title: fresh!.title,
      status: fresh!.status,
      pricingMode: fresh!.pricingMode,
      soldPrice: fresh!.soldPrice ?? null,
      discountType: fresh!.discountType ?? null,
      discountValue: fresh!.discountValue ?? null,
      roleAllocation: fresh!.roleAllocation ?? [],
      scheduledStartDate: fresh!.scheduledStartDate ?? null,
      scheduledEndDate: fresh!.scheduledEndDate ?? null,
      serviceId: fresh!.serviceId ?? null,
      templateId: fresh!.templateId ?? null,
      why: fresh!.why ?? null,
      how: fresh!.how ?? null,
      what: fresh!.what ?? null,
      activities: fresh!.activities ?? null,
      deliverables: fresh!.deliverables ?? null,
      hiddenSections: fresh!.hiddenSections ?? [],
      description: fresh!.description ?? null,
      tasks: freshTasks.map((t) => ({
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
      })),
      sessions: freshSessions.map((s) => ({
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
      })),
    },
    { status: 201 }
  );
}
