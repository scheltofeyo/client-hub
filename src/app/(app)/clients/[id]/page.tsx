import { getClientById, getProjectsByClientId, getArchetypes, getLogsByClientId, getLogSignals, getSheetsByClientId, getClientProjectsWithTaskStats, getLastActivityByClientId, getServices } from "@/lib/data";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { Suspense } from "react";

export const dynamic = "force-dynamic";
import StatusBadge from "@/components/ui/StatusBadge";
import EditClientButton from "@/components/ui/EditClientButton";
import DeleteClientButton from "@/components/ui/DeleteClientButton";
import ContactsSection from "@/components/ui/ContactsSection";
import LeadsSection from "@/components/ui/LeadsSection";
import AddProjectButton from "@/components/ui/AddProjectButton";
import LogbookTab from "@/components/ui/LogbookTab";
import OverviewTab from "@/components/ui/OverviewTab";
import SheetsTab, { ManageSheetsButton } from "@/components/ui/SheetsTab";
import ActivityTab from "@/components/ui/ActivityTab";
import AboutTertiaryNav from "@/components/layout/AboutTertiaryNav";
import PageHeader from "@/components/layout/PageHeader";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Client, Log, LogSignal, Project, Service, Sheet } from "@/types";
import { fmtDate } from "@/lib/utils";

const tabs = ["Dashboard", "Projects", "Sheets", "Logbook", "Activity", "Settings"] as const;
type Tab = (typeof tabs)[number];

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; section?: string }>;
}) {
  const { id } = await params;
  const { tab, section } = await searchParams;
  const [client, projects, session, archetypes, logs, logSignals, sheets, services] = await Promise.all([
    getClientById(id),
    getProjectsByClientId(id),
    auth(),
    getArchetypes(),
    getLogsByClientId(id),
    getLogSignals(),
    getSheetsByClientId(id),
    getServices(),
  ]);

  if (!client) notFound();

  const activeTab: Tab =
    tabs.find((t) => t.toLowerCase() === tab?.toLowerCase()) ?? "Dashboard";

  const isAdmin = session?.user?.isAdmin ?? false;
  const currentUserId = session?.user?.id ?? "";

  // Check if current user is a lead for this client
  const isLead = (client.leads ?? []).some((l) => l.userId === currentUserId);
  const canEdit = isAdmin || isLead;

  // Fetch all users for admin lead assignment
  let allUsers: { id: string; name: string; email: string; image: string | null }[] = [];
  if (isAdmin) {
    await connectDB();
    const docs = await UserModel.find().sort({ name: 1 }).lean();
    allUsers = docs.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      image: u.image ?? null,
    }));
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { label: "Clients", href: "/clients" },
          { label: client.company, href: `/clients/${id}` },
          { label: "..." },
        ]}
        title={activeTab}
        actions={
          activeTab === "Settings" && canEdit ? (
            <>
              <EditClientButton client={client} archetypes={archetypes} />
              {isAdmin && <DeleteClientButton id={client.id} company={client.company} />}
            </>
          ) : activeTab === "Projects" && canEdit ? (
            <AddProjectButton clientId={client.id} />
          ) : activeTab === "Sheets" ? (
            <ManageSheetsButton clientId={id} initialSheets={sheets} />
          ) : undefined
        }
        tertiaryNav={
          activeTab === "Settings" ? (
            <Suspense fallback={null}>
              <AboutTertiaryNav clientId={id} />
            </Suspense>
          ) : undefined
        }
      />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-7">
        {activeTab === "Dashboard" && (
          <DashboardTabWrapper
            clientId={id}
            client={client}
            projects={projects}
            logs={logs}
            logSignals={logSignals}
            sheets={sheets}
            services={services}
            currentUserId={currentUserId}
            currentUserName={session?.user?.name ?? ""}
            isAdmin={isAdmin}
          />
        )}
        {activeTab === "Settings" && (
          <AboutContent
            client={client}
            isAdmin={isAdmin}
            allUsers={allUsers}
            section={section ?? "about"}
          />
        )}
        {activeTab === "Projects" && (
          <ProjectsTabWrapper clientId={id} projects={projects} currentUserId={currentUserId} />
        )}
        {activeTab === "Sheets" && (
          <SheetsTab clientId={id} initialSheets={sheets} />
        )}
        {activeTab === "Logbook" && (
          <LogbookTab
            clientId={id}
            clientName={client.company}
            initialLogs={logs}
            signals={logSignals}
            contacts={client.contacts ?? []}
            currentUserId={currentUserId}
            currentUserName={session?.user?.name ?? ""}
            isAdmin={isAdmin}
          />
        )}
        {activeTab === "Activity" && (
          <ActivityTab clientId={id} />
        )}
      </div>
    </div>
  );
}

// ── Tab panels ──────────────────────────────────────────────

function AboutContent({
  client,
  isAdmin,
  allUsers,
  section,
}: {
  client: Client;
  isAdmin: boolean;
  allUsers: { id: string; name: string; email: string; image: string | null }[];
  section: string;
}) {
  if (section === "leads") {
    return (
      <div className="max-w-2xl space-y-8">
        <LeadsSection
          clientId={client.id}
          initialLeads={client.leads ?? []}
          allUsers={allUsers}
          isAdmin={isAdmin}
        />
      </div>
    );
  }

  if (section === "contacts") {
    return (
      <div className="max-w-2xl space-y-8">
        <ContactsSection
          clientId={client.id}
          initialContacts={client.contacts ?? []}
        />
      </div>
    );
  }

  return <CompanySection client={client} />;
}

function CompanySection({ client }: { client: Client }) {
  const platformLabel =
    client.platform === "summ_core" ? "SUMM Core" :
    client.platform === "summ_suite" ? "SUMM Suite" :
    undefined;

  const details: [string, string | undefined][] = [
    ["Website", client.website],
    ["Employees", client.employees != null ? client.employees.toLocaleString() : undefined],
    ["Platform", platformLabel],
    ["Archetype", client.archetype],
    ["Client since", fmtDate(client.clientSince ?? client.createdAt)],
    ["Projects", String(client.projects?.length ?? 0)],
  ];
  const visibleDetails = details.filter(([, v]) => v !== undefined);

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Company
        </h2>

        <div className="space-y-1.5">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {client.company}
          </p>
          {client.description && (
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
              {client.description}
            </p>
          )}
        </div>

        {visibleDetails.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            {visibleDetails.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</dt>
                <dd className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {label === "Website" && value ? (
                    <a
                      href={value.startsWith("http") ? value : `https://${value}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 btn-link"
                    >
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
            {client.status && (
              <div>
                <dt className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>Status</dt>
                <dd><StatusBadge status={client.status} /></dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}

async function ProjectsTabWrapper({
  clientId,
  projects,
  currentUserId,
}: {
  clientId: string;
  projects: Project[];
  currentUserId: string;
}) {
  if (projects.length === 0)
    return <EmptyTab message="No projects yet. Click 'Add Project' to get started." />;

  const { perProject, overduePerProject, myOpenTasks, overdueCount } = await getClientProjectsWithTaskStats(
    projects.map((p) => p.id),
    currentUserId
  );
  return (
    <ProjectsTab
      clientId={clientId}
      projects={projects}
      perProject={perProject}
      overduePerProject={overduePerProject}
      myOpenTasks={myOpenTasks}
      overdueCount={overdueCount}
    />
  );
}

function ProjectsTab({
  clientId,
  projects,
  perProject,
  overduePerProject,
  myOpenTasks,
  overdueCount,
}: {
  clientId: string;
  projects: Project[];
  perProject: Map<string, { total: number; completed: number }>;
  overduePerProject: Map<string, number>;
  myOpenTasks: number;
  overdueCount: number;
}) {
  const completedProjects = projects.filter((p) => p.status === "completed").length;
  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === "in_progress" || p.status === "not_started").length;
  const projectPct = totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : null;

  const inProgress = projects.filter((p) => p.status === "in_progress");
  const notStarted = projects.filter((p) => p.status === "not_started");
  const completed = projects.filter((p) => p.status === "completed");

  return (
    <div className="space-y-8">
      {/* Statistics bar */}
      <div className="grid grid-cols-3 gap-4 max-w-2xl">
        <div className="rounded-xl border p-4 space-y-1.5" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Active projects</p>
          <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {activeProjects}
          </p>
          {projectPct !== null && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div className="h-full rounded-full" style={{ width: `${projectPct}%`, background: "var(--primary)" }} />
              </div>
              <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{completedProjects}/{totalProjects}</span>
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4 space-y-1.5" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>My open tasks</p>
          <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {myOpenTasks}
          </p>
        </div>

        <div className="rounded-xl border p-4 space-y-1.5" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Overdue tasks</p>
          <p
            className="text-2xl font-semibold tabular-nums"
            style={{ color: overdueCount > 0 ? "#dc2626" : "var(--text-primary)" }}
          >
            {overdueCount}
          </p>
        </div>
      </div>

      {inProgress.length > 0 && (
        <ProjectSection title="Currently" projects={inProgress} clientId={clientId} perProject={perProject} overduePerProject={overduePerProject} />
      )}

      {notStarted.length > 0 && (
        <ProjectSection title="Upcoming" projects={notStarted} clientId={clientId} perProject={perProject} overduePerProject={overduePerProject} />
      )}

      {completed.length > 0 && (
        <CompletedSection projects={completed} clientId={clientId} />
      )}
    </div>
  );
}

function ProjectSection({
  title,
  projects,
  clientId,
  perProject,
  overduePerProject,
}: {
  title: string;
  projects: Project[];
  clientId: string;
  perProject: Map<string, { total: number; completed: number }>;
  overduePerProject: Map<string, number>;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {title}
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} clientId={clientId} stats={perProject.get(p.id)} overdue={overduePerProject.get(p.id) ?? 0} />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  clientId,
  stats,
  overdue = 0,
}: {
  project: Project;
  clientId: string;
  stats?: { total: number; completed: number };
  overdue?: number;
}) {
  const openTasks = stats ? stats.total - stats.completed : null;
  const pct = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : null;

  return (
    <Link
      href={`/clients/${clientId}/projects/${project.id}/tasks`}
      className="block relative rounded-xl border p-4 space-y-2.5 bg-white dark:bg-[var(--bg-sidebar)] transition-colors project-card-hover"
      style={{ boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm leading-snug" style={{ color: "var(--text-primary)" }}>
          {project.title}
        </p>
        <StatusBadge status={project.status} />
      </div>

      {project.description && (
        <p className="text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
          {project.description}
        </p>
      )}

      {openTasks !== null && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {openTasks} open {openTasks === 1 ? "task" : "tasks"}
          {overdue > 0 && (
            <span style={{ color: "#dc2626" }}> · {overdue} overdue</span>
          )}
        </p>
      )}

      {stats && stats.total > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--primary)" }} />
          </div>
          <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
            {stats.completed}/{stats.total}
          </span>
        </div>
      )}

      {project.createdAt && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Created {fmtDate(project.createdAt)}</p>
      )}
    </Link>
  );
}

function CompletedSection({
  projects,
  clientId,
}: {
  projects: Project[];
  clientId: string;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        Completed
      </h3>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {/* Header */}
        <div className="grid grid-cols-4 px-4 py-2.5 text-xs font-medium" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-muted)" }}>
          <span>Project</span>
          <span>Created</span>
          <span>Completed</span>
          <span>Status</span>
        </div>
        {projects.map((project, idx) => (
          <Link
            key={project.id}
            href={`/clients/${clientId}/projects/${project.id}/tasks`}
            className="grid grid-cols-4 items-center px-4 py-3 text-sm hover:bg-[var(--bg-hover)] transition-colors"
            style={idx < projects.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
          >
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>{project.title}</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(project.createdAt)}</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(project.completedDate)}</span>
            <span><StatusBadge status={project.status} /></span>
          </Link>
        ))}
      </div>
    </div>
  );
}

async function DashboardTabWrapper({
  clientId,
  client,
  projects,
  logs,
  logSignals,
  sheets,
  services,
  currentUserId,
  currentUserName,
  isAdmin,
}: {
  clientId: string;
  client: Client;
  projects: Project[];
  logs: Log[];
  logSignals: LogSignal[];
  sheets: Sheet[];
  services: Service[];
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
}) {
  const [taskStats, lastActivity] = await Promise.all([
    getClientProjectsWithTaskStats(projects.map((p) => p.id), currentUserId),
    getLastActivityByClientId(clientId),
  ]);

  const totalOpenTasks = [...taskStats.perProject.values()].reduce(
    (sum, s) => sum + (s.total - s.completed),
    0
  );

  return (
    <OverviewTab
      clientId={clientId}
      client={client}
      projects={projects}
      initialLogs={logs}
      signals={logSignals}
      sheets={sheets}
      services={services}
      contacts={client.contacts ?? []}
      currentUserName={currentUserName}
      currentUserId={currentUserId}
      isAdmin={isAdmin}
      totalOpenTasks={totalOpenTasks}
      overdueTaskCount={taskStats.overdueCount}
      myOpenTasks={taskStats.myOpenTasks}
      lastActivityAt={lastActivity?.createdAt ?? null}
      lastActivityActorName={lastActivity?.actorName ?? null}
      lastActivityType={lastActivity?.type ?? null}
    />
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-40">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{message}</p>
    </div>
  );
}
