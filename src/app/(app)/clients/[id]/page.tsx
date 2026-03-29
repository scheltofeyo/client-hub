import { getClientById, getProjectsByClientId, getArchetypes, getLogsByClientId, getLogSignals, getSheetsByClientId, getClientProjectsWithTaskStats, getLastActivityByClientId, getServices, getUpcomingEventsForClient, getEventTypes } from "@/lib/data";
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
import ClientTasksTab, { AddClientTaskButton } from "@/components/ui/ClientTasksTab";
import LogbookTab from "@/components/ui/LogbookTab";
import OverviewTab from "@/components/ui/OverviewTab";
import SheetsTab, { ManageSheetsButton } from "@/components/ui/SheetsTab";
import ActivityTab from "@/components/ui/ActivityTab";
import EventsTab from "@/components/ui/EventsTab";
import AddEventButton from "@/components/ui/AddEventButton";
import FolderPendingBanner from "@/components/ui/FolderPendingBanner";
import AboutTertiaryNav from "@/components/layout/AboutTertiaryNav";
import PageHeader from "@/components/layout/PageHeader";
import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { notFound } from "next/navigation";
import type { Client, Log, LogSignal, Project, Service, Sheet, Task } from "@/types";
import { getGeneralTasksByClientId, getTasksByProjectIds } from "@/lib/data";
import { fmtDate } from "@/lib/utils";

const tabs = ["Dashboard", "Projects", "Tasks", "Sheets", "Logbook", "Events", "Activity", "Settings"] as const;
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
  const [client, projects, session, archetypes, logs, logSignals, sheets, services, eventTypes] = await Promise.all([
    getClientById(id),
    getProjectsByClientId(id),
    auth(),
    getArchetypes(),
    getLogsByClientId(id),
    getLogSignals(),
    getSheetsByClientId(id),
    getServices(),
    getEventTypes(),
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
          ) : activeTab === "Tasks" ? (
            <AddClientTaskButton clientId={client.id} />
          ) : activeTab === "Sheets" ? (
            <ManageSheetsButton clientId={id} initialSheets={sheets} />
          ) : activeTab === "Events" ? (
            <AddEventButton clientId={id} />
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

      {client.folderStatus === "pending" && (
        <FolderPendingBanner clientId={id} />
      )}

      {/* Tab content */}
      <div
        className={`flex-1 overflow-y-auto px-7 pb-7 ${activeTab === "Dashboard" ? "pt-0" : "pt-7"}`}
        style={activeTab === "Dashboard" ? { background: "var(--bg-surface)" } : undefined}
      >
        {activeTab === "Dashboard" && (
          <DashboardTabWrapper
            clientId={id}
            client={client}
            projects={projects}
            logSignals={logSignals}
            sheets={sheets}
            services={services}
            eventTypes={eventTypes}
            currentUserId={currentUserId}
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
        {activeTab === "Tasks" && (
          <TasksTabWrapper
            clientId={id}
            projects={projects}
            currentUserId={currentUserId}
            currentUserName={session?.user?.name ?? ""}
          />
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
        {activeTab === "Events" && (
          <EventsTabWrapper clientId={id} eventTypes={eventTypes} />
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
      className="relative flex flex-col rounded-xl border p-4 bg-white dark:bg-[var(--bg-sidebar)] transition-colors project-card-hover"
      style={{ boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)" }}
    >
      {/* Icon + title */}
      <div className="flex gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--bg-sidebar)", border: "1px solid var(--border)" }}
        >
          <FolderOpen size={15} style={{ color: "var(--text-muted)" }} />
        </div>
        <div className="flex flex-col justify-center min-w-0">
          {project.service && (
            <p className="text-[10px] font-semibold uppercase tracking-wider leading-none mb-1 truncate" style={{ color: "var(--text-muted)" }}>
              {project.service}
            </p>
          )}
          <p className="font-medium text-sm leading-snug line-clamp-2" style={{ color: "var(--text-primary)" }}>
            {project.title}
          </p>
        </div>
      </div>

      {/* Description — up to 3 lines */}
      {project.description && (
        <p
          className="text-xs leading-relaxed mt-3 line-clamp-3"
          style={{ color: "var(--text-muted)" }}
        >
          {project.description}
        </p>
      )}

      {/* Spacer to push footer down */}
      <div className="flex-1 min-h-[1.25rem]" />

      {/* Tasks + progress bar */}
      {(openTasks !== null || (stats && stats.total > 0)) && (
        <div className="flex flex-col gap-1.5 mt-5">
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
        </div>
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
  logSignals,
  sheets,
  services,
  eventTypes,
  currentUserId,
  isAdmin,
}: {
  clientId: string;
  client: Client;
  projects: Project[];
  logSignals: LogSignal[];
  sheets: Sheet[];
  services: Service[];
  eventTypes: import("@/types").EventType[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [taskStats, lastActivity, upcomingEvents] = await Promise.all([
    getClientProjectsWithTaskStats(projects.map((p) => p.id), currentUserId),
    getLastActivityByClientId(clientId),
    getUpcomingEventsForClient(clientId),
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
      signals={logSignals}
      sheets={sheets}
      services={services}
      contacts={client.contacts ?? []}
      currentUserId={currentUserId}
      isAdmin={isAdmin}
      totalOpenTasks={totalOpenTasks}
      overdueTaskCount={taskStats.overdueCount}
      myOpenTasks={taskStats.myOpenTasks}
      initialEvents={upcomingEvents.slice(0, 2)}
      eventTypes={eventTypes}
      lastActivityAt={lastActivity?.createdAt ?? null}
    />
  );
}

async function EventsTabWrapper({
  clientId,
  eventTypes,
}: {
  clientId: string;
  eventTypes: import("@/types").EventType[];
}) {
  const initialEvents = await getUpcomingEventsForClient(clientId);
  return <EventsTab clientId={clientId} initialEvents={initialEvents} initialEventTypes={eventTypes} />;
}

async function TasksTabWrapper({
  clientId,
  projects,
  currentUserId,
  currentUserName: _currentUserName,
}: {
  clientId: string;
  projects: Project[];
  currentUserId: string;
  currentUserName: string;
}) {
  const projectIds = projects.map((p) => p.id);
  const [generalTasks, projectTasksMap] = await Promise.all([
    getGeneralTasksByClientId(clientId),
    getTasksByProjectIds(projectIds),
  ]);

  const initialProjectTasks: Record<string, Task[]> = {};
  for (const p of projects) {
    initialProjectTasks[p.id] = projectTasksMap.get(p.id) ?? [];
  }

  return (
    <ClientTasksTab
      clientId={clientId}
      projects={projects.map((p) => ({ id: p.id, title: p.title, status: p.status }))}
      initialGeneralTasks={generalTasks}
      initialProjectTasks={initialProjectTasks}
      currentUserId={currentUserId}
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
