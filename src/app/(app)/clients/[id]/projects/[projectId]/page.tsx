import { getProjectById, getServices, getProjectLabels } from "@/lib/data";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import StatusBadge from "@/components/ui/StatusBadge";
import EditProjectButton from "@/components/ui/EditProjectButton";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id, projectId } = await params;
  const [project, services, labels, session] = await Promise.all([
    getProjectById(projectId),
    getServices(),
    getProjectLabels(),
    auth(),
  ]);
  if (!project) notFound();

  const details: [string, string | undefined][] = [
    ["Status", undefined],
    ["Service", project.service],
    ["Kicked off", project.kickedOffAt ? fmtDate(project.kickedOffAt) : "Upcoming"],
    ["Completed", project.completedDate ? fmtDate(project.completedDate) : undefined],
    [
      "Sold price",
      project.soldPrice != null
        ? `€${project.soldPrice.toLocaleString()}`
        : undefined,
    ],
    ["Created", project.createdAt ? fmtDate(project.createdAt) : undefined],
  ];

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            Project details
          </h2>
          <EditProjectButton project={project} clientId={id} services={services} labels={labels} isAdmin={!!session?.user?.isAdmin} />
        </div>

        {project.description && (
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
            {project.description}
          </p>
        )}

        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div>
            <dt className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>
              Status
            </dt>
            <dd>
              <StatusBadge status={project.status} />
            </dd>
          </div>
          {details
            .filter(([label]) => label !== "Status")
            .filter(([label, value]) => label === "Kicked off" || value !== undefined)
            .map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>
                  {label}
                </dt>
                <dd
                  className="font-medium"
                  style={{ color: label === "Kicked off" && !project.kickedOffAt ? "var(--text-muted)" : "var(--text-primary)" }}
                >
                  {value}
                </dd>
              </div>
            ))}
        </dl>
      </div>
    </div>
  );
}
