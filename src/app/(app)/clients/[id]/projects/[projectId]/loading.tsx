export default function ProjectDetailLoading() {
  return (
    <div className="flex flex-col h-full overflow-hidden animate-pulse">
      {/* PageHeader skeleton */}
      <div className="px-7 pt-6 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 mb-2">
          <div className="h-3 w-12 rounded" style={{ background: "var(--border)" }} />
          <div className="h-3 w-2 rounded" style={{ background: "var(--border)" }} />
          <div className="h-3 w-24 rounded" style={{ background: "var(--border)" }} />
          <div className="h-3 w-2 rounded" style={{ background: "var(--border)" }} />
          <div className="h-3 w-16 rounded" style={{ background: "var(--border)" }} />
          <div className="h-3 w-2 rounded" style={{ background: "var(--border)" }} />
          <div className="h-3 w-8 rounded" style={{ background: "var(--border)" }} />
        </nav>

        {/* Title + action */}
        <div className="flex items-center justify-between mt-1 pb-4">
          <div className="h-6 w-48 rounded" style={{ background: "var(--border)" }} />
          <div className="h-8 w-28 rounded-lg" style={{ background: "var(--border)" }} />
        </div>

        {/* Tab bar */}
        <div className="flex gap-6 pb-0">
          {[48, 40, 36].map((w, i) => (
            <div key={i} className="h-3 rounded pb-3" style={{ background: "var(--border)", width: `${w}px` }} />
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-7">
        {/* Section label */}
        <div className="h-3 w-16 rounded mb-5" style={{ background: "var(--border)" }} />

        {/* Task rows */}
        <div className="space-y-3">
          {[75, 55, 68, 48, 60, 52].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-4 rounded shrink-0" style={{ background: "var(--border)" }} />
              <div className="h-4 rounded" style={{ background: "var(--border)", width: `${w}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
