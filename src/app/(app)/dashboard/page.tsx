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
      {/* Summary bar */}
      <div
        className="flex flex-wrap items-center gap-5 rounded-card border px-5 py-4 shadow-subtle"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        {[80, 70, 64, 76].map((w, i) => (
          <div key={i} className="h-4 rounded-full" style={{ background: "var(--border)", width: w }} />
        ))}
      </div>

      {/* Week strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-card border p-3.5 shadow-subtle"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-16 rounded" style={{ background: "var(--border)" }} />
            </div>
            <div className="h-5 w-10 rounded" style={{ background: "var(--border)" }} />
            <div className="h-1.5 w-full rounded-full" style={{ background: "var(--border)" }} />
          </div>
        ))}
      </div>

      {/* Day detail panels */}
      <div>
        <div className="mb-3 h-4 w-40 rounded" style={{ background: "var(--border)" }} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-card border p-4 shadow-subtle"
              style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
            >
              <div className="h-3.5 w-28 rounded" style={{ background: "var(--border)" }} />
              <div className="space-y-2.5">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="space-y-1.5">
                    <div className="h-3.5 w-4/5 rounded" style={{ background: "var(--border)" }} />
                    <div className="h-3 w-3/5 rounded" style={{ background: "var(--border)" }} />
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
    <div className="space-y-3 animate-pulse">
      <div className="h-4 w-44 rounded" style={{ background: "var(--border)" }} />
      <div
        className="rounded-xl border p-4 shadow-subtle"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        {[65, 40, 55, 30].map((w, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5">
            <div className="h-[18px] w-[18px] flex-none rounded" style={{ background: "var(--border)" }} />
            <div className="h-3 flex-none rounded-full" style={{ background: "var(--border)", width: `${w}%` }} />
          </div>
        ))}
      </div>
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
