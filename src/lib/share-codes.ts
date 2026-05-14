/** Generate an 8-character URL-safe share code (no ambiguous chars). */
export function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/**
 * Generate a share code that does not collide with an existing one.
 * Pass an `exists` predicate that resolves to a truthy value when the code is taken
 * (typically `(code) => SomeModel.exists({ shareCode: code })`).
 */
export async function ensureUniqueShareCode(
  exists: (code: string) => Promise<unknown>,
  maxAttempts = 20
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateShareCode();
    if (!(await exists(code))) return code;
  }
  throw new Error("Could not generate unique share code");
}
