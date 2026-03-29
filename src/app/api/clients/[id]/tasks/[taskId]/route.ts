import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { TaskModel } from "@/lib/models/Task";
import { ProjectModel } from "@/lib/models/Project";
import { LogModel } from "@/lib/models/Log";
import { recordActivity } from "@/lib/activity";

async function recalcProjectStatus(projectId: string) {
  const allTasks = await TaskModel.find({ projectId }).lean();
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
    const existing = await ProjectModel.findById(projectId).lean();
    if (!existing?.completedDate) {
      projectUpdate.completedDate = new Date().toISOString().split("T")[0];
    }
  } else {
    projectUpdate.completedDate = null;
  }
  await ProjectModel.findByIdAndUpdate(projectId, { $set: projectUpdate });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: clientId, taskId } = await params;
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

  if ((completed === true || completed === false) && doc.projectId) {
    await recalcProjectStatus(doc.projectId);
  }

  // Sync log follow-up status when this is a derived follow-up task
  if ((completed === true || completed === false) && doc.logId) {
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

  if (completed === true) {
    await recordActivity({
      clientId,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "task.completed",
      metadata: { projectId: doc.projectId, title: doc.title },
    });
  }

  return NextResponse.json({
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
    createdById: doc.createdById,
    createdByName: doc.createdByName,
    createdAt: doc.createdAt?.toISOString(),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: clientId, taskId } = await params;
  await connectDB();

  const doc = await TaskModel.findByIdAndDelete(taskId).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await TaskModel.deleteMany({ parentTaskId: taskId });

  if (doc.projectId) {
    await recalcProjectStatus(doc.projectId);
  }

  await recordActivity({
    clientId,
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "task.deleted",
    metadata: { projectId: doc.projectId, title: doc.title },
  });

  return NextResponse.json({ success: true });
}
