import { Suspense } from "react";
import { getWeekCalendarItems, getActiveProjectsForGantt, getWeekTeamData } from "@/lib/data";
import { getWeekRange, getDayColumns } from "@/lib/utils";
import type { DayColumn } from "@/lib/utils";
import ThisWeekDashboard from "@/components/dashboard/ThisWeekDashboard";
import WeekContent from "@/components/dashboard/WeekContent";
import ActiveProjectsSection from "@/components/dashboard/ActiveProjectsSection";

export const dynamic = "force-dynamic";

async function WeekContentSection({
  start,
  end,
  days,
}: {
  start: string;
  end: string;
  days: DayColumn[];
}) {
  const [items, teamData] = await Promise.all([
    getWeekCalendarItems(start, end),
    getWeekTeamData(start, end),
  ]);
  return <WeekContent days={days} items={items} teamData={teamData} />;
}

async function GanttSection() {
  const ganttData = await getActiveProjectsForGantt();
  return (
    <ActiveProjectsSection
      clients={ganttData.clients}
      projectsByClient={ganttData.projectsByClient}
    />
  );
}

function WeekContentSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border p-3 flex flex-col gap-2"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-8 rounded" style={{ background: "var(--border)" }} />
              <div className="h-5 w-5 rounded" style={{ background: "var(--border)" }} />
            </div>
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="h-2 w-full rounded-full" style={{ background: "var(--border)" }} />
              <div className="h-2 w-3/4 rounded-full" style={{ background: "var(--border)" }} />
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="h-4 w-40 rounded mb-4" style={{ background: "var(--border)" }} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border p-4 flex flex-col gap-3"
              style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
            >
              <div className="h-3.5 w-28 rounded" style={{ background: "var(--border)" }} />
              <div className="space-y-2.5">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="flex items-start gap-2.5">
                    <div className="w-2 h-2 rounded-full mt-1 flex-none" style={{ background: "var(--border)" }} />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-4/5 rounded" style={{ background: "var(--border)" }} />
                      <div className="h-3 w-3/5 rounded" style={{ background: "var(--border)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GanttSectionSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-36 rounded mb-3" style={{ background: "var(--border)" }} />
      {[65, 40, 55, 30].map((w, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <div className="w-[18px] h-[18px] rounded flex-none" style={{ background: "var(--border)" }} />
          <div className="h-3 rounded-full flex-none" style={{ background: "var(--border)", width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const weekOffset = parseInt(params.week ?? "0", 10) || 0;

  const { start, end, label } = getWeekRange(weekOffset);
  const days = getDayColumns(start, end);

  return (
    <ThisWeekDashboard
      weekOffset={weekOffset}
      weekLabel={label}
      weekContentSlot={
        <Suspense fallback={<WeekContentSkeleton />}>
          <WeekContentSection start={start} end={end} days={days} />
        </Suspense>
      }
      ganttSlot={
        <Suspense fallback={<GanttSectionSkeleton />}>
          <GanttSection />
        </Suspense>
      }
    />
  );
}
