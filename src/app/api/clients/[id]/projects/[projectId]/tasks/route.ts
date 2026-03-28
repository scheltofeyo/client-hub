import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { TaskModel } from "@/lib/models/Task";
import { ProjectModel } from "@/lib/models/Project";
import { recordActivity } from "@/lib/activity";
import { UserModel } from "@/lib/models/User";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  await connectDB();

  const docs = await TaskModel.find({ projectId }).sort({ createdAt: 1 }).lean();

  // Live lookup of current user images for all assignees
  const assigneeIds = [...new Set(docs.flatMap((d) => (d.assignees ?? []).map((a) => a.userId)))];
  const assigneeUsers = assigneeIds.length
    ? await UserModel.find({ _id: { $in: assigneeIds } }, { _id: 1, image: 1 }).lean()
    : [];
  const assigneeImgMap = Object.fromEntries(assigneeUsers.map((u) => [u._id.toString(), u.image ?? null]));

  return NextResponse.json(
    docs.map((doc) => ({
      id: doc._id.toString(),
      projectId: doc.projectId,
      parentTaskId: doc.parentTaskId ?? undefined,
      title: doc.title,
      description: doc.description ?? undefined,
      assignees: (doc.assignees ?? []).map((a) => ({
        userId: a.userId,
        name: a.name,
        image: assigneeImgMap[a.userId] ?? null,
      })),
      completionDate: doc.completionDate ?? undefined,
      completedAt: doc.completedAt ?? undefined,
      completedById: doc.completedById ?? undefined,
      completedByName: doc.completedByName ?? undefined,
      createdById: doc.createdById,
      createdByName: doc.createdByName,
      createdAt: doc.createdAt?.toISOString(),
    }))
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: clientId, projectId } = await params;
  const body = await req.json();
  const { title, description, assignees, completionDate, parentTaskId } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  await connectDB();

  const doc = await TaskModel.create({
    projectId,
    parentTaskId: parentTaskId || undefined,
    title: title.trim(),
    description: description?.trim() || undefined,
    assignees: assignees ?? [],
    completionDate: completionDate || undefined,
    createdById: session.user.id,
    createdByName: session.user.name ?? "Unknown",
  });

  // Recalculate project status — new task is always incomplete
  const allTasks = await TaskModel.find({ projectId }).lean();
  const completedCount = allTasks.filter((t) => !!t.completedAt).length;
  const total = allTasks.length;
  const projectStatus =
    total === 0 || completedCount === 0
      ? "not_started"
      : completedCount === total
      ? "completed"
      : "in_progress";
  // Adding a task always moves project out of completed — clear completedDate
  const projectUpdate: Record<string, unknown> = { status: projectStatus };
  if (projectStatus !== "completed") projectUpdate.completedDate = null;
  await ProjectModel.findByIdAndUpdate(projectId, { $set: projectUpdate });

  await recordActivity({
    clientId,
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "task.created",
    metadata: { projectId, title: doc.title },
  });

  return NextResponse.json(
    {
      id: doc._id.toString(),
      projectId: doc.projectId,
      parentTaskId: doc.parentTaskId ?? undefined,
      title: doc.title,
      description: doc.description ?? undefined,
      assignees: doc.assignees ?? [],
      completionDate: doc.completionDate ?? undefined,
      completedAt: doc.completedAt ?? undefined,
      createdById: doc.createdById,
      createdByName: doc.createdByName,
      createdAt: doc.createdAt?.toISOString(),
    },
    { status: 201 }
  );
}
