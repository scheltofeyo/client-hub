export default function FinanceLoading() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header placeholder */}
      <div
        className="px-7 pt-6 pb-5 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <div className="h-2.5 w-24 rounded mb-3 animate-pulse" style={{ background: "var(--border)" }} />
        <div className="h-6 w-32 rounded animate-pulse" style={{ background: "var(--border)" }} />
      </div>

      <div className="flex-1 overflow-y-auto px-7 py-6" style={{ background: "var(--bg-tinted)" }}>
        <div className="animate-pulse space-y-6">
          {/* KPI strip */}
          <div
            className="rounded-card border p-5 flex flex-wrap gap-x-10 gap-y-5"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-2.5 w-20 rounded" style={{ background: "var(--border)" }} />
                <div className="h-7 rounded" style={{ background: "var(--border)", width: i === 0 ? 160 : 90 }} />
              </div>
            ))}
          </div>

          {/* Trend chart */}
          <div
            className="rounded-card border p-5"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
          >
            <div className="h-3 w-40 rounded mb-5" style={{ background: "var(--border)" }} />
            <div className="h-56 rounded" style={{ background: "var(--bg-elevated)" }} />
          </div>

          {/* Breakdown row */}
          <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-card border p-5"
                style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
              >
                <div className="h-3 w-32 rounded mb-5" style={{ background: "var(--border)" }} />
                <div className="h-44 rounded" style={{ background: "var(--bg-elevated)" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
