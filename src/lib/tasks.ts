/**
 * Shared task writes, used by the REST routes and the MCP tools so the two
 * surfaces can never drift on the rules that matter:
 *
 *  1. completing a project task recalculates the parent project's status,
 *  2. completing a task derived from a logbook follow-up marks that log as
 *     followed up (and reopening it clears the marker),
 *  3. a follow-up task may be checked off by anyone — but that exemption
 *     covers the completion toggle alone.
 *
 * Each of those used to live twice, once per task route, and the pair had
 * already drifted apart before this module existed.
 */
import type { Session } from "next-auth";
import type { Task, TaskAssignee } from "@/types";
import { hasPermission, hasPermissionOrIsCreator } from "./auth-helpers";
import { creatorFields } from "./actor";
import { connectDB } from "./mongodb";
import { TaskModel, type ITask } from "./models/Task";
import { ProjectModel } from "./models/Project";
import { LogModel } from "./models/Log";
import { recordActivity } from "./activity";

/** The lean() shape of a doc — same fields, no Document methods. */
type Lean<T> = Omit<T, keyof import("mongoose").Document> & {
  _id: import("mongoose").Types.ObjectId;
};

export type LeanTask = Lean<ITask>;

export function serializeTask(doc: LeanTask): Task {
  return {
    id: doc._id.toString(),
    clientId: doc.clientId ?? undefined,
    projectId: doc.projectId ?? undefined,
    parentTaskId: doc.parentTaskId ?? undefined,
    logId: doc.logId ?? undefined,
    title: doc.title,
    description: doc.description ?? undefined,
    assignees: (doc.assignees ?? []).map((a) => ({
      userId: a.userId,
      name: a.name,
      image: a.image ?? undefined,
    })),
    completionDate: doc.completionDate ?? undefined,
    completedAt: doc.completedAt ?? undefined,
    completedById: doc.completedById ?? undefined,
    completedByName: doc.completedByName ?? undefined,
    order: doc.order ?? 0,
    createdById: doc.createdById,
    createdByName: doc.createdByName,
    createdVia: doc.createdVia ?? undefined,
    createdAt: doc.createdAt?.toISOString(),
  };
}

/**
 * Validation failures come back as a value rather than a thrown error or a
 * NextResponse: the REST route turns `status` into a response code and the MCP
 * tool turns `error` into a readable refusal, and neither has to know how the
 * other reports.
 */
export type TaskWriteResult =
  | { ok: true; task: Task }
  | { ok: false; error: string; status: 400 | 403 | 404 };

// ── Project status ───────────────────────────────────────────────────

/**
 * Recompute a project's status from its tasks.
 *
 * Draft (in-plan) projects and ones that have not been kicked off never
 * recompute — before kickoff the status stays where it was put by hand.
 *
 * This is the union of two recalculations that had drifted: the client-scoped
 * route emitted `not_started` when nothing was done, the project-scoped one
 * only ever chose between `in_progress` and `completed`. Both were reachable
 * from the UI for the same task, so the same click gave different answers
 * depending on which tab it came from. `not_started` wins — it is the
 * documented status set, and "in progress" is a lie about a project nobody has
 * touched.
 */
export async function recalcProjectStatus(projectId: string): Promise<void> {
  const project = await ProjectModel.findById(projectId).lean();
  if (!project || project.status === "draft" || !project.kickedOffAt) return;

  const tasks = await TaskModel.find({ projectId }, { completedAt: 1 }).lean();
  const total = tasks.length;
  const completed = tasks.filter((t) => !!t.completedAt).length;

  const status =
    total === 0 || completed === 0
      ? "not_started"
      : completed === total
      ? "completed"
      : "in_progress";

  const update: Record<string, unknown> = { status };
  if (status === "completed") {
    if (!project.completedDate) {
      update.completedDate = new Date().toISOString().split("T")[0];
    }
  } else {
    update.completedDate = null;
  }

  await ProjectModel.findByIdAndUpdate(projectId, { $set: update });
}

// ── Create ───────────────────────────────────────────────────────────

export type CreateTaskInput = {
  clientId: string;
  projectId?: string;
  title?: unknown;
  description?: unknown;
  assignees?: unknown;
  completionDate?: unknown;
  parentTaskId?: unknown;
};

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Create a task at client scope or project scope.
 *
 * A subtask inherits its parent's assignees and any passed in are ignored —
 * the UI keeps a subtask's assignees in lockstep with its parent, and letting a
 * caller break that here would put rows on screen the UI cannot produce.
 */
export async function createTask(
  session: Session,
  input: CreateTaskInput
): Promise<TaskWriteResult> {
  const title = trimmed(input.title);
  if (!title) return { ok: false, error: "Title is required", status: 400 };

  const { clientId, projectId } = input;

  await connectDB();

  const parentTaskId = trimmed(input.parentTaskId) || undefined;

  let assignees: TaskAssignee[] = Array.isArray(input.assignees) ? input.assignees : [];
  let order = 0;
  if (parentTaskId) {
    const parent = await TaskModel.findById(parentTaskId).lean();
    assignees = parent?.assignees ?? [];
  } else {
    // Top-level tasks are ordered per scope: within the project, or within the
    // client's project-less tasks.
    const siblings = projectId
      ? { projectId, parentTaskId: null }
      : { clientId, projectId: { $exists: false }, parentTaskId: null };
    const last = await TaskModel.findOne(siblings).sort({ order: -1 }).lean();
    order = last ? (last.order ?? 0) + 1 : 0;
  }

  const description = trimmed(input.description);
  const completionDate = trimmed(input.completionDate);

  const doc = await TaskModel.create({
    clientId,
    ...(projectId ? { projectId } : {}),
    parentTaskId,
    title,
    description: description || undefined,
    assignees,
    completionDate: completionDate || undefined,
    order,
    ...(await creatorFields(session)),
  });

  let isDraft = false;
  if (projectId) {
    isDraft = (await ProjectModel.findById(projectId, { status: 1 }).lean())?.status === "draft";
    // Adding a task can pull a project out of "completed"; recalcProjectStatus
    // skips draft and not-yet-kicked-off projects on its own.
    await recalcProjectStatus(projectId);
  }

  if (!isDraft) {
    await recordActivity({
      clientId,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "task.created",
      metadata: { ...(projectId ? { projectId } : {}), title: doc.title },
    });
  }

  return { ok: true, task: serializeTask(doc.toObject() as LeanTask) };
}

// ── Update ───────────────────────────────────────────────────────────

export type UpdateTaskInput = {
  title?: unknown;
  description?: unknown;
  assignees?: unknown;
  completionDate?: unknown;
  completed?: unknown;
  parentTaskId?: unknown;
};

/** Fields whose change is worth an activity event. */
const TRACKED_FIELDS = ["title", "description", "assignees", "completionDate"] as const;

/**
 * Whether `session` may apply `input` to `task`.
 *
 * Exported so a caller that writes more than one task can check them all before
 * writing any — the MCP completion tool closes a parent's subtasks alongside it
 * and must not leave half of them closed behind a refusal.
 *
 * A follow-up task (derived from a log) can be checked off by anyone, even
 * someone who neither created the log nor holds tasks.editAny. Strictly the
 * completion toggle: the moment any other field rides along, the normal
 * permissions apply again.
 */
export function canEditTask(
  session: Session,
  task: LeanTask,
  input: UpdateTaskInput
): boolean {
  if (hasPermission(session, "tasks.editAny")) return true;
  if (hasPermissionOrIsCreator(session, "tasks.editOwn", task.createdById ?? "")) return true;

  return (
    !!task.logId &&
    input.completed !== undefined &&
    input.title === undefined &&
    input.description === undefined &&
    input.assignees === undefined &&
    input.completionDate === undefined &&
    input.parentTaskId === undefined
  );
}

/**
 * Edit a task: its fields, its parent, or its completion.
 *
 * The permission decision lives here rather than in the callers, because the
 * follow-up exemption is the rule most likely to be reimplemented slightly
 * differently on a new surface — and a slightly different version of it is a
 * hole.
 */
export async function updateTask(
  session: Session,
  taskId: string,
  input: UpdateTaskInput
): Promise<TaskWriteResult> {
  const { title, description, assignees, completionDate, completed, parentTaskId } = input;

  if (title !== undefined && !trimmed(title)) {
    return { ok: false, error: "Title cannot be empty", status: 400 };
  }

  await connectDB();

  const existing = await TaskModel.findById(taskId).lean();
  if (!existing) return { ok: false, error: "Not found", status: 404 };

  // Tasks attached to a draft (in-plan) project cannot be completed or
  // reopened. Other field edits are allowed.
  if (existing.projectId && completed !== undefined) {
    const status = (await ProjectModel.findById(existing.projectId, { status: 1 }).lean())?.status;
    if (status === "draft") {
      return { ok: false, error: "Tasks in draft project plans cannot be completed", status: 400 };
    }
  }

  if (!canEditTask(session, existing as LeanTask, input)) {
    return { ok: false, error: "Forbidden", status: 403 };
  }

  const update: Record<string, unknown> = {};
  if (title !== undefined) update.title = trimmed(title);
  if (description !== undefined) update.description = trimmed(description) || null;
  if (assignees !== undefined) update.assignees = assignees;
  if (completionDate !== undefined) update.completionDate = trimmed(completionDate) || null;

  // Re-parenting: inherit the new parent's assignees and land at the end of its
  // children. An empty parent promotes the task back to top level.
  if (parentTaskId !== undefined) {
    const newParentId = trimmed(parentTaskId) || null;
    update.parentTaskId = newParentId;
    if (newParentId) {
      const parent = await TaskModel.findById(newParentId).lean();
      update.assignees = parent?.assignees ?? [];
      const lastSibling = await TaskModel.findOne({ parentTaskId: newParentId })
        .sort({ order: -1 })
        .lean();
      update.order = lastSibling ? (lastSibling.order ?? 0) + 1 : 0;
    }
  }

  if (completed === true) {
    update.completedAt = new Date().toISOString();
    update.completedById = session.user.id;
    update.completedByName = session.user.name ?? "Unknown";
  } else if (completed === false) {
    update.completedAt = null;
    update.completedById = null;
    update.completedByName = null;
  }

  const doc = await TaskModel.findByIdAndUpdate(taskId, { $set: update }, { new: true }).lean();
  if (!doc) return { ok: false, error: "Not found", status: 404 };

  // Subtasks follow their parent's assignees.
  if (assignees !== undefined) {
    await TaskModel.updateMany({ parentTaskId: taskId }, { $set: { assignees } });
  }

  const toggled = completed === true || completed === false;

  if (toggled && doc.projectId) {
    await recalcProjectStatus(doc.projectId);
  }

  // Keep the originating log's follow-up marker in step with the derived task.
  if (toggled && doc.logId) {
    if (completed === true) {
      await LogModel.findByIdAndUpdate(doc.logId, {
        $set: {
          followedUpAt: new Date().toISOString().split("T")[0],
          followedUpByName: session.user.name ?? "Unknown",
        },
      });
    } else {
      await LogModel.findByIdAndUpdate(doc.logId, {
        $unset: { followedUpAt: 1, followedUpByName: 1 },
      });
    }
  }

  let parentIsDraft = false;
  if (doc.projectId) {
    const project = await ProjectModel.findById(doc.projectId, { status: 1 }).lean();
    parentIsDraft = project?.status === "draft";
  }

  if (!parentIsDraft) {
    if (completed === true) {
      await recordActivity({
        clientId: doc.clientId ?? "",
        actorId: session.user.id,
        actorName: session.user.name ?? "Unknown",
        type: "task.completed",
        metadata: { projectId: doc.projectId, title: doc.title },
      });
    } else {
      const fields = TRACKED_FIELDS.filter((f) => input[f] !== undefined);
      if (fields.length > 0) {
        await recordActivity({
          clientId: doc.clientId ?? "",
          actorId: session.user.id,
          actorName: session.user.name ?? "Unknown",
          type: "task.updated",
          metadata: { projectId: doc.projectId, title: doc.title, fields },
        });
      }
    }
  }

  return { ok: true, task: serializeTask(doc) };
}

// ── Re-parenting guards ──────────────────────────────────────────────

export type TaskScope = { clientId?: string; projectId?: string };

/**
 * Whether `parentId` can take a child in `scope`, as a readable refusal or the
 * parent itself.
 *
 * Shared by the create and re-parent paths so the two cannot disagree about
 * what a usable parent is.
 */
export async function checkParent(
  parentId: string,
  scope: TaskScope
): Promise<{ error: string } | { parent: LeanTask }> {
  const parent = await TaskModel.findById(parentId).lean();
  if (!parent) return { error: `No task found with id ${parentId}.` };

  if ((parent.clientId ?? null) !== (scope.clientId ?? null)) {
    return { error: `"${parent.title}" belongs to a different client.` };
  }
  if ((parent.projectId ?? null) !== (scope.projectId ?? null)) {
    return {
      error: parent.projectId
        ? `"${parent.title}" belongs to a different project.`
        : `"${parent.title}" is a client-level task, so a project task cannot sit under it.`,
    };
  }
  if (parent.parentTaskId) {
    return { error: `"${parent.title}" is itself a subtask. Tasks nest only one level deep.` };
  }

  return { parent: parent as LeanTask };
}

/**
 * Whether `task` may be nested under `newParentId`, as a readable refusal or
 * null when it is fine.
 *
 * Called by the MCP tools only, deliberately. The REST routes accept every one
 * of these cases today and the UI's drag-and-drop cannot produce any of them,
 * so tightening them there would change behaviour for no gain. A model
 * addressing tasks by id has no such guard rails.
 *
 * Cycles need no separate check: a usable parent is always top-level and the
 * task being moved must be childless, so there is no chain left to close.
 */
export async function checkReparent(
  task: LeanTask,
  newParentId: string
): Promise<string | null> {
  const taskId = task._id.toString();
  if (newParentId === taskId) return "A task cannot be its own parent.";

  const checked = await checkParent(newParentId, {
    clientId: task.clientId,
    projectId: task.projectId,
  });
  if ("error" in checked) return checked.error;

  const children = await TaskModel.countDocuments({ parentTaskId: taskId });
  if (children > 0) {
    return `"${task.title}" has ${children} subtask(s) of its own, so it cannot become a subtask itself. Move or clear those first.`;
  }

  return null;
}
