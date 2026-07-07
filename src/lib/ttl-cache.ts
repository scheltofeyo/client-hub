/**
 * Per-warm-instance TTL memo for reference data that changes ~never
 * (archetypes, services, event/leave types, status/platform options, project
 * labels, log signals). React cache() only dedupes within one request; this
 * adds cross-request reuse on a warm serverless instance, taking those
 * collections off the per-render DB hot path entirely.
 *
 * Staleness tradeoff: admin edits to these lists become visible on OTHER warm
 * instances within ttlMs (default 60s) — accepted for near-static admin-only
 * lists. Callers MUST treat cached docs as immutable (they are shared across
 * requests). Rejected promises are evicted immediately, never cached.
 */

type Entry = { value: Promise<unknown>; expiresAt: number };

const store = new Map<string, Entry>();

export function ttlCached<T>(key: string, fn: () => Promise<T>, ttlMs = 60_000): () => Promise<T> {
  return () => {
    const hit = store.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value as Promise<T>;
    const value = fn();
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
    value.catch(() => {
      if (store.get(key)?.value === value) store.delete(key);
    });
    return value;
  };
}

/** Evict one key early (same-instance only — e.g. after an admin mutation). */
export function invalidateTtl(key: string) {
  store.delete(key);
}
