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

// UTC cron: every 5 min, 04:00–20:59 UTC on weekdays — roughly 06:00–22:59
// CEST / 05:00–21:59 CET, comfortably covering early-start and late-finish
// working hours. Every 5 min (was 10) halves the worst-case idle window a real
// request can fall into after the pooled instance has scaled down. Netlify
// scheduled functions run only on the published production deploy.
export const config = { schedule: "*/5 4-20 * * 1-5" };
