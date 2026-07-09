import { createHash } from "node:crypto";

// Best-effort post-deploy keep-warm. The scheduled function
// (netlify/functions/warmup.mts) covers steady-state idle gaps, but the very
// first request right after a fresh production deploy is guaranteed to hit a
// cold SSR function + cold Atlas dial (an ~8s first paint). onSuccess runs once
// the deploy is live, so a few pings here boot the shared instance and its
// Mongoose pool before a real user arrives.
//
// Twin secret derivation lives in src/app/api/internal/warmup/route.ts.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const onSuccess = async ({ utils }) => {
  // Production deploys only — previews/branch deploys have their own cold
  // functions and no real users waiting on them.
  if (process.env.CONTEXT !== "production") return;

  const base = process.env.URL;
  const secret = process.env.AUTH_SECRET;
  if (!base || !secret) {
    console.log("[warmup-on-deploy] skipped: missing URL or AUTH_SECRET");
    return;
  }

  const key = createHash("sha256").update(`${secret}:warmup`).digest("hex");

  // Ping a few times over ~30s: the first call pays (and thereby absorbs) the
  // cold boot + DB dial, later calls confirm the instance stays warm. Failures
  // are swallowed — this must never fail a deploy.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${base}/api/internal/warmup`, {
        headers: { "x-warmup-key": key },
        signal: AbortSignal.timeout(15_000),
      });
      const body = await res.text();
      console.log(`[warmup-on-deploy] attempt ${attempt}: ${res.status} ${body}`);
      if (res.ok) break;
    } catch (err) {
      console.log(`[warmup-on-deploy] attempt ${attempt} failed: ${err?.message ?? err}`);
    }
    if (attempt < 3) await sleep(12_000);
  }

  utils?.status?.show?.({
    title: "Post-deploy warmup",
    summary: "Pinged the keep-warm endpoint to prime the SSR function + DB pool.",
  });
};
