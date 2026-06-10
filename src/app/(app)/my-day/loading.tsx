function TasksSkeleton() {
  return (
    <div
      className="rounded-card border p-5 shadow-subtle sm:p-6"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="h-4 w-4 rounded" style={{ background: "var(--border)" }} />
        <div className="h-4 w-16 rounded" style={{ background: "var(--border)" }} />
        <div className="ml-auto h-7 w-36 rounded-button" style={{ background: "var(--border)" }} />
      </div>
      <div className="mb-5 flex gap-4 border-b pb-2.5" style={{ borderColor: "var(--border)" }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-5 w-5 rounded" style={{ background: "var(--border)" }} />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <div className="h-4 w-4 flex-none rounded border" style={{ borderColor: "var(--border)" }} />
          <div className="h-3.5 flex-none rounded" style={{ background: "var(--border)", width: "60%" }} />
        </div>
      ))}
    </div>
  );
}

function EventsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-36 rounded" style={{ background: "var(--border)" }} />
      <div className="flex flex-col gap-5 sm:flex-row">
        {Array.from({ length: 3 }).map((_, col) => (
          <div key={col} className="min-w-0 flex-1 space-y-2.5">
            <div className="h-3 w-16 rounded" style={{ background: "var(--border)" }} />
            <div
              className="flex overflow-hidden rounded-card border shadow-subtle"
              style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
            >
              <div className="h-[58px] w-14 flex-none" style={{ background: "var(--border)", opacity: 0.5 }} />
              <div className="flex-1 space-y-1.5 px-3 py-3">
                <div className="h-3 w-2/5 rounded" style={{ background: "var(--border)" }} />
                <div className="h-3.5 w-4/5 rounded" style={{ background: "var(--border)" }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GanttSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-32 rounded" style={{ background: "var(--border)" }} />
      <div
        className="rounded-xl border p-4 shadow-subtle"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        {[70, 45, 60, 35].map((w, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5">
            <div className="h-[18px] w-[18px] flex-none rounded" style={{ background: "var(--border)" }} />
            <div className="h-3 flex-none rounded-full" style={{ background: "var(--border)", width: `${w}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function UserInfoSkeleton() {
  return (
    <div
      className="w-full rounded-card border flex flex-col sticky top-6 overflow-hidden shadow-subtle"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      <div className="relative px-5 pt-5 shrink-0" style={{ background: "var(--border)", height: "52px", opacity: 0.3 }}>
        <div className="relative" style={{ marginBottom: "-24px", zIndex: 10 }}>
          <div className="w-12 h-12 rounded-full" style={{ background: "var(--border)" }} />
        </div>
      </div>
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
    <div className="flex-1 overflow-y-auto" style={{ background: "var(--bg-tinted)" }}>
      <div className="mx-auto w-full max-w-[1400px] px-6 py-8 sm:px-8 animate-pulse">
        {/* Greeting skeleton */}
        <div className="mb-8">
          <div className="h-6 w-64 rounded" style={{ background: "var(--border)" }} />
          <div className="h-3.5 w-44 rounded mt-2" style={{ background: "var(--border)" }} />
        </div>

        {/* Action-first layout: tasks → events → gantt, + right rail */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-10">
            <section><TasksSkeleton /></section>
            <section><EventsSkeleton /></section>
            <section><GanttSkeleton /></section>
          </div>
          <div className="w-full flex-none lg:w-1/3 lg:max-w-sm">
            <UserInfoSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
