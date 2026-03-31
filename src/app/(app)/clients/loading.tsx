function SkeletonClientCard() {
  return (
    <div
      className="flex flex-col rounded-2xl border overflow-hidden animate-pulse"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      {/* Coloured top banner */}
      <div className="h-10" style={{ background: "var(--border)" }} />

      <div className="flex flex-col gap-2.5 px-4 pt-8 pb-4">
        {/* Company name */}
        <div className="h-4 w-3/5 rounded" style={{ background: "var(--border)" }} />

        {/* Badge row */}
        <div className="flex gap-1.5">
          <div className="h-5 w-16 rounded-full" style={{ background: "var(--border)" }} />
          <div className="h-5 w-20 rounded-full" style={{ background: "var(--border)" }} />
        </div>

        <div className="border-t" style={{ borderColor: "var(--border)" }} />

        {/* Bottom row */}
        <div className="flex items-center justify-between">
          <div className="h-3 w-16 rounded" style={{ background: "var(--border)" }} />
          <div className="flex gap-1">
            <div className="w-6 h-6 rounded-full" style={{ background: "var(--border)" }} />
            <div className="w-6 h-6 rounded-full -ml-1.5" style={{ background: "var(--border)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClientsLoading() {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-5 w-24 rounded" style={{ background: "var(--border)" }} />
          <div className="h-3.5 w-16 rounded" style={{ background: "var(--border)" }} />
        </div>
        <div className="h-8 w-28 rounded-lg" style={{ background: "var(--border)" }} />
      </div>

      {/* Filter chips placeholder */}
      <div className="flex gap-2 mb-6 animate-pulse">
        <div className="h-3.5 w-10 rounded" style={{ background: "var(--border)" }} />
        <div className="h-6 w-16 rounded-full" style={{ background: "var(--border)" }} />
        <div className="h-6 w-20 rounded-full" style={{ background: "var(--border)" }} />
        <div className="h-6 w-14 rounded-full" style={{ background: "var(--border)" }} />
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonClientCard key={i} />
        ))}
      </div>
    </div>
  );
}
