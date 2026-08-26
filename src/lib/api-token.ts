import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import type { Session } from "next-auth";
import { connectDB } from "./mongodb";
import { ApiTokenModel } from "./models/ApiToken";
import { UserModel } from "./models/User";
import { RoleModel } from "./models/Role";
import { getLeadSettings } from "./models/LeadSettings";
import { tokenGrantable } from "./permissions";
import {
  OAUTH_ACCESS_PREFIX,
  oauthClientName,
  sessionFromOAuthToken,
} from "./oauth";

const TOKEN_PREFIX = "shub_";
const PREFIX_DISPLAY_LENGTH = TOKEN_PREFIX.length + 6;
/** Don't write lastUsedAt on every single call — once per window is enough. */
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000;

/**
 * sha256, deliberately not bcrypt. The secret is 32 bytes of CSPRNG output, so
 * there is nothing to brute-force, and this runs on every authenticated
 * request — a deliberately slow hash would be a per-request tax for no gain.
 */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateApiToken(): { raw: string; tokenHash: string; prefix: string } {
  const raw = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return { raw, tokenHash: hashToken(raw), prefix: raw.slice(0, PREFIX_DISPLAY_LENGTH) };
}

// ── Identifying the calling token ────────────────────────────────────
// Two request-scoped context mechanisms were tried here and both failed for
// the same structural reason: auth() is awaited from inside the route handler,
// so anything it sets (React cache(), AsyncLocalStorage.enterWith) is invisible
// to the caller's continuation, which resumes in the context captured before
// the call. Reading the header back is stateless and cannot break that way.

/**
 * The raw bearer token on the current request, if any — a personal API token
 * or an OAuth access token.
 *
 * Both kinds are reported here on purpose. Every caller of this function is
 * asking "did this request arrive over a machine credential rather than a
 * browser session?", and the answer is yes for both: it is what keeps an OAuth
 * connector out of the token-management endpoints, and what makes the "via"
 * attribution fire for connector writes.
 */
export async function bearerFromHeaders(): Promise<string | null> {
  try {
    const value = (await headers()).get("authorization");
    if (!value?.startsWith("Bearer ")) return null;
    const raw = value.slice(7).trim();
    return isHubToken(raw) ? raw : null;
  } catch {
    // headers() throws outside a request scope.
    return null;
  }
}

/**
 * The two prefixes are mutually exclusive rather than merely unlikely to
 * collide: a personal token is exactly `shub_` + base64url, so it can never
 * begin `shubo_` — they differ at index 4 ("_" vs "o"). Routing on the prefix
 * is therefore exact.
 */
function isHubToken(raw: string): boolean {
  return raw.startsWith(TOKEN_PREFIX) || raw.startsWith(OAUTH_ACCESS_PREFIX);
}

/**
 * How this request arrived, for the "via" marker on anything it writes: the
 * name of the personal API token, or the name of the connected app for an
 * OAuth caller, or null for a normal browser session. Costs one indexed lookup,
 * and only on requests that both use a credential and record activity, so it
 * stays off the hot path.
 */
export async function activeTokenName(): Promise<string | null> {
  const raw = await bearerFromHeaders();
  if (!raw) return null;
  if (raw.startsWith(OAUTH_ACCESS_PREFIX)) return oauthClientName(raw);
  await connectDB();
  const doc = await ApiTokenModel.findOne({ tokenHash: hashToken(raw) }, { name: 1 }).lean();
  return doc?.name ?? null;
}

function intersect(granted: string[], allowed?: string[] | null): string[] {
  if (!allowed || allowed.length === 0) return granted;
  const allowedSet = new Set(allowed);
  return granted.filter((p) => allowedSet.has(p));
}

/**
 * Resolve a raw bearer credential into a Session, or null if it is unusable for
 * any reason.
 *
 * Two kinds arrive here and they are told apart by prefix, exactly (see
 * isHubToken). An OAuth access token hands off to sessionFromOAuthToken, which
 * does the same job against a grant; everything below this line is the personal
 * API token path, unchanged.
 *
 * Unlike the JWT path (which caches its claims for 15 minutes), both re-read
 * the credential, the user and the role on every request. That costs one indexed
 * lookup but makes revocation, expiry and archiving take effect immediately.
 */
export async function sessionFromApiToken(raw: string): Promise<Session | null> {
  if (raw.startsWith(OAUTH_ACCESS_PREFIX)) return sessionFromOAuthToken(raw);

  await connectDB();

  const doc = await ApiTokenModel.findOne({ tokenHash: hashToken(raw) }).lean();
  if (!doc) return null;

  // The lookup already matched on a hash of the full secret; this guards the
  // theoretical case of a hash collision in the index.
  const expected = Buffer.from(doc.tokenHash);
  const actual = Buffer.from(hashToken(raw));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  if (doc.revokedAt) return null;
  if (doc.expiresAt && doc.expiresAt <= new Date().toISOString()) return null;

  const user = await UserModel.findById(doc.userId, {
    name: 1,
    email: 1,
    image: 1,
    role: 1,
    status: 1,
  }).lean();
  if (!user || user.status !== "active") return null;

  const [role, leadPerms] = await Promise.all([
    RoleModel.findOne({ slug: user.role }).lean(),
    getLeadSettings(),
  ]);

  // Fire-and-forget, throttled: a stale lastUsedAt is far cheaper than a write
  // on every request.
  const now = new Date().toISOString();
  if (!doc.lastUsedAt || Date.now() - Date.parse(doc.lastUsedAt) > LAST_USED_THROTTLE_MS) {
    ApiTokenModel.updateOne({ _id: doc._id }, { $set: { lastUsedAt: now } }).catch(() => {});
  }

  return {
    user: {
      id: doc.userId,
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
      role: user.role ?? "member",
      // tokenGrantable last: the admin surface is stripped even from a token
      // that was created without an explicit scope.
      permissions: tokenGrantable(intersect(role?.permissions ?? [], doc.permissions)),
      leadPermissions: tokenGrantable(intersect(leadPerms ?? [], doc.permissions)),
      seenWhatsNewIds: [],
    },
    expires: doc.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}
