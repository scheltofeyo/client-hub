import { getClientById, getProjectById } from "@/lib/data";
import { notFound } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import ProjectTertiaryNav from "@/components/layout/ProjectTertiaryNav";
import CompleteProjectButton from "@/components/ui/CompleteProjectButton";
import KickOffProjectButton from "@/components/ui/KickOffProjectButton";

export const dynamic = "force-dynamic";

export default async function ProjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id, projectId } = await params;
  const [client, project] = await Promise.all([
    getClientById(id),
    getProjectById(projectId),
  ]);

  if (!client || !project) notFound();

  const basePath = `/clients/${id}/projects/${projectId}`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { label: "Clients", href: "/clients" },
          { label: client.company, href: `/clients/${id}` },
          { label: "Projects", href: `/clients/${id}?tab=projects` },
          { label: "..." },
        ]}
        title={project.title}
        actions={
          project.kickedOffAt ? (
            <CompleteProjectButton
              projectId={projectId}
              clientId={id}
              isCompleted={project.status === "completed"}
            />
          ) : (
            <KickOffProjectButton project={project} clientId={id} />
          )
        }
        tertiaryNav={<ProjectTertiaryNav basePath={basePath} />}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-7">{children}</div>
    </div>
  );
}
