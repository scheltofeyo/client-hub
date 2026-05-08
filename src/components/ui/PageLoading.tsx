type Variant = "default" | "list" | "cards";

export default function PageLoading({ variant = "default" }: { variant?: Variant }) {
  return (
    <div className="flex flex-col h-full overflow-hidden animate-pulse">
      <div
        className="px-7 pt-6 pb-5 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <nav className="flex items-center gap-1.5 mb-2">
          <div className="h-3 w-12 rounded" style={{ background: "var(--border)" }} />
          <div className="h-3 w-2 rounded" style={{ background: "var(--border)" }} />
          <div className="h-3 w-20 rounded" style={{ background: "var(--border)" }} />
        </nav>

        <div className="flex items-center justify-between">
          <div className="h-6 w-40 rounded" style={{ background: "var(--border)" }} />
          <div className="h-8 w-24 rounded-lg" style={{ background: "var(--border)" }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-7 pt-7 pb-7">
        {variant === "cards" ? <CardsBody /> : variant === "list" ? <ListBody /> : <DefaultBody />}
      </div>
    </div>
  );
}

function DefaultBody() {
  return (
    <div className="space-y-3">
      {[80, 65, 72, 55, 68, 45, 70].map((w, i) => (
        <div
          key={i}
          className="h-4 rounded"
          style={{ background: "var(--border)", width: `${w}%` }}
        />
      ))}
    </div>
  );
}

function ListBody() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border h-12 flex items-center gap-3 px-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="w-5 h-5 rounded shrink-0" style={{ background: "var(--border)" }} />
          <div
            className="h-3.5 rounded"
            style={{ background: "var(--border)", width: `${[60, 45, 70, 50, 65, 40, 55, 48][i]}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function CardsBody() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="h-10" style={{ background: "var(--border)" }} />
          <div className="p-4 space-y-2.5">
            <div className="h-4 w-3/5 rounded" style={{ background: "var(--border)" }} />
            <div className="flex gap-1.5">
              <div className="h-5 w-16 rounded-full" style={{ background: "var(--border)" }} />
              <div className="h-5 w-20 rounded-full" style={{ background: "var(--border)" }} />
            </div>
            <div className="h-3 w-1/3 rounded" style={{ background: "var(--border)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
