// Scheduled keep-warm. Netlify scheduled functions run ONLY on the published
// production deploy (never on previews/branch deploys), on a UTC cron.
// Fetching through the public site URL warms the shared Next.js SSR function
// and its Atlas connection pool, so the first real request after an idle
// period doesn't pay the cold start + cold DB dial.
import { createHash } from "node:crypto";

const warmup = async () => {
  const base = process.env.URL; // Netlify-provided production site URL
  if (!base) return;
  // Shared-secret handshake derived from AUTH_SECRET (same site env) — twin
  // derivation lives in src/app/api/internal/warmup/route.ts.
  const key = createHash("sha256").update(`${process.env.AUTH_SECRET}:warmup`).digest("hex");
  try {
    await fetch(`${base}/api/internal/warmup`, {
      headers: { "x-warmup-key": key },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Best-effort: even if this fetch times out on a cold start, the SSR
    // invocation it triggered keeps running and completes the warm.
  }
};

export default warmup;

// UTC cron: every 10 min, 05:00–16:59 UTC on weekdays — roughly 07:00–18:59
// CEST / 06:00–17:59 CET working hours. Adjust to taste.
export const config = { schedule: "*/10 5-16 * * 1-5" };
