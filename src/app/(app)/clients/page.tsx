import {
  getClients,
  getClientStatuses,
  getClientPlatforms,
  getOpenTaskCountsByClient,
  getOpenProjectCountsByClient,
  getLastActivityDateByAllClients,
  getFirstUpcomingEventByAllClients,
  getProjectsByAllClients,
} from "@/lib/data";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { hasPermission } from "@/lib/auth-helpers";
import ClientsPageClient from "./ClientsPageClient";
import type { OverviewRow } from "./ClientsOverviewTable";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const [resolvedParams, session] = await Promise.all([
    searchParams,
    auth(),
    connectDB(),
  ]);

  const tab = resolvedParams?.tab ?? "all";
  const canViewOverview = hasPermission(session, "dashboard.viewOverview");
  const isOverview = canViewOverview && tab === "overview";

  const [clients, statuses, platforms, taskCounts, projectCounts, lastActivity, firstEvents, projectsByClientMap] =
    await Promise.all([
      getClients(),
      getClientStatuses(),
      getClientPlatforms(),
      isOverview ? getOpenTaskCountsByClient() : Promise.resolve(new Map<string, number>()),
      isOverview ? getOpenProjectCountsByClient() : Promise.resolve(new Map<string, number>()),
      isOverview ? getLastActivityDateByAllClients() : Promise.resolve(new Map<string, string | null>()),
      isOverview ? getFirstUpcomingEventByAllClients() : Promise.resolve(new Map()),
      getProjectsByAllClients(),
    ]);

  // Convert Map to plain object for serialization to client component
  const projectsByClient: Record<string, import("@/types").Project[]> = {};
  for (const [cid, projects] of projectsByClientMap) {
    projectsByClient[cid] = projects;
  }

  const overviewRows: OverviewRow[] = isOverview
    ? clients.map((client) => ({
        client,
        openTasks: taskCounts.get(client.id) ?? 0,
        openProjects: projectCounts.get(client.id) ?? 0,
        lastActivityAt: lastActivity.get(client.id) ?? null,
        firstEvent: firstEvents.get(client.id) ?? null,
      }))
    : [];

  return (
    <ClientsPageClient
      clients={clients}
      currentUserId={session?.user?.id ?? null}
      statuses={statuses}
      platforms={platforms}
      tab={tab}
      isAdmin={canViewOverview}
      canCreateClient={hasPermission(session, "clients.create")}
      overviewRows={overviewRows}
      projectsByClient={projectsByClient}
    />
  );
}
