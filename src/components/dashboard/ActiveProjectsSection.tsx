import ClientsTimeline from "@/components/ui/ClientsTimeline";
import type { Client, Project } from "@/types";

interface Props {
  clients: Client[];
  projectsByClient: Record<string, Project[]>;
}

export default function ActiveProjectsSection({ clients, projectsByClient }: Props) {
  // Only render if there are active projects
  const hasProjects = Object.values(projectsByClient).some((ps) => ps.length > 0);
  if (!hasProjects) return null;

  return (
    <ClientsTimeline
      clients={clients}
      projectsByClient={projectsByClient}
      pxPerDay={12}
      title="Active and upcoming projects"
      collapsible={false}
    />
  );
}
