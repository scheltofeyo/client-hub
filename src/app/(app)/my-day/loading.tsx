function SkeletonGanttRow({ width }: { width: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-[18px] h-[18px] rounded flex-none" style={{ background: "var(--border)" }} />
      <div className="h-3 rounded-full flex-none" style={{ background: "var(--border)", width }} />
    </div>
  );
}

function SkeletonFollowUpRow() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-7 h-7 rounded-full flex-none" style={{ background: "var(--border)" }} />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-3/5 rounded" style={{ background: "var(--border)" }} />
        <div className="h-3 w-2/5 rounded" style={{ background: "var(--border)" }} />
      </div>
    </div>
  );
}

function SkeletonTaskRow() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-4 h-4 rounded border flex-none" style={{ borderColor: "var(--border)" }} />
      <div className="h-3.5 rounded flex-none" style={{ background: "var(--border)", width: `${45 + Math.floor(Math.random() * 30)}%` }} />
    </div>
  );
}

function SkeletonUserInfoCard() {
  return (
    <div
      className="w-full rounded-xl border flex flex-col sticky top-6 overflow-hidden animate-pulse"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      {/* Tinted header */}
      <div className="relative px-5 pt-5 shrink-0" style={{ background: "var(--border)", height: "52px", opacity: 0.3 }}>
        <div className="relative" style={{ marginBottom: "-24px", zIndex: 10 }}>
          <div className="w-12 h-12 rounded-full" style={{ background: "var(--border)" }} />
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col gap-4 px-5 pt-9 pb-5">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-32 rounded" style={{ background: "var(--border)" }} />
          <div className="h-3.5 w-40 rounded" style={{ background: "var(--border)" }} />
        </div>

        <hr style={{ borderColor: "var(--border)" }} />

        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded" style={{ background: "var(--border)" }} />
                <div className="h-3 rounded" style={{ background: "var(--border)", width: `${80 + i * 12}px` }} />
              </div>
              <div className="h-3.5 w-6 rounded" style={{ background: "var(--border)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MyDayLoading() {
  return (
    <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
      {/* Greeting skeleton */}
      <div className="animate-pulse">
        <div className="h-6 w-56 rounded" style={{ background: "var(--border)" }} />
        <div className="h-4 w-44 rounded mt-2" style={{ background: "var(--border)" }} />
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">
        {/* LEFT: Content sections */}
        <div className="flex-1 flex flex-col gap-8 min-w-0 animate-pulse">
          {/* Timeline section */}
          <section>
            <div className="h-4 w-20 rounded mb-3" style={{ background: "var(--border)" }} />
            <SkeletonGanttRow width="70%" />
            <SkeletonGanttRow width="45%" />
            <SkeletonGanttRow width="60%" />
            <SkeletonGanttRow width="35%" />
          </section>

          {/* Follow-ups section */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-4 w-24 rounded" style={{ background: "var(--border)" }} />
              <div className="h-5 w-6 rounded-full" style={{ background: "var(--border)" }} />
            </div>
            <SkeletonFollowUpRow />
            <SkeletonFollowUpRow />
            <SkeletonFollowUpRow />
          </section>

          {/* Tasks section */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-4 w-16 rounded" style={{ background: "var(--border)" }} />
              <div className="h-5 w-6 rounded-full" style={{ background: "var(--border)" }} />
            </div>
            <SkeletonTaskRow />
            <SkeletonTaskRow />
            <SkeletonTaskRow />
            <SkeletonTaskRow />
          </section>
        </div>

        {/* RIGHT: User info card */}
        <div className="w-1/3 flex-none">
          <SkeletonUserInfoCard />
        </div>
      </div>
    </div>
  );
}
