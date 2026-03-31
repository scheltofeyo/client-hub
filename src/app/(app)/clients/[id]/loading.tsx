export default function ClientDetailLoading() {
  return (
    <div className="flex flex-col h-full overflow-hidden animate-pulse">
      {/* PageHeader skeleton: px-7 pt-6 pb-5 border-b */}
      <div className="px-7 pt-6 pb-5 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 mb-2">
          <div className="h-3 w-12 rounded" style={{ background: "var(--border)" }} />
          <div className="h-3 w-2 rounded" style={{ background: "var(--border)" }} />
          <div className="h-3 w-24 rounded" style={{ background: "var(--border)" }} />
          <div className="h-3 w-2 rounded" style={{ background: "var(--border)" }} />
          <div className="h-3 w-16 rounded" style={{ background: "var(--border)" }} />
        </nav>

        {/* Title + action */}
        <div className="flex items-center justify-between">
          <div className="h-6 w-36 rounded" style={{ background: "var(--border)" }} />
          <div className="h-8 w-28 rounded-lg" style={{ background: "var(--border)" }} />
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-7 pt-7 pb-7">
        {/* Stat cards row */}
        <div className="grid grid-cols-3 gap-4 max-w-2xl mb-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border p-4 h-[88px]"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="h-3 w-20 rounded mb-3" style={{ background: "var(--border)" }} />
              <div className="h-7 w-12 rounded" style={{ background: "var(--border)" }} />
            </div>
          ))}
        </div>

        {/* Section header */}
        <div className="h-3 w-16 rounded mb-4" style={{ background: "var(--border)" }} />

        {/* Content rows */}
        <div className="space-y-3">
          {[80, 65, 72, 55, 68].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-5 w-5 rounded shrink-0" style={{ background: "var(--border)" }} />
              <div className={`h-4 rounded`} style={{ background: "var(--border)", width: `${w}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
