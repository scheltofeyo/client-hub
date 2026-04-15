export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 max-w-2xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border p-4 h-[88px]" style={{ borderColor: "var(--border)" }}>
            <div className="h-3 w-20 rounded mb-3" style={{ background: "var(--border)" }} />
            <div className="h-7 w-12 rounded" style={{ background: "var(--border)" }} />
          </div>
        ))}
      </div>
      {/* Content blocks */}
      <div className="space-y-3">
        <div className="h-3 w-16 rounded" style={{ background: "var(--border)" }} />
        {[75, 60, 68, 50].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-5 w-5 rounded shrink-0" style={{ background: "var(--border)" }} />
            <div className="h-4 rounded" style={{ background: "var(--border)", width: `${w}%` }} />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-3 w-20 rounded" style={{ background: "var(--border)" }} />
        {[55, 70, 45].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-5 w-5 rounded shrink-0" style={{ background: "var(--border)" }} />
            <div className="h-4 rounded" style={{ background: "var(--border)", width: `${w}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectsSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 max-w-2xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border p-4 h-[88px]" style={{ borderColor: "var(--border)" }}>
            <div className="h-3 w-20 rounded mb-3" style={{ background: "var(--border)" }} />
            <div className="h-7 w-12 rounded" style={{ background: "var(--border)" }} />
          </div>
        ))}
      </div>
      {/* Section header */}
      <div>
        <div className="h-3 w-16 rounded mb-4" style={{ background: "var(--border)" }} />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border p-4 h-[140px] flex flex-col gap-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg shrink-0" style={{ background: "var(--border)" }} />
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <div className="h-2.5 w-10 rounded" style={{ background: "var(--border)" }} />
                  <div className="h-3.5 w-full rounded" style={{ background: "var(--border)" }} />
                </div>
              </div>
              <div className="flex-1" />
              <div className="h-2 w-full rounded-full" style={{ background: "var(--border)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TasksSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Section header */}
      <div className="h-3 w-20 rounded" style={{ background: "var(--border)" }} />
      {/* Task rows */}
      {[85, 70, 78, 60, 72].map((w, i) => (
        <div key={i} className="flex items-center gap-3 h-8">
          <div className="w-4 h-4 rounded shrink-0" style={{ background: "var(--border)" }} />
          <div className="h-4 rounded" style={{ background: "var(--border)", width: `${w}%` }} />
          <div className="w-6 h-6 rounded-full shrink-0 ml-auto" style={{ background: "var(--border)" }} />
        </div>
      ))}
      {/* Second section */}
      <div className="h-3 w-24 rounded mt-4" style={{ background: "var(--border)" }} />
      {[65, 80, 55].map((w, i) => (
        <div key={i} className="flex items-center gap-3 h-8">
          <div className="w-4 h-4 rounded shrink-0" style={{ background: "var(--border)" }} />
          <div className="h-4 rounded" style={{ background: "var(--border)", width: `${w}%` }} />
          <div className="w-6 h-6 rounded-full shrink-0 ml-auto" style={{ background: "var(--border)" }} />
        </div>
      ))}
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="animate-pulse max-w-2xl space-y-8">
      <div className="space-y-5">
        <div className="h-3 w-16 rounded" style={{ background: "var(--border)" }} />
        <div className="h-5 w-40 rounded" style={{ background: "var(--border)" }} />
        <div className="h-4 w-full rounded" style={{ background: "var(--border)" }} />
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="h-2.5 w-12 rounded mb-1" style={{ background: "var(--border)" }} />
              <div className="h-4 w-20 rounded" style={{ background: "var(--border)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SheetsSkeleton() {
  return (
    <div className="animate-pulse max-w-3xl space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 h-12 px-4 rounded-lg border" style={{ borderColor: "var(--border)" }}>
          <div className="w-5 h-5 rounded shrink-0" style={{ background: "var(--border)" }} />
          <div className="h-4 w-48 rounded" style={{ background: "var(--border)" }} />
        </div>
      ))}
    </div>
  );
}

export function LogbookSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-3 w-16 rounded" style={{ background: "var(--border)" }} />
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full" style={{ background: "var(--border)" }} />
            <div className="h-3 w-24 rounded" style={{ background: "var(--border)" }} />
            <div className="h-3 w-16 rounded ml-auto" style={{ background: "var(--border)" }} />
          </div>
          <div className="h-4 w-full rounded" style={{ background: "var(--border)" }} />
          <div className="h-4 w-3/4 rounded" style={{ background: "var(--border)" }} />
        </div>
      ))}
    </div>
  );
}

export function AdminEmployeesSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex gap-2 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-20 rounded-lg" style={{ background: "var(--border)" }} />
        ))}
        <div className="h-8 w-24 rounded-lg ml-auto" style={{ background: "var(--border)" }} />
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 h-12 px-3 rounded-lg border" style={{ borderColor: "var(--border)" }}>
          <div className="w-8 h-8 rounded-full shrink-0" style={{ background: "var(--border)" }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-32 rounded" style={{ background: "var(--border)" }} />
            <div className="h-2.5 w-48 rounded" style={{ background: "var(--border)" }} />
          </div>
          <div className="h-5 w-14 rounded-full" style={{ background: "var(--border)" }} />
        </div>
      ))}
    </div>
  );
}

export function AdminRolesSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-8 w-28 rounded-lg mb-4" style={{ background: "var(--border)" }} />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 h-14 px-4 rounded-lg border" style={{ borderColor: "var(--border)" }}>
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-24 rounded" style={{ background: "var(--border)" }} />
            <div className="h-2.5 w-40 rounded" style={{ background: "var(--border)" }} />
          </div>
          <div className="h-5 w-16 rounded-full" style={{ background: "var(--border)" }} />
        </div>
      ))}
    </div>
  );
}

export function AdminTemplatesSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex gap-2 mb-4">
        <div className="h-8 w-32 rounded-lg" style={{ background: "var(--border)" }} />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 h-14 px-4 rounded-lg border" style={{ borderColor: "var(--border)" }}>
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-36 rounded" style={{ background: "var(--border)" }} />
            <div className="h-2.5 w-20 rounded" style={{ background: "var(--border)" }} />
          </div>
          <div className="h-5 w-12 rounded" style={{ background: "var(--border)" }} />
        </div>
      ))}
    </div>
  );
}
