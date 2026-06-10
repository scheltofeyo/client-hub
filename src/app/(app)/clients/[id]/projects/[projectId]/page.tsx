import Link from "next/link";
import { getClientById, getProjectById, getServices, getProjectLabels, getPlanSummaryById } from "@/lib/data";
import { auth } from "@/auth";
import { hasPermission, hasPermissionOrIsLead } from "@/lib/auth-helpers";
import { notFound } from "next/navigation";
import { EyeOff } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import EditProjectButton from "@/components/ui/EditProjectButton";
import RichTextDisplay from "@/components/ui/RichTextDisplay";
import UserAvatar from "@/components/ui/UserAvatar";
import { SECTION_KEYS } from "@/components/ui/editor-panel/draft-types";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SECTION_LABELS: Record<(typeof SECTION_KEYS)[number], string> = {
  why: "Why",
  what: "What",
  how: "How",
  activities: "Activities",
  deliverables: "Deliverables",
};

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id, projectId } = await params;
  const [client, project, services, labels, session] = await Promise.all([
    getClientById(id),
    getProjectById(projectId),
    getServices(),
    getProjectLabels(),
    auth(),
  ]);
  if (!project) notFound();

  const plan = project.planId ? await getPlanSummaryById(project.planId) : null;

  const canEditProject = hasPermissionOrIsLead(session, "projects.edit", client?.leads ?? []);

  const hiddenSections = project.hiddenSections ?? [];
  const sections = SECTION_KEYS.map((key) => ({
    key,
    label: SECTION_LABELS[key],
    html: project[key],
    hidden: hiddenSections.includes(key),
  })).filter((s) => s.html);

  const scheduledRange =
    project.scheduledStartDate && project.scheduledEndDate
      ? `${fmtDate(project.scheduledStartDate)} → ${fmtDate(project.scheduledEndDate)}`
      : project.scheduledStartDate
        ? `From ${fmtDate(project.scheduledStartDate)}`
        : project.scheduledEndDate
          ? `Until ${fmtDate(project.scheduledEndDate)}`
          : undefined;

  const details: [string, string | undefined][] = [
    ["Service", project.service],
    ["Label", project.label],
    [
      "Sold price",
      project.soldPrice != null
        ? `€${project.soldPrice.toLocaleString()}`
        : undefined,
    ],
    ...(project.kickedOffAt
      ? ([
          ["Kicked off", fmtDate(project.kickedOffAt)],
          ["Expected delivery", project.deliveryDate ? fmtDate(project.deliveryDate) : undefined],
        ] as [string, string | undefined][])
      : ([
          ["Kicked off", "Upcoming"],
          ["Scheduled", scheduledRange],
        ] as [string, string | undefined][])),
    ["Completed", project.completedDate ? fmtDate(project.completedDate) : undefined],
    ["Created", project.createdAt ? fmtDate(project.createdAt) : undefined],
  ];

  const members = project.members ?? [];

  return (
    <div className="max-w-4xl grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div className="space-y-8 min-w-0">
        <div className="flex items-center justify-between">
          <h2
            className="typo-section-header"
            style={{ color: "var(--text-muted)" }}
          >
            Project details
          </h2>
          {canEditProject && (
            <EditProjectButton project={project} clientId={id} services={services} labels={labels} canDelete={hasPermission(session, "projects.delete")} canReset={hasPermission(session, "projects.resetToUpcoming")} />
          )}
        </div>

        {project.description && (
          <RichTextDisplay
            html={project.description}
            className="text-sm leading-relaxed"
            style={{ color: "var(--text-primary)" }}
          />
        )}

        {sections.map((section) => (
          <section key={section.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3
                className="typo-section-header"
                style={{ color: "var(--text-muted)" }}
              >
                {section.label}
              </h3>
              {section.hidden && (
                <span
                  className="typo-tag inline-flex items-center gap-1"
                  style={{ color: "var(--text-muted)" }}
                  title="This section is hidden from the client-facing proposal overview"
                >
                  <EyeOff size={12} />
                  Hidden from client
                </span>
              )}
            </div>
            <RichTextDisplay
              html={section.html!}
              className="text-sm leading-relaxed"
              style={{ color: "var(--text-primary)" }}
            />
          </section>
        ))}

        {!project.description && sections.length === 0 && (
          <p className="typo-body-sm" style={{ color: "var(--text-muted)" }}>
            No project description yet.
          </p>
        )}
      </div>

      <aside className="space-y-8">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>
              Status
            </dt>
            <dd>
              <StatusBadge status={project.status} />
            </dd>
          </div>
          {details
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

        {members.length > 0 && (
          <div>
            <h3
              className="typo-section-header mb-3"
              style={{ color: "var(--text-muted)" }}
            >
              Team
            </h3>
            <ul className="space-y-2">
              {members.map((member) => (
                <li key={member.userId} className="flex items-center gap-2">
                  <UserAvatar name={member.name} image={member.image} size={24} />
                  <span className="typo-body-sm" style={{ color: "var(--text-primary)" }}>
                    {member.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {plan && (
          <div>
            <h3
              className="typo-section-header mb-1.5"
              style={{ color: "var(--text-muted)" }}
            >
              From proposal
            </h3>
            <Link
              href={
                plan.status === "finalized"
                  ? `/proposal/${plan.shareCode}/pdf`
                  : `/clients/${id}/projects/plans/${plan.id}`
              }
              className="btn-link text-sm"
            >
              {plan.title}
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
