import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { TaskModel } from "@/lib/models/Task";
import { ProjectModel } from "@/lib/models/Project";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string; taskId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const body = await req.json();
  const { title, description, assignees, completionDate, completed } = body;

  if (title !== undefined && !title?.trim()) {
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
  }

  await connectDB();

  const update: Record<string, unknown> = {};
  if (title !== undefined) update.title = title.trim();
  if (description !== undefined) update.description = description?.trim() || null;
  if (assignees !== undefined) update.assignees = assignees;
  if (completionDate !== undefined) update.completionDate = completionDate || null;

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

  const { taskId } = await params;
  await connectDB();

  const doc = await TaskModel.findByIdAndDelete(taskId).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete all subtasks of this task
  await TaskModel.deleteMany({ parentTaskId: taskId });

  return NextResponse.json({ success: true });
}
