import { getSessionsByProjectId } from "@/lib/data";
import SessionsTab from "@/components/ui/SessionsTab";

export const dynamic = "force-dynamic";

export default async function ProjectSessionsPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id, projectId } = await params;
  const sessions = await getSessionsByProjectId(projectId);

  return (
    <SessionsTab
      clientId={id}
      projectId={projectId}
      initialSessions={sessions}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
