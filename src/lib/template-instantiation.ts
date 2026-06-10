import {
  calculateRolebasedPrice,
  type IRoleAllocationLine,
  type PricingMode,
} from "@/lib/models/Project";
import { ProjectRoleModel } from "@/lib/models/ProjectRole";
import type { IProjectTemplate } from "@/lib/models/ProjectTemplate";
import { TemplateTaskModel } from "@/lib/models/TemplateTask";
import { TemplateSessionModel } from "@/lib/models/TemplateSession";
import { TaskModel } from "@/lib/models/Task";
import { SessionModel } from "@/lib/models/Session";
import { UserModel } from "@/lib/models/User";
import type { DiscountType } from "@/lib/pricing";
import type { TaskAssignee } from "@/types";

/**
 * Shared logic for instantiating a project from a `ProjectTemplate`.
 *
 * Both the normal project-create route (`/api/clients/[id]/projects`) and the
 * plan-draft route (`/api/clients/[id]/plans/[planId]/projects`) snapshot the
 * same content, budget, tasks and sessions out of a template — this module is
 * the single source of truth so the two never drift apart again.
 */

type Lead = { userId: string; name: string };

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
 * collection so that future rate edits don't affect this project. Uses the latest
 * live rate when the role still exists; otherwise falls back to the template snapshot.
 */
export async function snapshotTemplateAllocation(
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

export interface TemplateProjectFields {
  description?: string;
  why?: string;
  how?: string;
  what?: string;
  activities?: string;
  deliverables?: string;
  serviceId?: string;
  pricingMode: PricingMode;
  roleAllocation?: IRoleAllocationLine[];
  soldPrice?: number;
  discountType?: DiscountType;
  discountValue?: number;
}

/**
 * Build the project field snapshot from a (lean) `ProjectTemplate` doc:
 * plan content (why/how/what/activities/deliverables), service, and budget
 * (pricing mode, snapshotted role allocation, sold price, discount).
 */
export async function buildProjectFieldsFromTemplate(
  template: IProjectTemplate
): Promise<TemplateProjectFields> {
  const pricingMode: PricingMode = template.defaultPricingMode ?? "rolebased";

  const roleAllocation = await snapshotTemplateAllocation(
    template.defaultRoleAllocation as unknown as Array<Record<string, unknown>> | undefined
  );

  const soldPrice =
    pricingMode === "rolebased"
      ? calculateRolebasedPrice(roleAllocation)
      : (template.defaultSoldPrice ?? undefined);

  let discountType: DiscountType | undefined;
  let discountValue: number | undefined;
  const tmplDiscountType = template.defaultDiscountType;
  const tmplDiscountValue = template.defaultDiscountValue;
  if (
    (tmplDiscountType === "percentage" || tmplDiscountType === "amount") &&
    tmplDiscountValue != null &&
    Number(tmplDiscountValue) > 0
  ) {
    discountType = tmplDiscountType;
    discountValue = Number(tmplDiscountValue);
  }

  return {
    description: template.defaultDescription,
    why: template.defaultWhy,
    how: template.defaultHow,
    what: template.defaultWhat,
    activities: template.defaultActivities,
    deliverables: template.defaultDeliverables,
    serviceId: template.defaultServiceId,
    pricingMode,
    roleAllocation: roleAllocation.length > 0 ? roleAllocation : undefined,
    soldPrice,
    discountType,
    discountValue,
  };
}

/**
 * Instantiate a template's tasks (top-level + subtasks) onto a project.
 *
 * - `extraAssignees` are merged into every task (project members for the normal
 *   route, `[]` for plan drafts).
 * - `completionFields` stamps each task as completed when the project is created
 *   "as completed"; pass `{}` otherwise.
 * Tasks flagged `assignToClientLead` additionally get the resolved client leads.
 */
export async function instantiateTemplateTasks(opts: {
  templateId: string;
  clientId: string;
  projectId: string;
  leads: Lead[];
  extraAssignees: TaskAssignee[];
  completionFields: Record<string, unknown>;
  createdById: string;
  createdByName: string;
}): Promise<void> {
  const {
    templateId,
    clientId,
    projectId,
    leads,
    extraAssignees,
    completionFields,
    createdById,
    createdByName,
  } = opts;

  const templateTasks = await TemplateTaskModel.find({ templateId })
    .sort({ order: 1 })
    .lean();
  if (templateTasks.length === 0) return;

  // Resolve client lead assignees (with live images) only if a task needs them
  const needsLeads = templateTasks.some((t) => t.assignToClientLead);
  let leadAssignees: TaskAssignee[] = [];
  if (needsLeads && leads.length > 0) {
    const leadIds = leads.map((l) => l.userId);
    const leadUsers = await UserModel.find(
      { _id: { $in: leadIds } },
      { _id: 1, image: 1 }
    ).lean();
    const imgMap = Object.fromEntries(
      leadUsers.map((u) => [u._id.toString(), u.image ?? undefined])
    );
    leadAssignees = leads.map((l) => ({
      userId: l.userId,
      name: l.name,
      image: imgMap[l.userId],
    }));
  }

  const idMap: Record<string, string> = {};

  // Pass 1: top-level tasks (no parentTaskId)
  const topLevel = templateTasks.filter((t) => !t.parentTaskId);
  for (const tt of topLevel) {
    const created = await TaskModel.create({
      clientId,
      projectId,
      title: tt.title,
      description: tt.description || undefined,
      assignees: mergeAssignees(tt.assignToClientLead ? leadAssignees : [], extraAssignees),
      createdById,
      createdByName,
      ...completionFields,
    });
    idMap[tt._id.toString()] = created._id.toString();
  }

  // Pass 2: subtasks (resolve parent ids; skip orphans gracefully)
  const subtasks = templateTasks.filter((t) => !!t.parentTaskId);
  for (const tt of subtasks) {
    const resolvedParentId = idMap[tt.parentTaskId!];
    if (!resolvedParentId) continue;
    const created = await TaskModel.create({
      clientId,
      projectId,
      parentTaskId: resolvedParentId,
      title: tt.title,
      description: tt.description || undefined,
      assignees: mergeAssignees(tt.assignToClientLead ? leadAssignees : [], extraAssignees),
      createdById,
      createdByName,
      ...completionFields,
    });
    idMap[tt._id.toString()] = created._id.toString();
  }
}

/**
 * Instantiate a template's sessions onto a project as draft `Session` docs, each
 * paired with a "Plan {session}" task.
 *
 * - `planTaskAssignees` are assigned to the generated Plan-task (project members
 *   for the normal route, `[]` for plan drafts).
 * - `completionFields` stamps the Plan-task as completed when relevant.
 */
export async function instantiateTemplateSessions(opts: {
  templateId: string;
  clientId: string;
  projectId: string;
  planTaskAssignees: TaskAssignee[];
  completionFields: Record<string, unknown>;
  createdById: string;
  createdByName: string;
}): Promise<void> {
  const {
    templateId,
    clientId,
    projectId,
    planTaskAssignees,
    completionFields,
    createdById,
    createdByName,
  } = opts;

  const templateSessions = await TemplateSessionModel.find({ templateId })
    .sort({ order: 1 })
    .lean();

  for (const ts of templateSessions) {
    const draft = await SessionModel.create({
      clientId,
      projectId,
      title: ts.title,
      info: ts.info || undefined,
      templateSessionId: ts._id.toString(),
      participants: [],
      createdById,
      createdByName,
    });
    await TaskModel.create({
      clientId,
      projectId,
      sessionId: draft._id.toString(),
      title: `Plan ${ts.title}`,
      assignees: planTaskAssignees,
      createdById,
      createdByName,
      ...completionFields,
    });
  }
}
