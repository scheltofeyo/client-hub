import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import {
  getArchetypes,
  getServices,
  getLogSignals,
  getEventTypes,
  getClientStatuses,
  getClientPlatforms,
  getProjectLabels,
  getLeaveTypes,
  getCompanyHolidays,
} from "@/lib/data";
import PageHeader from "@/components/layout/PageHeader";
import LabelsAndTypesTertiaryNav from "@/components/layout/LabelsAndTypesTertiaryNav";
import AdminArchetypesTable from "../AdminArchetypesTable";
import AdminServicesTable from "../AdminServicesTable";
import AdminLogSignalsTable from "../AdminLogSignalsTable";
import AdminEventTypesTable from "../AdminEventTypesTable";
import AdminClientStatusesTable from "../AdminClientStatusesTable";
import AdminClientPlatformsTable from "../AdminClientPlatformsTable";
import AdminProjectLabelsTable from "../AdminProjectLabelsTable";
import AdminLeaveTypesTable from "../AdminLeaveTypesTable";
import AdminCompanyHolidaysTable from "../AdminCompanyHolidaysTable";

const validTabs = [
  "archetypes",
  "services",
  "signals",
  "event-types",
  "client-statuses",
  "client-platforms",
  "project-labels",
  "leave-types",
  "company-holidays",
] as const;

type Tab = (typeof validTabs)[number];

export default async function LabelsAndTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!hasPermission(session, "admin.access")) redirect("/dashboard");

  const perms = session?.user?.permissions ?? [];
  const { tab } = await searchParams;
  const activeTab: Tab = validTabs.includes(tab as Tab)
    ? (tab as Tab)
    : "archetypes";

  await connectDB();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Labels and Types" },
        ]}
        title="Labels and Types"
        tertiaryNav={
          <Suspense fallback={null}>
            <LabelsAndTypesTertiaryNav permissions={perms} />
          </Suspense>
        }
      />
      <div className="flex-1 overflow-y-auto px-7 pb-7 pt-6 max-w-3xl">
        {activeTab === "archetypes" && perms.includes("admin.archetypes") && <ArchetypesSection />}
        {activeTab === "services" && perms.includes("admin.services") && <ServicesSection />}
        {activeTab === "signals" && perms.includes("admin.logSignals") && <SignalsSection />}
        {activeTab === "event-types" && perms.includes("admin.eventTypes") && <EventTypesSection />}
        {activeTab === "client-statuses" && perms.includes("admin.clientStatuses") && <ClientStatusesSection />}
        {activeTab === "client-platforms" && perms.includes("admin.clientPlatforms") && <ClientPlatformsSection />}
        {activeTab === "project-labels" && perms.includes("admin.projectLabels") && <ProjectLabelsSection />}
        {activeTab === "leave-types" && perms.includes("admin.leaveTypes") && <LeaveTypesSection />}
        {activeTab === "company-holidays" && perms.includes("admin.companyHolidays") && <CompanyHolidaysSection />}
      </div>
    </div>
  );
}

async function ArchetypesSection() {
  const archetypes = await getArchetypes();
  return (
    <>
      <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        Archetype labels that can be assigned to clients.
      </p>
      <AdminArchetypesTable initialArchetypes={archetypes} />
    </>
  );
}

async function ServicesSection() {
  const services = await getServices();
  return (
    <>
      <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        Service labels that can be linked to projects for cross-client reporting.
      </p>
      <AdminServicesTable initialServices={services} />
    </>
  );
}

async function SignalsSection() {
  const signals = await getLogSignals();
  return (
    <>
      <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        Signal labels that can be attached to logbook entries to categorise interactions.
      </p>
      <AdminLogSignalsTable initialSignals={signals} />
    </>
  );
}

async function EventTypesSection() {
  const eventTypes = await getEventTypes();
  return (
    <>
      <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        Types available when adding events to a client&apos;s timeline.
      </p>
      <AdminEventTypesTable initialEventTypes={eventTypes} />
    </>
  );
}

async function ClientStatusesSection() {
  const statuses = await getClientStatuses();
  return (
    <>
      <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        Status options available when creating or editing clients.
      </p>
      <AdminClientStatusesTable initialStatuses={statuses} />
    </>
  );
}

async function ClientPlatformsSection() {
  const platforms = await getClientPlatforms();
  return (
    <>
      <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        Platform options available when creating or editing clients.
      </p>
      <AdminClientPlatformsTable initialPlatforms={platforms} />
    </>
  );
}

async function ProjectLabelsSection() {
  const projectLabels = await getProjectLabels();
  return (
    <>
      <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        Labels that can be assigned to projects for categorisation.
      </p>
      <AdminProjectLabelsTable initialLabels={projectLabels} />
    </>
  );
}

async function LeaveTypesSection() {
  const leaveTypes = await getLeaveTypes();
  return (
    <>
      <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        Leave types available on the team holiday calendar. Types marked as &quot;counts against allowance&quot; are deducted from vacation days.
      </p>
      <AdminLeaveTypesTable initialLeaveTypes={leaveTypes} />
    </>
  );
}

async function CompanyHolidaysSection() {
  const holidays = await getCompanyHolidays(new Date().getFullYear());
  return (
    <>
      <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        Company-wide holidays shown as highlighted columns on the team calendar. These apply to all team members.
      </p>
      <AdminCompanyHolidaysTable initialHolidays={holidays} />
    </>
  );
}
