import { getClientById, getProjectById, getServices } from "@/lib/data";
import { notFound } from "next/navigation";
import Link from "next/link";
import ProjectTertiaryNav from "@/components/layout/ProjectTertiaryNav";
import EditProjectButton from "@/components/ui/EditProjectButton";

export const dynamic = "force-dynamic";

export default async function ProjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id, projectId } = await params;
  const [client, project, services] = await Promise.all([
    getClientById(id),
    getProjectById(projectId),
    getServices(),
  ]);

  if (!client || !project) notFound();

  const basePath = `/clients/${id}/projects/${projectId}`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="px-7 pt-6 pb-5 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <nav className="flex items-center gap-1.5 mb-2">
          <Link href="/clients" className="text-xs breadcrumb-link">
            Clients
          </Link>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>/</span>
          <Link href={`/clients/${id}`} className="text-xs breadcrumb-link">
            {client.company}
          </Link>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>/</span>
          <Link href={`/clients/${id}?tab=projects`} className="text-xs breadcrumb-link">
            Projects
          </Link>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>/</span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>...</span>
        </nav>

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {project.title}
          </h1>
          <EditProjectButton project={project} clientId={id} services={services} />
        </div>
      </div>

      {/* Tertiary nav */}
      <ProjectTertiaryNav basePath={basePath} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-7">{children}</div>
    </div>
  );
}
