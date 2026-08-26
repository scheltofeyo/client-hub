import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { TaskModel } from "@/lib/models/Task";
import { createTask } from "@/lib/tasks";

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
      createdVia: doc.createdVia ?? undefined,
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

  // Fields are listed rather than spread: this route is client-scoped, and a
  // `projectId` riding in on the body would silently make it a project task.
  const created = await createTask(session, {
    clientId,
    title: body.title,
    description: body.description,
    assignees: body.assignees,
    completionDate: body.completionDate,
    parentTaskId: body.parentTaskId,
  });
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }

  return NextResponse.json(created.task, { status: 201 });
}
