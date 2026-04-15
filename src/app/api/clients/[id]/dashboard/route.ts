import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getClientById,
  getProjectsByClientId,
  getClientProjectsWithTaskStats,
  getLastActivityByClientId,
  getUpcomingEventsForClient,
  getLatestFollowUpDatesByService,
  checkAndCreateServiceExpiryLogs,
  getLogSignals,
  getSheetsByClientId,
  getServices,
  getEventTypes,
  getClientStatuses,
} from "@/lib/data";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clientId } = await params;
  const currentUserId = session.user.id ?? "";

  const client = await getClientById(clientId);
  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check for expired services first
  await checkAndCreateServiceExpiryLogs(clientId);

  const projects = await getProjectsByClientId(clientId);
  const projectIds = projects.map((p) => p.id);

  const [taskStats, lastActivity, upcomingEvents, serviceFollowUpDates, logSignals, sheets, services, eventTypes, clientStatuses] =
    await Promise.all([
      getClientProjectsWithTaskStats(projectIds, currentUserId),
      getLastActivityByClientId(clientId),
      getUpcomingEventsForClient(clientId),
      getLatestFollowUpDatesByService(clientId),
      getLogSignals(),
      getSheetsByClientId(clientId),
      getServices(),
      getEventTypes(),
      getClientStatuses(),
    ]);

  const totalOpenTasks = [...taskStats.perProject.values()].reduce(
    (sum, s) => sum + (s.total - s.completed),
    0
  );

  return NextResponse.json({
    client,
    projects,
    totalOpenTasks,
    overdueTaskCount: taskStats.overdueCount,
    myOpenTasks: taskStats.myOpenTasks,
    lastActivityAt: lastActivity?.createdAt ?? null,
    upcomingEvents: upcomingEvents.slice(0, 5),
    serviceFollowUpDates,
    logSignals,
    sheets,
    services,
    eventTypes,
    clientStatuses,
  });
}
