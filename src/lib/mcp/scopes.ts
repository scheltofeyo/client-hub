import type { Session } from "next-auth";
import { MCP_TOOLS } from "./tools";
import { isTokenGrantable, type Permission } from "@/lib/permissions";
import { hasLeadPermission, hasPermission } from "@/lib/auth-helpers";

/**
 * OAuth scopes for the MCP server.
 *
 * A scope is just a hub permission string. There is no mapping table and no
 * parallel vocabulary on purpose: the tools already declare the permission each
 * one needs, `sessionFromOAuthToken` already intersects role ∩ scope, and an
 * `insufficient_scope` challenge can therefore name the same thing the tool's
 * own refusal message names. Inventing `logs:write` alongside `logs.create`
 * would buy nothing but a translation layer to keep in sync.
 *
 * Derived from MCP_TOOLS rather than hand-listed, so adding a tool with a new
 * permission widens the advertised scopes automatically.
 */
export const MCP_SCOPES: Permission[] = [
  ...new Set(
    MCP_TOOLS.map((tool) => tool.permission).filter(
      (permission): permission is Permission => !!permission && isTokenGrantable(permission)
    )
  ),
].sort();

/**
 * The subset of MCP_SCOPES that may also be delegated on the strength of
 * leading a client, rather than holding the permission outright.
 *
 * Derived from the `leadEligible` flag for the same reason MCP_SCOPES is derived
 * from `permission`: a future lead-eligible tool widens this on its own, and the
 * registry stays the single place the rule is written down.
 */
export const MCP_LEAD_SCOPES: Permission[] = [
  ...new Set(
    MCP_TOOLS.filter((tool) => tool.leadEligible)
      .map((tool) => tool.permission)
      .filter(
        (permission): permission is Permission => !!permission && isTokenGrantable(permission)
      )
  ),
].sort();

const LEAD = new Set<string>(MCP_LEAD_SCOPES);

/**
 * Whether this person may hand this scope to a connection.
 *
 * The one question the consent page and its decide route both ask, and the
 * reason they now ask it here: answering it with a bare hasPermission() meant a
 * lead-eligible scope could never enter a grant, so the lead-eligible tools were
 * reachable with a personal token and unreachable from a connector.
 *
 * Delegating on lead grounds is safe because sessionFromOAuthToken() builds the
 * two permission sets from different sources — the role for `permissions`, the
 * lead settings for `leadPermissions` — and intersects each with the grant. A
 * scope that got in on lead grounds therefore lands only in `leadPermissions`,
 * and the handler's own per-client check stays the binding one.
 */
export function mayDelegateScope(session: Session | null, scope: Permission): boolean {
  if (hasPermission(session, scope)) return true;
  return LEAD.has(scope) && hasLeadPermission(session, scope);
}

/**
 * Delegable, but only because this person leads clients — they do not hold the
 * permission globally. The consent screen groups on this so the narrower reach
 * is stated before anyone approves it, and the Integrations page labels with it.
 */
export function isLeadOnlyScope(session: Session | null, scope: Permission): boolean {
  return !hasPermission(session, scope) && mayDelegateScope(session, scope);
}

const KNOWN = new Set<string>(MCP_SCOPES);

/**
 * What every connection can do regardless of the scopes it was granted, in
 * plain language for the consent screen.
 *
 * `find_clients`, `list_prospects` and `list_client_logs` declare no permission
 * — not because a check was forgotten, but because the app has no read
 * permission to declare: `GET /api/clients` and the logbook `GET` are open to
 * any signed-in employee, and the tools mirror that exactly.
 *
 * The consent screen has to say so anyway. Without this line its list reads as
 * exhaustive while a connection scoped to, say, `logs.create` can still read
 * every client and every logbook entry — the user would be consenting to less
 * than they hand over. If a new tool is added without a permission, widen this
 * sentence to cover it.
 *
 * English to match its neighbours in the list, which come from
 * PERMISSION_GROUPS and are English app-wide. The surrounding page copy is
 * Dutch, but a list with one Dutch item among English ones reads as a mistake.
 */
export const BASELINE_ACCESS_LABEL = "Read clients, contacts and log entries";

/**
 * Keep only scopes this server actually offers.
 *
 * Unknown scopes are dropped rather than rejected. A client that asks for
 * something we do not have should get a working connection limited to what we
 * do have — which is also what the spec's "clients must not assume any
 * relationship to scopes_supported" guidance points at. Applied again when a
 * consent is redeemed, so a grant can only ever hold scopes that mean something
 * here.
 */
export function filterKnownScopes(scopes: string[]): Permission[] {
  return [...new Set(scopes.filter((s): s is Permission => KNOWN.has(s)))];
}

/** Parse an OAuth `scope` parameter — space-delimited, per RFC 6749. */
export function parseScopeParam(raw: string | null): Permission[] {
  if (!raw) return [];
  return filterKnownScopes(raw.split(/\s+/).filter(Boolean));
}
