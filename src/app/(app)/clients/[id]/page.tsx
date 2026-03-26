import { getClientById, getProjectsByClientId, getArchetypes, getLogsByClientId, getLogSignals, getSheetsByClientId } from "@/lib/data";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";

export const dynamic = "force-dynamic";
import StatusBadge from "@/components/ui/StatusBadge";
import EditClientButton from "@/components/ui/EditClientButton";
import DeleteClientButton from "@/components/ui/DeleteClientButton";
import ContactsSection from "@/components/ui/ContactsSection";
import LeadsSection from "@/components/ui/LeadsSection";
import AddProjectButton from "@/components/ui/AddProjectButton";
import AddLogButton from "@/components/ui/AddLogButton";
import LogbookTab from "@/components/ui/LogbookTab";
import SheetsTab, { ManageSheetsButton } from "@/components/ui/SheetsTab";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Archetype, Client, Project } from "@/types";

const tabs = ["Overview", "Projects", "Sheets", "Logbook"] as const;
type Tab = (typeof tabs)[number];

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const [client, projects, session, archetypes, logs, logSignals, sheets] = await Promise.all([
    getClientById(id),
    getProjectsByClientId(id),
    auth(),
    getArchetypes(),
    getLogsByClientId(id),
    getLogSignals(),
    getSheetsByClientId(id),
  ]);

  if (!client) notFound();

  const activeTab: Tab =
    tabs.find((t) => t.toLowerCase() === tab?.toLowerCase()) ?? "Overview";

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
      {/* Content header */}
      <div
        className="px-7 pt-6 pb-5 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 mb-2">
          <Link href="/clients" className="text-xs breadcrumb-link">
            Clients
          </Link>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>/</span>
          <Link href={`/clients/${id}`} className="text-xs breadcrumb-link">
            {client.company}
          </Link>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>/</span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>...</span>
        </nav>

        {/* Page title + actions */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {activeTab}
          </h1>
          <div className="flex items-center gap-2">
            {activeTab === "Overview" && canEdit && (
              <>
                <EditClientButton client={client} archetypes={archetypes} />
                {isAdmin && <DeleteClientButton id={client.id} company={client.company} />}
              </>
            )}
            {activeTab === "Projects" && canEdit && (
              <AddProjectButton clientId={client.id} />
            )}
            {activeTab === "Sheets" && (
              <ManageSheetsButton
                clientId={id}
                initialSheets={sheets}
              />
            )}
            {activeTab === "Logbook" && (
              <AddLogButton
                clientId={id}
                clientName={client.company}
                contacts={client.contacts ?? []}
                signals={logSignals}
                currentUserName={session?.user?.name ?? ""}
              />
            )}
          </div>
        </div>
      </div>

      {/* Tab bar — hidden for now, reserved for tertiary subsection nav */}
      {false && (
        <div
          className="flex gap-0 border-b shrink-0 px-7"
          style={{ borderColor: "var(--border)" }}
        >
          {tabs.map((t) => (
            <Link
              key={t}
              href={`/clients/${id}?tab=${t.toLowerCase()}`}
              className="px-1 py-3 mr-5 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderColor: activeTab === t ? "var(--primary)" : "transparent",
                color: activeTab === t ? "var(--primary)" : "var(--text-muted)",
              }}
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-7">
        {activeTab === "Overview" && (
          <OverviewTab
            client={client}
            isAdmin={isAdmin}
            canEdit={canEdit}
            allUsers={allUsers}
            archetypes={archetypes}
          />
        )}
        {activeTab === "Projects" && <ProjectsTab clientId={id} projects={projects} />}
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
      </div>
    </div>
  );
}

// ── Tab panels ──────────────────────────────────────────────

function OverviewTab({
  client,
  isAdmin,
  canEdit,
  allUsers,
}: {
  client: Client;
  isAdmin: boolean;
  canEdit: boolean;
  allUsers: { id: string; name: string; email: string; image: string | null }[];
  archetypes: Archetype[];
}) {
  const platformLabel =
    client.platform === "summ_core" ? "SUMM Core" :
    client.platform === "summ_suite" ? "SUMM Suite" :
    undefined;

  const details: [string, string | undefined][] = [
    ["Website", client.website],
    ["Employees", client.employees != null ? client.employees.toLocaleString() : undefined],
    ["Platform", platformLabel],
    ["Archetype", client.archetype],
    ["Client since", client.clientSince ?? client.createdAt],
    ["Projects", String(client.projects?.length ?? 0)],
  ];
  const visibleDetails = details.filter(([, v]) => v !== undefined);

  return (
    <div className="max-w-2xl space-y-8">
      {/* Company section */}
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

      <hr style={{ borderColor: "var(--border)" }} />

      {/* Leads section */}
      <LeadsSection
        clientId={client.id}
        initialLeads={client.leads ?? []}
        allUsers={allUsers}
        isAdmin={isAdmin}
      />

      <hr style={{ borderColor: "var(--border)" }} />

      {/* Contacts section */}
      <ContactsSection
        clientId={client.id}
        initialContacts={client.contacts ?? []}
      />

    </div>
  );
}

function ProjectsTab({ clientId, projects }: { clientId: string; projects: Project[] }) {
  if (projects.length === 0) {
    return <EmptyTab message="No projects yet. Click 'Add Project' to get started." />;
  }
  return (
    <div className="max-w-3xl space-y-3">
      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/clients/${clientId}/projects/${project.id}`}
          className="rounded-2xl border p-5 flex items-center justify-between hover:border-purple-400 transition-colors block"
          style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}
        >
          <div>
            <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
              {project.title}
            </p>
            {project.deliveryDate && (
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Due {project.deliveryDate}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {project.soldPrice != null && (
              <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                €{project.soldPrice.toLocaleString()}
              </span>
            )}
            <StatusBadge status={project.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-40">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{message}</p>
    </div>
  );
}
