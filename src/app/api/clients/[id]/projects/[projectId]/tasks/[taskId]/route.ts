import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission, hasPermissionOrIsCreator } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { TaskModel } from "@/lib/models/Task";
import { ProjectModel } from "@/lib/models/Project";
import { recordActivity } from "@/lib/activity";
import { updateTask } from "@/lib/tasks";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string; taskId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const body = await req.json();

  const updated = await updateTask(session, taskId, {
    title: body.title,
    description: body.description,
    assignees: body.assignees,
    completionDate: body.completionDate,
    completed: body.completed,
    parentTaskId: body.parentTaskId,
  });
  if (!updated.ok) {
    return NextResponse.json({ error: updated.error }, { status: updated.status });
  }

  return NextResponse.json(updated.task);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string; taskId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: clientId, projectId, taskId } = await params;
  await connectDB();

  const existing = await TaskModel.findById(taskId).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canDeleteAny = hasPermission(session, "tasks.deleteAny");
  const canDeleteOwn = hasPermissionOrIsCreator(session, "tasks.deleteOwn", existing.createdById ?? "");
  if (!canDeleteAny && !canDeleteOwn) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await TaskModel.findByIdAndDelete(taskId).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete all subtasks of this task
  await TaskModel.deleteMany({ parentTaskId: taskId });

  const parentStatus = (await ProjectModel.findById(projectId, { status: 1 }).lean())?.status;
  if (parentStatus !== "draft") {
    await recordActivity({
      clientId,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "task.deleted",
      metadata: { projectId, title: doc.title },
    });
  }

  return NextResponse.json({ success: true });
}
