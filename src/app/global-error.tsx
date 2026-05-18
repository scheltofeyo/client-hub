"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary that catches errors thrown above the (app) layout
 * (root layout, themes script, etc). Next 15 requires this file to render
 * its own <html> and <body> because the root layout itself may have failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary:", error.digest, error);
  }, [error]);

  return (
    <html lang="nl">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#f5f5f7",
          color: "#1d1d1f",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: "420px",
            width: "100%",
            background: "#fff",
            border: "1px solid #e5e5ea",
            borderRadius: "12px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 8px" }}>Er ging iets mis</h1>
          <p style={{ fontSize: "14px", color: "#6e6e73", margin: "0 0 16px" }}>
            De applicatie kon niet starten. Probeer de pagina te verversen.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              background: "#7c3aed",
              color: "#fff",
              border: "none",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Opnieuw proberen
          </button>
        </div>
      </body>
    </html>
  );
}
