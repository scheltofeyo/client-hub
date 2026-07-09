/**
 * Stale-chunk auto-recovery for the client error boundaries.
 *
 * After a deploy, a browser (or a not-yet-purged CDN node) can still be running
 * an HTML document from the previous build, whose content-hashed JS chunks the
 * new build has already replaced. Loading one of those now-missing chunks throws
 * a `ChunkLoadError` during hydration, which bubbles all the way to the root and
 * shows the "De applicatie kon niet starten" screen. A hard reload fixes it by
 * fetching the current build's document — so we do exactly that, automatically.
 *
 * Loop-safe: the reload timestamp is recorded in sessionStorage and a second
 * chunk error within COOLDOWN_MS does NOT reload (so a genuinely broken build
 * shows the error screen instead of reloading forever). Self-clearing: after the
 * cooldown a future deploy's chunk error recovers again with no manual cleanup.
 */
const RELOAD_KEY = "summ:chunk-reload-at";
const COOLDOWN_MS = 20_000;

function isStaleChunkError(error: { name?: string; message?: string } | undefined): boolean {
  if (!error) return false;
  const haystack = `${error.name ?? ""} ${error.message ?? ""}`;
  return (
    error.name === "ChunkLoadError" ||
    /Loading chunk|Loading CSS chunk|dynamically imported module|Failed to fetch dynamically imported|Importing a module script failed/i.test(
      haystack
    )
  );
}

/**
 * If `error` looks like a post-deploy stale-chunk failure, trigger a one-shot
 * hard reload and return true (the caller can keep rendering its fallback UI in
 * the meantime — the navigation supersedes it). Returns false when the error is
 * not chunk-related or a reload was already attempted within the cooldown.
 */
export function attemptStaleChunkRecovery(error: { name?: string; message?: string } | undefined): boolean {
  if (typeof window === "undefined") return false;
  if (!isStaleChunkError(error)) return false;

  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Number.isFinite(last) && Date.now() - last < COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable (some private-mode contexts) — fall through and
    // still attempt a single reload; without the guard we accept the small risk
    // rather than leaving the user stranded on the error screen.
  }

  window.location.reload();
  return true;
}
