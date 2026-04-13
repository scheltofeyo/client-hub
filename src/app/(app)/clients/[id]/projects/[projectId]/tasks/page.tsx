import { getTasksByProjectId, getProjectById } from "@/lib/data";
import { auth } from "@/auth";
import TasksTab from "@/components/ui/TasksTab";

export const dynamic = "force-dynamic";

export default async function ProjectTasksPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id, projectId } = await params;
  const [tasks, project, session] = await Promise.all([
    getTasksByProjectId(projectId),
    getProjectById(projectId),
    auth(),
  ]);

  return (
    <TasksTab
      projectId={projectId}
      clientId={id}
      initialTasks={tasks}
      currentUserId={session?.user?.id ?? ""}
      project={project}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
