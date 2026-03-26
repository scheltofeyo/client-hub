import { getProjectById } from "@/lib/data";
import { notFound } from "next/navigation";
import StatusBadge from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProjectById(projectId);
  if (!project) notFound();

  const details: [string, string | undefined][] = [
    ["Status", undefined],
    ["Service", project.service],
    ["Delivery date", project.deliveryDate],
    [
      "Sold price",
      project.soldPrice != null
        ? `€${project.soldPrice.toLocaleString()}`
        : undefined,
    ],
    ["Created", project.createdAt],
  ];

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-5">
        <h2
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Project details
        </h2>

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
            .filter(([, value]) => value !== undefined)
            .map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>
                  {label}
                </dt>
                <dd className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {value}
                </dd>
              </div>
            ))}
        </dl>
      </div>
    </div>
  );
}
