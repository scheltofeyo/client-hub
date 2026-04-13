import { getWeekCalendarItems, getActiveProjectsForGantt, getWeekTeamData } from "@/lib/data";
import { getWeekRange, getDayColumns } from "@/lib/utils";
import ThisWeekDashboard from "@/components/dashboard/ThisWeekDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const weekOffset = parseInt(params.week ?? "0", 10) || 0;

  const { start, end, label } = getWeekRange(weekOffset);
  const days = getDayColumns(start, end);

  const [items, ganttData, teamData] = await Promise.all([
    getWeekCalendarItems(start, end),
    getActiveProjectsForGantt(),
    getWeekTeamData(start, end),
  ]);

  return (
    <ThisWeekDashboard
      weekOffset={weekOffset}
      weekLabel={label}
      days={days}
      items={items}
      ganttClients={ganttData.clients}
      ganttProjectsByClient={ganttData.projectsByClient}
      teamData={teamData}
    />
  );
}
