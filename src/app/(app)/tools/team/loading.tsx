export default function TeamLoading() {
  const numDays = 30;

  return (
    <div className="flex flex-col h-full overflow-hidden animate-pulse">
      {/* PageHeader skeleton */}
      <div className="px-7 pt-6 pb-0 shrink-0">
        {/* Breadcrumb */}
        <div className="mb-2">
          <div className="h-3 w-10 rounded" style={{ background: "var(--border)" }} />
        </div>
        {/* Title */}
        <div className="h-6 w-20 rounded" style={{ background: "var(--border)" }} />
        {/* Tertiary nav tabs */}
        <div className="flex gap-4 mt-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="h-3.5 w-20 rounded mb-3" style={{ background: "var(--border)" }} />
          <div className="h-3.5 w-20 rounded mb-3" style={{ background: "var(--border)" }} />
        </div>
      </div>

      {/* Calendar content */}
      <div className="flex-1 overflow-y-auto px-7 pb-7 pt-5">
        {/* Month navigator */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-7 h-7 rounded-lg" style={{ background: "var(--border)" }} />
          <div className="w-7 h-7 rounded-lg" style={{ background: "var(--border)" }} />
          <div className="h-4 w-28 rounded" style={{ background: "var(--border)" }} />
        </div>

        {/* Calendar grid skeleton */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
        >
          {/* Header row — day letters */}
          <div className="flex" style={{ borderBottom: "1px solid var(--border)" }}>
            <div
              className="shrink-0"
              style={{ width: 220, minWidth: 220, borderRight: "1px solid var(--border)" }}
            />
            <div className="flex-1 flex">
              {Array.from({ length: numDays }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 py-2 flex flex-col items-center gap-0.5"
                  style={{ borderLeft: "1px solid color-mix(in srgb, var(--border) 50%, transparent)" }}
                >
                  <div className="h-2.5 w-2.5 rounded" style={{ background: "var(--border)" }} />
                  <div className="h-3 w-3 rounded" style={{ background: "var(--border)" }} />
                </div>
              ))}
            </div>
          </div>

          {/* User rows */}
          {Array.from({ length: 6 }).map((_, rowIdx) => (
            <div
              key={rowIdx}
              className="flex"
              style={{ borderBottom: rowIdx < 5 ? "1px solid var(--border)" : undefined }}
            >
              {/* Name cell */}
              <div
                className="shrink-0 flex items-center gap-2.5 px-3 py-2.5"
                style={{ width: 220, minWidth: 220, borderRight: "1px solid var(--border)" }}
              >
                <div className="w-6 h-6 rounded-full flex-none" style={{ background: "var(--border)" }} />
                <div className="h-3 rounded flex-none" style={{ background: "var(--border)", width: `${80 + rowIdx * 10}px` }} />
              </div>
              {/* Day cells */}
              <div className="flex-1 flex">
                {Array.from({ length: numDays }).map((_, colIdx) => (
                  <div
                    key={colIdx}
                    className="flex-1 py-2.5"
                    style={{ borderLeft: "1px solid color-mix(in srgb, var(--border) 50%, transparent)" }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
