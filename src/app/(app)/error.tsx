"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console so Netlify Functions logs capture it. The digest is the
    // server-side correlation id for matching this client display to the
    // function-side stack.
    console.error("App error boundary:", error.digest, error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div
        className="max-w-md w-full rounded-card p-6 text-center"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <h1 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
          Er ging iets mis
        </h1>
        <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
          De pagina kon niet worden geladen. Vaak is dit een tijdelijke
          hapering — probeer het opnieuw.
        </p>
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={reset} className="btn-primary px-3 py-1.5 rounded-button text-sm">
            Opnieuw proberen
          </button>
          <Link href="/dashboard" className="btn-border border px-3 py-1.5 rounded-button text-sm">
            Terug naar dashboard
          </Link>
        </div>
        {error.digest && (
          <p className="text-[11px] mt-4" style={{ color: "var(--text-muted)" }}>
            Foutcode: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
