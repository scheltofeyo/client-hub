/**
 * Retry a database operation once on transient MongoDB errors.
 *
 * Use this for hot read paths where a brief Atlas blip would otherwise turn
 * into a 500. We retry only on the two error classes that indicate a network
 * or replica-selection issue — everything else (validation, cast, write
 * conflict, etc.) re-throws immediately so we don't paper over real bugs.
 *
 * Default: retry once after a 200ms backoff. That matches a typical Atlas
 * failover and is short enough that even a doubled wait stays under our
 * 5s serverSelectionTimeoutMS budget.
 */

const TRANSIENT_ERROR_NAMES = new Set([
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoServerSelectionError",
  "MongoServerClosedError",
  "MongoTopologyClosedError",
]);

function isTransient(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: unknown }).name;
  return typeof name === "string" && TRANSIENT_ERROR_NAMES.has(name);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; delayMs?: number } = {}
): Promise<T> {
  const retries = opts.retries ?? 1;
  const delayMs = opts.delayMs ?? 200;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === retries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  // Unreachable — the loop above either returns or throws — but TS needs it.
  throw lastErr;
}
