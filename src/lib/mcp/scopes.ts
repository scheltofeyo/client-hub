import { MCP_TOOLS } from "./tools";
import { isTokenGrantable, type Permission } from "@/lib/permissions";

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
