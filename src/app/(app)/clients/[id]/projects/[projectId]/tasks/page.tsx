import { getTasksByProjectId } from "@/lib/data";
import { auth } from "@/auth";
import TasksTab from "@/components/ui/TasksTab";

export const dynamic = "force-dynamic";

export default async function ProjectTasksPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id, projectId } = await params;
  const [tasks, session] = await Promise.all([getTasksByProjectId(projectId), auth()]);

  return (
    <TasksTab
      projectId={projectId}
      clientId={id}
      initialTasks={tasks}
      currentUserId={session?.user?.id ?? ""}
    />
  );
}
