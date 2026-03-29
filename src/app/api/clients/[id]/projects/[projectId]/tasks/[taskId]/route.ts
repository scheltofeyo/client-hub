import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { TaskModel } from "@/lib/models/Task";
import { ProjectModel } from "@/lib/models/Project";
import { recordActivity } from "@/lib/activity";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string; taskId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: clientId, projectId, taskId } = await params;
  const body = await req.json();
  const { title, description, assignees, completionDate, completed, parentTaskId: newParentTaskId } = body;

  if (title !== undefined && !title?.trim()) {
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
  }

  await connectDB();

  const update: Record<string, unknown> = {};
  if (title !== undefined) update.title = title.trim();
  if (description !== undefined) update.description = description?.trim() || null;
  if (assignees !== undefined) update.assignees = assignees;
  if (completionDate !== undefined) update.completionDate = completionDate || null;

  // Moving to a new parent: inherit assignees + order at end of new parent's children
  if (newParentTaskId !== undefined) {
    update.parentTaskId = newParentTaskId || null;
    if (newParentTaskId) {
      const parent = await TaskModel.findById(newParentTaskId).lean();
      update.assignees = parent?.assignees ?? [];
      const lastSibling = await TaskModel.findOne({ parentTaskId: newParentTaskId }).sort({ order: -1 }).lean();
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
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cascade assignee changes to all child tasks
  if (assignees !== undefined) {
    await TaskModel.updateMany({ parentTaskId: taskId }, { $set: { assignees } });
  }

  // Recalculate project status when task completion changes
  if (completed === true || completed === false) {
    const allTasks = await TaskModel.find({ projectId: doc.projectId }).lean();
    const completedCount = allTasks.filter((t) => !!t.completedAt).length;
    const total = allTasks.length;
    const projectStatus =
      total === 0 || completedCount === 0
        ? "not_started"
        : completedCount === total
        ? "completed"
        : "in_progress";
    const projectUpdate: Record<string, unknown> = { status: projectStatus };
    if (projectStatus === "completed") {
      // All tasks just completed — set completedDate to today if not already set
      const existing = await ProjectModel.findById(doc.projectId).lean();
      if (!existing?.completedDate) {
        projectUpdate.completedDate = new Date().toISOString().split("T")[0];
      }
    } else {
      // Project no longer completed — clear completedDate
      projectUpdate.completedDate = null;
    }
    await ProjectModel.findByIdAndUpdate(doc.projectId, { $set: projectUpdate });
  }

  if (completed === true) {
    await recordActivity({
      clientId,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "task.completed",
      metadata: { projectId, title: doc.title },
    });
  }

  return NextResponse.json({
    id: doc._id.toString(),
    projectId: doc.projectId,
    parentTaskId: doc.parentTaskId ?? undefined,
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
    createdById: doc.createdById,
    createdByName: doc.createdByName,
    createdAt: doc.createdAt?.toISOString(),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string; taskId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: clientId, projectId, taskId } = await params;
  await connectDB();

  const doc = await TaskModel.findByIdAndDelete(taskId).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete all subtasks of this task
  await TaskModel.deleteMany({ parentTaskId: taskId });

  await recordActivity({
    clientId,
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "task.deleted",
    metadata: { projectId, title: doc.title },
  });

  return NextResponse.json({ success: true });
}
