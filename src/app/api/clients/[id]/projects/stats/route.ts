import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProjectsByClientId, getClientProjectsWithTaskStats, getTasksByProjectIds } from "@/lib/data";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clientId } = await params;
  const currentUserId = session.user.id ?? "";

  const projects = await getProjectsByClientId(clientId);
  if (projects.length === 0) {
    return NextResponse.json({ projects: [], perProject: {}, overduePerProject: {}, openTaskCounts: {} });
  }

  const projectIds = projects.map((p) => p.id);
  const [{ perProject, overduePerProject }, projectTasksMap] = await Promise.all([
    getClientProjectsWithTaskStats(projectIds, currentUserId),
    getTasksByProjectIds(projectIds),
  ]);

  const openTaskCounts: Record<string, number> = {};
  for (const p of projects) {
    const tasks = projectTasksMap.get(p.id) ?? [];
    openTaskCounts[p.id] = tasks.filter((t) => !t.completedAt && !t.parentTaskId).length;
  }

  // Convert Maps to plain objects for JSON serialization
  const perProjectObj: Record<string, { total: number; completed: number }> = {};
  for (const [k, v] of perProject) perProjectObj[k] = v;

  const overduePerProjectObj: Record<string, number> = {};
  for (const [k, v] of overduePerProject) overduePerProjectObj[k] = v;

  return NextResponse.json({
    projects,
    perProject: perProjectObj,
    overduePerProject: overduePerProjectObj,
    openTaskCounts,
  });
}
