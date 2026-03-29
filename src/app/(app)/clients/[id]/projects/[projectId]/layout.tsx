import { getClientById, getProjectById, getProjectLabels, getServices } from "@/lib/data";
import { notFound } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import ProjectTertiaryNav from "@/components/layout/ProjectTertiaryNav";
import EditProjectButton from "@/components/ui/EditProjectButton";
import CompleteProjectButton from "@/components/ui/CompleteProjectButton";

export const dynamic = "force-dynamic";

export default async function ProjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id, projectId } = await params;
  const [client, project, services, labels] = await Promise.all([
    getClientById(id),
    getProjectById(projectId),
    getServices(),
    getProjectLabels(),
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
          <>
            <CompleteProjectButton
              projectId={projectId}
              clientId={id}
              isCompleted={project.status === "completed"}
            />
            <EditProjectButton project={project} clientId={id} services={services} labels={labels} />
          </>
        }
        tertiaryNav={<ProjectTertiaryNav basePath={basePath} />}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-7">{children}</div>
    </div>
  );
}
