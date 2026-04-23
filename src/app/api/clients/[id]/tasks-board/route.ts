import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { TaskModel } from "@/lib/models/Task";
import { ProjectModel } from "@/lib/models/Project";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: clientId } = await params;
  await connectDB();

  const [projects, tasks] = await Promise.all([
    ProjectModel.find(
      { clientId },
      { title: 1, status: 1, kickedOffAt: 1 }
    ).sort({ createdAt: -1 }).lean(),
    TaskModel.find({ clientId }).sort({ order: 1, createdAt: 1 }).lean(),
  ]);

  const serializeTask = (doc: typeof tasks[number]) => ({
    id: doc._id.toString(),
    clientId: doc.clientId,
    projectId: doc.projectId ?? undefined,
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
  });

  const generalTasks: ReturnType<typeof serializeTask>[] = [];
  const projectTasks: Record<string, ReturnType<typeof serializeTask>[]> = {};
  for (const doc of tasks) {
    const serialized = serializeTask(doc);
    if (doc.projectId) {
      (projectTasks[doc.projectId] ??= []).push(serialized);
    } else {
      generalTasks.push(serialized);
    }
  }

  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p._id.toString(),
      title: p.title,
      status: p.status,
      kickedOffAt: p.kickedOffAt ?? null,
    })),
    generalTasks,
    projectTasks,
  });
}
