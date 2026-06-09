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
    <section className="space-y-3">
      <h2 className="typo-section-title" style={{ color: "var(--text-primary)" }}>
        Active and upcoming projects
      </h2>
      {/* The gantt's own root is already a rounded, bordered surface box — give
          it a light elevation so it lifts off the page (no extra panel). The
          wrapper's rounding matches so the shadow follows the rounded corners. */}
      <div className="rounded-xl shadow-subtle">
        <ClientsTimeline
          clients={clients}
          projectsByClient={projectsByClient}
          pxPerDay={12}
          showHeader={false}
          collapsible={false}
          defaultSectionsCollapsed
        />
      </div>
    </section>
  );
}
