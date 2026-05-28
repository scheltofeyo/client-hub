import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectPlanModel } from "@/lib/models/ProjectPlan";
import {
  ProjectModel,
  calculateRolebasedPrice,
  type IRoleAllocationLine,
} from "@/lib/models/Project";
import { ProjectTemplateModel } from "@/lib/models/ProjectTemplate";
import { TemplateTaskModel } from "@/lib/models/TemplateTask";
import { TemplateSessionModel } from "@/lib/models/TemplateSession";
import { ProjectRoleModel } from "@/lib/models/ProjectRole";
import { TaskModel } from "@/lib/models/Task";
import { SessionModel } from "@/lib/models/Session";
import { UserModel } from "@/lib/models/User";
import { hasPermissionOrIsLead } from "@/lib/auth-helpers";
import type { TaskAssignee } from "@/types";

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

/**
 * Snapshot a template's `defaultRoleAllocation` against the current `ProjectRole`
 * collection so that future rate edits don't affect this draft.
 */
async function snapshotTemplateAllocation(
  defaults: Array<Record<string, unknown>> | undefined
): Promise<IRoleAllocationLine[]> {
  if (!defaults || defaults.length === 0) return [];
  const ids = defaults
    .map((l) => String(l.roleId ?? ""))
    .filter((s) => s.length > 0);
  const roles = await ProjectRoleModel.find({ _id: { $in: ids } }).lean();
  const byId = new Map(roles.map((r) => [r._id.toString(), r]));
  return defaults
    .map((l): IRoleAllocationLine | null => {
      const roleId = String(l.roleId ?? "");
      if (!roleId) return null;
      const role = byId.get(roleId);
      // Use the latest live rate if the role still exists; otherwise fall back to the template snapshot.
      const dayRate = Number(role?.dayRate ?? l.dayRate ?? 0);
      const marginMultiplier = Number(role?.marginMultiplier ?? l.marginMultiplier ?? 1);
      const isExternal = !!(role?.isExternal ?? l.isExternal);
      const roleName = String(role?.name ?? l.roleName ?? "");
      const liveCost = role?.externalCostRate;
      const tmplCost = l.externalCostRate;
      const externalCostRate = isExternal
        ? liveCost != null
          ? Number(liveCost)
          : tmplCost != null
            ? Number(tmplCost)
            : undefined
        : undefined;
      return {
        roleId,
        roleName,
        days: Number(l.days ?? 0),
        dayRate,
        marginMultiplier,
        isExternal,
        externalCostRate,
      };
    })
    .filter((l): l is IRoleAllocationLine => l !== null);
}

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
  let pricingMode: "manual" | "rolebased" = "rolebased";
  let roleAllocation: IRoleAllocationLine[] = [];
  let serviceId: string | undefined;
  let why: string | undefined;
  let how: string | undefined;
  let what: string | undefined;
  let activities: string | undefined;
  let deliverables: string | undefined;
  let description: string | undefined;

  // Snapshot from template, if provided
  if (templateId) {
    const template = await ProjectTemplateModel.findById(templateId).lean();
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    if (!draftTitle) draftTitle = template.name;
    pricingMode = (template as { defaultPricingMode?: "manual" | "rolebased" }).defaultPricingMode ?? "rolebased";
    serviceId = (template as { defaultServiceId?: string }).defaultServiceId;
    description = (template as { defaultDescription?: string }).defaultDescription;
    why = (template as { defaultWhy?: string }).defaultWhy;
    how = (template as { defaultHow?: string }).defaultHow;
    what = (template as { defaultWhat?: string }).defaultWhat;
    activities = (template as { defaultActivities?: string }).defaultActivities;
    deliverables = (template as { defaultDeliverables?: string }).defaultDeliverables;
    const defaults = (template as { defaultRoleAllocation?: Array<Record<string, unknown>> }).defaultRoleAllocation;
    roleAllocation = await snapshotTemplateAllocation(defaults);
  }

  if (!draftTitle) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const initialSoldPrice =
    pricingMode === "rolebased"
      ? calculateRolebasedPrice(roleAllocation)
      : ((templateId
          ? (await ProjectTemplateModel.findById(templateId, { defaultSoldPrice: 1 }).lean())?.defaultSoldPrice
          : undefined) ?? undefined);

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
    description: description || undefined,
    why,
    how,
    what,
    activities,
    deliverables,
    status: "draft",
    pricingMode,
    roleAllocation: roleAllocation.length > 0 ? roleAllocation : undefined,
    serviceId: serviceId || undefined,
    soldPrice: initialSoldPrice,
    scheduledStartDate: scheduledStartDate?.trim() || undefined,
    scheduledEndDate: scheduledEndDate?.trim() || undefined,
    templateId: templateId || undefined,
    order: nextOrder,
  });
  const projectId = project._id.toString();

  // Instantiate template tasks + sessions (skip activity logging — project is draft)
  if (templateId) {
    const templateTasks = await TemplateTaskModel.find({ templateId }).sort({ order: 1 }).lean();
    if (templateTasks.length > 0) {
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

      const idMap: Record<string, string> = {};
      const topLevel = templateTasks.filter((t) => !t.parentTaskId);
      for (const tt of topLevel) {
        const created = await TaskModel.create({
          clientId: id,
          projectId,
          title: tt.title,
          description: tt.description || undefined,
          assignees: mergeAssignees(tt.assignToClientLead ? leadAssignees : [], []),
          createdById: session.user.id,
          createdByName: session.user.name ?? "Unknown",
        });
        idMap[tt._id.toString()] = created._id.toString();
      }
      const subtasks = templateTasks.filter((t) => !!t.parentTaskId);
      for (const tt of subtasks) {
        const resolvedParentId = idMap[tt.parentTaskId!];
        if (!resolvedParentId) continue;
        const created = await TaskModel.create({
          clientId: id,
          projectId,
          parentTaskId: resolvedParentId,
          title: tt.title,
          description: tt.description || undefined,
          assignees: mergeAssignees(tt.assignToClientLead ? leadAssignees : [], []),
          createdById: session.user.id,
          createdByName: session.user.name ?? "Unknown",
        });
        idMap[tt._id.toString()] = created._id.toString();
      }
    }

    const templateSessions = await TemplateSessionModel.find({ templateId }).sort({ order: 1 }).lean();
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
        assignees: [],
        createdById: session.user.id,
        createdByName: session.user.name ?? "Unknown",
      });
    }
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
