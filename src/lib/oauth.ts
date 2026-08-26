import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Session } from "next-auth";
import { connectDB } from "./mongodb";
import { OAuthGrantModel } from "./models/OAuthGrant";
import { OAuthAuthCodeModel } from "./models/OAuthAuthCode";
import { UserModel } from "./models/User";
import { RoleModel } from "./models/Role";
import { getLeadSettings } from "./models/LeadSettings";
import { tokenGrantable } from "./permissions";

/**
 * The hub as its own OAuth 2.1 authorization server.
 *
 * The MCP spec lets the authorization server live either beside the resource
 * server or somewhere else entirely; hosting it here means the user step is the
 * Google login the team already has, with no second identity source to
 * reconcile against `User`.
 *
 * Tokens are opaque and stored only as hashes — never JWTs. That is what makes
 * the spec's hard rule ("only accept tokens issued for us, never transit
 * anything else") true by construction rather than by signature checking: a
 * token from another issuer is simply not in our collection. It also means a
 * revoked grant or an archived user stops working on the very next request,
 * because every call re-reads the grant, the user and the role.
 *
 * Deliberately NOT imported here: src/lib/mcp/tools.ts. It reaches
 * api-token.ts through the log/activity helpers, and api-token.ts imports this
 * module, so importing the tool registry would close a cycle. The routes that
 * need the advertised scope list read MCP_TOOLS themselves.
 */

/**
 * Access tokens are distinguishable from the personal `shub_` tokens at a
 * glance and, more importantly, unambiguously: a personal token is exactly
 * `shub_` followed by base64url, so it can never begin `shubo_` — the two
 * differ at index 4 ("_" vs "o"). Routing on the prefix is therefore exact,
 * not probabilistic.
 */
export const OAUTH_ACCESS_PREFIX = "shubo_";
export const OAUTH_REFRESH_PREFIX = "shubr_";

/** Short-lived by convention; revocation does not depend on it. */
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
/** Long enough to survive the gap between two working days. */
const AUTH_CODE_TTL_MS = 60 * 1000;
/** A consent form left open longer than this has to be restarted. */
const CONSENT_TTL_MS = 10 * 60 * 1000;
/** Matches the personal-token path: a stale lastUsedAt beats a write per call. */
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000;

/**
 * sha256, deliberately not bcrypt — same reasoning as the personal tokens.
 * The secret is 32 bytes of CSPRNG output, so there is no guessable input to
 * slow an attacker down on, and this runs on every authenticated request.
 */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function randomSecret(prefix: string): string {
  return prefix + randomBytes(32).toString("base64url");
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// ── Origin and resource identity ─────────────────────────────────────

/**
 * The origin this request arrived on, which is also our OAuth issuer.
 *
 * Read off the request rather than from APP_URL on purpose: a Netlify deploy
 * preview serves the same code from a different host, and RFC 8414 requires the
 * issuer to match the origin the client fetched the metadata from. Pinning it
 * to the production URL would make discovery fail on every preview.
 */
export function hubOrigin(headerList: Headers): string {
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (host) {
    const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
    const proto = headerList.get("x-forwarded-proto") ?? (local ? "http" : "https");
    return `${proto}://${host}`;
  }
  const configured = process.env.AUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  return configured.replace(/\/+$/, "");
}

/**
 * The canonical URI of the MCP server, in RFC 8707 terms. Clients send this as
 * the `resource` parameter and we bind every grant to it, so a token minted for
 * this hub cannot be presented to some other resource and vice versa.
 */
export function mcpResource(origin: string): string {
  return `${origin}/api/mcp`;
}

export function protectedResourceMetadataUrl(origin: string): string {
  return `${origin}/.well-known/oauth-protected-resource/api/mcp`;
}

/**
 * Whether a client's `resource` parameter names this MCP server.
 *
 * The spec asks clients to send the most specific URI they can and to prefer
 * the form without a trailing slash, but a client that names the bare origin is
 * still pointing at us, so both are accepted. Anything else is refused — that
 * refusal is the audience check the spec demands, applied at issue time.
 */
export function resourceMatches(resource: string | null, origin: string): boolean {
  if (!resource) return false;
  const normalized = resource.replace(/\/+$/, "").toLowerCase();
  return normalized === mcpResource(origin).toLowerCase() || normalized === origin.toLowerCase();
}

// ── PKCE ─────────────────────────────────────────────────────────────

/** S256 only. `plain` is allowed by neither OAuth 2.1 nor this server. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!verifier || verifier.length < 43 || verifier.length > 128) return false;
  const computed = createHash("sha256").update(verifier).digest("base64url");
  return constantTimeEquals(computed, challenge);
}

// ── Consent hand-off ─────────────────────────────────────────────────

interface ConsentPayload {
  userId: string;
  clientId: string;
  clientName: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  resource: string;
  state?: string;
  exp: number;
}

function consentSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required to sign OAuth consent");
  return secret;
}

/**
 * The consent screen hands its parameters to the decide endpoint through one
 * signed blob rather than a fistful of hidden inputs.
 *
 * Two problems solved at once. Hidden inputs are user-editable, so a form post
 * could otherwise claim scopes or a redirect target the user never saw; and a
 * bare POST endpoint would be forgeable from another site, letting a page grant
 * a connector on a signed-in user's behalf. An HMAC over the whole set, bound
 * to the specific user, makes both impossible without keeping server-side
 * state. The decide endpoint still re-validates everything against the DB —
 * this stops tampering, it does not replace authorization.
 */
export function signConsent(payload: Omit<ConsentPayload, "exp">): string {
  const body: ConsentPayload = { ...payload, exp: Date.now() + CONSENT_TTL_MS };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const mac = createHmac("sha256", consentSecret()).update(encoded).digest("base64url");
  return `${encoded}.${mac}`;
}

export function verifyConsent(token: string): ConsentPayload | null {
  const [encoded, mac] = token.split(".");
  if (!encoded || !mac) return null;
  const expected = createHmac("sha256", consentSecret()).update(encoded).digest("base64url");
  if (!constantTimeEquals(expected, mac)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as ConsentPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Authorization codes ──────────────────────────────────────────────

/** Mint a single-use code for an approved consent. Returns the raw code. */
export async function issueAuthCode(payload: {
  userId: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  resource: string;
}): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  await connectDB();
  await OAuthAuthCodeModel.create({
    ...payload,
    codeHash: sha256Hex(code),
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
  });
  return code;
}

/**
 * Claim a code, atomically. The `usedAt: null` filter is the whole point: two
 * exchanges racing on the same code produce one winner and one `invalid_grant`,
 * so a leaked code cannot be redeemed twice.
 */
export async function claimAuthCode(code: string) {
  await connectDB();
  const doc = await OAuthAuthCodeModel.findOneAndUpdate(
    { codeHash: sha256Hex(code), usedAt: null },
    { $set: { usedAt: new Date().toISOString() } },
    { new: false }
  ).lean();
  if (!doc) return null;
  // The TTL monitor only sweeps about once a minute, so expiry is enforced here
  // rather than trusted to Mongo.
  if (doc.expiresAt.getTime() < Date.now()) return null;
  return doc;
}

// ── Grants and tokens ────────────────────────────────────────────────

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scopes: string[];
}

/**
 * Create or replace the grant for one (user, client) pair and hand back a fresh
 * token pair. Used both by the code exchange and by refresh, so rotation and
 * first issue cannot drift apart.
 */
export async function issueTokens(params: {
  userId: string;
  clientId: string;
  clientName: string;
  scopes: string[];
  resource: string;
}): Promise<IssuedTokens> {
  const accessToken = randomSecret(OAUTH_ACCESS_PREFIX);
  const refreshToken = randomSecret(OAUTH_REFRESH_PREFIX);
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS).toISOString();

  await connectDB();
  await OAuthGrantModel.findOneAndUpdate(
    { userId: params.userId, clientId: params.clientId },
    {
      $set: {
        clientName: params.clientName,
        scopes: params.scopes,
        resource: params.resource,
        accessTokenHash: sha256Hex(accessToken),
        accessTokenExpiresAt: expiresAt,
        refreshTokenHash: sha256Hex(refreshToken),
        // Re-authorizing a previously revoked connection revives it, which is
        // what a user who just clicked "Allow" expects.
        revokedAt: null,
      },
    },
    { upsert: true, new: true }
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    scopes: params.scopes,
  };
}

/** The grant a refresh token belongs to, or null if it is spent or revoked. */
export async function grantForRefreshToken(raw: string) {
  if (!raw.startsWith(OAUTH_REFRESH_PREFIX)) return null;
  await connectDB();
  const doc = await OAuthGrantModel.findOne({ refreshTokenHash: sha256Hex(raw) }).lean();
  if (!doc || doc.revokedAt) return null;
  return doc;
}

/**
 * Revoke by either token. RFC 7009 asks the endpoint to accept an access or a
 * refresh token and to stay quiet about which, so both lookups live here.
 */
export async function revokeByToken(raw: string): Promise<boolean> {
  await connectDB();
  const hash = sha256Hex(raw);
  const res = await OAuthGrantModel.updateOne(
    { $or: [{ accessTokenHash: hash }, { refreshTokenHash: hash }], revokedAt: null },
    { $set: { revokedAt: new Date().toISOString() } }
  );
  return res.modifiedCount > 0;
}

// ── Resolving an access token into a Session ─────────────────────────

function intersect(granted: string[], scopes: string[]): string[] {
  const allowed = new Set(scopes);
  return granted.filter((p) => allowed.has(p));
}

/**
 * What a grant's scopes actually amount to for one person.
 *
 * The two sets come from different sources on purpose, and that is what makes
 * delegating a lead-eligible scope safe: `permissions` can only ever contain
 * what the *role* holds, so a scope delegated on the strength of leading a
 * client lands in `leadPermissions` alone and confers nothing globally.
 *
 * Exported because the Integrations page has to answer "what can this
 * connection reach" without minting a token — and answering it with a second
 * copy of this arithmetic is how the page ends up disagreeing with the server.
 */
export function grantPermissions(
  rolePermissions: string[],
  leadPermissions: string[],
  scopes: string[]
): { permissions: string[]; leadPermissions: string[] } {
  return {
    permissions: tokenGrantable(intersect(rolePermissions, scopes)),
    leadPermissions: tokenGrantable(intersect(leadPermissions, scopes)),
  };
}

/**
 * Turn an OAuth access token into the same Session shape every route already
 * expects — the counterpart of sessionFromApiToken for the OAuth path.
 *
 * The permission maths is deliberately identical to the personal-token path
 * (role ∩ scope, then tokenGrantable), with one difference: an empty scope set
 * means empty, not "inherit everything". A personal token with no scope was
 * created by its owner as a general-purpose credential; an OAuth grant's scopes
 * are what the user was actually shown and approved, so widening them here
 * would grant access nobody consented to.
 *
 * Nothing is cached. That costs two indexed lookups per request and buys
 * immediate revocation — pull the grant or archive the user and the very next
 * call fails.
 */
export async function sessionFromOAuthToken(raw: string): Promise<Session | null> {
  await connectDB();

  const grant = await OAuthGrantModel.findOne({ accessTokenHash: sha256Hex(raw) }).lean();
  if (!grant) return null;

  // The lookup already matched a hash of the full secret; this guards the
  // theoretical case of a collision in the index.
  if (!constantTimeEquals(grant.accessTokenHash, sha256Hex(raw))) return null;

  if (grant.revokedAt) return null;
  if (grant.accessTokenExpiresAt <= new Date().toISOString()) return null;

  const user = await UserModel.findById(grant.userId, {
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

  const now = new Date().toISOString();
  if (!grant.lastUsedAt || Date.now() - Date.parse(grant.lastUsedAt) > LAST_USED_THROTTLE_MS) {
    OAuthGrantModel.updateOne({ _id: grant._id }, { $set: { lastUsedAt: now } }).catch(() => {});
  }

  return {
    user: {
      id: grant.userId,
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
      role: user.role ?? "member",
      ...grantPermissions(role?.permissions ?? [], leadPerms ?? [], grant.scopes),
      seenWhatsNewIds: [],
    },
    expires: grant.accessTokenExpiresAt,
  };
}

/**
 * Name of the connected app behind this access token, for the "via" marker on
 * records it writes. Mirrors activeTokenName() on the personal-token path.
 */
export async function oauthClientName(raw: string): Promise<string | null> {
  await connectDB();
  const grant = await OAuthGrantModel.findOne(
    { accessTokenHash: sha256Hex(raw) },
    { clientName: 1 }
  ).lean();
  return grant?.clientName ?? null;
}

/**
 * Whether a refusal is a *scope gap* — the person holds this permission but did
 * not delegate it to this connection — as opposed to a role that never had it.
 *
 * The distinction decides how the MCP endpoint refuses. A scope gap is fixable
 * by re-consenting, so it is worth sending the client through the spec's
 * step-up flow; a missing role permission is not, and sending someone around
 * the whole OAuth loop only to be refused again would be a worse experience
 * than a plain sentence saying so.
 *
 * Only reached on the refusal path, so the two lookups cost nothing in normal
 * operation.
 */
export async function isScopeGap(raw: string, permission: string): Promise<boolean> {
  await connectDB();
  const grant = await OAuthGrantModel.findOne(
    { accessTokenHash: sha256Hex(raw) },
    { scopes: 1, userId: 1 }
  ).lean();
  if (!grant || grant.scopes.includes(permission)) return false;

  const user = await UserModel.findById(grant.userId, { role: 1 }).lean();
  if (!user) return false;
  const [role, leadPerms] = await Promise.all([
    RoleModel.findOne({ slug: user.role }, { permissions: 1 }).lean(),
    getLeadSettings(),
  ]);

  // Lead permissions count here too, now that they can be delegated: without
  // this a lead who simply has not re-consented would be told their role never
  // had the permission — wrong, and a dead end instead of a step-up.
  return (
    (role?.permissions ?? []).includes(permission) || (leadPerms ?? []).includes(permission)
  );
}
