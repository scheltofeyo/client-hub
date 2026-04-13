function SkeletonDayCard() {
  return (
    <div
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
  );
}

function SkeletonDetailColumn() {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      <div className="h-3.5 w-28 rounded" style={{ background: "var(--border)" }} />
      <div className="space-y-2.5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="w-2 h-2 rounded-full mt-1 flex-none" style={{ background: "var(--border)" }} />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-4/5 rounded" style={{ background: "var(--border)" }} />
              <div className="h-3 w-3/5 rounded" style={{ background: "var(--border)" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonGanttRow({ width }: { width: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-[18px] h-[18px] rounded flex-none" style={{ background: "var(--border)" }} />
      <div className="h-3 rounded-full flex-none" style={{ background: "var(--border)", width }} />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div
      className="flex-1 overflow-y-auto p-8 space-y-6 animate-pulse"
      style={{ background: "var(--bg-surface)" }}
    >
      {/* Week header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-28 rounded" style={{ background: "var(--border)" }} />
          <div className="h-4 w-40 rounded mt-1.5" style={{ background: "var(--border)" }} />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-7 h-7 rounded-lg" style={{ background: "var(--border)" }} />
          <div className="w-7 h-7 rounded-lg" style={{ background: "var(--border)" }} />
        </div>
      </div>

      {/* Week overview strip — 5 day cards */}
      <div className="grid grid-cols-5 gap-2">
        <SkeletonDayCard />
        <SkeletonDayCard />
        <SkeletonDayCard />
        <SkeletonDayCard />
        <SkeletonDayCard />
      </div>

      {/* Day detail panel */}
      <div>
        <div className="h-4 w-40 rounded mb-4" style={{ background: "var(--border)" }} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SkeletonDetailColumn />
          <SkeletonDetailColumn />
          <SkeletonDetailColumn />
        </div>
      </div>

      {/* Active projects / Gantt */}
      <div>
        <div className="h-4 w-36 rounded mb-3" style={{ background: "var(--border)" }} />
        <SkeletonGanttRow width="65%" />
        <SkeletonGanttRow width="40%" />
        <SkeletonGanttRow width="55%" />
      </div>
    </div>
  );
}
