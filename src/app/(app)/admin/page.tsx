import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { getProjectTemplates, getArchetypes, getServices, getLogSignals, getEventTypes, getClientStatuses, getClientPlatforms, getProjectLabels } from "@/lib/data";
import AdminUsersTable from "./AdminUsersTable";
import AdminTemplatesTable from "./AdminTemplatesTable";
import AdminArchetypesTable from "./AdminArchetypesTable";
import AdminServicesTable from "./AdminServicesTable";
import AdminLogSignalsTable from "./AdminLogSignalsTable";
import AdminEventTypesTable from "./AdminEventTypesTable";
import AdminClientStatusesTable from "./AdminClientStatusesTable";
import AdminClientPlatformsTable from "./AdminClientPlatformsTable";
import AdminProjectLabelsTable from "./AdminProjectLabelsTable";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect("/dashboard");

  const { tab } = await searchParams;
  const activeTab =
    tab === "templates"        ? "templates"        :
    tab === "archetypes"       ? "archetypes"       :
    tab === "services"         ? "services"         :
    tab === "signals"          ? "signals"          :
    tab === "event-types"      ? "event-types"      :
    tab === "client-statuses"  ? "client-statuses"  :
    tab === "client-platforms" ? "client-platforms" :
    tab === "project-labels"   ? "project-labels"   :
    "users";

  await connectDB();

  if (activeTab === "templates") {
    const [templates, services] = await Promise.all([getProjectTemplates(), getServices()]);
    return (
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
        <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Project Templates
        </h1>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Templates pre-fill project fields when creating new projects.
        </p>
        <AdminTemplatesTable initialTemplates={templates} services={services} />
      </div>
    );
  }

  if (activeTab === "archetypes") {
    const archetypes = await getArchetypes();
    return (
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
        <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Archetypes
        </h1>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Archetype labels that can be assigned to clients.
        </p>
        <AdminArchetypesTable initialArchetypes={archetypes} />
      </div>
    );
  }

  if (activeTab === "services") {
    const services = await getServices();
    return (
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
        <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Services
        </h1>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Service labels that can be linked to projects for cross-client reporting.
        </p>
        <AdminServicesTable initialServices={services} />
      </div>
    );
  }

  if (activeTab === "event-types") {
    const eventTypes = await getEventTypes();
    return (
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
        <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Event Types
        </h1>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Types available when adding events to a client's timeline.
        </p>
        <AdminEventTypesTable initialEventTypes={eventTypes} />
      </div>
    );
  }

  if (activeTab === "client-statuses") {
    const statuses = await getClientStatuses();
    return (
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
        <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Client Statuses
        </h1>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Status options available when creating or editing clients.
        </p>
        <AdminClientStatusesTable initialStatuses={statuses} />
      </div>
    );
  }

  if (activeTab === "client-platforms") {
    const platforms = await getClientPlatforms();
    return (
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
        <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Client Platforms
        </h1>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Platform options available when creating or editing clients.
        </p>
        <AdminClientPlatformsTable initialPlatforms={platforms} />
      </div>
    );
  }

  if (activeTab === "project-labels") {
    const projectLabels = await getProjectLabels();
    return (
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
        <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Project Labels
        </h1>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Labels that can be assigned to projects for categorisation.
        </p>
        <AdminProjectLabelsTable initialLabels={projectLabels} />
      </div>
    );
  }

  if (activeTab === "signals") {
    const signals = await getLogSignals();
    return (
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
        <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Log Signals
        </h1>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Signal labels that can be attached to logbook entries to categorise interactions.
        </p>
        <AdminLogSignalsTable initialSignals={signals} />
      </div>
    );
  }

  const docs = await UserModel.find().sort({ createdAt: 1 }).lean();
  const users = docs.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    isAdmin: u.isAdmin,
  }));

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        Users
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
        Manage user access and roles.
      </p>
      <AdminUsersTable users={users} currentUserId={session.user.id} />
    </div>
  );
}
