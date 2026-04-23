import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { TaskModel } from "@/lib/models/Task";
import { recordActivity } from "@/lib/activity";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: clientId } = await params;
  await connectDB();

  const docs = await TaskModel.find({ clientId, projectId: { $exists: false } })
    .sort({ order: 1, createdAt: 1 })
    .lean();

  return NextResponse.json(
    docs.map((doc) => ({
      id: doc._id.toString(),
      clientId: doc.clientId,
      parentTaskId: doc.parentTaskId ?? undefined,
      logId: doc.logId ?? undefined,
      title: doc.title,
      description: doc.description ?? undefined,
      assignees: (doc.assignees ?? []).map((a) => ({
        userId: a.userId,
        name: a.name,
        image: a.image ?? null,
      })),
      completionDate: doc.completionDate ?? undefined,
      completedAt: doc.completedAt ?? undefined,
      completedById: doc.completedById ?? undefined,
      completedByName: doc.completedByName ?? undefined,
      order: doc.order ?? 0,
      createdById: doc.createdById,
      createdByName: doc.createdByName,
      createdAt: doc.createdAt?.toISOString(),
    }))
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "tasks.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: clientId } = await params;
  const body = await req.json();
  const { title, description, assignees, completionDate, parentTaskId } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  await connectDB();

  // Inherit assignees from parent task; auto-increment order for top-level tasks
  let taskAssignees = assignees ?? [];
  let taskOrder = 0;
  if (parentTaskId) {
    const parent = await TaskModel.findById(parentTaskId).lean();
    taskAssignees = parent?.assignees ?? [];
  } else {
    const last = await TaskModel.findOne({ clientId, projectId: { $exists: false }, parentTaskId: null }).sort({ order: -1 }).lean();
    taskOrder = last ? (last.order ?? 0) + 1 : 0;
  }

  const doc = await TaskModel.create({
    clientId,
    parentTaskId: parentTaskId || undefined,
    title: title.trim(),
    description: description?.trim() || undefined,
    assignees: taskAssignees,
    completionDate: completionDate || undefined,
    order: taskOrder,
    createdById: session.user.id,
    createdByName: session.user.name ?? "Unknown",
  });

  await recordActivity({
    clientId,
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "task.created",
    metadata: { title: doc.title },
  });

  return NextResponse.json(
    {
      id: doc._id.toString(),
      clientId: doc.clientId,
      parentTaskId: doc.parentTaskId ?? undefined,
      title: doc.title,
      description: doc.description ?? undefined,
      assignees: doc.assignees ?? [],
      completionDate: doc.completionDate ?? undefined,
      completedAt: doc.completedAt ?? undefined,
      order: doc.order ?? 0,
      createdById: doc.createdById,
      createdByName: doc.createdByName,
      createdAt: doc.createdAt?.toISOString(),
    },
    { status: 201 }
  );
}
